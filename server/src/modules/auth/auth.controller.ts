import { Controller, Post, Body, Get, UseGuards, Req, Res } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
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

  // Google OAuth entry point
  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth() {
    // Handled by passport, redirects to Google
  }

  // Google OAuth callback
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req: any, @Res() res: any) {
    try {
      const result = await this.authService.googleLogin(req.user);
      if (result && result.token) {
        return res.redirect(`/?token=${encodeURIComponent(result.token)}`);
      }
      return res.redirect('/?error=oauth_failed');
    } catch (err) {
      return res.redirect('/?error=oauth_error');
    }
  }

  @Get('profile')
  async getProfile() {
    return this.authService.getProfile();
  }
}
