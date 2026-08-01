import { Injectable } from '@nestjs/common';

@Injectable()
export class SubscriptionsService {
  async getPlans() {
    return {
      success: true,
      plans: [
        { id: 'starter', name: 'Starter', priceXof: 0, invoicesLimit: 5, watermark: true },
        { id: 'pro', name: 'Pro PME', priceXof: 4900, invoicesLimit: 'unlimited', watermark: false, momoQr: true, whatsapp: true },
        { id: 'entreprise', name: 'Entreprise SA', priceXof: 24900, invoicesLimit: 'unlimited', watermark: false, momoQr: true, cardPayments: true, multiCompany: true },
      ],
    };
  }

  async subscribe(planId: string, paymentMethod: string) {
    return {
      success: true,
      message: `Abonnement au Plan ${planId.toUpperCase()} activé avec succès via ${paymentMethod.toUpperCase()}.`,
      subscription: {
        id: 'sub_' + Date.now(),
        planId,
        status: 'active',
        paymentMethod,
        activatedAt: new Date().toISOString(),
      },
    };
  }
}
