import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { each } from 'lodash';
import { bignumber } from 'mathjs';
import { SharedSessionService } from 'src/modules/shared/services/session.service';
import { SupabaseService } from '../../../supabase/supabase.service';
import { AdminDashboardStats, RegistrarDashboardStats } from '../types/dashboard.types';

@Injectable()
export class DashboardService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly sharedSessionService: SharedSessionService,
  ) {}

  async getAdminDashboardStats(): Promise<AdminDashboardStats> {
    try {
      const sql = `
        select
          jsonb_build_object(
            'totalRegistrars',
            coalesce(
              (
                select 
                  count(r.registrar_id)
                from
                  registrars r
                where
                  r.registrar_id > 0
                limit 1
              ),
              0
            ),
            'totalStudents',
            coalesce(
              (
                select 
                  count(s.student_id)
                from
                  students s
                where
                  s.student_id > 0
                limit 1
              ),
              0
            ),
            'totalPrograms',
            coalesce(
              (
                select 
                  count(p.program_id)
                from
                  programs p
                where
                  p.program_id > 0
                limit 1
              ),
              0
            ),
            'totalCourses',
            coalesce(
              (
                select 
                  count(c.course_id)
                from
                  courses c
                where
                  c.course_id > 0
                limit 1
              ),
              0
            )
          ) as stats
      `;
      const prismaSql = Prisma.sql([sql]);
      const resp = await this.sharedSessionService.prismaClient.$queryRaw<
        [
          {
            stats: AdminDashboardStats;
          },
        ]
      >(prismaSql);

      each(resp[0].stats, (val, key, list) => {
        console.log({
          val,
          key,
          list,
        });
        list[key] = bignumber(val).toNumber();
      });

      return resp[0].stats;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Failed to get dashboard counts');
    }
  }

  async getRegistrarDashboardStats(registrarId: string | number): Promise<RegistrarDashboardStats> {
    try {
      const sql = `
        select
          jsonb_build_object(
            'totalStudents',
            coalesce(
              (
                select 
                  count(s.student_id)
                from
                  students s
                inner join
                  session_students st
                  on (
                    st.student_id = s.student_id
                  )
                inner join
                  sessions se
                  on (
                    se.session_id = st.session_id
                    and
                    se.session_status = 'ACTIVE'
                  )
                inner join
                  student_registrar_sessions srs
                  on (
                    srs.student_id = s.student_id
                    and
                    srs.session_id = se.session_id
                  )
                where
                  srs.registrar_id = ${Number(registrarId)}
                limit 1
              ),
              0
            ),
            'totalPendingEnrollments',
            coalesce(
              (
                select 
                  count(e.enrollment_id)
                from
                  enrollments e
                inner join
                  sessions se
                  on (
                    se.session_id = e.session_id
                    and
                    se.session_status = 'ACTIVE'
                  )
                inner join
                  student_registrar_sessions srs
                  on (
                    srs.student_id = e.student_id
                    and
                    srs.session_id = se.session_id
                  )
                where
                  srs.registrar_id = ${Number(registrarId)}
                  and
                  e.enrollment_status = 'PENDING'
                limit 1
              ),
              0
            ),
            'totalRejectedEnrollments',
            coalesce(
              (
                select 
                  count(e.enrollment_id)
                from
                  enrollments e
                inner join
                  sessions se
                  on (
                    se.session_id = e.session_id
                    and
                    se.session_status = 'ACTIVE'
                  )
                inner join
                  student_registrar_sessions srs
                  on (
                    srs.student_id = e.student_id
                    and
                    srs.session_id = se.session_id
                  )
                where
                  srs.registrar_id = ${Number(registrarId)}
                  and
                  e.enrollment_status = 'REJECTED'
                limit 1
              ),
              0
            ),
            'totalApprovedEnrollments',
            coalesce(
              (
                select 
                  count(e.enrollment_id)
                from
                  enrollments e
                inner join
                  sessions se
                  on (
                    se.session_id = e.session_id
                    and
                    se.session_status = 'ACTIVE'
                  )
                inner join
                  student_registrar_sessions srs
                  on (
                    srs.student_id = e.student_id
                    and
                    srs.session_id = se.session_id
                  )
                where
                  srs.registrar_id = ${Number(registrarId)}
                  and
                  e.enrollment_status in (
                    'APPROVED',
                    'ACTIVE',
                    'COMPLETED'
                  )
                limit 1
              ),
              0
            )
          ) as stats
      `;
      const prismaSql = Prisma.sql([sql]);
      const resp = await this.sharedSessionService.prismaClient.$queryRaw<
        [
          {
            stats: RegistrarDashboardStats;
          },
        ]
      >(prismaSql);

      each(resp[0].stats, (val, key, list) => {
        list[key] = bignumber(val).toNumber();
      });

      return resp[0].stats;
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException('Failed to get dashboard counts');
    }
  }
}
