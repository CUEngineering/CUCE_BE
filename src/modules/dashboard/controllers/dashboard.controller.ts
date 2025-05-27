import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Delete,
  UseGuards,
  Req,
  ParseIntPipe,
  Patch,
} from '@nestjs/common';
import { DashboardService } from '../services/dashboard.service';
import { AuthGuard } from '../../../supabase/auth.guard';
import { Request } from 'express';

@Controller('dashboard')
@UseGuards(AuthGuard) // Apply authentication guard to all endpoints
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('admin/stats')
  async getDashboardCounts(@Req() req: Request & { accessToken: string }) {
    return this.dashboardService.getAdminDashCounts(req.accessToken);
  }
}
