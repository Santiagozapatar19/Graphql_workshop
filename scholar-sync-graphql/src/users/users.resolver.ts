import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { User, ValidRoles } from './entities/user.entity';
import { UsersService } from './users.service';
import { SignUpInput } from './dto/signup-input.dto';
import { LoginInput } from './dto/login-input.dto';
import { UpdateUserInput } from './dto/update-user-input.dto';
import { AuthResponse } from './types/auth-response.type';
import { Auth } from './decorators/auth.decorator';
import { CurrentUser } from './decorators/current-user.decorator';

@Resolver(() => User)
export class UsersResolver {
  constructor(private readonly usersService: UsersService) {}

  // ──────────────────────────── Mutations ──────────────────────────────────

  /** Registra un nuevo usuario (ruta pública) */
  @Mutation(() => AuthResponse, { name: 'signup' })
  signup(@Args('signUpInput') signUpInput: SignUpInput): Promise<AuthResponse> {
    return this.usersService.signup(signUpInput);
  }

  /** Inicia sesión y retorna token JWT (ruta pública) */
  @Mutation(() => AuthResponse, { name: 'login' })
  login(@Args('loginInput') loginInput: LoginInput): Promise<AuthResponse> {
    return this.usersService.login(loginInput);
  }

  /**
   * Actualiza un usuario.
   * Cualquier usuario autenticado puede actualizar su propio perfil.
   * Un admin puede actualizar el de cualquiera.
   */
  @Mutation(() => User, { name: 'updateUser' })
  @Auth()
  updateUser(
    @Args('updateUserInput') updateUserInput: UpdateUserInput,
    @CurrentUser() currentUser: User,
  ): Promise<User> {
    return this.usersService.update(updateUserInput, currentUser);
  }

  /**
   * Desactiva un usuario (soft-delete) — solo admin.
   */
  @Mutation(() => User, { name: 'removeUser' })
  @Auth(ValidRoles.admin)
  removeUser(@Args('id', { type: () => ID }) id: string): Promise<User> {
    return this.usersService.remove(id);
  }

  // ──────────────────────────── Queries ────────────────────────────────────

  /** Retorna el usuario autenticado actualmente */
  @Query(() => User, { name: 'me' })
  @Auth()
  me(@CurrentUser() user: User): User {
    return user;
  }

  /** Lista todos los usuarios — solo admin */
  @Query(() => [User], { name: 'users' })
  @Auth(ValidRoles.admin)
  findAll(): Promise<User[]> {
    return this.usersService.findAll();
  }

  /** Busca un usuario por id — requiere autenticación */
  @Query(() => User, { name: 'user' })
  @Auth()
  findOne(@Args('id', { type: () => ID }) id: string): Promise<User> {
    return this.usersService.findOne(id);
  }
}
