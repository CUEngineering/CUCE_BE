import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { SupabaseModule } from 'src/supabase/supabase.module';
import { EnrollmentController } from './controllers/enrollments.controller';
import { EnrollmentsService } from './services/enrollments.service';

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
