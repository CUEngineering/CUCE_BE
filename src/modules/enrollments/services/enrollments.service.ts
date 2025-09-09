import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  courses,
  enrollments,
  Prisma,
  PrismaClient,
  programs,
  registrars,
  session_courses,
  sessions,
  students,
} from '@prisma/client';
import isNumeric from 'fast-isnumeric';
import { SharedSessionService } from 'src/modules/shared/services/session.service';
import { sendEmail } from 'src/utils/email.helper';
import { SupabaseService } from '../../../supabase/supabase.service';
import { CreateEnrollmentDto, UpdateEnrollmentDto } from '../dto/update-enrollment.dto';
import { Enrollment } from '../types/enrollment.types';

@Injectable()
export class EnrollmentsService {
  constructor(
    @Inject('PRISMA_CLIENT') private readonly prisma: PrismaClient,
    private readonly supabaseService: SupabaseService,
    private readonly sharedSessionService: SharedSessionService,
  ) {}

  /**
   * Create a new enrollment request
   */
  async createEnrollment(studentId: number, courseId: number, sessionId: number, isSpecialRequest = false) {
    try {
      // Check if student already has a non-rejected enrollment for this course in this session
      const existingEnrollment = await this.prisma.enrollments.findFirst({
        where: {
          student_id: studentId,
          course_id: courseId,
          session_id: sessionId,
          enrollment_status: {
            notIn: ['REJECTED'],
          },
        },
      });

      if (existingEnrollment) {
        throw new BadRequestException(
          `You already have an active enrollment for this course with status: ${existingEnrollment.enrollment_status}`,
        );
      }

      // Check if session is active and enrollment deadline hasn't passed
      const session = await this.prisma.sessions.findUnique({
        where: { session_id: sessionId },
      });

      if (!session) {
        throw new NotFoundException(`Session with ID ${sessionId} not found`);
      }

      if (session.session_status !== 'ACTIVE') {
        throw new BadRequestException('Enrollment is only allowed for active sessions');
      }

      if (new Date() > new Date(session.enrollment_deadline)) {
        throw new BadRequestException('Enrollment deadline has passed for this session');
      }

      // Check if course exists and is open for enrollment
      const sessionCourse = await this.prisma.session_courses.findUnique({
        where: {
          session_id_course_id: {
            session_id: sessionId,
            course_id: courseId,
          },
        },
      });

      if (!sessionCourse) {
        throw new NotFoundException(`Course with ID ${courseId} is not available for this session`);
      }

      if (sessionCourse.status !== 'OPEN' && !isSpecialRequest) {
        throw new BadRequestException(
          'This course is closed for enrollment. You can submit a special request if needed.',
        );
      }

      // Create enrollment with PENDING status
      const enrollment = await this.prisma.enrollments.create({
        data: {
          student_id: studentId,
          course_id: courseId,
          session_id: sessionId,
          enrollment_status: 'PENDING',
          special_request: isSpecialRequest,
          updated_at: new Date(),
        },
      });

      return {
        success: true,
        message: isSpecialRequest
          ? 'Special enrollment request submitted successfully'
          : 'Enrollment request submitted successfully',
        enrollment,
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      if (error instanceof Error) {
        throw new InternalServerErrorException(`Failed to create enrollment: ${error.message}`);
      }

      throw new InternalServerErrorException('An unknown error occurred while creating enrollment');
    }
  }

  /**
   * Approve an enrollment
   */
  async approveEnrollment(enrollmentId: number, registrarId: number) {
    try {
      const enrollment = await this.prisma.enrollments.findUnique({
        where: { enrollment_id: enrollmentId },
      });

      if (!enrollment) {
        throw new NotFoundException(`Enrollment with ID ${enrollmentId} not found`);
      }

      if (enrollment.enrollment_status !== 'PENDING') {
        throw new BadRequestException(`Cannot approve enrollment with status ${enrollment.enrollment_status}`);
      }

      // Check if registrar is already assigned to this student for this session
      const existingAssignment = await this.prisma.enrollments.findFirst({
        where: {
          student_id: enrollment.student_id,
          session_id: enrollment.session_id,
          registrar_id: { not: null },
        },
      });

      // If registrar is already assigned but different from current one, prevent approval
      if (existingAssignment && existingAssignment.registrar_id !== registrarId) {
        throw new ForbiddenException(`Another registrar is already assigned to this student for this session`);
      }

      // Update enrollment to APPROVED status and assign registrar
      const updatedEnrollment = await this.prisma.enrollments.update({
        where: { enrollment_id: enrollmentId },
        data: {
          enrollment_status: 'APPROVED',
          registrar_id: registrarId,
        },
      });

      // Also assign this registrar to all other pending enrollments from this student in this session
      await this.prisma.enrollments.updateMany({
        where: {
          student_id: enrollment.student_id,
          session_id: enrollment.session_id,
          enrollment_status: 'PENDING',
          registrar_id: null,
        },
        data: {
          registrar_id: registrarId,
        },
      });

      return {
        success: true,
        message: 'Enrollment approved successfully',
        enrollment: updatedEnrollment,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      if (error instanceof Error) {
        throw new InternalServerErrorException(`Failed to approve enrollment: ${error.message}`);
      }

      throw new InternalServerErrorException('An unknown error occurred while approving enrollment');
    }
  }

  /**
   * Reject an enrollment with a reason
   */
  async rejectEnrollment(enrollmentId: number, registrarId: number, rejectionReason: string) {
    try {
      const enrollment = await this.prisma.enrollments.findUnique({
        where: { enrollment_id: enrollmentId },
      });

      if (!enrollment) {
        throw new NotFoundException(`Enrollment with ID ${enrollmentId} not found`);
      }

      if (enrollment.enrollment_status !== 'PENDING') {
        throw new BadRequestException(`Cannot reject enrollment with status ${enrollment.enrollment_status}`);
      }

      // Check if registrar is already assigned to this student for this session
      const existingAssignment = await this.prisma.enrollments.findFirst({
        where: {
          student_id: enrollment.student_id,
          session_id: enrollment.session_id,
          registrar_id: { not: null },
        },
      });

      // If registrar is already assigned but different from current one, prevent rejection
      if (existingAssignment && existingAssignment.registrar_id !== registrarId) {
        throw new ForbiddenException(`Another registrar is already assigned to this student for this session`);
      }

      if (!rejectionReason) {
        throw new BadRequestException('Rejection reason is required');
      }

      // Update enrollment to REJECTED status, assign registrar, and add rejection reason
      const updatedEnrollment = await this.prisma.enrollments.update({
        where: { enrollment_id: enrollmentId },
        data: {
          enrollment_status: 'REJECTED',
          registrar_id: registrarId,
          rejection_reason: rejectionReason,
        },
      });

      // Also assign this registrar to all other pending enrollments from this student in this session
      await this.prisma.enrollments.updateMany({
        where: {
          student_id: enrollment.student_id,
          session_id: enrollment.session_id,
          enrollment_status: 'PENDING',
          registrar_id: null,
        },
        data: {
          registrar_id: registrarId,
        },
      });

      return {
        success: true,
        message: 'Enrollment rejected successfully',
        enrollment: updatedEnrollment,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      if (error instanceof Error) {
        throw new InternalServerErrorException(`Failed to reject enrollment: ${error.message}`);
      }

      throw new InternalServerErrorException('An unknown error occurred while rejecting enrollment');
    }
  }

  /**
   * Cancel an enrollment
   */
  async cancelEnrollment(enrollmentId: number, userId: string, isAdmin = false) {
    try {
      const enrollment = await this.prisma.enrollments.findUnique({
        where: { enrollment_id: enrollmentId },
        include: { students: true },
      });

      if (!enrollment) {
        throw new NotFoundException(`Enrollment with ID ${enrollmentId} not found`);
      }

      // Check if enrollment is in a terminal state
      if (['REJECTED', 'COMPLETED', 'CANCELLED'].includes(enrollment.enrollment_status)) {
        throw new BadRequestException(`Cannot cancel enrollment with status ${enrollment.enrollment_status}`);
      }

      // If not admin, verify this is the student's own enrollment
      if (!isAdmin && enrollment.students.user_id !== userId) {
        throw new ForbiddenException('You do not have permission to cancel this enrollment');
      }

      // Update enrollment to CANCELLED status
      const updatedEnrollment = await this.prisma.enrollments.update({
        where: { enrollment_id: enrollmentId },
        data: {
          enrollment_status: 'CANCELLED',
        },
      });

      return {
        success: true,
        message: 'Enrollment cancelled successfully',
        enrollment: updatedEnrollment,
      };
    } catch (error) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      if (error instanceof Error) {
        throw new InternalServerErrorException(`Failed to cancel enrollment: ${error.message}`);
      }

      throw new InternalServerErrorException('An unknown error occurred while cancelling enrollment');
    }
  }

  /**
   * Automatically transition enrollments when session status changes
   */
  async updateEnrollmentsForSessionChange(sessionId: number, newSessionStatus: string) {
    try {
      if (newSessionStatus === 'ACTIVE') {
        // When session becomes active, change all APPROVED enrollments to ACTIVE
        await this.prisma.enrollments.updateMany({
          where: {
            session_id: sessionId,
            enrollment_status: 'APPROVED',
          },
          data: {
            enrollment_status: 'ACTIVE',
          },
        });
      } else if (newSessionStatus === 'CLOSED') {
        // When session is closed, change all ACTIVE enrollments to COMPLETED
        await this.prisma.enrollments.updateMany({
          where: {
            session_id: sessionId,
            enrollment_status: 'ACTIVE',
          },
          data: {
            enrollment_status: 'COMPLETED',
          },
        });
      }

      return {
        success: true,
        message: `Enrollments updated successfully for session ${sessionId}`,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new InternalServerErrorException(`Failed to update enrollments for session change: ${error.message}`);
      }

      throw new InternalServerErrorException('An unknown error occurred while updating enrollments');
    }
  }

  /**
   * Get all enrollments
   */
  async findAll(filters: any = {}) {
    try {
      return await this.prisma.enrollments.findMany({
        where: filters,
        include: {
          courses: true,
          students: true,
          registrars: true,
          sessions: true,
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new InternalServerErrorException(`Failed to find enrollments: ${error.message}`);
      }

      throw new InternalServerErrorException('An unknown error occurred while retrieving enrollments');
    }
  }

  /**
   * Get a specific enrollment
   */
  async findOne(enrollmentId: number) {
    try {
      const enrollment = await this.prisma.enrollments.findUnique({
        where: { enrollment_id: enrollmentId },
        include: {
          // course: true,
          courses: true,

          students: true,
          registrars: true,
          sessions: true,
        },
      });

      if (!enrollment) {
        throw new NotFoundException(`Enrollment with ID ${enrollmentId} not found`);
      }

      return enrollment;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      if (error instanceof Error) {
        throw new InternalServerErrorException(`Failed to find enrollment: ${error.message}`);
      }

      throw new InternalServerErrorException('An unknown error occurred while retrieving enrollment');
    }
  }

  // SupaBase
  async getEnrollmentListView(options: {
    session_id?: string | number | undefined | null;
    role: 'student' | 'admin' | 'registrar';
    role_id: string | number;
    assigned_to: 'none' | 'me' | 'others';
  }): Promise<
    {
      enrollmentId: number;
      studentName: string;
      studentId: string;
      studentImage: string;
      courseCode: string;
      courseName: string;
      courseType: string;
      courseStatus: string;
      courseCredit: number;
      courseDescription: string;
      program: string;
      status: 'approved' | 'pending' | 'rejected';
      assignedRegistrar?: string;
      assignedRegistrarImage?: string;
      assignedStatus: 'unassigned' | 'toOthers' | 'toMe';
      sessionName: string;
      sessionId: number;
      courseId: number;
      reason: string | null;
      createdAt?: Date;
      updatedAt?: Date;
    }[]
  > {
    const activeSessionIds = await this.sharedSessionService.getActiveSessionIds();
    const { role, role_id } = options;
    let assignedTo = options.assigned_to || 'none';
    let sessionId = options.session_id;

    if (!isNumeric(sessionId)) {
      sessionId = activeSessionIds[0];
    }

    if (role === 'registrar' && assignedTo !== 'me') {
      assignedTo = 'me';
    }

    let registrarId: string = String(role === 'registrar' ? (role_id ?? '') : '');
    if (role === 'admin') {
      const adminRegistrarResp = await this.sharedSessionService.prismaClient.$queryRaw<
        [
          {
            registrar_id: string | number;
          },
        ]
      >`
        select
          r.registrar_id
        from
          admins a
        inner join
          registrars r
          on (
            a.email = r.email
          )
        where
          a.admin_id = ${Number(role_id)}
        limit 1
      `;

      if (!adminRegistrarResp.length) {
        throw new BadRequestException(`Administrator doesn't have a registrar account`);
      }

      registrarId = String(adminRegistrarResp[0].registrar_id);
    }

    const prismaSql = Prisma.sql([
      `
        select
          e.*,
          to_jsonb(stu) as student,
          to_jsonb(s) as session,
          to_jsonb(c) as course,
          to_jsonb(sc) as session_course,
          to_jsonb(p) as program,
          (
            select
              to_jsonb(r)
            from
              student_registrar_sessions srs
            inner join
              registrars r
              on (
                r.registrar_id = srs.registrar_id
              )
            where
              srs.student_id = stu.student_id
              and
              srs.session_id = s.session_id
          ) as registrar,
          exists (
            select
              stus.session_id
            from
              session_students stus
            where
              stus.student_id = stu.student_id
              and
              stus.session_id = s.session_id
          ) as is_student_in_session
        from
          enrollments e
        inner join
          students stu
          on (
            stu.student_id = e.student_id
          )
        inner join
          programs p
          on (
            stu.program_id = p.program_id
          )
        inner join
          sessions s
          on (
            s.session_id = e.session_id
          )
        inner join
          courses c
          on (
            c.course_id = e.course_id
          )
        inner join
          session_courses sc
          on (
            s.session_id = sc.session_id
            and
            c.course_id = sc.course_id
          )
        ${
          role !== 'student'
            ? `
                ${assignedTo === 'none' ? 'left join' : 'inner join'}
                  student_registrar_sessions srs
                  on (
                    srs.student_id = stu.student_id
                    and
                    srs.session_id = s.session_id
                  )
              `
            : ''
        }
        where
          ${
            role === 'student'
              ? `
                  stu.student_id = ${role_id}
                `
              : assignedTo === 'none'
                ? `
                    srs.session_id is null
                  `
                : assignedTo === 'others'
                  ? `
                      srs.registrar_id <> ${registrarId}
                    `
                  : assignedTo === 'me'
                    ? `
                        srs.registrar_id = ${registrarId}
                      `
                    : 'e.student_id = 0'
          }
          and
            s.session_id = ${sessionId}
      `,
    ]);

    type EnrollmentRespType = enrollments & {
      student: students;
      session: sessions;
      course: courses;
      session_course: session_courses;
      program: programs;
      registrar?: registrars | null;
      is_student_in_session: boolean;
    };

    const enrollments = await this.sharedSessionService.prismaClient.$queryRaw<EnrollmentRespType[]>(prismaSql);

    return enrollments.map((e) => {
      let status: 'approved' | 'pending' | 'rejected';
      switch (e.enrollment_status) {
        case 'APPROVED':
          status = 'approved';
          break;
        case 'REJECTED':
          status = 'rejected';
          break;
        default:
          status = 'pending';
          break;
      }

      // Compute assignedStatus
      let assignedStatus: 'unassigned' | 'toOthers' | 'toMe';
      switch (assignedTo) {
        case 'none': {
          assignedStatus = 'unassigned';
          break;
        }

        case 'others': {
          assignedStatus = 'toOthers';
          break;
        }

        case 'me':
        default: {
          assignedStatus = 'toMe';
          break;
        }
      }

      const session = e.session;
      const sessionId = e.session_course.session_id ?? session.session_id;
      const isActiveSession = activeSessionIds.includes(String(sessionId));
      const enrollmentDeadline = session.enrollment_deadline;

      return {
        enrollmentId: e.enrollment_id,
        studentName: `${e.student.first_name ?? ''} ${e.student.last_name ?? ''}`.trim(),
        studentId: e.student.reg_number ?? '',
        studentImage: e.student.profile_picture ?? '',
        courseCode: e.course.course_code ?? '',
        courseCredit: e.course.course_credits,
        courseName: e.course.course_title ?? '',
        courseType: e.course.course_type,
        courseDescription: e.course.course_desc ?? '',
        sessionId,
        isActiveSession,
        enrollmentDeadline,
        isStudentInSession: e.is_student_in_session,
        courseId: e.course.course_id,
        courseStatus: e.session_course.status,
        program: e.program.program_name,
        status,
        assignedRegistrar: `${e.registrar?.first_name ?? ''} ${e.registrar?.last_name ?? ''}`.trim(),
        assignedRegistrarImage: e.registrar?.profile_picture ?? '',
        assignedStatus,
        sessionName: session.session_name ?? '',
        reason: e.rejection_reason,
        createdAt: e.created_at,
        updatedAt: e.updated_at,
      };
    });
  }

  async update(options: {
    id: number | string;
    data: UpdateEnrollmentDto;
    role: 'admin' | 'registrar';
    role_id: string | number;
  }): Promise<{ success: boolean; message: string }> {
    const { id: enrollment_id, data, role, role_id } = options;

    let registrarId: string = String(role === 'registrar' ? (role_id ?? '') : '');
    if (role === 'admin') {
      const adminRegistrarResp = await this.sharedSessionService.prismaClient.$queryRaw<
        [
          {
            registrar_id: string | number;
          },
        ]
      >`
        select
          r.registrar_id
        from
          admins a
        inner join
          registrars r
          on (
            a.email = r.email
          )
        where
          a.admin_id = ${Number(role_id)}
        limit 1
      `;

      if (!adminRegistrarResp.length) {
        throw new BadRequestException(`Administrator doesn't have a registrar account`);
      }

      registrarId = String(adminRegistrarResp[0].registrar_id);
    }

    try {
      const enrollmentsList = await this.sharedSessionService.prismaClient.$queryRaw<
        [
          Pick<Enrollment, 'student_id' | 'session_id' | 'registrar_id' | 'course_id'> & {
            session: Pick<
              sessions,
              'session_id' | 'session_name' | 'session_status' | 'start_date' | 'end_date' | 'enrollment_deadline'
            >;
            course: Pick<
              courses,
              'course_id' | 'course_title' | 'course_code' | 'course_credits' | 'course_type' | 'course_desc'
            >;
            student: Pick<
              students,
              'student_id' | 'reg_number' | 'first_name' | 'last_name' | 'email' | 'profile_picture'
            >;
            registrar: Pick<
              registrars,
              'registrar_id' | 'first_name' | 'last_name' | 'email' | 'profile_picture' | 'is_suspended'
            > | null;
          },
        ]
      >`
        select 
          e.student_id,
          e.session_id,
          e.registrar_id,
          e.course_id,
          jsonb_build_object(
            'session_id',
            se.session_id,
            'session_name',
            se.session_name,
            'session_status',
            se.session_status,
            'start_date',
            se.start_date,
            'end_date',
            se.end_date,
            'enrollment_deadline',
            se.enrollment_deadline
          ) as "session",
          jsonb_build_object(
            'course_id',
            co.course_id,
            'course_title',
            co.course_title,
            'course_code',
            co.course_code,
            'course_credits',
            co.course_credits,
            'course_type',
            co.course_type,
            'course_desc',
            co.course_desc
          ) as "course",
          jsonb_build_object(
            'student_id',
            st.student_id,
            'reg_number',
            st.reg_number,
            'first_name',
            st.first_name,
            'last_name',
            st.last_name,
            'email',
            st.email,
            'profile_picture',
            st.profile_picture
          ) as "student",
          jsonb_build_object(
            'registrar_id',
            re.registrar_id,
            'first_name',
            re.first_name,
            'last_name',
            re.last_name,
            'email',
            re.email,
            'profile_picture',
            re.profile_picture,
            'is_suspended',
            re.is_suspended
          ) as "registrar"
        from
          enrollments e
        inner join
          students st
          on (
            e.student_id = st.student_id
          )
        inner join
          sessions se
          on (
            e.session_id = se.session_id
          )
        inner join
          courses co
          on (
            e.course_id = co.course_id
          )
        left join
          registrars re
          on (
            e.registrar_id = re.registrar_id
          )
        where
          e."enrollment_id" = ${enrollment_id}
        limit 1
      `;

      if (!enrollmentsList?.length) {
        throw new NotFoundException(`Enrollment with ID ${enrollment_id} not found`);
      }

      const [enrollment] = enrollmentsList;
      const prismaSql = Prisma.sql([
        `
          update enrollments set
            enrollment_status = '${data.enrollment_status}',
            rejection_reason = ${data.enrollment_status === 'REJECTED' ? `'${data.rejection_reason}'` : `null`},
            updated_at = now(),
            ${
              role === 'admin'
                ? `
                    admin_id = ${role_id},
                  `
                : ''
            }
            registrar_id = ${registrarId}
          where
            enrollment_id = ${enrollment_id}
        `,
      ]);

      const noOfRowsAffected = await this.sharedSessionService.prismaClient.$executeRaw(prismaSql);

      if (!noOfRowsAffected) {
        throw new InternalServerErrorException('Failed to update enrollment');
      }

      // Send emails after acceptance or rejection
      switch (data.enrollment_status) {
        case 'APPROVED': {
          await sendEmail({
            to: enrollment.student.email,
            subject: 'Course Enrollment Approved',
            template: 'enrollment-approved.html',
            context: {
              courseName: `${enrollment.course.course_title} (${enrollment.course.course_code})`,
              session: `${enrollment.session.session_name}`,
            },
          });
          break;
        }

        case 'REJECTED': {
          await sendEmail({
            to: enrollment.student.email,
            subject: 'Course Enrollment Rejected',
            template: 'enrollment-rejected.html',
            context: {
              courseName: `${enrollment.course.course_title} (${enrollment.course.course_code})`,
              session: `${enrollment.session.session_name}`,
              rejectionReason: data.rejection_reason,
            },
          });
          break;
        }
      }

      return {
        success: true,
        message: `Enrollment with ID ${enrollment_id} updated successfully`,
      };
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      throw new InternalServerErrorException('Failed to update enrollment');
    }
  }

  async create(
    createDto: CreateEnrollmentDto,
    accessToken: string,
  ): Promise<{ success: boolean; message: string; enrollment: any }> {
    const { student_id, course_id, session_id } = createDto;

    const activeSessions = await this.sharedSessionService.prismaClient.$queryRaw<
      {
        session_id: number;
      }[]
    >`
      select
        s.session_id
      from
        sessions s
      where
        s.session_status = 'ACTIVE'
        and
        s.session_id = ${session_id}
      limit 1
    `;

    if (!activeSessions?.length) {
      throw new BadRequestException(`Selected session is no longer active for ${session_id}`);
    }

    // 1. Check for duplicate enrollment with same student_id, course_id, session_id
    const possibleDuplicates = await this.supabaseService.select(accessToken, 'enrollments', {
      filter: { student_id, course_id, session_id },
    });
    const duplicates = possibleDuplicates.filter((enrollment: any) =>
      ['APPROVED', 'PENDING'].includes(enrollment.enrollment_status),
    );

    if (duplicates.length > 0) {
      throw new BadRequestException(
        `Enrollment already exists for student_id ${student_id}, course_id ${course_id}, session_id ${session_id}`,
      );
    }

    if (duplicates && duplicates.length > 0) {
      throw new BadRequestException(
        `Enrollment already exists for student_id ${student_id}, course_id ${course_id}, session_id ${session_id}`,
      );
    }

    const existingEnrollment: any[] = await this.supabaseService.select(accessToken, 'enrollments', {
      filter: { student_id, session_id },
      limit: 1,
    });

    let registrar_id = null;
    let admin_id = null;

    if (existingEnrollment && existingEnrollment.length > 0) {
      registrar_id = existingEnrollment[0].registrar_id || null;
      admin_id = existingEnrollment[0].admin_id || null;
    }

    const enrollmentData = {
      ...createDto,
      ...(registrar_id !== null && { registrar_id }),
      ...(admin_id !== null && { admin_id }),
      created_at: new Date(),
      updated_at: new Date(),
    };

    // 4. Insert new enrollment
    const inserted = await this.supabaseService.insert(accessToken, 'enrollments', enrollmentData);

    return {
      success: true,
      message: 'Enrollment created successfully',
      enrollment: inserted[0],
    };
  }
}
