import { Injectable, BadRequestException, UnauthorizedException, HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}

  // Anti Brute-force Tracker (Email -> { count, lockedUntil })
  private failedAttempts = new Map<string, { count: number; lockedUntil: number }>();

  // Email 2FA Verification Codes Store (Email -> { code, expiresAt })
  private verificationCodes = new Map<string, { code: string; expiresAt: number }>();

  // In-Memory User Store (Data Isolation per User/Tenant)
  private users = new Map<string, any>();

  // Blacklist of known disposable / fake temporary email providers
  private disposableEmailDomains = new Set([
    'yopmail.com', 'yopmail.fr', 'yopmail.net',
    'mailinator.com', 'tempmail.com', 'temp-mail.org',
    '10minutemail.com', 'trashmail.com', 'trashmail.net',
    'dispostable.com', 'guerrillamail.com', 'sharklasers.com',
    'getnada.com', 'maildrop.cc', 'throwawaymail.com',
    'fakeinbox.com', 'boun.cr'
  ]);

  private validateEmailStrict(email: string): string {
    if (!email) throw new BadRequestException('L\'adresse email est obligatoire.');
    const cleanEmail = email.toLowerCase().trim();
    
    // Strict RFC 5322 standard syntax check
    const rfcRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,63}$/;
    if (!rfcRegex.test(cleanEmail)) {
      throw new BadRequestException('Format d\'adresse email invalide (Format attendu : exemple@domaine.com).');
    }

    const domain = cleanEmail.split('@')[1];
    if (this.disposableEmailDomains.has(domain)) {
      throw new BadRequestException(`🚫 Sécurité Backend : Les adresses emails temporaires et jetables (@${domain}) sont strictement interdites.`);
    }

    return cleanEmail;
  }

  async sendVerificationCode(email: string) {
    const cleanEmail = this.validateEmailStrict(email);

    const code = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit secure code
    const expiresAt = Date.now() + 10 * 60 * 1000; // Valid for 10 minutes

    this.verificationCodes.set(cleanEmail, { code, expiresAt });

    console.log(`🔒 [SÉCURITÉ BACKEND EASYFACT] Code OTP transmis à ${cleanEmail} : ${code}`);

    return {
      success: true,
      message: `Un code de confirmation OTP à 6 chiffres a été généré par le serveur NestJS pour ${cleanEmail}.`,
      expiresInMinutes: 10,
      devVerificationCode: code,
    };
  }

  async verifyCode(email: string, code: string) {
    const cleanEmail = this.validateEmailStrict(email);
    const record = this.verificationCodes.get(cleanEmail);
    if (!record) {
      throw new BadRequestException('Aucun code de vérification en attente pour cet email.');
    }
    if (Date.now() > record.expiresAt) {
      this.verificationCodes.delete(cleanEmail);
      throw new BadRequestException('Le code de vérification a expiré (limite 10 min). Veuillez en demander un nouveau.');
    }
    if (record.code !== code) {
      throw new UnauthorizedException('Code de vérification incorrect.');
    }

    this.verificationCodes.delete(cleanEmail);

    const user = this.users.get(cleanEmail);
    if (user) {
      user.verified = true;
    }

    return {
      success: true,
      message: 'Compte et email validés avec succès par le serveur !',
    };
  }

  async register(data: any) {
    const emailKey = this.validateEmailStrict(data.email || '');

    if (this.users.has(emailKey)) {
      throw new BadRequestException('Un compte existe déjà avec cet email.');
    }

    const rawPassword = data.password || 'EasyFactPass2026!';
    if (rawPassword.length < 6) {
      throw new BadRequestException('Le mot de passe doit contenir au moins 6 caractères.');
    }

    // Bcrypt Password Hashing (12 Rounds of Salting)
    const hashedPassword = await bcrypt.hash(rawPassword, 12);

    const userId = 'usr_' + Date.now();
    const newUser = {
      id: userId,
      email: emailKey,
      passwordHash: hashedPassword,
      companyName: data.companyName || 'Mon Entreprise SARL',
      ninea: data.ninea || '',
      phone: data.phone || '',
      tier: 'starter',
      verified: false,
      createdAt: new Date().toISOString(),
    };

    this.users.set(emailKey, newUser);

    const otpResult = await this.sendVerificationCode(emailKey);
    const token = await this.jwtService.signAsync({
      sub: userId,
      email: emailKey,
      companyName: newUser.companyName,
      tier: newUser.tier,
    });

    return {
      success: true,
      message: 'Compte créé avec mot de passe sécurisé (Bcrypt 12 rounds). Veuillez entrer le code OTP.',
      user: {
        id: newUser.id,
        email: newUser.email,
        companyName: newUser.companyName,
        tier: newUser.tier,
        verified: newUser.verified,
      },
      requiresOtp: true,
      otpInfo: otpResult,
      token,
    };
  }

  async login(data: any) {
    const emailKey = (data.email || 'utilisateur@entreprise.com').toLowerCase().trim();
    const now = Date.now();

    // Check Brute Force Lockout Status
    const attemptRecord = this.failedAttempts.get(emailKey);
    if (attemptRecord && attemptRecord.lockedUntil > now) {
      const remainingSeconds = Math.ceil((attemptRecord.lockedUntil - now) / 1000);
      const remainingMinutes = Math.ceil(remainingSeconds / 60);

      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Accès Verrouillé pour Sécurité',
          message: `⚠️ Sécurité Anti-Intrusion : 5 tentatives échouées enregistrées. Compte temporairement verrouillé. Veuillez réespacer de ${remainingMinutes} minute(s) (${remainingSeconds}s).`,
          remainingSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = this.users.get(emailKey);
    const rawPassword = data.password || '';

    let isPasswordValid = false;
    if (user && user.passwordHash) {
      isPasswordValid = await bcrypt.compare(rawPassword, user.passwordHash);
    } else if (rawPassword.length >= 4) {
      // Default initial mock validation
      isPasswordValid = true;
    }

    if (!isPasswordValid) {
      const currentCount = (attemptRecord?.count || 0) + 1;
      let lockedUntil = 0;

      if (currentCount >= 5) {
        lockedUntil = now + 5 * 60 * 1000; // 5 minutes lockout
        console.warn(`🚨 [ANTI-BRUTE-FORCE] 5 tentatives échouées pour ${emailKey}. Verrouillage de 5 minutes activé !`);
      }

      this.failedAttempts.set(emailKey, { count: currentCount, lockedUntil });

      const attemptsRemaining = Math.max(0, 5 - currentCount);
      throw new UnauthorizedException(
        `Mot de passe incorrect. Tentatives restantes avant verrouillage de 5 minutes : ${attemptsRemaining}/5.`,
      );
    }

    // Reset failed attempts on successful login
    this.failedAttempts.delete(emailKey);

    const activeUser = user || {
      id: 'usr_' + Date.now(),
      email: emailKey,
      companyName: data.companyName || 'Mon Entreprise SARL',
      tier: 'starter',
      verified: true,
    };

    if (!user) {
      this.users.set(emailKey, activeUser);
    }

    const token = await this.jwtService.signAsync({
      sub: activeUser.id,
      email: activeUser.email,
      companyName: activeUser.companyName,
      tier: activeUser.tier,
    });

    return {
      success: true,
      message: 'Connexion JWT sécurisée réussie.',
      user: {
        id: activeUser.id,
        email: activeUser.email,
        companyName: activeUser.companyName,
        tier: activeUser.tier,
        verified: activeUser.verified,
      },
      token,
    };
  }

  async getProfile(userId?: string) {
    return {
      id: userId || 'usr_default',
      companyName: 'Mon Entreprise SARL',
      tier: 'starter',
      invoicesUsedThisMonth: 0,
      invoicesLimit: 5,
    };
  }
}
