import { EnrollmentStatus } from '@prisma/client';

export interface EnrolledStudent {
  student: {
    id: number;
    reg_number: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
    program: {
      program_id: number;
      program_name: string;
      program_type: string;
    };
  };
  enrollment: {
    status: EnrollmentStatus;
    special_request: boolean;
    rejection_reason: string | null;
    enrolled_at: Date;
  };
}

export interface SupabaseEnrollment {
  student: {
    student_id: number;
    reg_number: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
    profile_picture: string | null;
    program: {
      program_id: number;
      program_name: string;
      program_type: string;
    };
  };
  session: {
    session_id: number;
    session_name: string;
  };
  enrollment_status: EnrollmentStatus;
  special_request: boolean;
  rejection_reason: string | null;
  created_at: Date;
}
