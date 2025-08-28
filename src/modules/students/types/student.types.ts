import type { EnrollmentStatus, invitations, programs, ProgramType, registrars, students } from '@prisma/client';

export interface Student {
  student_id: number;
  reg_number: string;
  first_name?: string;
  last_name?: string;
  email: string;
  profile_picture?: string;
  program_id: number;
  program?: {
    program_name: string;
    program_type: ProgramType;
    total_credits: number;
  };
  stats?: StudentStats;
  sessions?: StudentSession[];
}

export interface StudentStats {
  // Overall stats
  totalEnrollments: number;
  enrollmentsByStatus: {
    [key in EnrollmentStatus]: number;
  };
  totalCredits: number;

  // Active session stats
  activeSession?: {
    session_id: number;
    session_name: string;
    start_date: Date;
    end_date: Date;
    enrollment_deadline: Date;
    session_status: string;
    totalEnrollments: number;
    enrollmentsByStatus: {
      [key in EnrollmentStatus]: number;
    };
    totalCredits: number;
  };
}

export interface StudentSession {
  session_id: number;
  session_name: string;
  start_date: Date;
  end_date: Date;
  enrollment_deadline: Date;
  session_status: string;
  enrollments: StudentEnrollment[];
}

export interface StudentEnrollment {
  enrollment_id: number;
  enrollment_status: EnrollmentStatus;
  special_request: boolean;
  rejection_reason?: string;
  student_id: number;
  course_id: number;
  course_title: string;
  course_code: string;
  course_credits: number;
  course_type: string;
  default_capacity: number;
  course_desc: string;
  registrar?: {
    registrar_id: number;
    first_name?: string;
    last_name?: string;
  };
}

export interface SessionResponse {
  session: {
    session_id: number;
    session_name: string;
    start_date: string;
    end_date: string;
    enrollment_deadline: string;
    session_status: string;
    enrollments: Array<{
      enrollment_id: number;
      enrollment_status: string;
      special_request: string | null;
      rejection_reason: string | null;
      student_id: number;
      courses: {
        course_id: number;
        course_title: string;
        course_code: string;
        course_credits: number;
        course_type: string;
        default_capacity: number;
        course_desc: string;
      };
    }>;
  };
}

export interface StudentResponse {
  success: boolean;
  message: string;
  student?: Student;
}

export type StudentWithRegistrar = Pick<
  students,
  | 'student_id'
  | 'reg_number'
  | 'first_name'
  | 'last_name'
  | 'email'
  | 'profile_picture'
  | 'program_id'
  | 'status'
  | 'created_at'
  | 'updated_at'
> & {
  program: Pick<programs, 'program_id' | 'program_name' | 'program_type' | 'total_credits'>;
  invitation?: null | Pick<
    invitations,
    'invitation_id' | 'email' | 'expires_at' | 'status' | 'user_type' | 'created_at' | 'updated_at'
  >;
  registrar?: null | Pick<
    registrars,
    'registrar_id' | 'first_name' | 'last_name' | 'email' | 'profile_picture' | 'is_deactivated' | 'is_suspended'
  >;
  can_claim: boolean;
};
