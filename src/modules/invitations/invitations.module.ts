import { Module } from '@nestjs/common';
import { InvitationsController } from './controllers/invitations.controller';
import { InvitationsService } from './services/invitations.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { PrismaClient } from '@prisma/client';

@Module({
  controllers: [InvitationsController],
  providers: [
    InvitationsService,
    SupabaseService,
    {
      provide: PrismaClient,
      useValue: new PrismaClient(),
    },
  ],
  exports: [InvitationsService],
})
export class InvitationsModule {}
