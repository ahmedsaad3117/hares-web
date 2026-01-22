import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    // Find user by email or phone
    const user = await this.usersService.findByEmailOrPhone(loginDto.identifier);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is deactivated');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate unique session ID - this invalidates any previous sessions
    const sessionId = randomUUID();
    
    // Update user's active session ID in database
    await this.usersService.updateSessionId(user.userId, sessionId);

    const payload: JwtPayload = {
      sub: user.userId,
      email: user.email,
      roleId: user.roleId,
      roleName: user.role.roleName,
      institutionId: user.institutionId,
      branchId: user.branchId,
      sessionId, // Include session ID in JWT
    };

    return {
      access_token: this.jwtService.sign(payload),
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
      },
    };
  }

  async validateUser(payload: JwtPayload) {
    // Use findByEmail to get full User entity with role relation
    const user = await this.usersService.findByEmail(payload.email);
    if (!user || !user.isActive) {
      throw new UnauthorizedException();
    }
    
    // Check if session ID matches - ensures only one active session
    if (user.activeSessionId !== payload.sessionId) {
      throw new UnauthorizedException('Session expired. User logged in from another location.');
    }
    
    return user;
  }

  async logout(userId: number): Promise<void> {
    await this.usersService.clearSessionId(userId);
  }
}
