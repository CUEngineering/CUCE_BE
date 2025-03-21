export interface Registrar {
  registrar_id: number;
  is_suspended: boolean;
  is_deactivated: boolean;
  suspended_at?: string;
  email: string;
  first_name?: string;
  last_name?: string;
  profile_picture?: string;
  stats?: RegistrarStats;
}

export interface Enrollment {
  enrollment_id: number;
  enrollment_status: string;
  session_id: number;
}

export interface RegistrarStats {
  totalSessions: number;
  totalEnrollments: number;
  activeEnrollments: number;
  completedEnrollments: number;
  cancelledEnrollments: number;
}

export interface RegistrarResponse {
  success: boolean;
  message: string;
  registrar?: Registrar;
}
