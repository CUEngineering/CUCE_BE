export interface SessionCourse {
  session_id: number;
  status: string;
}

export interface SessionStudent {
  session_id: number;
}

export interface SessionDetail {
  session_id: number;
  session_name: string;
  start_date: string;
  end_date: string;
  enrollment_deadline: string;
  session_status: string;
  session_courses: SessionCourse[];
  session_students?: SessionStudent[];
  created_at: string;
  updated_at: string;
}
