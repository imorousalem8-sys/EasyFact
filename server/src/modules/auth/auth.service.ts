import { Injectable, BadRequestException, UnauthorizedException, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { SupabaseService } from '../../supabase/supabase.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly supabase: SupabaseService,
    private readonly emailService: EmailService,
  ) {}

  // Anti Brute-force Tracker (conservé en mémoire — performances)
  private failedAttempts = new Map<string, { count: number; lockedUntil: number }>();

  // Blacklist des emails jetables
  private disposableEmailDomains = new Set([
    'yopmail.com', 'yopmail.fr', 'yopmail.net',
    'mailinator.com', 'tempmail.com', 'temp-mail.org',
    '10minutemail.com', 'trashmail.com', 'trashmail.net',
    'dispostable.com', 'guerrillamail.com', 'sharklasers.com',
    'getnada.com', 'maildrop.cc', 'throwawaymail.com',
    'fakeinbox.com', 'boun.cr',
  ]);

  private validateEmailStrict(email: string): string {
    if (!email) throw new BadRequestException('L\'adresse email est obligatoire.');
    const cleanEmail = email.toLowerCase().trim();

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

  // ============================================================
  // ENVOYER CODE OTP (stocké dans Supabase + envoyé via Resend)
  // ============================================================
  async sendVerificationCode(email: string) {
    const cleanEmail = this.validateEmailStrict(email);

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Supprimer les anciens codes pour cet email
    await this.supabase.getClient()
      .from('otp_codes')
      .delete()
      .eq('email', cleanEmail)
      .eq('used', false);

    // Insérer le nouveau code OTP dans Supabase
    const { error } = await this.supabase.getClient()
      .from('otp_codes')
      .insert({ email: cleanEmail, code, expires_at: expiresAt });

    if (error) {
      this.logger.error(`❌ Supabase OTP insert error: ${error.message}`);
      throw new HttpException('Erreur de base de données lors de la génération OTP.', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    // Envoyer le vrai email via Resend
    try {
      await this.emailService.sendOtpEmail(cleanEmail, code);
      this.logger.log(`✅ Email OTP envoyé via Resend à ${cleanEmail}`);
    } catch (emailErr) {
      this.logger.error(`❌ Resend email error: ${emailErr.message}`);
      // On ne bloque pas la requête si l'email échoue — on log et on continue
    }

    return {
      success: true,
      message: `Un code de vérification à 6 chiffres a été envoyé à ${cleanEmail}. Vérifiez votre boîte mail.`,
      expiresInMinutes: 10,
    };
  }

  // ============================================================
  // VÉRIFIER CODE OTP (depuis Supabase)
  // ============================================================
  async verifyCode(email: string, code: string) {
    const cleanEmail = this.validateEmailStrict(email);

    const { data: otpRecord, error } = await this.supabase.getClient()
      .from('otp_codes')
      .select('*')
      .eq('email', cleanEmail)
      .eq('used', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !otpRecord) {
      throw new BadRequestException('Aucun code de vérification en attente pour cet email.');
    }

    if (new Date() > new Date(otpRecord.expires_at)) {
      await this.supabase.getClient()
        .from('otp_codes')
        .update({ used: true })
        .eq('id', otpRecord.id);
      throw new BadRequestException('Le code de vérification a expiré (limite 10 min). Veuillez en demander un nouveau.');
    }

    if (otpRecord.code !== code) {
      throw new UnauthorizedException('Code de vérification incorrect.');
    }

    // Marquer le code comme utilisé
    await this.supabase.getClient()
      .from('otp_codes')
      .update({ used: true })
      .eq('id', otpRecord.id);

    // Marquer l'utilisateur comme vérifié dans Supabase
    await this.supabase.getClient()
      .from('users')
      .update({ email_verified: true })
      .eq('email', cleanEmail);

    this.logger.log(`✅ Email ${cleanEmail} vérifié avec succès via OTP Supabase`);

    return {
      success: true,
      message: 'Compte et email validés avec succès !',
    };
  }

  // ============================================================
  // INSCRIPTION (persistance Supabase)
  // ============================================================
  async register(data: any) {
    const emailKey = this.validateEmailStrict(data.email || '');

    // Vérifier si l'email existe déjà dans Supabase
    const { data: existingUser } = await this.supabase.getClient()
      .from('users')
      .select('id')
      .eq('email', emailKey)
      .single();

    if (existingUser) {
      throw new BadRequestException('Un compte existe déjà avec cet email.');
    }

    const rawPassword = data.password || 'EasyFactPass2026!';
    if (rawPassword.length < 6) {
      throw new BadRequestException('Le mot de passe doit contenir au moins 6 caractères.');
    }

    const hashedPassword = await bcrypt.hash(rawPassword, 12);
    const companyName = data.companyName || 'Mon Entreprise SARL';

    // Insérer l'utilisateur dans Supabase
    const { data: newUser, error } = await this.supabase.getClient()
      .from('users')
      .insert({
        email: emailKey,
        password_hash: hashedPassword,
        company_name: companyName,
        ninea: data.ninea || null,
        phone: data.phone || null,
        tier: 'starter',
        email_verified: false,
      })
      .select()
      .single();

    if (error || !newUser) {
      this.logger.error(`❌ Supabase register error: ${error?.message}`);
      throw new HttpException('Erreur lors de la création du compte.', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    this.logger.log(`✅ Nouvel utilisateur créé dans Supabase: ${emailKey} (ID: ${newUser.id})`);

    // Envoyer le code OTP par email
    const otpResult = await this.sendVerificationCode(emailKey);

    const token = await this.jwtService.signAsync({
      sub: newUser.id,
      email: newUser.email,
      companyName: newUser.company_name,
      tier: newUser.tier,
    });

    return {
      success: true,
      message: 'Compte créé avec succès. Un code OTP a été envoyé à votre adresse email.',
      user: {
        id: newUser.id,
        email: newUser.email,
        companyName: newUser.company_name,
        tier: newUser.tier,
        verified: false,
      },
      requiresOtp: true,
      otpInfo: otpResult,
      token,
    };
  }

  // ============================================================
  // CONNEXION GOOGLE OAUTH (Supabase upsert)
  // ============================================================
  async googleLogin(data: { email: string; name?: string; sub?: string; picture?: string }) {
    const emailKey = (data.email || '').toLowerCase().trim();
    if (!emailKey || !emailKey.includes('@')) {
      throw new BadRequestException('Adresse email Google invalide.');
    }

    // Upsert: créer si inexistant, récupérer si existant
    const { data: existingUser } = await this.supabase.getClient()
      .from('users')
      .select('*')
      .eq('email', emailKey)
      .single();

    let user = existingUser;

    if (!user) {
      const { data: createdUser, error } = await this.supabase.getClient()
        .from('users')
        .insert({
          email: emailKey,
          password_hash: await bcrypt.hash('google_oauth_' + Date.now(), 10),
          company_name: data.name ? `${data.name}` : emailKey.split('@')[0].toUpperCase(),
          tier: 'starter',
          email_verified: true,
        })
        .select()
        .single();

      if (error) {
        throw new HttpException('Erreur lors de la connexion Google.', HttpStatus.INTERNAL_SERVER_ERROR);
      }
      user = createdUser;

      // Email de bienvenue
      await this.emailService.sendWelcomeEmail(emailKey, user.company_name);
    }

    const token = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      companyName: user.company_name,
      tier: user.tier,
    });

    return {
      success: true,
      message: 'Connexion Google OAuth 2.0 réussie.',
      user: {
        id: user.id,
        email: user.email,
        companyName: user.company_name,
        tier: user.tier,
        verified: true,
      },
      token,
    };
  }

  // ============================================================
  // CONNEXION EMAIL/MOT DE PASSE (lecture Supabase)
  // ============================================================
  async login(data: any) {
    const emailKey = (data.email || '').toLowerCase().trim();
    const rawPassword = data.password || '';

    if (!emailKey || !emailKey.includes('@')) {
      throw new BadRequestException('Veuillez fournir une adresse email valide.');
    }
    if (!rawPassword) {
      throw new BadRequestException('Veuillez saisir votre mot de passe.');
    }

    const now = Date.now();

    // Vérification Anti Brute-force (reste en mémoire pour les performances)
    const attemptRecord = this.failedAttempts.get(emailKey);
    if (attemptRecord && attemptRecord.lockedUntil > now) {
      const remainingSeconds = Math.ceil((attemptRecord.lockedUntil - now) / 1000);
      const remainingMinutes = Math.ceil(remainingSeconds / 60);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Accès Verrouillé pour Sécurité',
          message: `⚠️ Sécurité Anti-Intrusion : 5 tentatives échouées. Compte verrouillé pendant ${remainingMinutes} minute(s).`,
          remainingSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Récupérer l'utilisateur depuis Supabase
    const { data: user, error } = await this.supabase.getClient()
      .from('users')
      .select('*')
      .eq('email', emailKey)
      .single();

    if (error || !user) {
      const currentCount = (attemptRecord?.count || 0) + 1;
      this.failedAttempts.set(emailKey, { count: currentCount, lockedUntil: currentCount >= 5 ? now + 5 * 60 * 1000 : 0 });
      throw new UnauthorizedException('Compte introuvable ou mot de passe incorrect.');
    }

    const isPasswordValid = await bcrypt.compare(rawPassword, user.password_hash);

    if (!isPasswordValid) {
      const currentCount = (attemptRecord?.count || 0) + 1;
      const lockedUntil = currentCount >= 5 ? now + 5 * 60 * 1000 : 0;
      this.failedAttempts.set(emailKey, { count: currentCount, lockedUntil });
      const attemptsRemaining = Math.max(0, 5 - currentCount);
      throw new UnauthorizedException(
        `Mot de passe incorrect. Tentatives restantes avant verrouillage : ${attemptsRemaining}/5.`,
      );
    }

    this.failedAttempts.delete(emailKey);

    const token = await this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      companyName: user.company_name,
      tier: user.tier,
    });

    return {
      success: true,
      message: 'Connexion réussie.',
      user: {
        id: user.id,
        email: user.email,
        companyName: user.company_name,
        tier: user.tier,
        verified: user.email_verified,
      },
      token,
    };
  }

  // ============================================================
  // PROFIL UTILISATEUR (depuis Supabase)
  // ============================================================
  async getProfile(userId?: string) {
    if (!userId) {
      return { id: null, companyName: 'Invité', tier: 'starter', invoicesUsedThisMonth: 0, invoicesLimit: 5 };
    }

    const { data: user } = await this.supabase.getClient()
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (!user) {
      return { id: userId, companyName: 'Mon Entreprise', tier: 'starter', invoicesUsedThisMonth: 0, invoicesLimit: 5 };
    }

    // Compter les factures du mois courant
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { count } = await this.supabase.getClient()
      .from('invoices')
      .select('id', { count: 'exact' })
      .eq('user_id', userId)
      .gte('created_at', startOfMonth.toISOString());

    const tierLimits: Record<string, number> = { starter: 5, pro: 9999, entreprise: 9999 };

    return {
      id: user.id,
      email: user.email,
      companyName: user.company_name,
      ninea: user.ninea,
      phone: user.phone,
      address: user.address,
      waveNum: user.wave_num,
      omNum: user.om_num,
      bankRib: user.bank_rib,
      tier: user.tier,
      emailVerified: user.email_verified,
      invoicesUsedThisMonth: count || 0,
      invoicesLimit: tierLimits[user.tier] || 5,
    };
  }
}
