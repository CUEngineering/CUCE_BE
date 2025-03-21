import { InvitationStatus } from '@prisma/client';

export interface Invitation {
  invitation_id: number;
  email: string;
  token: string;
  expires_at: Date;
  status: InvitationStatus;
  user_type: string;
  student_id?: number | null;
  registrar_id?: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface StepState {
  success: boolean;
  error?: string;
  data?: any;
}

export interface AcceptanceState {
  steps: {
    tokenValidation: StepState;
    userCreation: StepState & { userId?: string };
    roleAssignment: StepState;
    profileCreation: StepState;
    invitationUpdate: StepState;
  };
  currentStep: string;
  rollbackNeeded: boolean;
  rollbackSteps: string[];
}

export interface AcceptanceResult {
  user: {
    id: string;
    email: string | undefined;
    first_name: string;
    last_name: string;
    role: string;
  };
  session: {
    access_token: string;
    refresh_token: string;
  };
  registrar?: {
    registrar_id: string;
    email: string;
    first_name: string;
    last_name: string;
    user_id: string;
  };
  acceptanceState?: AcceptanceState;
}
