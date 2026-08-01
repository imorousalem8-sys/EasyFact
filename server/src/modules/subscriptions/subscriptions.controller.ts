import { Controller, Get, Post, Body } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('plans')
  async getPlans() {
    return this.subscriptionsService.getPlans();
  }

  @Post('subscribe')
  async subscribe(@Body() body: { planId: string; paymentMethod: string }) {
    return this.subscriptionsService.subscribe(body.planId, body.paymentMethod);
  }
}
