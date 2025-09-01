import type { Request, Response } from 'express';
import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserType } from '@prisma/client';
import { File as MulterFile } from 'multer';
import { Public } from 'src/common/public.decorator';
import { AuthGuard } from '../../../supabase/auth.guard';
import { ClaimStudentDto } from '../dto/claim-student.dto';
import { AcceptStudentInviteDto, InviteStudentDto } from '../dto/invite-student.dto';
import { StudentsService } from '../services/students.service';

@Controller('students')
@UseGuards(AuthGuard)
export class StudentsController {
  constructor(
    @Inject(StudentsService)
    private readonly studentsService: StudentsService,
  ) {}

  @Get()
  async findAll(
    @Req() req: Request & { accessToken: string; user: { role: Lowercase<UserType>; [key: string]: string } },
    @Query('assigned_to') assignedTo: 'all' | 'none' | 'me' | 'others',
    @Query('session_id') sessionId?: string | number,
  ) {
    const role = String(req.user.role).toLowerCase();
    if (!['admin', 'registrar'].includes(role)) {
      throw new ForbiddenException('Only admins and registrars can view student list');
    }

    return this.studentsService.findAll({
      accessToken: req.accessToken,
      role: role as 'admin' | 'registrar',
      roleId: role === 'admin' ? req.user.admin_id : req.user.registrar_id,
      sessionId,
      assignedTo: String(assignedTo || 'all').toLowerCase() as 'all' | 'none' | 'me' | 'others',
    });
  }

  @Get(':id')
  async findOne(
    @Param('id') id: number,
    @Req() req: Request & { user: { role: Lowercase<UserType>; [key: string]: string } },
  ) {
    const role = String(req.user.role).toLowerCase();
    if (!['admin', 'registrar'].includes(role)) {
      throw new ForbiddenException('Only admins and registrars can view student data');
    }

    return this.studentsService.findOne({
      id,
      role: role as 'admin' | 'registrar',
      roleId: role === 'admin' ? req.user.admin_id : req.user.registrar_id,
    });
  }
  // Update students
  //   @Patch(':id')
  //   async update(
  //     @Param('id') id: number,
  //     @Body() updateStudentDto: UpdateStudentDto,
  //     @Req() req: Request & { accessToken: string },
  //   ) {
  //     return this.studentsService.update(id, updateStudentDto, req.accessToken);
  //   }

  @Post('invite')
  async invite(@Body() inviteDto: InviteStudentDto, @Req() req: Request & { accessToken: string }) {
    const result = await this.studentsService.inviteStudent(inviteDto, req.accessToken);

    return {
      success: true,
      message: result.message,
      student: result.student,
    };
  }

  @Get(':id/sessions')
  async getStudentSessions(@Param('id') id: number) {
    return this.studentsService.getStudentSessions(id);
  }

  @Get(':id/session/:session_id/courses')
  async getStudentSessionCourses(
    @Param('id') studentId: number | string,
    @Param('session_id') sessionId: number | string,
  ) {
    return this.studentsService.getStudentSessionCourses(sessionId, studentId);
  }

  @Get(':id/program/courses')
  async getStudentProgramCourses(@Param('id') studentId: number | string) {
    return this.studentsService.getStudentProgramCourses(studentId);
  }

  @Post(':studentId/claim')
  async claimStudent(
    @Req() req: Request & { user: { role: Lowercase<UserType>; [key: string]: string } },
    @Res() res: Response,
    @Param('studentId') studentId: number | string,
    @Body() body: ClaimStudentDto,
  ) {
    const role = String(req.user.role).toLowerCase();
    if (!['admin', 'registrar'].includes(role)) {
      throw new ForbiddenException('Only admins and registrars can view student list');
    }

    await this.studentsService.claimStudent({
      studentId,
      registrarId: role === 'registrar' ? req.user.registrar_id : body.registrar_id,
      role: role as 'admin' | 'registrar',
      roleId: role === 'admin' ? req.user.admin_id : req.user.registrar_id,
    });

    return res.status(HttpStatus.NO_CONTENT).send();
  }

  @Get(':id/stats')
  async getStudentStats(@Param('id') id: number, @Req() req: Request & { accessToken: string }) {
    return this.studentsService.getStudentStats(id, req.accessToken);
  }

  @Public()
  @UseInterceptors(FileInterceptor('profile_picture'))
  @Post('accept-invite')
  async acceptStudentInvite(@Body() dto: AcceptStudentInviteDto, @UploadedFile() file?: MulterFile) {
    const result = await this.studentsService.acceptStudentInvite(dto, file);

    return {
      success: true,
      message: 'Invitation accepted successfully',
      user: result.user,
      session: result.session,
      role: result.role,
    };
  }

  @Patch(':id/reject')
  async rejectStudent(@Param('id') id: number, @Req() req: Request & { accessToken: string }) {
    return this.studentsService.rejectStudent(id, req.accessToken);
  }

  @Delete(':id')
  async deleteStudent(@Param('id') id: number, @Req() req: Request & { accessToken: string }) {
    return this.studentsService.deleteStudent(id, req.accessToken);
  }
}
