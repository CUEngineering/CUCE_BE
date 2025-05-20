import { Controller, Get, Inject } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaClient } from '@prisma/client';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @Inject('PRISMA_CLIENT') private readonly prisma: PrismaClient,
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
}
