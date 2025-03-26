import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '../../../supabase/auth.guard';
import { StudentsService } from '../services/students.service';
import { InviteStudentDto } from '../dto/invite-student.dto';
import { UpdateStudentDto } from '../dto/update-student.dto';
import { Request } from 'express';

interface InvitationResult {
  email: string;
  success: boolean;
  student?: any;
  error?: string;
}

@Controller('students')
@UseGuards(AuthGuard)
export class StudentsController {
  constructor(private readonly studentsService: StudentsService) {}

  @Get()
  async findAll(@Req() req: Request & { accessToken: string }) {
    return this.studentsService.findAll(req.accessToken);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: number,
    @Req() req: Request & { accessToken: string },
  ) {
    return this.studentsService.findOne(id, req.accessToken);
  }
  //Update students
  //   @Patch(':id')
  //   async update(
  //     @Param('id') id: number,
  //     @Body() updateStudentDto: UpdateStudentDto,
  //     @Req() req: Request & { accessToken: string },
  //   ) {
  //     return this.studentsService.update(id, updateStudentDto, req.accessToken);
  //   }

  @Post('invite')
  async invite(
    @Body() inviteDto: InviteStudentDto,
    @Req() req: Request & { accessToken: string },
  ) {
    const result = await this.studentsService.inviteStudent(
      inviteDto,
      req.accessToken,
    );

    return {
      success: true,
      message: result.message,
      student: result.student,
    };
  }

  @Get(':id/sessions')
  async getStudentSessions(
    @Param('id') id: number,
    @Req() req: Request & { accessToken: string },
  ) {
    return this.studentsService.getStudentSessions(id, req.accessToken);
  }

  @Get(':id/stats')
  async getStudentStats(
    @Param('id') id: number,
    @Req() req: Request & { accessToken: string },
  ) {
    return this.studentsService.getStudentStats(id, req.accessToken);
  }
}
