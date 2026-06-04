import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Course } from './entities/course.entity';
import { UserCourse } from './entities/user-course.entity.js';
import { CoursesService } from './courses.service';
import { CoursesResolver } from './courses.resolver';
import { UsersModule } from '../users/users.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([Course, UserCourse]),
    UsersModule, 
  ],
  providers: [CoursesService, CoursesResolver],
})
export class CoursesModule {}
