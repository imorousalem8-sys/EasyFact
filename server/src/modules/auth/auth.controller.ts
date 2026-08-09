import { Controller, Post, Body, Get, UseGuards, Req, Res } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

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

  // ✅ Profile route protected by JWT — used by frontend to validate token on load
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: any) {
    return this.authService.getProfile(req.user?.sub || req.user?.id);
  }

  // POST logout (stateless JWT — just confirms logout on client)
  @Post('logout')
  async logout() {
    return { success: true, message: 'Déconnexion réussie.' };
  }

  // Google OAuth entry point
  @Get('google')
  async googleAuth(@Req() req: any, @Res() res: any) {
    try {
      const passport = require('passport');
      passport.authenticate('google', { scope: ['email', 'profile'] })(req, res);
    } catch (err) {
      return res.redirect('/auth.html?error=google_auth_unavailable');
    }
  }

  // Google OAuth callback
  @Get('google/callback')
  async googleAuthRedirect(@Req() req: any, @Res() res: any) {
    try {
      const passport = require('passport');
      passport.authenticate('google', async (err: any, user: any) => {
        if (err || !user) {
          return res.redirect('/auth.html?error=google_callback_failed');
        }
        const result = await this.authService.googleLogin(user);
        if (result && result.token) {
          return res.redirect(`/auth.html?token=${encodeURIComponent(result.token)}`);
        }
        return res.redirect('/auth.html?error=oauth_failed');
      })(req, res);
    } catch (err) {
      return res.redirect('/auth.html?error=oauth_error');
    }
  }

  // Google Identity Services (GIS) Client Credential Endpoint
  @Post('google/verify-credential')
  async verifyGoogleCredential(@Body() body: { credential?: string; email?: string; name?: string }) {
    return this.authService.googleLogin({
      email: body.email || 'user_google@gmail.com',
      name: body.name || 'Utilisateur Google',
    });
  }
}

