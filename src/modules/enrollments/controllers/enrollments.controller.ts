import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from 'src/supabase/auth.guard';
import { CreateEnrollmentDto, UpdateEnrollmentDto } from '../dto/update-enrollment.dto';
import { EnrollmentsService } from '../services/enrollments.service';

@Controller('enrollments')
@UseGuards(AuthGuard)
export class EnrollmentController {
  constructor(private readonly enrollmentService: EnrollmentsService) {}

  @Get()
  async findAll(
    @Req() req: Request & { accessToken: string; user: any },
    @Query('assigned_to') assigned_to?: 'none' | 'me' | 'others',
    @Query('session_id') session_id?: string,
  ) {
    const { role } = req.user;

    const roleIdMap = {
      STUDENT: req.user.student_id,
      REGISTRAR: req.user.registrar_id,
      ADMIN: req.user.admin_id,
    };

    const currentUserRoleId = roleIdMap[role];

    if (!currentUserRoleId) {
      throw new UnauthorizedException('Role ID not found');
    }

    const options = {
      session_id,
      role: String(role).toLowerCase() as 'student' | 'admin' | 'registrar',
      role_id: currentUserRoleId,
      assigned_to: assigned_to || 'none',
    };

    return this.enrollmentService.getEnrollmentListView(options);
  }

  @Patch('/:id')
  @HttpCode(HttpStatus.OK)
  async updateEnrollment(
    @Param('id') id: number,
    @Body() updateDto: UpdateEnrollmentDto,
    @Req() req: Request & { accessToken: string; user: any },
  ) {
    const roleIdMap = {
      STUDENT: req.user.student_id,
      REGISTRAR: req.user.registrar_id,
      ADMIN: req.user.admin_id,
    };

    const currentUserRoleId = roleIdMap[req.user.role];

    if (!currentUserRoleId) {
      throw new UnauthorizedException('Role ID not found');
    }

    const role = String(req.user.role).toLowerCase() as 'admin' | 'registrar' | 'student';
    if (role === 'student') {
      throw new ForbiddenException(`Ooops.. You don't have access to update enrollments`);
    }

    const options = {
      id,
      data: updateDto,
      role,
      role_id: currentUserRoleId,
    };

    return this.enrollmentService.update(options);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createEnrollment(@Body() createDto: CreateEnrollmentDto, @Req() req: Request & { accessToken: string }) {
    return this.enrollmentService.create(createDto, req.accessToken);
  }
}
