import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from 'src/supabase/auth.guard';
import { CreateSessionDto, UpdateSessionDto } from '../dto/index.dto';
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

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createSession(
    @Body() createDto: CreateSessionDto,
    @Req() req: Request & { accessToken: string },
  ) {
    return this.sessionService.createSession(req.accessToken, createDto);
  }
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async updateSession(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateSessionDto,
    @Req() req: Request & { accessToken: string },
  ) {
    return this.sessionService.updateSession(req.accessToken, id, updateDto);
  }
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSession(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request & { accessToken: string },
  ): Promise<void> {
    await this.sessionService.deleteSession(req.accessToken, id);
  }
}
