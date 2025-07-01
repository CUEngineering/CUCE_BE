import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from 'src/supabase/auth.guard';
import { SessionsService } from '../services/sessions.service';

@Controller('sessions')
@UseGuards(AuthGuard)
export class SessionController {
  constructor(private readonly sessionService: SessionsService) {}

  @Get()
  async findAllSessions(
    @Req() req: Request & { accessToken: string },
    @Query('status') status: 'active' | 'closed' | 'upcoming' | 'not_closed',
  ) {
    return this.sessionService.getAllSessionsWithStats(req.accessToken, status);
  }

  @Get(':id')
  async getSessionById(
    @Req() req: Request & { accessToken: string },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.sessionService.getSessionDetail(req.accessToken, id);
  }

  @Get(':id/courses')
  async getSessionCourses(
    @Req() req: Request & { accessToken: string },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.sessionService.getCoursesBySession(req.accessToken, id);
  }

  @Get(':id/students')
  async getSessionStudents(
    @Req() req: Request & { accessToken: string },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.sessionService.getStudentsBySession(req.accessToken, id);
  }
}
