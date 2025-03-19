import { Module } from '@nestjs/common';
import { HealthController } from './controllers/health.controller';
import { PrismaClient } from '@prisma/client';

@Module({
  controllers: [HealthController],
  providers: [
    {
      provide: 'PRISMA_CLIENT',
      useValue: new PrismaClient(),
    },
  ],
})
export class HealthModule {}
