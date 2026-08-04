import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(configService: ConfigService) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID') || 'PLACEHOLDER_CLIENT_ID',
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET') || 'PLACEHOLDER_CLIENT_SECRET',
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL') || 'https://easyfact-africa.vercel.app/api/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { name, emails, photos } = profile;
    const user = {
      email: emails && emails[0] ? emails[0].value : '',
      firstName: name?.givenName || '',
      lastName: name?.familyName || '',
      name: profile.displayName || `${name?.givenName || ''} ${name?.familyName || ''}`.trim(),
      picture: photos && photos[0] ? photos[0].value : null,
      accessToken,
    };
    done(null, user);
  }
}
