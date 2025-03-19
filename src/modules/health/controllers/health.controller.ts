import { Controller, Get, Inject } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Controller('health')
export class HealthController {
  constructor(@Inject('PRISMA_CLIENT') private readonly prisma: PrismaClient) {}

  @Get()
  async checkHealth() {
    try {
      // Perform a simple database connection check
      await this.prisma.$connect();

      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        message: 'API is healthy and database connection is successful',
      };
    } catch (error) {
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        message: 'Database connection failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    } finally {
      // Ensure we disconnect to prevent connection pooling issues
      await this.prisma.$disconnect();
    }
  }
}
