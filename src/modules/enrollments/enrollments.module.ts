import { Module } from '@nestjs/common';
import { EnrollmentsService } from './services/enrollments.service';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  providers: [EnrollmentsService, PrismaService],
  exports: [EnrollmentsService],
})
export class EnrollmentsModule {}
