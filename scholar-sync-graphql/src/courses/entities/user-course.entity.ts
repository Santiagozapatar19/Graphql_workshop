import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Course } from './course.entity';

export enum RelationType {
	student = 'student',
	ta = 'ta',
	professor = 'professor',
}

registerEnumType(RelationType, { name: 'RelationType' });

/**
 * Tabla de unión entre User y Course.
 * Representa el enrollment de un usuario en un curso con un rol específico.
 */
@ObjectType()
@Entity('users_courses')
export class UserCourse {
	@PrimaryGeneratedColumn('uuid')
	@Field(() => ID)
	id!: string;

	@ManyToOne(() => User, (user) => user.userCourses, { onDelete: 'CASCADE' })
	@Field(() => User)
	user!: User;

	@ManyToOne(() => Course, (course) => course.enrollments, { onDelete: 'CASCADE' })
	@Field(() => Course)
	course!: Course;

	@Column({ type: 'enum', enum: RelationType, default: RelationType.student })
	@Field(() => RelationType)
	relationType!: RelationType;

	@Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
	@Field(() => String)
	enrolledAt!: Date;
}

