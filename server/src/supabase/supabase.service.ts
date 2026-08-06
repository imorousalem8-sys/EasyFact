import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  private client: SupabaseClient;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const url = this.config.get<string>('SUPABASE_URL') || process.env.SUPABASE_URL || '';
    const key = this.config.get<string>('SUPABASE_KEY') || process.env.SUPABASE_KEY || '';

    if (!url || !key) {
      this.logger.warn('⚠️ SUPABASE_URL ou SUPABASE_KEY non défini dans l\'environnement.');
    }

    this.client = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    this.logger.log('✅ Supabase PostgreSQL connecté avec succès.');
  }

  getClient(): SupabaseClient {
    return this.client;
  }
}
