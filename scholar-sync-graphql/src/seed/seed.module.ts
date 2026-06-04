import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Course } from '../courses/entities/course.entity.js';
import { User } from '../users/entities/user.entity.js';
import { SeedResolver } from './seed.resolver.js';
import { SeedService } from './seed.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([User, Course])],
  providers: [SeedService, SeedResolver],
})
export class SeedModule {}