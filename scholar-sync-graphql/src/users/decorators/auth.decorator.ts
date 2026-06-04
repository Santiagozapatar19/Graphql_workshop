import { applyDecorators, UseGuards } from '@nestjs/common';
import { ValidRoles } from '../entities/user.entity';
import { RoleProtected } from './role-protected.decorator';
import { GraphQlAuthGuard } from '../guards/auth/graphql-auth.guard';
import { UserRoleGuard } from '../guards/user-role/user-role.guard';

export function Auth(...roles: ValidRoles[]) {
    return applyDecorators(RoleProtected(...roles), UseGuards(GraphQlAuthGuard, UserRoleGuard));
}