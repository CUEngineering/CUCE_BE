import * as process from 'node:process';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import { PrismaClient } from '@prisma/client';
// import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validate } from './config/env.validation';
import { CoursesModule } from './modules/courses/courses.module';
import { DashboardsModule } from './modules/dashboard/dashboard.module';
import { EnrollmentsModule } from './modules/enrollments/enrollments.module';
import { HealthModule } from './modules/health/health.module';
import { HomeController } from './modules/home/home.controller';
import { InvitationsModule } from './modules/invitations/invitations.module';
import { ProgramsModule } from './modules/programs/programs.module';
import { RegistrarsModule } from './modules/registrars/registrars.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { SharedModule } from './modules/shared/shared.module';
import { StudentsModule } from './modules/students/students.module';
import { SupabaseModule } from './supabase/supabase.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      envFilePath: process.env.NODE_ENV === 'production' ? '.env.production' : '.env',
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
    DashboardsModule,
    SharedModule,
    ScheduleModule.forRoot(),
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
