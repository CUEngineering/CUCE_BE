import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/supabase/auth.guard';
import { SessionsService } from '../services/sessions.service';

@Controller('sessions')
@UseGuards(AuthGuard)
export class SessionController {
  constructor(private readonly sessionService: SessionsService) {}

  @Get()
  async findAllSessions(
    @Req() req: Request & { accessToken: string },
    @Query('status') status: 'active' | 'closed' | 'upcoming',
  ) {
    return this.sessionService.getAllSessionsWithStats(req.accessToken, status);
  }
}
