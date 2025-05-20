import { Controller, Get, Inject } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Controller()
export class HomeController {
  constructor(@Inject('PRISMA_CLIENT') private readonly prisma: PrismaClient) {}

  @Get()
  getHome() {
    return {
      message: 'Welcome to CUCE backend version 1',
    };
  }

  @Get('test-db')
  async testFullDbConnection() {
    try {
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
