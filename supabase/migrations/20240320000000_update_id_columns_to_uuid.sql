-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Update registrars table
ALTER TABLE registrars
ALTER COLUMN registrar_id TYPE uuid USING registrar_id::uuid,
ALTER COLUMN registrar_id SET DEFAULT uuid_generate_v4();

-- Update invitations table
ALTER TABLE invitations
ALTER COLUMN invitation_id TYPE uuid USING invitation_id::uuid,
ALTER COLUMN invitation_id SET DEFAULT uuid_generate_v4(),
ALTER COLUMN token TYPE uuid USING token::uuid;

-- Update enrollments table
ALTER TABLE enrollments
ALTER COLUMN enrollment_id TYPE uuid USING enrollment_id::uuid,
ALTER COLUMN enrollment_id SET DEFAULT uuid_generate_v4(),
ALTER COLUMN registrar_id TYPE uuid USING registrar_id::uuid,
ALTER COLUMN session_id TYPE uuid USING session_id::uuid;

-- Update courses table
ALTER TABLE courses
ALTER COLUMN course_id TYPE uuid USING course_id::uuid,
ALTER COLUMN course_id SET DEFAULT uuid_generate_v4();

-- Update sessions table
ALTER TABLE sessions
ALTER COLUMN session_id TYPE uuid USING session_id::uuid,
ALTER COLUMN session_id SET DEFAULT uuid_generate_v4(),
ALTER COLUMN course_id TYPE uuid USING course_id::uuid;

-- Update programs table
ALTER TABLE programs
ALTER COLUMN program_id TYPE uuid USING program_id::uuid,
ALTER COLUMN program_id SET DEFAULT uuid_generate_v4(); 