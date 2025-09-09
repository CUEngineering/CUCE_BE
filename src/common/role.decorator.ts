// src/common/decorators/public.decorator.ts
import { SetMetadata } from '@nestjs/common';

export type AUTHORIZED_ROLE_TYPE = 'STUDENT' | 'REGISTRAR' | 'ADMIN';
export const AUTH_USER_ROLE_KEY = Symbol('auth_user_role_key');
export const AuthorizedRoles = (roles: AUTHORIZED_ROLE_TYPE[]) => SetMetadata(AUTH_USER_ROLE_KEY, roles);
