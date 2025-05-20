import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validate } from './config/env.validation';

import { SupabaseModule } from './supabase/supabase.module';
import { CoursesModule } from './modules/courses/courses.module';
import { ProgramsModule } from './modules/programs/programs.module';
import { RegistrarsModule } from './modules/registrars/registrars.module';
import { InvitationsModule } from './modules/invitations/invitations.module';
import { HealthModule } from './modules/health/health.module';
import { EnrollmentsModule } from './modules/enrollments/enrollments.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { StudentsModule } from './modules/students/students.module';
import { PrismaClient } from '@prisma/client';
import { HomeController } from './modules/home/home.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      envFilePath:
        process.env.NODE_ENV === 'production' ? '.env.production' : '.env',
    }),
    SupabaseModule,
    CoursesModule,
    ProgramsModule,
    RegistrarsModule,
    InvitationsModule,
    HealthModule,
    EnrollmentsModule,
    SessionsModule,
    StudentsModule,
  ],
  controllers: [
    // AppController,
    HomeController,
  ],
  providers: [
    AppService,
    {
      provide: 'PRISMA_CLIENT',
      useValue: new PrismaClient(),
    },
  ],
})
export class AppModule {}
