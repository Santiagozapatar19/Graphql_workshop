import { SetMetadata } from '@nestjs/common';
import { ValidRoles } from '../entities/user.entity';

//Clave usada para almacenar los roles en los metadatos del handler
export const META_ROLES = 'roles';

export const RoleProtected = (...roles: ValidRoles[]) => SetMetadata(META_ROLES, roles);
