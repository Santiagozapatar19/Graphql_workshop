import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';

import { Course } from './entities/course.entity.js';
import { UserCourse } from './entities/user-course.entity.js';
import { CoursesService } from './courses.service';
import { CreateCourseInput } from './dto/create-course.input';
import { UpdateCourseInput } from './dto/update-course.input';
import { EnrollUserInput } from './dto/enroll-user.input';
import { Auth } from '../users/decorators/auth.decorator.js';
import { CurrentUser } from '../users/decorators/current-user.decorator.js';
import { User, ValidRoles } from '../users/entities/user.entity.js';

@Resolver(() => Course)
export class CoursesResolver {
  constructor(private readonly coursesService: CoursesService) {}

  // ──────────────────────────── Course Mutations ───────────────────────────

  /** Crea un nuevo curso — solo admin */
  @Mutation(() => Course, { name: 'createCourse' })
  @Auth(ValidRoles.admin)
  createCourse(@Args('createCourseInput') createCourseInput: CreateCourseInput): Promise<Course> {
    return this.coursesService.create(createCourseInput);
  }

  /** Actualiza un curso — solo admin */
  @Mutation(() => Course, { name: 'updateCourse' })
  @Auth(ValidRoles.admin)
  updateCourse(@Args('updateCourseInput') updateCourseInput: UpdateCourseInput): Promise<Course> {
    return this.coursesService.update(updateCourseInput);
  }

  /** Desactiva un curso — solo admin */
  @Mutation(() => Course, { name: 'removeCourse' })
  @Auth(ValidRoles.admin)
  removeCourse(@Args('id', { type: () => ID }) id: string): Promise<Course> {
    return this.coursesService.remove(id);
  }

  // ──────────────────────────── Course Queries ────────────────────────────

  /** Lista todos los cursos activos — cualquier usuario autenticado */
  @Query(() => [Course], { name: 'courses' })
  @Auth()
  findAll(): Promise<Course[]> {
    return this.coursesService.findAll();
  }

  /** Busca un curso por id — cualquier usuario autenticado */
  @Query(() => Course, { name: 'course' })
  @Auth()
  findOne(@Args('id', { type: () => ID }) id: string): Promise<Course> {
    return this.coursesService.findOne(id);
  }

  // ──────────────────────────── Enrollment (Módulo 2) ─────────────────────

  /**
   * Inscribe a un usuario en un curso.
   * Un student se inscribe a sí mismo (userId omitido).
   * Un admin puede inscribir a cualquier usuario especificando userId.
   */
  @Mutation(() => UserCourse, { name: 'enrollUser' })
  @Auth()
  enrollUser(
    @Args('enrollUserInput') enrollUserInput: EnrollUserInput,
    @CurrentUser() currentUser: User,
  ): Promise<UserCourse> {
    return this.coursesService.enrollUser(enrollUserInput, currentUser);
  }

  /**
   * Lista las inscripciones del usuario autenticado.
   * Un admin puede consultar las de cualquier usuario pasando userId.
   */
  @Query(() => [UserCourse], { name: 'myEnrollments' })
  @Auth()
  myEnrollments(
    @CurrentUser() currentUser: User,
    @Args('userId', { type: () => ID, nullable: true }) userId?: string,
  ): Promise<UserCourse[]> {
    return this.coursesService.myEnrollments(currentUser, userId);
  }

  /**
   * Cancela una inscripción — el propio usuario o un admin.
   */
  @Mutation(() => UserCourse, { name: 'unenroll' })
  @Auth()
  unenroll(
    @Args('enrollmentId', { type: () => ID }) enrollmentId: string,
    @CurrentUser() currentUser: User,
  ): Promise<UserCourse> {
    return this.coursesService.unenroll(enrollmentId, currentUser);
  }
}
