import { Module } from '@nestjs/common';
import { EnrollmentsService } from './services/enrollments.service';
import { PrismaClient } from '@prisma/client';
import { SupabaseService } from '../../supabase/supabase.service';
import { SupabaseModule } from 'src/supabase/supabase.module';
import { EnrollmentController } from './controllers/enrollments.controller';

@Module({
  imports: [SupabaseModule],
  controllers: [EnrollmentController],
  providers: [
    EnrollmentsService,
    {
      provide: 'PRISMA_CLIENT',
      useValue: new PrismaClient(),
    },
  ],
  exports: [EnrollmentsService],
})
export class EnrollmentsModule {}
