CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- AlterTable
ALTER TABLE "admins" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
CREATE TRIGGER admins_update_trigger_for_updated_at BEFORE UPDATE ON "admins" FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- AlterTable
ALTER TABLE "courses" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
CREATE TRIGGER courses_update_trigger_for_updated_at BEFORE UPDATE ON "courses" FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- AlterTable
ALTER TABLE "enrollments" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
CREATE TRIGGER enrollments_update_trigger_for_updated_at BEFORE UPDATE ON "enrollments" FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- AlterTable
ALTER TABLE "invitations" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
CREATE TRIGGER invitations_update_trigger_for_updated_at BEFORE UPDATE ON "invitations" FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- AlterTable
ALTER TABLE "program_courses" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
CREATE TRIGGER program_courses_update_trigger_for_updated_at BEFORE UPDATE ON "program_courses" FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- AlterTable
ALTER TABLE "programs" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
CREATE TRIGGER program_update_trigger_for_updated_at BEFORE UPDATE ON "programs" FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- AlterTable
ALTER TABLE "registrars" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
CREATE TRIGGER registrars_update_trigger_for_updated_at BEFORE UPDATE ON "registrars" FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- AlterTable
ALTER TABLE "session_courses" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
CREATE TRIGGER session_courses_update_trigger_for_updated_at BEFORE UPDATE ON "session_courses" FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- AlterTable
ALTER TABLE "session_students" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
CREATE TRIGGER session_students_update_trigger_for_updated_at BEFORE UPDATE ON "session_students" FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- AlterTable
ALTER TABLE "sessions" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
CREATE TRIGGER sessions_update_trigger_for_updated_at BEFORE UPDATE ON "sessions" FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- AlterTable
ALTER TABLE "student_registrar_sessions" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
CREATE TRIGGER student_registrar_sessions_update_trigger_for_updated_at BEFORE UPDATE ON "student_registrar_sessions" FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- AlterTable
ALTER TABLE "students" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
CREATE TRIGGER students_update_trigger_for_updated_at BEFORE UPDATE ON "students" FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- AlterTable
ALTER TABLE "user_roles" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
CREATE TRIGGER user_roles_update_trigger_for_updated_at BEFORE UPDATE ON "user_roles" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
