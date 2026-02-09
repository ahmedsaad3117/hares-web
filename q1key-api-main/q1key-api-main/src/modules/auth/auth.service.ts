import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { UsersService } from "../users/users.service";
import { LoginDto } from "./dto/login.dto";
import { JwtPayload } from "./interfaces/jwt-payload.interface";
import { MonitoringService } from "../../common/monitoring";

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private monitoringService: MonitoringService,
  ) { }

  /**
   * Main login method
   * Generates both Access and Refresh tokens
   */
  async login(loginDto: LoginDto, ip: string = "unknown") {
    // Find user by email or phone
    const user = await this.usersService.findByEmailOrPhone(
      loginDto.identifier,
    );

    if (!user) {
      this.monitoringService.logAuthFailure(
        loginDto.identifier,
        ip,
        "User not found",
      );
      throw new UnauthorizedException("Invalid credentials");
    }

    if (!user.isActive) {
      this.monitoringService.logAuthFailure(
        loginDto.identifier,
        ip,
        "Account deactivated",
      );
      throw new UnauthorizedException("Account is deactivated");
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      this.monitoringService.logAuthFailure(
        loginDto.identifier,
        ip,
        "Invalid password",
      );
      throw new UnauthorizedException("Invalid credentials");
    }

    // --- SUBSCRIPTION EXPIRATION CHECK ---
    // Block login for non-Super Admin users if their institution/branch subscription has expired
    // This ensures users can only create NEW sessions if subscription is valid
    // Active sessions are NOT affected (checked only at login time)
    if (user.role.roleName !== "Super Admin") {
      const expirationDate =
        user.branch?.expirationDate || user.institution?.expirationDate;

      if (expirationDate) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const expDate = new Date(expirationDate);
        expDate.setHours(23, 59, 59, 999); // End of expiration day

        if (today > expDate) {
          this.monitoringService.logAuthFailure(
            loginDto.identifier,
            ip,
            "Subscription expired (Login allowed - restricted state)",
          );
          console.log(
            `[Auth] Login allowed for EXPIRED user ${loginDto.identifier} (Status restricted)`,
          );
          // throw new UnauthorizedException('SUBSCRIPTION_EXPIRED'); // DISABLED per new plan
        }
      }
    }

    // --- Session Restriction Logic ---
    // If user has an active session and was active within the last 15 minutes, block new login
    // This implements the requested "No concurrent login unless logged out or 15 mins idle" rule.
    if (user.activeSessionId && user.lastActivityAt) {
      const now = new Date();
      const lastActivity = new Date(user.lastActivityAt);
      const diffMs = now.getTime() - lastActivity.getTime();
      const diffMins = diffMs / (1000 * 60);

      if (diffMins < 15) {
        this.monitoringService.logAuthFailure(
          loginDto.identifier,
          ip,
          "Active session already exists (Login blocked)",
        );
        throw new UnauthorizedException("ACTIVE_SESSION_EXISTS");
      }
    }

    // Generate unique session ID - this invalidates any previous sessions (if 30 mins passed)
    const sessionId = randomUUID();

    // Update user's active session ID and last activity in database
    await this.usersService.updateSessionId(user.userId, sessionId);

    // Generate tokens
    const tokens = this.generateTokens(user, sessionId);

    return {
      ...tokens,
      user: {
        userId: user.userId,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        roleId: user.roleId,
        roleName: user.role.roleName,
        institutionId: user.institutionId,
        branchId: user.branchId,
        canCreateBranches: user.institution?.canCreateBranches ?? true,
        expirationDate:
          user.branch?.expirationDate ||
          user.institution?.expirationDate ||
          null,
      },
    };
  }

  /**
   * Refresh the access token using a valid refresh token
   */
  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken);

      // Verify user still exists and session is still active
      const user = await this.usersService.findByEmail(payload.email);

      if (!user) {
        console.log(
          `[Auth] Refresh failed: User not found for email ${payload.email}`,
        );
        throw new UnauthorizedException("User not found");
      }

      if (!user.isActive) {
        console.log(
          `[Auth] Refresh failed: User ${payload.email} is deactivated`,
        );
        throw new UnauthorizedException("Account is deactivated");
      }

      // Check session - must match payload sessionId
      if (!user.activeSessionId || user.activeSessionId !== payload.sessionId) {
        console.log(
          `[Auth] Refresh failed: Session mismatch or cleared for user ${payload.email}`,
        );
        throw new UnauthorizedException(
          "Session expired or terminated by administrator.",
        );
      }

      // Generate new token pair (refresh rotation)
      // Use existing sessionId if available, otherwise use the one from payload
      const currentSessionId = user.activeSessionId || payload.sessionId;

      // Update the session ID in DB if it was null
      if (!user.activeSessionId) {
        await this.usersService.updateSessionId(user.userId, currentSessionId);
      }

      return this.generateTokens(user, currentSessionId);
    } catch (e) {
      if (e instanceof UnauthorizedException) {
        throw e;
      }
      console.log(
        `[Auth] Refresh failed: Token verification error - ${e.message}`,
      );
      throw new UnauthorizedException("Invalid or expired refresh token");
    }
  }

  /**
   * Helper to generate a pair of Access and Refresh tokens
   */
  private generateTokens(user: any, sessionId: string) {
    const payload: JwtPayload = {
      sub: user.userId,
      email: user.email,
      roleId: user.roleId,
      roleName: user.role?.roleName || user.roleName,
      institutionId: user.institutionId,
      branchId: user.branchId,
      sessionId,
    };

    return {
      access_token: this.jwtService.sign(payload, { expiresIn: "1h" }),
      refresh_token: this.jwtService.sign(payload, { expiresIn: "7d" }),
    };
  }

  async validateUser(payload: JwtPayload) {
    // Use findByEmail to get full User entity with role relation
    const user = await this.usersService.findByEmail(payload.email);

    if (!user) {
      console.log(
        `[Auth] validateUser failed: User not found for email ${payload.email}`,
      );
      throw new UnauthorizedException("User not found");
    }

    if (!user.isActive) {
      console.log(
        `[Auth] validateUser failed: User ${payload.email} is deactivated`,
      );
      throw new UnauthorizedException("Account is deactivated");
    }

    // Check if session ID matches - ensures only one active session
    if (!user.activeSessionId || user.activeSessionId !== payload.sessionId) {
      console.log(
        `[Auth] Session mismatch or cleared for user ${payload.email}:`,
      );
      console.log(`  - Token sessionId: ${payload.sessionId}`);
      console.log(`  - DB activeSessionId: ${user.activeSessionId}`);
      throw new UnauthorizedException(
        "Session expired or terminated by administrator.",
      );
    }

    // Update last activity whenever a user makes a request (but don't await to not slow down requests)
    this.usersService.updateLastActivity(user.userId).catch((err) => {
      console.error("[Auth] Failed to update last activity:", err.message);
    });

    return user;
  }

  async logout(userId: number): Promise<void> {
    await this.usersService.clearSessionId(userId);
  }
}
