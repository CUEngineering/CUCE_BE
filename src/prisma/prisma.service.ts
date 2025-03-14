import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(private configService: ConfigService) {
    super({
      datasources: {
        db: {
          url: configService.get<string>('DATABASE_URL') || '',
        },
      },
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async cleanDatabase(): Promise<void> {
    if (this.configService.get<string>('NODE_ENV') === 'test') {
      // Add logic to truncate all tables for testing purposes
      // This should only run in test environment
      // For now, this is just a placeholder
    }
  }
}
