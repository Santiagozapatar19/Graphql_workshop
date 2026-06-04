import { Field, ID, InputType } from '@nestjs/graphql';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { RelationType } from '../entities/user-course.entity.js';

@InputType()
export class EnrollUserInput {
  @Field(() => ID)
  @IsUUID()
  courseId!: string;

  /** Si no se especifica, se usa el usuario autenticado */
  @Field(() => ID, { nullable: true })
  @IsUUID()
  @IsOptional()
  userId?: string;

  @Field(() => RelationType, { nullable: true, defaultValue: RelationType.student })
  @IsEnum(RelationType)
  @IsOptional()
  relationType?: RelationType;
}
