import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

@InputType()
export class SignUpInput {
  @Field(() => String)
  @IsEmail()
  email!: string;

  @Field(() => String)
  @MinLength(6)
  password!: string;

  @Field(() => String)
  @IsNotEmpty()
  @IsString()
  firstName!: string;

  @Field(() => String)
  @IsNotEmpty()
  @IsString()
  lastName!: string;
}
