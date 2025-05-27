import { Module } from '@nestjs/common';
import { DashboardService } from './services/dashboard.service';
import { DashboardController } from './controllers/dashboard.controller';
import { SupabaseModule } from '../../supabase/supabase.module';
import { PrismaClient } from '@prisma/client';

@Module({
  imports: [SupabaseModule],
  controllers: [DashboardController],
  providers: [
    DashboardService,
    {
      provide: 'PRISMA_CLIENT',
      useValue: new PrismaClient(),
    },
  ],
  exports: [DashboardService],
})
export class DashboardsModule {}
