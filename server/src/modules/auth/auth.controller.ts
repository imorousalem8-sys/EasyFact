import { Controller, Post, Body, Get } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('send-code')
  async sendCode(@Body() body: { email: string }) {
    return this.authService.sendVerificationCode(body.email);
  }

  @Post('verify-code')
  async verifyCode(@Body() body: { email: string; code: string }) {
    return this.authService.verifyCode(body.email, body.code);
  }

  @Post('register')
  async register(@Body() body: any) {
    return this.authService.register(body);
  }

  @Post('login')
  async login(@Body() body: any) {
    return this.authService.login(body);
  }

  @Get('profile')
  async getProfile() {
    return this.authService.getProfile();
  }
}
