import { Module } from '@nestjs/common';
import { InvitationsController } from './controllers/invitations.controller';
import { InvitationsService } from './services/invitations.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseService } from '../../supabase/supabase.service';

@Module({
  controllers: [InvitationsController],
  providers: [InvitationsService, PrismaService, SupabaseService],
  exports: [InvitationsService],
})
export class InvitationsModule {}
