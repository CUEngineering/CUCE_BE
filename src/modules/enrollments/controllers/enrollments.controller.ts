import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from 'src/supabase/auth.guard';
import { UpdateEnrollmentDto } from '../dto/update-enrollment.dto';
import { EnrollmentsService } from '../services/enrollments.service';

@Controller('enrollments')
@UseGuards(AuthGuard)
export class EnrollmentController {
  constructor(private readonly enrollmentService: EnrollmentsService) {}

  @Get()
  async findAll(@Req() req: Request & { accessToken: string; user: any }) {
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

    return this.enrollmentService.getEnrollmentListView(
      req.accessToken,
      currentUserRoleId,
      role,
    );
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
}
