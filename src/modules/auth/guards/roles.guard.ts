import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const ctx = GqlExecutionContext.create(context);
    const { user } = ctx.getContext().req;

    if (!user) {
      throw new ForbiddenException('No tienes permisos para realizar esta acción');
    }

    // Intentar obtener el rol de diferentes formas posibles
    const userRole = user.rol?.nombre || user.rol || user.role || user.userRole;

    if (!userRole) {
      throw new ForbiddenException('No tienes permisos para realizar esta acción');
    }

    const hasRequiredRole = requiredRoles.some((role) => userRole === role);
    
    if (!hasRequiredRole) {
      // Mensaje específico para deleteShift
      const handlerName = context.getHandler().name;
      if (handlerName === 'deleteShift' || handlerName === 'deleteTurno') {
        throw new ForbiddenException('No tienes permisos para eliminar turnos');
      }
      throw new ForbiddenException('No tienes permisos para realizar esta acción');
    }

    return true;
  }
} 