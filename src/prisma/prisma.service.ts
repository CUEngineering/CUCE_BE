import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor(private configService: ConfigService) {
    super({
      datasources: {
        db: {
          url: configService.get<string>('DATABASE_URL') || '',
        },
      },
      // Enable logging in development
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'error', 'warn']
          : ['error'],
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      this.logger.log('Connecting to database...');

      await this.$connect();
      this.logger.log('Successfully connected to database');
    } catch (error) {
      this.logger.error(
        `Failed to connect to database: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      // Don't throw the error to allow the application to start even if DB is not available
      // This allows us to at least start the server and serve endpoints that don't require DB
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      this.logger.log('Disconnecting from database...');

      await this.$disconnect();
      this.logger.log('Successfully disconnected from database');
    } catch (error) {
      this.logger.error(
        `Error disconnecting from database: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async cleanDatabase(): Promise<void> {
    if (this.configService.get<string>('NODE_ENV') === 'test') {
      // Add logic to truncate all tables for testing purposes
      // This should only run in test environment
      // For now, this is just a placeholder
    }
  }

  /**
   * Compatibility getters for singular model names
   * These map to the plural names defined in the Prisma schema
   */
  get invitation() {
    // @ts-ignore - we're using the undocumented _baseDmmf to access the raw schema
    return this.invitations;
  }

  get enrollment() {
    // @ts-ignore
    return this.enrollments;
  }

  get session() {
    // @ts-ignore
    return this.public_sessions;
  }

  get sessionCourse() {
    // @ts-ignore
    return this.session_courses;
  }

  get program() {
    // @ts-ignore
    return this.programs;
  }

  get programCourse() {
    // @ts-ignore
    return this.program_courses;
  }

  get registrar() {
    // @ts-ignore
    return this.registrars;
  }

  get student() {
    // @ts-ignore
    return this.students;
  }
}
