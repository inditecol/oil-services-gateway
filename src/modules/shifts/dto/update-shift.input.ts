import { InputType, Field, ID } from '@nestjs/graphql';
import { IsString, IsOptional, IsBoolean, IsDateString, Matches } from 'class-validator';

@InputType()
export class UpdateShiftInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  startDate?: string; // Formato esperado: "YYYY-MM-DD HH:mm:ss" o "YYYY-MM-DD HH:mm:ss.fff" (ejemplo: "2025-12-03 06:00:00" o "2025-12-11 23:59:59.999")

  @Field({ nullable: true })
  @IsOptional()
  @IsDateString()
  endDate?: string; // Formato esperado: "YYYY-MM-DD HH:mm:ss" o "YYYY-MM-DD HH:mm:ss.fff" (ejemplo: "2025-12-03 14:00:00" o "2025-12-11 23:59:59.999")

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'startTime must have HH:mm format (e.g.: 08:00, 14:30)'
  })
  startTime?: string; // Formato esperado: "HH:mm" (ejemplo: "06:00")

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'endTime must have HH:mm format (e.g.: 14:00, 22:30)'
  })
  endTime?: string; // Formato esperado: "HH:mm" (ejemplo: "14:00") - Puede ser undefined para eliminar

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  observations?: string;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsString()
  userId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsBoolean()
  active?: boolean;
} 