import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from 'src/supabase/auth.guard';
import { EnrollmentsService } from '../services/enrollments.service';

@Controller('enrollments')
@UseGuards(AuthGuard)
export class EnrollmentController {
  constructor(private readonly enrollmentService: EnrollmentsService) {}

  @Get()
  async findAll(@Req() req: Request & { accessToken: string }) {
    return this.enrollmentService.findAll(req.accessToken);
  }

  @Get(':id')
  async findOne(
    @Param('id') id: number,
    @Req() req: Request & { accessToken: string },
  ) {}
}
