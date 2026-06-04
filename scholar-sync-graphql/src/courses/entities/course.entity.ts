import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { UserCourse } from './user-course.entity';

@ObjectType()
@Entity('courses')
export class Course {
  @PrimaryGeneratedColumn('uuid')
  @Field(() => ID)
  id!: string;

  @Column()
  @Field(() => String)
  name!: string;

  @Column({ nullable: true })
  @Field(() => String, { nullable: true })
  description?: string;

  @Column({ type: 'int', default: 3 })
  @Field(() => Int)
  credits!: number;

  @Column({ type: 'boolean', default: true })
  @Field(() => Boolean)
  isActive!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  @Field(() => String, { nullable: true })
  startDate?: Date;

  /** Relación con UserCourse (módulo 2 — enrollment) */
  @OneToMany(() => UserCourse, (uc) => uc.course)
  @Field(() => [UserCourse], { nullable: true })
  enrollments?: UserCourse[];
}
