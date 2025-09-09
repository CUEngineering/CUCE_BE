import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { courses, Prisma, program_courses, session_courses, sessions } from '@prisma/client';
import { isPast } from 'date-fns';
import { omit } from 'lodash';
import { bignumber, equal } from 'mathjs';
import { Enrollment } from 'src/modules/enrollments/types/enrollment.types';
import { SessionCourse } from 'src/modules/sessions/types';
import { SharedSessionService } from 'src/modules/shared/services/session.service';
import { SupabaseService } from '../../../supabase/supabase.service';
import { CourseType, CreateCourseDto } from '../dto/create-course.dto';
import { UpdateCourseDto } from '../dto/update-course.dto';
import { EnrolledStudent, SupabaseEnrollment } from '../types/course.types';

@Injectable()
export class CourseService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly sharedSessionService: SharedSessionService,
  ) {}

  private getDefaultCapacity(courseType: CourseType): number {
    switch (courseType) {
      case CourseType.UNDERGRADUATE:
        return 6;
      case CourseType.GRADUATE:
        return 3;
      case CourseType.MASTERS:
        return 6;
      case CourseType.DOCTORATE:
        return 4;
      case CourseType.GENERAL:
        return 12;
      default:
        return 12;
    }
  }

  async create(createCourseDto: CreateCourseDto, accessToken: string) {
    const defaultCapacity = this.getDefaultCapacity(createCourseDto.course_type);

    const courseData = {
      course_title: createCourseDto.course_title,
      course_code: createCourseDto.course_code,
      course_credits: createCourseDto.course_credits,
      course_type: createCourseDto.course_type,
      default_capacity: defaultCapacity,
    };
    return this.supabaseService.insert(accessToken, 'courses', courseData);
  }

  async findAll(accessToken: string) {
    // Get all courses with their enrollments and program associations
    const { data: courses, error } = await this.supabaseService.getClientWithAuth(accessToken).from('courses').select(`
        *,
        enrollments (
          student_id,
          enrollment_status
        ),
        program_courses (
          program_id
        )
      `);

    if (error) {
      throw new Error(`Failed to fetch courses: ${error.message}`);
    }

    // Process each course to calculate unique stats
    const processedCourses = courses.map((course) => {
      // Get unique student IDs from approved, active, or completed enrollments
      const uniqueEnrolledStudents = new Set(
        (course.enrollments || [])
          .filter((enrollment) => ['APPROVED', 'ACTIVE', 'COMPLETED'].includes(enrollment.enrollment_status))
          .map((enrollment) => enrollment.student_id),
      );

      // Get unique program IDs
      const uniquePrograms = new Set((course.program_courses || []).map((pc) => pc.program_id));
      return {
        ...omit(course, ['enrollments', 'program_courses']),
        total_enrolled_students: uniqueEnrolledStudents.size,
        total_programs: uniquePrograms.size,
      };
    });

    return processedCourses;
  }

  async findOne(id: string, accessToken: string) {
    const result = await this.supabaseService.select(accessToken, 'courses', {
      filter: { course_id: id },
    });

    if (!result || result.length === 0) {
      throw new NotFoundException(`Course with ID ${id} not found`);
    }

    return result[0];
  }

  async update(id: string, updateCourseDto: UpdateCourseDto, accessToken: string) {
    // First check if course exists
    await this.findOne(id, accessToken);

    const updateData: any = {
      ...updateCourseDto,
    };

    // If course_type is being updated, recalculate default_capacity
    if (updateCourseDto.course_type) {
      updateData.default_capacity = this.getDefaultCapacity(updateCourseDto.course_type);
    }

    return this.supabaseService.update(accessToken, 'courses', { course_id: id }, updateData);
  }

  async delete(id: string, accessToken: string) {
    // First check if course exists
    await this.findOne(id, accessToken);

    // Check if course has any enrollments
    const { data: enrollments, error: enrollmentError } = await this.supabaseService
      .getClientWithAuth(accessToken)
      .from('enrollments')
      .select('enrollment_id')
      .eq('course_id', id)
      .limit(1);

    if (enrollmentError) {
      throw new InternalServerErrorException(`Failed to check course enrollments: ${enrollmentError.message}`);
    }

    if (enrollments && enrollments.length > 0) {
      throw new BadRequestException('Cannot delete course with existing enrollments');
    }

    // If no enrollments exist, proceed with deletion
    const { error: deleteError } = await this.supabaseService
      .getClientWithAuth(accessToken)
      .from('courses')
      .delete()
      .eq('course_id', id);

    if (deleteError) {
      throw new InternalServerErrorException(`Failed to delete course: ${deleteError.message}`);
    }

    return {
      success: true,
      message: `Course with ID ${id} has been deleted successfully`,
    };
  }

  async getAffiliatedPrograms(id: string, accessToken: string) {
    // First check if course exists
    await this.findOne(id, accessToken);

    // Get all programs associated with this course
    const { data: programs, error } = await this.supabaseService
      .getClientWithAuth(accessToken)
      .from('program_courses')
      .select(
        `
        program:programs (
          program_id,
          program_name,
          program_type,
          total_credits,
          student:students (
            student_id,
            reg_number)
        )
      `,
      )
      .eq('course_id', id);

    if (error) {
      throw new InternalServerErrorException(`Failed to fetch affiliated programs: ${error.message}`);
    }

    if (!programs || programs.length === 0) {
      throw new NotFoundException(`No programs found for course with ID ${id}`);
    }

    return programs.map((pc) => pc.program);
  }

  async getAffiliatedSessions(id: string, accessToken: string) {
    // First check if course exists
    await this.findOne(id, accessToken);

    // Get all sessions associated with this course
    const { data: sessions, error } = await this.supabaseService
      .getClientWithAuth(accessToken)
      .from('session_courses')
      .select(
        `
        session:sessions (
          session_id,
          session_name,
          start_date,
          end_date,
          enrollment_deadline,
          session_status
        ),
        status,
        adjusted_capacity
      `,
      )
      .eq('course_id', id);

    if (error) {
      throw new InternalServerErrorException(`Failed to fetch affiliated sessions: ${error.message}`);
    }

    if (!sessions || sessions.length === 0) {
      throw new NotFoundException(`No sessions found for course with ID ${id}`);
    }

    // Extract and format the session data
    return sessions.map((sc) => ({
      ...sc.session,
      course_status: sc.status,
      adjusted_capacity: sc.adjusted_capacity,
    }));
  }

  async getEnrolledStudents(id: string, accessToken: string): Promise<EnrolledStudent[]> {
    // First check if course exists
    await this.findOne(id, accessToken);

    // Get all students enrolled in this course with approved, active, or completed status
    const { data: enrollments, error } = await this.supabaseService
      .getClientWithAuth(accessToken)
      .from('enrollments')
      .select(
        `
        student:students (
          student_id,
          reg_number,
          first_name,
          last_name,
          email,
          profile_picture,
          program:programs (
            program_id,
            program_name,
            program_type
          )
        ),
        session:sessions (
          session_id,
          session_name
        ),
        enrollment_status,
        special_request,
        rejection_reason,
        created_at
      `,
      )
      .eq('course_id', id)
      .in('enrollment_status', ['APPROVED', 'ACTIVE', 'COMPLETED'])
      .order('created_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(`Failed to fetch enrolled students: ${error.message}`);
    }

    if (!enrollments || enrollments.length === 0) {
      throw new NotFoundException(`No enrolled students found for course with ID ${id}`);
    }

    // Format the response to include both student and enrollment information
    return (enrollments as unknown as SupabaseEnrollment[]).map((enrollment) => ({
      student: {
        id: enrollment.student.student_id,
        reg_number: enrollment.student.reg_number,
        first_name: enrollment.student.first_name,
        last_name: enrollment.student.last_name,
        email: enrollment.student.email,
        profile_picture: enrollment.student.profile_picture,
        program: enrollment.student.program,
      },
      session: {
        session_id: enrollment.session.session_id,
        session_name: enrollment.session.session_name,
      },
      enrollment: {
        status: enrollment.enrollment_status,
        special_request: enrollment.special_request,
        rejection_reason: enrollment.rejection_reason,
        enrolled_at: enrollment.created_at,
      },
    }));
  }

  async getStudentCoursesInSessionsUsingId(
    studentId: number | string,
    sessionIds: (string | number)[],
    onlyEnrolled = false,
  ) {
    const prismaSql = Prisma.sql([
      `
        select
          sc.course_id,
          sc.status,
          jsonb_build_object(
            'session_id',
            s.session_id,
            'session_status',
            s.session_status,
            'enrollment_deadline',
            s.enrollment_deadline
          ) as session,
          jsonb_build_object(
            'course_id',
            c.course_id,
            'course_title',
            c.course_title,
            'course_code',
            c.course_code,
            'course_credits',
            c.course_credits,
            'course_type',
            c.course_type,
            'default_capacity',
            c.default_capacity,
            'course_desc',
            c.course_desc,
            'created_at',
            c.created_at,
            'updated_at',
            c.updated_at
          ) as course,
          coalesce(
            (
              select
                jsonb_agg(
                  jsonb_build_object(
                    'session_id',
                    e.session_id,
                    'enrollment_status',
                    e.enrollment_status,
                    'rejection_reason',
                    e.rejection_reason,
                    'created_at',
                    e.created_at,
                    'updated_at',
                    e.updated_at
                  )
                )
              from
                enrollments e
              where
                e.course_id = c.course_id
                and
                e.student_id = stu.student_id
                and
                e.session_id = coalesce(
                  (
                    select
                      ie.session_id
                    from 
                      enrollments ie
                    where
                      ie.course_id = c.course_id
                      and
                      ie.student_id = stu.student_id
                      and
                      ie.enrollment_status in (
                        'ACTIVE',
                        'APPROVED',
                        'COMPLETED'
                      )
                    order by
                      ie.updated_at asc
                    limit 1
                  ),
                  s.session_id
                )
            ),
            '[]'::jsonb
          ) as enrollments,
          coalesce(
            (
              select
                true
              from
                session_students st
              where
                st.session_id = s.session_id
                and
                st.student_id = stu.student_id
            ),
            false
          ) as is_student_in_session,
          cast(
            coalesce(
              (
                select
                  count(pc.course_id)
                from
                  program_courses pc
                where
                  pc.program_id = stu.program_id
              ),
              0
            ) as int
          ) as no_of_program_course
        from
          session_courses sc
        inner join
          sessions s
          on (sc.session_id = s.session_id)
        inner join
          courses c
          on (sc.course_id = c.course_id)
        inner join
          program_courses pc
          on (
            pc.course_id = c.course_id
          )
        inner join
          students stu
          on (
            pc.program_id = stu.program_id
          ) 
        ${
          onlyEnrolled
            ? `
                inner join
                  enrollments e
                  on (
                    e.course_id = c.course_id
                    and
                    e.session_id = s.session_id
                    and
                    e.student_id = stu.student_id
                  )
              `
            : ''
        } 
        where
          s.session_id in (${sessionIds.join(',')})
          and
          stu.student_id = ${studentId}
          ${
            onlyEnrolled
              ? `
                  and
                  e.enrollment_status in ('APPROVED', 'ACTIVE', 'COMPLETED')
                `
              : ''
          }
      `,
    ]);

    type CourseRespType = Pick<SessionCourse, 'course_id' | 'status'> & {
      session: Pick<sessions, 'session_id' | 'enrollment_deadline' | 'session_status'>;
      course: courses;
      enrollments: Pick<
        Enrollment,
        'session_id' | 'enrollment_status' | 'rejection_reason' | 'created_at' | 'updated_at'
      >[];
      is_student_in_session: boolean;
      no_of_program_course: number;
    };

    const eligibleCourses = await this.sharedSessionService.prismaClient.$queryRaw<CourseRespType[]>(prismaSql);

    const processedCourses = (eligibleCourses ?? []).map((record) => {
      const inActiveSession = record.session.session_status === 'ACTIVE';
      const enrolledStatusList = ['APPROVED', 'ACTIVE', 'COMPLETED'];
      const isCourseOpenForSession = record.status === 'OPEN';
      const hasAcceptedEnrollment = record.enrollments.some((enrollment) =>
        enrolledStatusList.includes(enrollment.enrollment_status),
      );

      const hasPendingEnrollment = record.enrollments.some((enrollment) => enrollment.enrollment_status === 'PENDING');
      const enrollmentDeadline = record.session.enrollment_deadline;
      const hasPastEnrollmentDeadline = isPast(new Date(enrollmentDeadline));
      const isStudentInSession = !!record.is_student_in_session;
      const isStudentInActiveSession = isStudentInSession && inActiveSession;

      return {
        ...record.course,
        in_active_session: inActiveSession,
        is_enrolled: hasAcceptedEnrollment,
        is_student_in_session: isStudentInSession,
        is_student_in_active_session: isStudentInActiveSession,
        session_id: record.session.session_id,
        can_enroll:
          !(hasAcceptedEnrollment || hasPendingEnrollment) &&
          inActiveSession &&
          !hasPastEnrollmentDeadline &&
          isStudentInActiveSession &&
          isCourseOpenForSession,
        can_request:
          !(hasAcceptedEnrollment || hasPendingEnrollment) &&
          inActiveSession &&
          !hasPastEnrollmentDeadline &&
          isStudentInActiveSession,
        enrollment_deadline: enrollmentDeadline,
        student_course_enrollements: record.enrollments,
        total_programs: bignumber(record.no_of_program_course).toNumber(),
        availability_status: record.status,
      };
    });

    return processedCourses;
  }

  async getEligibleCourses(accessToken: string, studentId: number) {
    const supabase = this.supabaseService.getClientWithAuth(accessToken);
    const activeSessionIds = await this.sharedSessionService.getActiveSessionIds(supabase);

    if (activeSessionIds.every((id) => equal(id, 0))) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'NO_ACTIVE_SESSION',
        message: 'There is no active session at the moment',
      });
    }

    const { data: activeSessionStudents, error: activeSessionStudentError } = await supabase
      .from('session_students')
      .select(
        `
          session_id,
          student_id,
          created_at,
          updated_at
        `,
      )
      .in('session_id', activeSessionIds)
      .eq('student_id', studentId)
      .limit(1);

    if (activeSessionStudentError) {
      throw new Error(`Failed to check if student is in active session: ${activeSessionStudentError.message}`);
    }

    if (!activeSessionStudents?.length) {
      throw new BadRequestException({
        statusCode: 400,
        code: 'NOT_IN_ACTIVE_SESSION',
        message: 'Student is currently not in active session. Kindly contact your registrar for possible resolution.',
      });
    }

    const processedCourses = (await this.getStudentCoursesInSessionsUsingId(studentId, activeSessionIds)).map(
      (course) => {
        return {
          ...course,
          active_session_ids: activeSessionIds,
        };
      },
    );

    return processedCourses;
  }

  async getStudentProgramCoursesUsingId(studentId: number | string) {
    const prismaSql = Prisma.sql([
      `
        select
          pc.course_id,
          pc.program_id,
          jsonb_build_object(
            'course_id',
            c.course_id,
            'course_title',
            c.course_title,
            'course_code',
            c.course_code,
            'course_credits',
            c.course_credits,
            'course_type',
            c.course_type,
            'default_capacity',
            c.default_capacity,
            'course_desc',
            c.course_desc,
            'created_at',
            c.created_at,
            'updated_at',
            c.updated_at
          ) as course,
          coalesce(
            (
              select
                jsonb_agg(
                  jsonb_build_object(
                    'session_id',
                    e.session_id,
                    'enrollment_status',
                    e.enrollment_status,
                    'rejection_reason',
                    e.rejection_reason,
                    'created_at',
                    e.created_at,
                    'updated_at',
                    e.updated_at
                  )
                )
              from
                enrollments e
              where
                e.course_id = c.course_id
                and
                e.student_id = stu.student_id
                and
                e.session_id = coalesce(
                  (
                    select
                      ie.session_id
                    from 
                      enrollments ie
                    where
                      ie.course_id = c.course_id
                      and
                      ie.student_id = stu.student_id
                      and
                      ie.enrollment_status in (
                        'ACTIVE',
                        'APPROVED',
                        'COMPLETED'
                      )
                    order by
                      ie.updated_at asc
                    limit 1
                  ),
                  coalesce(
                    (
                      select
                        s.session_id
                      from 
                        sessions s
                      where
                        s.session_status = 'ACTIVE'
                      limit 1
                    ),
                    0
                  )
                )
            ),
            '[]'::jsonb
          ) as enrollments,
          coalesce(
            (
              select
                true
              from
                session_students st
              inner join
                sessions s
                on (
                  s.session_id = st.session_id
                )
              where
                s.session_status = 'ACTIVE'
                and
                st.student_id = stu.student_id
              limit 1
            ),
            false
          ) as is_student_in_active_session,
          (
            select
              jsonb_build_object(
                'session_course',
                to_jsonb(sc),
                'session',
                to_jsonb(s)
              )
            from
              session_courses sc
            inner join
              sessions s
              on (
                s.session_id = sc.session_id
              )
            where
              s.session_status = 'ACTIVE'
              and
              sc.course_id = c.course_id
            limit 1
          ) as active_session_course
        from
          program_courses pc
        inner join
          courses c
          on (pc.course_id = c.course_id)
        inner join
          students stu
          on (stu.program_id = pc.program_id)
        where
          stu.student_id = ${Number(studentId)}
      `,
    ]);

    type ProgramCourseRespType = Pick<program_courses, 'course_id' | 'program_id'> & {
      course: courses;
      enrollments: Pick<
        Enrollment,
        'session_id' | 'enrollment_status' | 'rejection_reason' | 'created_at' | 'updated_at'
      >[];
      is_student_in_active_session: boolean;
      active_session_course?: {
        session_course: session_courses;
        session: sessions;
      } | null;
    };

    try {
      const programCourses = await this.sharedSessionService.prismaClient.$queryRaw<ProgramCourseRespType[]>(prismaSql);
      const uniquePrograms = new Set((programCourses || []).map((pc) => pc.program_id));

      const processedCourses = programCourses.map((record) => {
        const inActiveSession = !!record.active_session_course;
        const enrolledStatusList = ['APPROVED', 'ACTIVE', 'COMPLETED'];
        const activeSessionCourse = record.active_session_course?.session_course ?? undefined;
        const activeSession = record.active_session_course?.session ?? undefined;
        const isCourseOpenForSession = activeSessionCourse?.status === 'OPEN';
        const hasAcceptedEnrollment = record.enrollments.some((enrollment) =>
          enrolledStatusList.includes(enrollment.enrollment_status),
        );

        const hasPendingEnrollment = record.enrollments.some(
          (enrollment) => enrollment.enrollment_status === 'PENDING',
        );
        const enrollmentDeadline = activeSession?.enrollment_deadline;

        const hasPastEnrollmentDeadline = enrollmentDeadline ? isPast(new Date(enrollmentDeadline)) : false;
        const isStudentInSession = !!record.is_student_in_active_session;
        const isStudentInActiveSession = inActiveSession && isStudentInSession;

        return {
          ...record.course,
          in_active_session: inActiveSession,
          is_enrolled: hasAcceptedEnrollment,
          is_student_in_session: isStudentInSession,
          is_student_in_active_session: isStudentInActiveSession,
          session_id: activeSession?.session_id,
          can_enroll:
            !(hasAcceptedEnrollment || hasPendingEnrollment) &&
            inActiveSession &&
            !hasPastEnrollmentDeadline &&
            isStudentInActiveSession &&
            isCourseOpenForSession,
          can_request:
            !(hasAcceptedEnrollment || hasPendingEnrollment) &&
            inActiveSession &&
            !hasPastEnrollmentDeadline &&
            isStudentInActiveSession,
          enrollment_deadline: enrollmentDeadline,
          student_course_enrollements: record.enrollments,
          total_programs: uniquePrograms.size,
          availability_status: isCourseOpenForSession ? 'OPEN' : 'CLOSED',
        };
      });

      return processedCourses;
    } catch (e) {
      console.log(e);
      throw new Error(`Failed to fetch program courses: ${e.message}`);
    }
  }

  async getStudentProgramCourses(accessToken: string, studentId: number) {
    const supabase = this.supabaseService.getClientWithAuth(accessToken);
    const activeSessionIds = await this.sharedSessionService.getActiveSessionIds(supabase);

    const processedCourses = (await this.getStudentProgramCoursesUsingId(studentId)).map((course) => {
      return {
        ...course,
        active_session_ids: activeSessionIds,
      };
    });

    return processedCourses;
  }
}
