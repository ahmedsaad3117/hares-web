import { Controller, Post, Body, HttpCode, HttpStatus, Get, UseGuards, Ip } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { RateLimiterGuard, RateLimit, RATE_LIMITS } from '../../common/rate-limiter';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  /**
   * Login endpoint with rate limiting
   * - 5 attempts per minute per IP
   * - Prevents brute force attacks
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(RateLimiterGuard)
  @RateLimit(RATE_LIMITS.LOGIN)
  login(@Body() loginDto: LoginDto, @Ip() ip: string) {
    return this.authService.login(loginDto, ip);
  }

  /**
   * Refresh token endpoint
   * Allows clients to get a new access token using a refresh token
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body('refresh_token') refreshToken: string) {
    return this.authService.refresh(refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: any) {
    await this.authService.logout(user.userId);
    return { message: 'Logged out successfully' };
  }

  @Get('verify-session')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  verifySession(@CurrentUser() user: any) {
    return { valid: true, userId: user.userId };
  }
}
