import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import { META_ROLES } from '../../decorators/role-protected.decorator';
import { User } from '../../entities/user.entity';

/**
 * Guard que valida si el usuario autenticado posee al menos uno
 * de los roles requeridos (declarados con @RoleProtected / @Auth).
 */
@Injectable()
export class UserRoleGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
        const requiredRoles: string[] = this.reflector.get(META_ROLES, context.getHandler());

        // Si no se declararon roles, la ruta es accesible para cualquier usuario autenticado
        if (!requiredRoles || requiredRoles.length === 0) return true;

        const ctx = GqlExecutionContext.create(context);
        const user = ctx.getContext().req.user as User;

        if (!user) throw new BadRequestException('User not found in request');

        const hasRole = user.roles.some((role) => requiredRoles.includes(role));
        if (hasRole) return true;

        throw new ForbiddenException(
            `User ${user.email} does not have the required role(s): [${requiredRoles.join(', ')}]`,
        );
    }
}
