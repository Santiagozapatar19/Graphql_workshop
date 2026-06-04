import { Field, InputType, Int } from '@nestjs/graphql';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

@InputType()
export class CreateCourseInput {
  @Field(() => String)
  @IsNotEmpty()
  @IsString()
  name!: string;

  @Field(() => String, { nullable: true })
  @IsString()
  @IsOptional()
  description?: string;

  @Field(() => Int, { nullable: true, defaultValue: 3 })
  @IsInt()
  @Min(1)
  @IsOptional()
  credits?: number;

  @Field(() => String, { nullable: true })
  @IsString()
  @IsOptional()
  startDate?: string;
}
