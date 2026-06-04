import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Course } from '../courses/entities/course.entity';
import { User } from '../users/entities/user.entity';
import { SeedResolver } from './seed.resolver';
import { SeedService } from './seed.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Course])],
  providers: [SeedService, SeedResolver],
})
export class SeedModule {}
