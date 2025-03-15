import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

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
