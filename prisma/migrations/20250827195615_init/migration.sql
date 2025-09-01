-- CreateEnum
CREATE TYPE "CourseStatus" AS ENUM ('OPEN', 'CLOSED', 'FULL', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CourseType" AS ENUM ('UNDERGRADUATE', 'GRADUATE', 'MASTERS', 'DOCTORATE');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProgramType" AS ENUM ('UNDERGRADUATE', 'GRADUATE', 'MASTERS', 'DOCTORATE');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('UPCOMING', 'ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('STUDENT', 'REGISTRAR', 'ADMIN');

-- CreateTable
CREATE TABLE IF NOT EXISTS "admins" (
    "admin_id" SERIAL NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "email" TEXT NOT NULL,
    "profile_picture" TEXT,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "is_suspended" BOOLEAN NOT NULL DEFAULT false,
    "is_deactivated" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("admin_id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "courses" (
    "course_id" SERIAL NOT NULL,
    "course_title" TEXT NOT NULL,
    "course_code" TEXT NOT NULL,
    "course_credits" INTEGER NOT NULL,
    "course_type" "CourseType" NOT NULL,
    "default_capacity" INTEGER NOT NULL,
    "course_desc" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("course_id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "enrollments" (
    "enrollment_id" SERIAL NOT NULL,
    "enrollment_status" "EnrollmentStatus" NOT NULL,
    "special_request" BOOLEAN NOT NULL DEFAULT false,
    "rejection_reason" TEXT,
    "student_id" INTEGER NOT NULL,
    "course_id" INTEGER NOT NULL,
    "session_id" INTEGER NOT NULL,
    "registrar_id" INTEGER,
    "admin_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("enrollment_id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "invitations" (
    "invitation_id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "token" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "status" "InvitationStatus" NOT NULL,
    "user_type" "UserType" NOT NULL,
    "student_id" INTEGER,
    "registrar_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invitations_pkey" PRIMARY KEY ("invitation_id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "program_courses" (
    "program_id" INTEGER NOT NULL,
    "course_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "program_courses_pkey" PRIMARY KEY ("program_id","course_id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "programs" (
    "program_id" SERIAL NOT NULL,
    "program_name" TEXT NOT NULL,
    "program_type" "ProgramType" NOT NULL,
    "total_credits" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "programs_pkey" PRIMARY KEY ("program_id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "registrars" (
    "registrar_id" SERIAL NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "email" TEXT NOT NULL,
    "profile_picture" TEXT,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_suspended" BOOLEAN NOT NULL DEFAULT false,
    "is_deactivated" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "registrars_pkey" PRIMARY KEY ("registrar_id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "session_courses" (
    "session_id" INTEGER NOT NULL,
    "course_id" INTEGER NOT NULL,
    "status" "CourseStatus" NOT NULL DEFAULT 'OPEN',
    "adjusted_capacity" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_courses_pkey" PRIMARY KEY ("session_id","course_id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "session_students" (
    "session_id" INTEGER NOT NULL,
    "student_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_students_pkey" PRIMARY KEY ("session_id","student_id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "sessions" (
    "session_id" SERIAL NOT NULL,
    "session_name" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "enrollment_deadline" TIMESTAMP(3) NOT NULL,
    "session_status" "SessionStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("session_id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "students" (
    "student_id" SERIAL NOT NULL,
    "reg_number" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "email" TEXT NOT NULL,
    "profile_picture" TEXT,
    "program_id" INTEGER NOT NULL,
    "user_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("student_id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "user_roles" (
    "id" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "UserType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "password_resets" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "student_registrar_sessions" (
    "student_id" INTEGER NOT NULL,
    "registrar_id" INTEGER NOT NULL,
    "session_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_registrar_sessions_pkey" PRIMARY KEY ("student_id","registrar_id","session_id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "admins_email_key" ON "admins"("email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "admins_user_id_key" ON "admins"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "courses_course_code_key" ON "courses"("course_code");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "invitations_token_key" ON "invitations"("token");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "invitations_email_status_key" ON "invitations"("email", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "registrars_email_key" ON "registrars"("email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "registrars_user_id_key" ON "registrars"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "students_reg_number_key" ON "students"("reg_number");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "students_email_key" ON "students"("email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "students_user_id_key" ON "students"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "user_roles_user_id_key" ON "user_roles"("user_id");

-- AddForeignKey
ALTER TABLE IF EXISTS "enrollments" ADD CONSTRAINT "enrollments_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("course_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE IF EXISTS "enrollments" ADD CONSTRAINT "enrollments_registrar_id_fkey" FOREIGN KEY ("registrar_id") REFERENCES "registrars"("registrar_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE IF EXISTS "enrollments" ADD CONSTRAINT "enrollments_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("session_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE IF EXISTS "enrollments" ADD CONSTRAINT "enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("student_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE IF EXISTS "enrollments" ADD CONSTRAINT "enrollments_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("admin_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE IF EXISTS "invitations" ADD CONSTRAINT "invitations_registrar_id_fkey" FOREIGN KEY ("registrar_id") REFERENCES "registrars"("registrar_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE IF EXISTS "invitations" ADD CONSTRAINT "invitations_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("student_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE IF EXISTS "program_courses" ADD CONSTRAINT "program_courses_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("course_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE IF EXISTS "program_courses" ADD CONSTRAINT "program_courses_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("program_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE IF EXISTS "session_courses" ADD CONSTRAINT "session_courses_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("course_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE IF EXISTS "session_courses" ADD CONSTRAINT "session_courses_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("session_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE IF EXISTS "session_students" ADD CONSTRAINT "session_students_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("session_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE IF EXISTS "session_students" ADD CONSTRAINT "session_students_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("student_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE IF EXISTS "students" ADD CONSTRAINT "students_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("program_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE IF EXISTS "student_registrar_sessions" ADD CONSTRAINT "student_registrar_sessions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("student_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE IF EXISTS "student_registrar_sessions" ADD CONSTRAINT "student_registrar_sessions_registrar_id_fkey" FOREIGN KEY ("registrar_id") REFERENCES "registrars"("registrar_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE IF EXISTS "student_registrar_sessions" ADD CONSTRAINT "student_registrar_sessions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("session_id") ON DELETE RESTRICT ON UPDATE CASCADE;
