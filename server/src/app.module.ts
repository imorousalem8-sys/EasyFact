import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { ClientsModule } from './modules/clients/clients.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { AuthModule } from './modules/auth/auth.module';
import { AuditModule } from './modules/audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRoot([{
      ttl: 300000, // 5 minutes window
      limit: 10,  // Max 10 requests per 5 min window
    }]),
    AuthModule,
    InvoicesModule,
    ClientsModule,
    SubscriptionsModule,
    AuditModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
