import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { get } from 'lodash';
import { AuthorizedRoles } from 'src/common/role.decorator';
import { AuthGuard } from '../../../supabase/auth.guard';
import { DashboardService } from '../services/dashboard.service';

@Controller('dashboard')
@UseGuards(AuthGuard) // Apply authentication guard to all endpoints
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('admin/stats')
  @AuthorizedRoles(['ADMIN'])
  async getAdminDashboardStats() {
    return this.dashboardService.getAdminDashboardStats();
  }

  @Get('registrar/stats')
  @AuthorizedRoles(['REGISTRAR'])
  async getRegistrarDashboardCounts(@Req() req: Request) {
    const registrarId = get(req, 'user.registrar_id', 0) as string | number;
    return this.dashboardService.getRegistrarDashboardStats(registrarId);
  }
}
