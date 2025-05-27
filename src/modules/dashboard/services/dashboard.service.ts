import {
  Injectable,
  Req,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

import { SupabaseService } from '../../../supabase/supabase.service';
import { DashboardCounts } from '../types/dashboard.types';

@Injectable()
export class DashboardService {
  constructor(
    private readonly supabaseService: SupabaseService,
    @Inject('PRISMA_CLIENT') private readonly prisma: PrismaClient,
  ) {}

  async getAdminDashCounts(accessToken: string): Promise<DashboardCounts> {
    try {
      // const [registrars, students, programs, courses] = await Promise.all([
      //   this.supabaseService.select(accessToken, 'registrars', {}),
      //   this.supabaseService.select(accessToken, 'students', {}),
      //   this.supabaseService.select(accessToken, 'programs', {}),
      //   this.supabaseService.select(accessToken, 'courses', {}),
      // ]);

      // return {
      //   totalRegistrars: Array.isArray(registrars) ? registrars.length : 0,
      //   totalStudents: Array.isArray(students) ? students.length : 0,
      //   totalPrograms: Array.isArray(programs) ? programs.length : 0,
      //   totalCourses: Array.isArray(courses) ? courses.length : 0,
      // };

      //prisma
      const [totalRegistrars, totalStudents, totalPrograms, totalCourses] =
        await Promise.all([
          this.prisma.registrars.count(),
          this.prisma.students.count(),
          this.prisma.programs.count(),
          this.prisma.courses.count(),
        ]);
      return {
        totalRegistrars,
        totalStudents,
        totalPrograms,
        totalCourses,
      };
    } catch (error) {
      throw new InternalServerErrorException('Failed to get dashboard counts');
    }
  }
}
