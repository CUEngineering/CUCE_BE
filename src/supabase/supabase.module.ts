import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { SupabaseController } from './supabase.controller';
import { AuthGuard } from './auth.guard';

@Module({
  imports: [ConfigModule],
  controllers: [SupabaseController],
  providers: [
    SupabaseService,
    AuthGuard,
    {
      provide: 'SUPABASE_CLIENT',
      useFactory: (configService: ConfigService) => {
        const supabaseUrl = configService.get<string>('SUPABASE_URL');
        const supabaseKey = configService.get<string>('SUPABASE_ANON_KEY');

        if (!supabaseUrl || !supabaseKey) {
          throw new Error('Supabase URL and Anon Key must be provided');
        }

        return createClient(supabaseUrl, supabaseKey);
      },
      inject: [ConfigService],
    },
  ],
  exports: ['SUPABASE_CLIENT', SupabaseService, AuthGuard],
})
export class SupabaseModule {}
