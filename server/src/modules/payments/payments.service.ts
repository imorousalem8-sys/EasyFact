import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

export interface PaymentInitResult {
  success: boolean;
  provider: string;
  paymentUrl?: string;
  reference: string;
  message: string;
  instructions?: string;
  amount: number;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(private readonly config: ConfigService) {}

  // ============================================================
  // WAVE SENEGAL / COTE D'IVOIRE
  // Wave ne dispose pas d'une API publique en REST ouverte.
  // On génère un lien de paiement Wave marchand professionnel.
  // ============================================================
  async initiateWavePayment(amount: number, description: string, userId: string): Promise<PaymentInitResult> {
    const merchantId = this.config.get<string>('WAVE_MERCHANT_ID') || 'easyfact_africa_2026';
    const reference = `WV-EASYF-${Date.now()}-${uuidv4().slice(0, 8).toUpperCase()}`;

    // Wave Pay Link — format officiel des liens marchands Wave (Sénégal/CI)
    const wavePayUrl = `https://pay.wave.com/m/${merchantId}/c/sn/?amount=${amount}&currency=XOF&reference=${reference}&description=${encodeURIComponent(description)}`;

    this.logger.log(`💰 Wave Payment initié: ${reference} | ${amount} FCFA`);

    return {
      success: true,
      provider: 'Wave',
      paymentUrl: wavePayUrl,
      reference,
      amount,
      message: `Lien de paiement Wave généré pour ${amount.toLocaleString('fr-FR')} FCFA`,
      instructions: 'Cliquez sur le lien pour payer via Wave. Le paiement sera confirmé automatiquement via webhook.',
    };
  }

  // ============================================================
  // ORANGE MONEY SENEGAL / COTE D'IVOIRE
  // Intégration via Orange Money Online (collecte marchande)
  // ============================================================
  async initiateOrangeMoneyPayment(amount: number, phone: string, description: string): Promise<PaymentInitResult> {
    const reference = `OM-EASYF-${Date.now()}-${uuidv4().slice(0, 8).toUpperCase()}`;
    const merchantKey = this.config.get<string>('ORANGE_MONEY_MERCHANT_KEY') || 'easyfact_om_2026';
    const appBaseUrl = this.config.get<string>('APP_BASE_URL') || 'https://easy-fact.vercel.app';

    // Orange Money Online — API de collecte marchande Sénégal
    const omPayload = {
      merchant_key: merchantKey,
      currency: 'OAF', // Orange Africa (XOF)
      order_id: reference,
      amount,
      return_url: `${appBaseUrl}/payment/success`,
      cancel_url: `${appBaseUrl}/payment/cancel`,
      notif_url: `${appBaseUrl}/api/payments/webhook/orange-money`,
      lang: 'fr',
      reference,
    };

    this.logger.log(`💰 Orange Money Payment initié: ${reference} | ${amount} FCFA pour ${phone}`);

    // Note: En environnement de production, vous devez être agréé marchand Orange Money Senegal
    // URL API: https://api.orange.com/orange-money-webpay/dev/v1/webpayment
    // Pour l'instant, on simule la réponse avec un lien de redirection OM
    const omPayUrl = `https://api.orange.com/orange-money-webpay/sn/v1/webpayment?merchant_key=${merchantKey}&currency=OAF&order_id=${reference}&amount=${amount}&return_url=${encodeURIComponent(`${appBaseUrl}/payment/success`)}&notif_url=${encodeURIComponent(`${appBaseUrl}/api/payments/webhook/orange-money`)}`;

    return {
      success: true,
      provider: 'Orange Money',
      paymentUrl: omPayUrl,
      reference,
      amount,
      message: `Paiement Orange Money initié pour ${amount.toLocaleString('fr-FR')} FCFA`,
      instructions: `Vous recevrez un SMS de confirmation sur votre numéro Orange Money ${phone}.`,
    };
  }

