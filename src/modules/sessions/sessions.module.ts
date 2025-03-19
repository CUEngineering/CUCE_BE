import { Module } from '@nestjs/common';
import { SessionsService } from './services/sessions.service';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { PrismaClient } from '@prisma/client';
import { SupabaseService } from '../../supabase/supabase.service';

@Module({
  imports: [EnrollmentsModule],
  providers: [
    SessionsService,
    SupabaseService,
    {
      provide: 'PRISMA_CLIENT',
      useValue: new PrismaClient(),
    },
  ],
  exports: [SessionsService],
})
export class SessionsModule {}
