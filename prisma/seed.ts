import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clean up existing data
  await cleanDatabase();

  // Create Programs
  const undergraduateProgram = await prisma.programs.create({
    data: {
      program_name: 'Bachelor of Computer Science',
      program_type: 'UNDERGRADUATE',
      total_credits: 120,
    },
  });

  const graduateProgram = await prisma.programs.create({
    data: {
      program_name: 'Master of Data Science',
      program_type: 'MASTERS',
      total_credits: 60,
    },
  });

  // Create Courses
  const programmingCourse = await prisma.courses.create({
    data: {
      course_title: 'Introduction to Programming',
      course_code: 'CS101',
      course_credits: 3,
      course_type: 'UNDERGRADUATE',
      default_capacity: 50,
      course_desc: 'Learn the basics of programming concepts and logic.',
    },
  });

  const databaseCourse = await prisma.courses.create({
    data: {
      course_title: 'Database Systems',
      course_code: 'CS202',
      course_credits: 4,
      course_type: 'UNDERGRADUATE',
      default_capacity: 40,
      course_desc:
        'Learn about database design, SQL, and database management systems.',
    },
  });

  const aiCourse = await prisma.courses.create({
    data: {
      course_title: 'Artificial Intelligence',
      course_code: 'CS505',
      course_credits: 4,
      course_type: 'GRADUATE',
      default_capacity: 30,
      course_desc:
        'Advanced topics in artificial intelligence and machine learning.',
    },
  });

  // Create Program-Course Relationships
  await prisma.program_courses.createMany({
    data: [
      {
        program_id: undergraduateProgram.program_id,
        course_id: programmingCourse.course_id,
      },
      {
        program_id: undergraduateProgram.program_id,
        course_id: databaseCourse.course_id,
      },
      {
        program_id: graduateProgram.program_id,
        course_id: aiCourse.course_id,
      },
    ],
  });

  // Create Sessions
  const currentSession = await prisma.sessions.create({
    data: {
      session_name: 'Fall 2025',
      start_date: new Date('2025-09-01'),
      end_date: new Date('2025-12-15'),
      enrollment_deadline: new Date('2025-08-20'),
      session_status: 'UPCOMING',
    },
  });

  const pastSession = await prisma.sessions.create({
    data: {
      session_name: 'Spring 2025',
      start_date: new Date('2025-01-15'),
      end_date: new Date('2025-05-15'),
      enrollment_deadline: new Date('2025-01-10'),
      session_status: 'CLOSED',
    },
  });

  // Create Session-Course Relationships
  await prisma.session_courses.createMany({
    data: [
      {
        session_id: currentSession.session_id,
        course_id: programmingCourse.course_id,
        status: 'OPEN',
        adjusted_capacity: 45,
      },
      {
        session_id: currentSession.session_id,
        course_id: databaseCourse.course_id,
        status: 'OPEN',
        adjusted_capacity: 35,
      },
      {
        session_id: currentSession.session_id,
        course_id: aiCourse.course_id,
        status: 'OPEN',
        adjusted_capacity: 25,
      },
      {
        session_id: pastSession.session_id,
        course_id: programmingCourse.course_id,
        status: 'CLOSED',
        adjusted_capacity: 50,
      },
      {
        session_id: pastSession.session_id,
        course_id: databaseCourse.course_id,
        status: 'CLOSED',
        adjusted_capacity: 40,
      },
    ],
  });

  // Create Students
  const student1 = await prisma.students.create({
    data: {
      reg_number: 'STU001',
      first_name: 'John',
      last_name: 'Doe',
      email: 'john.doe@example.com',
      profile_picture: 'https://randomuser.me/api/portraits/men/1.jpg',
      program_id: undergraduateProgram.program_id,
      user_id: randomUUID(),
    },
  });

  const student2 = await prisma.students.create({
    data: {
      reg_number: 'STU002',
      first_name: 'Jane',
      last_name: 'Smith',
      email: 'jane.smith@example.com',
      profile_picture: 'https://randomuser.me/api/portraits/women/1.jpg',
      program_id: graduateProgram.program_id,
      user_id: randomUUID(),
    },
  });

  // Create Registrars
  const registrar = await prisma.registrars.create({
    data: {
      first_name: 'Robert',
      last_name: 'Johnson',
      email: 'robert.johnson@example.com',
      profile_picture: 'https://randomuser.me/api/portraits/men/10.jpg',
      user_id: randomUUID(),
      is_suspended: false,
    },
  });

  // Create User Roles
  await prisma.user_roles.createMany({
    data: [
      {
        user_id: student1.user_id,
        role: 'STUDENT',
      },
      {
        user_id: student2.user_id,
        role: 'STUDENT',
      },
      {
        user_id: registrar.user_id,
        role: 'REGISTRAR',
      },
    ],
  });

  // Create Session Students
  await prisma.session_students.createMany({
    data: [
      {
        session_id: currentSession.session_id,
        student_id: student1.student_id,
      },
      {
        session_id: currentSession.session_id,
        student_id: student2.student_id,
      },
      {
        session_id: pastSession.session_id,
        student_id: student1.student_id,
      },
    ],
  });

  // Create Enrollments
  await prisma.enrollments.createMany({
    data: [
      {
        enrollment_status: 'APPROVED',
        special_request: false,
        student_id: student1.student_id,
        course_id: programmingCourse.course_id,
        session_id: currentSession.session_id,
        registrar_id: registrar.registrar_id,
      },
      {
        enrollment_status: 'PENDING',
        special_request: true,
        student_id: student1.student_id,
        course_id: databaseCourse.course_id,
        session_id: currentSession.session_id,
      },
      {
        enrollment_status: 'APPROVED',
        special_request: false,
        student_id: student2.student_id,
        course_id: aiCourse.course_id,
        session_id: currentSession.session_id,
        registrar_id: registrar.registrar_id,
      },
      {
        enrollment_status: 'COMPLETED',
        special_request: false,
        student_id: student1.student_id,
        course_id: programmingCourse.course_id,
        session_id: pastSession.session_id,
        registrar_id: registrar.registrar_id,
      },
    ],
  });

  // Create Invitations
  await prisma.invitations.createMany({
    data: [
      {
        email: 'new.student@example.com',
        token: randomUUID(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        status: 'PENDING',
        user_type: 'STUDENT',
      },
      {
        email: 'new.registrar@example.com',
        token: randomUUID(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        status: 'PENDING',
        user_type: 'REGISTRAR',
      },
    ],
  });

  console.log('Database seeded successfully!');
}

async function cleanDatabase() {
  // Delete records from tables with foreign key constraints first
  await prisma.enrollments.deleteMany({});
  await prisma.invitations.deleteMany({});
  await prisma.session_students.deleteMany({});
  await prisma.session_courses.deleteMany({});
  await prisma.program_courses.deleteMany({});
  await prisma.user_roles.deleteMany({});

  // Then delete records from tables without foreign key constraints
  await prisma.students.deleteMany({});
  await prisma.registrars.deleteMany({});
  await prisma.sessions.deleteMany({});
  await prisma.courses.deleteMany({});
  await prisma.programs.deleteMany({});
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