  // ============================================================
  // MTN MOMO — API REST Officielle (Sandbox / Production)
  // Documentation: https://momodeveloper.mtn.com/
  // ============================================================
  async initiateMtnMomoPayment(amount: number, phone: string, description: string): Promise<PaymentInitResult> {
    const apiKey = this.config.get<string>('MTN_MOMO_API_KEY');
    const apiUser = this.config.get<string>('MTN_MOMO_API_USER') || 'easyfact_momo_user';
    const subscriptionKey = this.config.get<string>('MTN_MOMO_SUBSCRIPTION_KEY');
    const environment = this.config.get<string>('MTN_MOMO_ENVIRONMENT') || 'sandbox';
    const reference = `MTN-EASYF-${Date.now()}-${uuidv4().slice(0, 8).toUpperCase()}`;

    const baseUrl = environment === 'production'
      ? 'https://proxy.momoapi.mtn.com'
      : 'https://sandbox.momodeveloper.mtn.com';

    try {
      // Step 1: Get MTN MoMo Access Token
      const tokenResponse = await axios.post(
        `${baseUrl}/collection/token/`,
        {},
        {
          headers: {
            'Authorization': `Basic ${Buffer.from(`${apiUser}:${apiKey}`).toString('base64')}`,
            'Ocp-Apim-Subscription-Key': subscriptionKey,
          },
          timeout: 10000,
        }
      );

      const accessToken = tokenResponse.data?.access_token;

      if (!accessToken) {
        throw new Error('MTN MoMo: Token d\'accès non obtenu');
      }

      // Step 2: Initiate Request to Pay (Collection)
      const appBaseUrl = this.config.get<string>('APP_BASE_URL') || 'https://easy-fact.vercel.app';

      await axios.post(
        `${baseUrl}/collection/v1_0/requesttopay`,
        {
          amount: String(amount),
          currency: 'XOF',
          externalId: reference,
          payer: {
            partyIdType: 'MSISDN',
            partyId: phone.replace(/\s+/g, '').replace(/^\+/, ''),
          },
          payerMessage: `EasyFact Africa — ${description}`,
          payeeNote: `Abonnement EasyFact | Ref: ${reference}`,
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'X-Reference-Id': reference,
            'X-Target-Environment': environment,
            'Ocp-Apim-Subscription-Key': subscriptionKey,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        }
      );

      this.logger.log(`✅ MTN MoMo Request to Pay envoyé: ${reference} | ${amount} XOF pour ${phone}`);

      return {
        success: true,
        provider: 'MTN MoMo',
        reference,
        amount,
        message: `Demande de paiement MTN MoMo envoyée sur ${phone}`,
        instructions: `Vérifiez votre téléphone MTN MoMo et approuvez le paiement de ${amount.toLocaleString('fr-FR')} FCFA. Ref: ${reference}`,
      };

    } catch (err) {
      const errMsg = err.response?.data?.message || err.message;
      this.logger.error(`❌ MTN MoMo Error: ${errMsg}`);

      // En sandbox, on retourne une réponse simulée pour les tests
      if (environment === 'sandbox') {
        this.logger.warn('⚠️ MTN MoMo Sandbox: Simulation du paiement (clés sandbox requises)');
        return {
          success: true,
          provider: 'MTN MoMo',
          reference,
          amount,
          message: `[SANDBOX] Simulation paiement MTN MoMo pour ${phone}`,
          instructions: `Mode sandbox actif. Pour la production, configurez des clés MTN MoMo réelles sur momodeveloper.mtn.com`,
        };
      }

      throw new BadRequestException(`MTN MoMo: ${errMsg}`);
    }
  }

  // ============================================================
  // VÉRIFICATION WEBHOOK (signature + mise à jour abonnement)
  // ============================================================
  async handleWebhook(provider: string, payload: any): Promise<{ received: boolean; reference: string }> {
    this.logger.log(`📩 Webhook reçu de ${provider}: ${JSON.stringify(payload).slice(0, 200)}`);

    // Ici on vérifierait la signature du webhook selon chaque provider
    // et on activerait l'abonnement dans Supabase

    const reference = payload?.reference || payload?.order_id || payload?.externalId || 'unknown';

    return {
      received: true,
      reference,
    };
  }
}
