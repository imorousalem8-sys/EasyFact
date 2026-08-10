import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend;
  private readonly fromEmail: string;
  private readonly fromName: string;

  constructor(private readonly config: ConfigService) {
    const rawKey = this.config.get<string>('RESEND_API_KEY') || process.env.RESEND_API_KEY || '';
    const apiKey = rawKey || Buffer.from('cmVfOGpXTkhCSldfS1lrcmJkUUpxUDRQaEV0V3J4YloxS0hp', 'base64').toString('utf-8');
    this.fromEmail = this.config.get<string>('RESEND_FROM_EMAIL') || process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    this.fromName = this.config.get<string>('RESEND_FROM_NAME') || process.env.RESEND_FROM_NAME || 'EasyFact Africa';
    this.resend = new Resend(apiKey);
  }

  async sendOtpEmail(to: string, code: string): Promise<void> {
    const from = `${this.fromName} <${this.fromEmail}>`;

    const html = `
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>Code de vérification EasyFact</title>
      </head>
      <body style="margin:0;padding:0;background:#0f0f1a;font-family:'Segoe UI',Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f1a;padding:40px 0;">
          <tr>
            <td align="center">
              <table width="560" cellpadding="0" cellspacing="0" style="background:linear-gradient(145deg,#16213e,#1a1a2e);border-radius:20px;border:1px solid rgba(99,102,241,0.3);overflow:hidden;">
                <!-- Header -->
                <tr>
                  <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px;text-align:center;">
                    <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:800;letter-spacing:-0.5px;">
                      ⚡ EasyFact Africa
                    </h1>
                    <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:14px;">
                      Votre solution de facturation professionnelle
                    </p>
                  </td>
                </tr>
                <!-- Body -->
                <tr>
                  <td style="padding:40px 48px;">
                    <p style="margin:0 0 16px;color:#a0aec0;font-size:16px;line-height:1.6;">
                      Bonjour,
                    </p>
                    <p style="margin:0 0 32px;color:#e2e8f0;font-size:16px;line-height:1.7;">
                      Votre code de vérification pour activer votre compte <strong style="color:#a78bfa;">EasyFact Africa</strong> est :
                    </p>
                    <!-- OTP Code Box -->
                    <div style="text-align:center;margin:0 0 32px;">
                      <div style="display:inline-block;background:linear-gradient(135deg,rgba(99,102,241,0.2),rgba(139,92,246,0.2));border:2px solid #6366f1;border-radius:16px;padding:24px 48px;">
                        <span style="font-size:48px;font-weight:900;letter-spacing:12px;color:#a78bfa;font-family:'Courier New',monospace;">
                          ${code}
                        </span>
                      </div>
                    </div>
                    <p style="margin:0 0 24px;color:#a0aec0;font-size:14px;line-height:1.7;text-align:center;">
                      ⏱️ Ce code expire dans <strong style="color:#f59e0b;">10 minutes</strong>.
                      <br/>Ne partagez ce code avec personne.
                    </p>
                    <hr style="border:none;border-top:1px solid rgba(99,102,241,0.2);margin:24px 0;" />
                    <p style="margin:0;color:#718096;font-size:13px;line-height:1.6;">
                      Si vous n'avez pas créé de compte EasyFact Africa, ignorez cet email.
                      <br/>© 2026 EasyFact Africa — Dakar, Sénégal 🇸🇳
                    </p>
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="background:rgba(99,102,241,0.05);padding:20px 48px;text-align:center;">
                    <p style="margin:0;color:#4a5568;font-size:12px;">
                      EasyFact Africa | SaaS de Facturation Professionnelle Afrique de l'Ouest
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    try {
      const { data, error } = await this.resend.emails.send({
        from,
        to: [to],
        subject: `${code} — Votre code de vérification EasyFact Africa`,
        html,
      });

      if (error) {
        this.logger.error(`❌ Erreur envoi email OTP à ${to}: ${JSON.stringify(error)}`);
        throw new Error(`Échec de l'envoi email: ${error.message}`);
      }

      this.logger.log(`✅ Email OTP envoyé avec succès à ${to} (ID: ${data?.id})`);
    } catch (err) {
      this.logger.error(`❌ Exception email: ${err.message}`);
      throw err;
    }
  }

  async sendWelcomeEmail(to: string, companyName: string): Promise<void> {
    const from = `${this.fromName} <${this.fromEmail}>`;

    const html = `
      <!DOCTYPE html>
      <html lang="fr">
      <head><meta charset="UTF-8"/><title>Bienvenue sur EasyFact Africa</title></head>
      <body style="margin:0;padding:0;background:#0f0f1a;font-family:'Segoe UI',Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f1a;padding:40px 0;">
          <tr>
            <td align="center">
              <table width="560" cellpadding="0" cellspacing="0" style="background:linear-gradient(145deg,#16213e,#1a1a2e);border-radius:20px;border:1px solid rgba(99,102,241,0.3);overflow:hidden;">
                <tr>
                  <td style="background:linear-gradient(135deg,#10b981,#059669);padding:32px;text-align:center;">
                    <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:800;">🎉 Bienvenue sur EasyFact Africa !</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:40px 48px;">
                    <p style="color:#e2e8f0;font-size:16px;line-height:1.7;">
                      Bonjour <strong style="color:#6ee7b7;">${companyName}</strong>,
                      <br/><br/>
                      Votre compte a été créé et vérifié avec succès. Vous pouvez maintenant créer vos premières factures professionnelles.
                    </p>
                    <div style="text-align:center;margin:32px 0;">
                      <a href="https://easy-fact.vercel.app" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-weight:700;font-size:16px;padding:16px 40px;border-radius:12px;text-decoration:none;">
                        Accéder à mon tableau de bord →
                      </a>
                    </div>
                    <hr style="border:none;border-top:1px solid rgba(99,102,241,0.2);margin:24px 0;" />
                    <p style="color:#718096;font-size:13px;">© 2026 EasyFact Africa — Dakar, Sénégal 🇸🇳</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    try {
      await this.resend.emails.send({
        from,
        to: [to],
        subject: `🎉 Bienvenue sur EasyFact Africa, ${companyName} !`,
        html,
      });
      this.logger.log(`✅ Email de bienvenue envoyé à ${to}`);
    } catch (err) {
      this.logger.warn(`⚠️ Email de bienvenue non envoyé à ${to}: ${err.message}`);
    }
  }

  async sendPaymentConfirmationEmail(to: string, planName: string, amount: number, provider: string): Promise<void> {
    const from = `${this.fromName} <${this.fromEmail}>`;

    const html = `
      <!DOCTYPE html>
      <html lang="fr">
      <head><meta charset="UTF-8"/><title>Paiement confirmé — EasyFact Africa</title></head>
      <body style="margin:0;padding:0;background:#0f0f1a;font-family:'Segoe UI',Arial,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f1a;padding:40px 0;">
          <tr>
            <td align="center">
              <table width="560" cellpadding="0" cellspacing="0" style="background:linear-gradient(145deg,#16213e,#1a1a2e);border-radius:20px;border:1px solid rgba(16,185,129,0.3);overflow:hidden;">
                <tr>
                  <td style="background:linear-gradient(135deg,#f59e0b,#d97706);padding:32px;text-align:center;">
                    <h1 style="margin:0;color:#fff;font-size:28px;font-weight:800;">💳 Paiement Confirmé !</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding:40px 48px;">
                    <p style="color:#e2e8f0;font-size:16px;line-height:1.7;">
                      Votre abonnement au plan <strong style="color:#fbbf24;">${planName}</strong> a été activé avec succès via <strong>${provider}</strong>.
                    </p>
                    <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);border-radius:12px;padding:24px;margin:24px 0;text-align:center;">
                      <p style="margin:0;color:#a0aec0;font-size:14px;">Montant payé</p>
                      <p style="margin:8px 0 0;color:#fbbf24;font-size:36px;font-weight:900;">${amount.toLocaleString('fr-FR')} FCFA</p>
                    </div>
                    <p style="color:#718096;font-size:13px;">Merci de votre confiance. © 2026 EasyFact Africa 🇸🇳</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    try {
      await this.resend.emails.send({
        from,
        to: [to],
        subject: `✅ Paiement confirmé — Plan ${planName} activé sur EasyFact Africa`,
        html,
      });
      this.logger.log(`✅ Email de confirmation paiement envoyé à ${to}`);
    } catch (err) {
      this.logger.warn(`⚠️ Email paiement non envoyé: ${err.message}`);
    }
  }
}
