import { InputType, Field } from '@nestjs/graphql';
import { IsEmail, IsOptional, IsString, Matches } from 'class-validator';

@InputType()
export class UpdateProfileInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsEmail({}, { message: 'Debe ser un email válido' })
  email?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString({ message: 'El nombre de usuario debe ser una cadena' })
  username?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString({ message: 'El nombre debe ser una cadena' })
  nombre?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString({ message: 'El apellido debe ser una cadena' })
  apellido?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString({ message: 'El teléfono debe ser una cadena' })
  telefono?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString({ message: 'El tipo de documento debe ser una cadena' })
  tipoDeDocumento?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @Matches(/^\d+$/, { message: 'El número de identificación debe contener solo dígitos' })
  numeroDeIdentificacion?: string;
}

