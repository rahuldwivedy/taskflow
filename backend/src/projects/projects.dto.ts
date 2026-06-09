import { IsString, IsEmail, IsOptional, MinLength } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class InviteMemberDto {
  @IsEmail()
  email: string;
}
