import { CourseType } from '@prisma/client';

export interface Enrollment {
  enrollment_id: number;
  enrollment_status: 'ACTIVE' | 'COMPLETED' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'PENDING';
  student_id: number;
  registrar_id?: number | null;
  rejection_reason: string;
  admin_id?: number | null;
  course_id: number;
  session_id: number;
  students?: {
    first_name: string;
    last_name: string;
    reg_number: string;
    profile_picture: string;
    programs: {
      program_name: string;
    };
  };
  sessions?: {
    session_status: string;
  };
  session_course: {
    session_status: string;
    session_name: string;
    session_id: string;
  };
  courses?: {
    course_code: string;
    course_credits: string;
    course_status: 'open' | 'closed';
    course_type: CourseType;
    program: string;
    course_title: string;
    course_desc: string;
    course_id: string;
  };
  registrars?: {
    first_name: string;
    last_name: string;

    profile_picture: string;
  };
  created_at: Date;
  updated_at: Date;
}
