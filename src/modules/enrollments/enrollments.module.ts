import { Module } from '@nestjs/common';
import { EnrollmentsService } from './services/enrollments.service';
import { PrismaClient } from '@prisma/client';
import { SupabaseService } from '../../supabase/supabase.service';

@Module({
  providers: [
    EnrollmentsService,
    SupabaseService,
    {
      provide: 'PRISMA_CLIENT',
      useValue: new PrismaClient(),
    },
  ],
  exports: [EnrollmentsService],
})
export class EnrollmentsModule {}
