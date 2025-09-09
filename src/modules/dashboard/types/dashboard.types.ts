export interface AdminDashboardStats {
  totalRegistrars: number;
  totalStudents: number;
  totalPrograms: number;
  totalCourses: number;
}

export interface RegistrarDashboardStats {
  totalStudents: number;
  totalPendingEnrollments: number;
  totalRejectedEnrollments: number;
  totalApprovedEnrollments: number;
}
