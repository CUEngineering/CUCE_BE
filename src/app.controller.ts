import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('test-db')
  testDbConnection() {
    return {
      status: 'info',
      message: 'Database connection test endpoint (connection not tested)',
      timestamp: new Date().toISOString(),
      supabaseUrl: process.env.SUPABASE_URL,
      databaseUrl: `${process.env.DATABASE_URL?.substring(0, 20)}...`, // Only show beginning for security
    };
  }

  @Get('test-connection')
  async testFullDbConnection() {
    try {
      // Test database connection
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      await this.prisma.$connect();
      return {
        status: 'success',
        message: 'Successfully connected to the database',
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return {
        status: 'error',
        message: 'Failed to connect to the database',
        error: errorMessage,
      };
    }
  }
}
