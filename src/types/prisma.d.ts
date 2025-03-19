import { PrismaClient } from '@prisma/client';

declare global {
  namespace PrismaClient {
    interface PrismaClient {
      // Map singular model names to the plural ones from the schema
      invitation: PrismaClient['invitations'];
      enrollment: PrismaClient['enrollments'];
      session: PrismaClient['public_sessions'];
      sessionCourse: PrismaClient['session_courses'];
      program: PrismaClient['programs'];
      programCourse: PrismaClient['program_courses'];
      registrar: PrismaClient['registrars'];
      student: PrismaClient['students'];
    }
  }
}
