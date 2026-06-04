import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';

import { User, ValidRoles } from './entities/user.entity';
import { SignUpInput } from './dto/signup-input.dto';
import { LoginInput } from './dto/login-input.dto';
import { UpdateUserInput } from './dto/update-user-input.dto';
import { AuthResponse } from './types/auth-response.type';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}


  /** Registra un nuevo usuario con rol student por defecto */
  async signup(signUpInput: SignUpInput): Promise<AuthResponse> {
    try {
      const user = this.userRepository.create({
        ...signUpInput,
        password: bcrypt.hashSync(signUpInput.password, 10),
        roles: [ValidRoles.student],
      });
      await this.userRepository.save(user);
      delete user.password;
      return { user, token: this.getJwtToken({ id: user.id, email: user.email, roles: user.roles }) };
    } catch (error) {
      this.handleDbException(error);
    }
  }

  /** Autentica un usuario y devuelve el token JWT */
  async login(loginInput: LoginInput): Promise<AuthResponse> {
    const { email, password } = loginInput;

    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) throw new UnauthorizedException('Credentials are not valid (email)');

    if (!bcrypt.compareSync(password, user.password!))
      throw new UnauthorizedException('Credentials are not valid (password)');

    delete user.password;
    return { user, token: this.getJwtToken({ id: user.id, email: user.email, roles: user.roles }) };
  }

  // ──────────────────────────── CRUD ───────────────────────────────────────

  /** Devuelve todos los usuarios — solo admin */
  async findAll(): Promise<User[]> {
    const users = await this.userRepository.find();
    users.forEach((u) => delete u.password);
    return users;
  }

  /** Devuelve un usuario por id */
  async findOne(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User with id ${id} not found`);
    delete user.password;
    return user;
  }

  /**
   * Actualiza un usuario.
   * - Un admin puede actualizar cualquier usuario.
   * - Un student solo puede actualizarse a sí mismo.
   */
  async update(updateUserInput: UpdateUserInput, currentUser: User): Promise<User> {
    const target = await this.findOne(updateUserInput.id);

    const isAdmin = currentUser.roles.includes(ValidRoles.admin);
    if (!isAdmin && currentUser.id !== target.id)
      throw new UnauthorizedException('You can only update your own profile');

    const merged = this.userRepository.merge(target, updateUserInput);
    const saved = await this.userRepository.save(merged);
    delete saved.password;
    return saved;
  }

  /**
   * Elimina (desactiva) un usuario — solo admin.
   * Hacemos soft-delete poniendo isActive=false.
   */
  async remove(id: string): Promise<User> {
    const user = await this.findOne(id);
    user.isActive = false;
    const saved = await this.userRepository.save(user);
    delete saved.password;
    return saved;
  }

  // ──────────────────────────── Helpers ────────────────────────────────────

  private getJwtToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload);
  }

  private handleDbException(error: any): never {
    if (error.code === '23505') {
      throw new BadRequestException(error.detail);
    }
    throw new InternalServerErrorException('Unexpected error — check server logs');
  }
}
