export interface ProgramCourse {
  program_id: string;
  course_id: number;
  updated_at: string;
}

export interface ProgramCourseWithEnrollmentStatus extends ProgramCourse {
  hasEnrollments: boolean;
}

export interface Student {
  student_id: number;
  program_id: string;
}

export interface RawProgramCourse {
  program_id: string;
  course_id: string | number;
  updated_at?: string;
}

export interface Course {
  course_id: number;
  course_credits: number;
}

export interface Enrollment {
  enrollment_id: number;
  enrollment_status: string;
  course: Course;
}

export interface Program {
  program_name: string;
  program_type: string;
  total_credits: number;
}

export interface StudentWithDetails {
  student_id: number;
  reg_number: string;
  first_name: string;
  last_name: string;
  email: string;
  profile_picture?: string;
  program_id: string;
  program: Program;
  enrollments: Enrollment[];
  totalCredits: number;
}

export interface ProgramStudent {
  student_id: number;
  reg_number: string;
  first_name: string;
  last_name: string;
  email: string;
  profile_picture?: string;
  totalCredits: number;
}
