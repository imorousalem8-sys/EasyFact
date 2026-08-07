import { Controller, Post, Body, Param, HttpCode, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('wave')
  @UseGuards(JwtAuthGuard)
  async initiateWave(@Body() body: { amount: number; description: string; userId: string }) {
    const { amount, description, userId } = body;
    return this.paymentsService.initiateWavePayment(amount, description || 'Abonnement EasyFact Africa', userId);
  }

  @Post('orange-money')
  @UseGuards(JwtAuthGuard)
  async initiateOrangeMoney(@Body() body: { amount: number; phone: string; description: string }) {
    const { amount, phone, description } = body;
    return this.paymentsService.initiateOrangeMoneyPayment(amount, phone, description || 'Abonnement EasyFact Africa');
  }

  @Post('mtn-momo')
  @UseGuards(JwtAuthGuard)
  async initiateMtnMomo(@Body() body: { amount: number; phone: string; description: string }) {
    const { amount, phone, description } = body;
    return this.paymentsService.initiateMtnMomoPayment(amount, phone, description || 'Abonnement EasyFact Africa');
  }

  @Post('webhook/:provider')
  @HttpCode(200)
  async handleWebhook(
    @Param('provider') provider: string,
    @Body() payload: any,
  ) {
    return this.paymentsService.handleWebhook(provider, payload);
  }
}
