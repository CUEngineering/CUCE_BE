import { Module } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { SupabaseModule } from 'src/supabase/supabase.module';
import { EnrollmentsModule } from '../enrollments/enrollments.module';
import { SessionController } from './controllers/sessions.controller';
import { SessionsService } from './services/sessions.service';

@Module({
  imports: [EnrollmentsModule, SupabaseModule],
  controllers: [SessionController],

  providers: [
    SessionsService,
    {
      provide: 'PRISMA_CLIENT',
      useValue: new PrismaClient(),
    },
  ],
  exports: [SessionsService],
})
export class SessionsModule {}
