import {
  Body,
  Controller,
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
    @Query('registrar_id') registrarId?: string,
    @Query('student_id') studentId?: string,
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

    const filters: Record<string, any> = {
      session_id,
    };

    if (registrarId) filters.registrar_id = Number(registrarId);
    if (studentId) filters.student_id = Number(studentId);

    if (role) {
      switch (role.toLowerCase()) {
        case 'student': {
          filters.student_id = Number(currentUserRoleId);
          break;
        }

        case 'registrar': {
          filters.registrar_id = Number(currentUserRoleId);
          break;
        }
      }
    }

    return this.enrollmentService.getEnrollmentListView(req.accessToken, currentUserRoleId, role, filters);
  }

  @Patch('/:id')
  @HttpCode(HttpStatus.OK)
  async updateEnrollment(
    @Param('id') id: number,
    @Body() updateDto: UpdateEnrollmentDto,
    @Req() req: Request & { accessToken: string },
  ) {
    return this.enrollmentService.update(id, updateDto, req.accessToken);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createEnrollment(@Body() createDto: CreateEnrollmentDto, @Req() req: Request & { accessToken: string }) {
    return this.enrollmentService.create(createDto, req.accessToken);
  }
}
