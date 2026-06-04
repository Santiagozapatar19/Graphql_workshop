import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { UserCourse } from '../../courses/entities/user-course.entity';

export enum ValidRoles {
  admin = 'admin',
  student = 'student',
}

registerEnumType(ValidRoles, { name: 'ValidRoles' });

@ObjectType()
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  @Field(() => ID)
  id!: string;

  @Column({ unique: true })
  @Field(() => String)
  email!: string;

  @Column()
  password?: string;

  @Column()
  @Field(() => String)
  firstName!: string;

  @Column()
  @Field(() => String)
  lastName!: string;

  @Column({ type: 'text', array: true, default: ['student'] })
  @Field(() => [String])
  roles!: string[];

  @Column({ type: 'boolean', default: true })
  @Field(() => Boolean)
  isActive!: boolean;

  @OneToMany(() => UserCourse, (uc) => uc.user)
  userCourses!: UserCourse[];
}
