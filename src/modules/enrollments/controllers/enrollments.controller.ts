import {
  Controller,
  Get,
  Param,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from 'src/supabase/auth.guard';
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

  @Get(':id')
  async findOne(
    @Param('id') id: number,
    @Req() req: Request & { accessToken: string },
  ) {}
}
