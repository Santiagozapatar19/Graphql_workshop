import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { Course } from '../courses/entities/course.entity';
import { User, ValidRoles } from '../users/entities/user.entity';

@Injectable()
export class SeedService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Course)
    private readonly courseRepository: Repository<Course>,
  ) {}

  async runSeed(): Promise<string> {
    await this.deleteTables();
    await this.insertUsers();
    await this.insertCourses();
    return 'Seed executed successfully';
  }

  private async deleteTables(): Promise<void> {
    await this.courseRepository.query(`DELETE FROM users_courses`);
    await this.courseRepository.query(`DELETE FROM courses`);
    await this.userRepository.query(`DELETE FROM users`);
  }

  private async insertUsers(): Promise<void> {
    const users = [
      {
        email: 'admin@scholar.com',
        password: bcrypt.hashSync('Admin123', 10),
        firstName: 'Super',
        lastName: 'Admin',
        roles: [ValidRoles.admin],
        isActive: true,
      },
      {
        email: 'student1@scholar.com',
        password: bcrypt.hashSync('Student123', 10),
        firstName: 'Carlos',
        lastName: 'López',
        roles: [ValidRoles.student],
        isActive: true,
      },
      {
        email: 'student2@scholar.com',
        password: bcrypt.hashSync('Student123', 10),
        firstName: 'María',
        lastName: 'García',
        roles: [ValidRoles.student],
        isActive: true,
      },
    ];

    await this.userRepository.save(this.userRepository.create(users));
  }

  private async insertCourses(): Promise<void> {
    const courses = [
      {
        name: 'Computación en Internet III',
        description: 'Backend con GraphQL y NestJS',
        credits: 3,
        isActive: true,
        startDate: new Date('2026-08-01'),
      },
      {
        name: 'Bases de Datos Avanzadas',
        description: 'TypeORM, PostgreSQL y modelado de datos',
        credits: 4,
        isActive: true,
        startDate: new Date('2026-08-01'),
      },
      {
        name: 'Arquitectura de Software',
        description: 'Patrones de diseño y arquitecturas modernas',
        credits: 3,
        isActive: true,
        startDate: new Date('2026-08-15'),
      },
    ];

    await this.courseRepository.save(this.courseRepository.create(courses));
  }
}
