import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Course } from './entities/course.entity';
import { UserCourse } from './entities/user-course.entity';
import { CreateCourseInput } from './dto/create-course.input';
import { UpdateCourseInput } from './dto/update-course.input';
import { EnrollUserInput } from './dto/enroll-user.input';
import { User, ValidRoles } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
    @InjectRepository(UserCourse)
    private readonly userCourseRepository: Repository<UserCourse>,
    private readonly usersService: UsersService,
  ) {}

  // ──────────────────────────── Course CRUD ────────────────────────────────

  /** Crea un curso — solo admin */
  async create(createCourseInput: CreateCourseInput): Promise<Course> {
    const course = this.courseRepository.create({
      ...createCourseInput,
      startDate: createCourseInput.startDate ? new Date(createCourseInput.startDate) : undefined,
    });
    return this.courseRepository.save(course);
  }

  /** Lista todos los cursos activos */
  async findAll(): Promise<Course[]> {
    return this.courseRepository.find({ where: { isActive: true }, relations: { enrollments: { user: true } } });
  }

  /** Busca un curso por id */
  async findOne(id: string): Promise<Course> {
    const course = await this.courseRepository.findOne({
      where: { id },
      relations: { enrollments: { user: true } },
    });
    if (!course) throw new NotFoundException(`Course with id ${id} not found`);
    return course;
  }

  /**
   * Actualiza un curso — solo admin.
   */
  async update(updateCourseInput: UpdateCourseInput): Promise<Course> {
    const course = await this.findOne(updateCourseInput.id);
    const merged = this.courseRepository.merge(course, {
      ...updateCourseInput,
      startDate: updateCourseInput.startDate ? new Date(updateCourseInput.startDate) : course.startDate,
    });
    return this.courseRepository.save(merged);
  }

  /**
   * Elimina un curso (soft-delete: isActive=false) — solo admin.
   */
  async remove(id: string): Promise<Course> {
    const course = await this.findOne(id);
    course.isActive = false;
    return this.courseRepository.save(course);
  }

  // ──────────────────────── UserCourse (Módulo 2) ───────────────────────────

  /**
   * Enrolls a user in a course.
   * - Un admin puede inscribir a cualquier usuario (especificando userId).
   * - Un student solo puede inscribirse a sí mismo.
   */
  async enrollUser(enrollUserInput: EnrollUserInput, currentUser: User): Promise<UserCourse> {
    const isAdmin = currentUser.roles.includes(ValidRoles.admin);

    // Determinar qué usuario se va a inscribir
    const targetUserId = enrollUserInput.userId ?? currentUser.id;

    if (!isAdmin && targetUserId !== currentUser.id) {
      throw new ForbiddenException('Students can only enroll themselves');
    }

    const course = await this.findOne(enrollUserInput.courseId);
    const user = await this.usersService.findOne(targetUserId);

    // Verificar si ya está inscrito
    const existing = await this.userCourseRepository.findOne({
      where: { user: { id: user.id }, course: { id: course.id } },
    });
    if (existing) throw new ConflictException('User is already enrolled in this course');

    const enrollment = this.userCourseRepository.create({
      user,
      course,
      relationType: enrollUserInput.relationType,
    });
    return this.userCourseRepository.save(enrollment);
  }

  /**
   * Lista los cursos en los que está inscrito el usuario actual.
   * Un admin puede ver los de cualquier usuario (pasando userId).
   */
  async myEnrollments(currentUser: User, userId?: string): Promise<UserCourse[]> {
    const isAdmin = currentUser.roles.includes(ValidRoles.admin);
    const targetId = isAdmin && userId ? userId : currentUser.id;

    return this.userCourseRepository.find({
      where: { user: { id: targetId } },
      relations: { course: true, user: true },
    });
  }

  /** Cancela una inscripción — el propio usuario o un admin */
  async unenroll(enrollmentId: string, currentUser: User): Promise<UserCourse> {
    const enrollment = await this.userCourseRepository.findOne({
      where: { id: enrollmentId },
      relations: { user: true, course: true },
    });
    if (!enrollment) throw new NotFoundException(`Enrollment ${enrollmentId} not found`);

    const isAdmin = currentUser.roles.includes(ValidRoles.admin);
    if (!isAdmin && enrollment.user.id !== currentUser.id) {
      throw new ForbiddenException('You can only cancel your own enrollments');
    }

    await this.userCourseRepository.delete(enrollment.id);
    return enrollment;
  }
}
