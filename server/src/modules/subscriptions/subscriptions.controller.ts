import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('plans')
  async getPlans() {
    return this.subscriptionsService.getPlans();
  }

  @Post('subscribe')
  @UseGuards(JwtAuthGuard)
  async subscribe(
    @Body() body: {
      planId: string;
      paymentMethod: string;
      phone?: string;
      userId?: string;
      userEmail?: string;
    }
  ) {
    return this.subscriptionsService.subscribe(body.planId, body.paymentMethod, {
      phone: body.phone,
      userId: body.userId,
      userEmail: body.userEmail,
    });
  }
}
