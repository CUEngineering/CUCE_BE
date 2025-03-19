import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seeding...');

  // Create Programs
  const undergraduateProgram = await prisma.program.create({
    data: {
      program_name: 'Bachelor of Science in Computer Science',
      program_type: 'UNDERGRADUATE',
      total_credits: 120,
    },
  });

  const graduateProgram = await prisma.program.create({
    data: {
      program_name: 'Master of Science in Computer Science',
      program_type: 'GRADUATE',
      total_credits: 36,
    },
  });

  console.log('Created programs');

  // Create Courses
  await prisma.course.createMany({
    data: [
      {
        course_title: 'Introduction to Programming',
        course_code: 'CS101',
        course_credits: 3,
        course_type: 'UNDERGRADUATE',
        default_capacity: 30,
        course_desc: 'Basic programming concepts using Python',
      },
      {
        course_title: 'Data Structures',
        course_code: 'CS201',
        course_credits: 3,
        course_type: 'UNDERGRADUATE',
        default_capacity: 25,
        course_desc: 'Fundamental data structures and algorithms',
      },
      {
        course_title: 'Advanced Algorithms',
        course_code: 'CS501',
        course_credits: 3,
        course_type: 'GRADUATE',
        default_capacity: 20,
        course_desc: 'Advanced algorithmic concepts and optimization',
      },
    ],
  });

  console.log('Created courses');

  // Create Program-Course Associations
  const cs101 = await prisma.course.findUnique({
    where: { course_code: 'CS101' },
  });
  const cs201 = await prisma.course.findUnique({
    where: { course_code: 'CS201' },
  });
  const cs501 = await prisma.course.findUnique({
    where: { course_code: 'CS501' },
  });

  if (!cs101 || !cs201 || !cs501) {
    throw new Error('Failed to find required courses');
  }

  await prisma.programCourse.createMany({
    data: [
      {
        program_id: undergraduateProgram.program_id,
        course_id: cs101.course_id,
      },
      {
        program_id: undergraduateProgram.program_id,
        course_id: cs201.course_id,
      },
      {
        program_id: graduateProgram.program_id,
        course_id: cs501.course_id,
      },
    ],
  });

  console.log('Created program-course associations');

  // Create a Session
  const currentSession = await prisma.session.create({
    data: {
      session_name: 'Fall 2024',
      start_date: new Date('2024-09-01'),
      end_date: new Date('2024-12-20'),
      enrollment_deadline: new Date('2024-08-15'),
      session_status: 'UPCOMING',
    },
  });

  console.log('Created session');

  // Create Session-Course Associations
  await prisma.sessionCourse.createMany({
    data: [
      {
        session_id: currentSession.session_id,
        course_id: cs101.course_id,
        adjusted_capacity: 30,
        status: 'OPEN',
      },
      {
        session_id: currentSession.session_id,
        course_id: cs201.course_id,
        adjusted_capacity: 25,
        status: 'OPEN',
      },
      {
        session_id: currentSession.session_id,
        course_id: cs501.course_id,
        adjusted_capacity: 20,
        status: 'OPEN',
      },
    ],
  });

  console.log('Created session-course associations');

  // Create a Registrar
  const registrar = await prisma.registrar.create({
    data: {
      first_name: 'John',
      last_name: 'Doe',
      email: 'john.doe@example.com',
      user_id: randomUUID(),
    },
  });

  // Create a Student
  const student = await prisma.student.create({
    data: {
      student_id: randomUUID(),
      first_name: 'Jane',
      last_name: 'Smith',
      email: 'jane.smith@example.com',
      program_id: undergraduateProgram.program_id,
      user_id: randomUUID(),
    },
  });

  console.log('Created users');

  // Create an Enrollment
  await prisma.enrollment.create({
    data: {
      student_id: student.id,
      course_id: cs101.course_id,
      session_id: currentSession.session_id,
      enrollment_status: 'PENDING',
      registrar_id: registrar.registrar_id,
    },
  });

  console.log('Created enrollment');

  // Create an invitation
  await prisma.invitation.create({
    data: {
      email: 'new.student@example.com',
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      status: 'PENDING',
      user_type: 'STUDENT',
      token: randomUUID(),
    },
  });

  console.log('Seeding completed.');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
