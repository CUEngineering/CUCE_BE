import { Module } from '@nestjs/common';
import { SessionsService } from './services/sessions.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EnrollmentsModule } from '../enrollments/enrollments.module';

@Module({
  imports: [EnrollmentsModule],
  providers: [SessionsService, PrismaService],
  exports: [SessionsService],
})
export class SessionsModule {}
