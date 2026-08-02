import { Injectable, Logger } from '@nestjs/common';
import { PaymentsService } from '../payments/payments.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);

  private readonly PLANS = [
    {
      id: 'starter',
      name: 'Starter',
      priceXof: 0,
      invoicesLimit: 5,
      watermark: true,
      description: 'Parfait pour démarrer',
      features: ['5 factures/mois', 'PDF avec filigrane', 'Support email'],
    },
    {
      id: 'pro',
      name: 'Pro PME',
      priceXof: 4900,
      invoicesLimit: 9999,
      watermark: false,
      momoQr: true,
      whatsapp: true,
      description: 'Pour les PME en croissance',
      features: ['Factures illimitées', 'PDF sans filigrane', 'QR Code Mobile Money', 'Partage WhatsApp', 'Support prioritaire'],
    },
    {
      id: 'entreprise',
      name: 'Entreprise SA',
      priceXof: 24900,
      invoicesLimit: 9999,
      watermark: false,
      momoQr: true,
      cardPayments: true,
      multiCompany: true,
      description: 'Pour les grandes entreprises',
      features: ['Tout du plan Pro', 'Multi-entreprises', 'Paiements carte bancaire', 'API accès', 'Manager dédié'],
    },
  ];

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly supabase: SupabaseService,
    private readonly emailService: EmailService,
  ) {}

  async getPlans() {
    return {
      success: true,
      plans: this.PLANS,
    };
  }

  // ============================================================
  // S'ABONNER — Déclenche un vrai paiement Mobile Money
  // ============================================================
  async subscribe(planId: string, paymentMethod: string, options?: {
    userId?: string;
    userEmail?: string;
    phone?: string;
  }) {
    const plan = this.PLANS.find(p => p.id === planId);
    if (!plan) {
      return { success: false, message: `Plan "${planId}" introuvable.` };
    }

    // Le plan Starter est gratuit — activation directe
    if (plan.priceXof === 0) {
      return {
        success: true,
        message: 'Plan Starter activé gratuitement.',
        subscription: {
          id: 'sub_starter_' + Date.now(),
          planId,
          planName: plan.name,
          status: 'active',
          paymentMethod: 'gratuit',
          activatedAt: new Date().toISOString(),
        },
      };
    }

    const userPhone = options?.phone || '';
    const description = `Abonnement EasyFact Africa — Plan ${plan.name}`;
    let paymentResult;

    // ---- Déclenchement du paiement selon le provider ----
    switch (paymentMethod.toLowerCase()) {
      case 'wave':
        paymentResult = await this.paymentsService.initiateWavePayment(
          plan.priceXof,
          description,
          options?.userId || 'anonymous',
        );
        break;

      case 'orange_money':
      case 'om':
        if (!userPhone) {
          return { success: false, message: 'Le numéro de téléphone est requis pour Orange Money.' };
        }
        paymentResult = await this.paymentsService.initiateOrangeMoneyPayment(
          plan.priceXof,
          userPhone,
          description,
        );
        break;

      case 'mtn_momo':
      case 'momo':
        if (!userPhone) {
          return { success: false, message: 'Le numéro de téléphone est requis pour MTN MoMo.' };
        }
        paymentResult = await this.paymentsService.initiateMtnMomoPayment(
          plan.priceXof,
          userPhone,
          description,
        );
        break;

      default:
        return { success: false, message: `Méthode de paiement "${paymentMethod}" non reconnue. Utilisez: wave, orange_money, ou mtn_momo.` };
    }

    // Enregistrer l'abonnement en attente dans Supabase
    if (options?.userId) {
      const { error } = await this.supabase.getClient()
        .from('subscriptions')
        .insert({
          user_id: options.userId,
          plan_id: planId,
          status: 'pending',
          payment_provider: paymentMethod,
          payment_reference: paymentResult.reference,
          payment_phone: userPhone || null,
          amount_xof: plan.priceXof,
        });

      if (error) {
        this.logger.warn(`⚠️ Supabase subscription insert warning: ${error.message}`);
      }
    }

    this.logger.log(`✅ Paiement ${paymentMethod.toUpperCase()} initié | Plan: ${plan.name} | ${plan.priceXof} FCFA | Ref: ${paymentResult.reference}`);

    return {
      success: true,
      message: paymentResult.message,
      subscription: {
        id: paymentResult.reference,
        planId,
        planName: plan.name,
        status: 'pending',
        paymentMethod,
        amount: plan.priceXof,
        reference: paymentResult.reference,
        paymentUrl: paymentResult.paymentUrl,
        instructions: paymentResult.instructions,
        activatedAt: null,
      },
    };
  }

  // ============================================================
  // ACTIVATION WEBHOOK — appelé après confirmation de paiement
  // ============================================================
  async activateSubscription(reference: string, userId: string, planId: string, amount: number, provider: string) {
    // Mettre à jour le statut dans Supabase
    await this.supabase.getClient()
      .from('subscriptions')
      .update({
        status: 'active',
        activated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 jours
        updated_at: new Date().toISOString(),
      })
      .eq('payment_reference', reference);

    // Mettre à jour le tier de l'utilisateur
    await this.supabase.getClient()
      .from('users')
      .update({ tier: planId, updated_at: new Date().toISOString() })
      .eq('id', userId);

    // Récupérer l'email de l'utilisateur pour l'email de confirmation
    const { data: user } = await this.supabase.getClient()
      .from('users')
      .select('email,company_name')
      .eq('id', userId)
      .single();

    if (user?.email) {
      const plan = this.PLANS.find(p => p.id === planId);
      await this.emailService.sendPaymentConfirmationEmail(
        user.email,
        plan?.name || planId,
        amount,
        provider,
      );
    }

    this.logger.log(`✅ Abonnement activé: ${reference} | User: ${userId} | Plan: ${planId}`);

    return { success: true, message: 'Abonnement activé avec succès.', reference };
  }
}
