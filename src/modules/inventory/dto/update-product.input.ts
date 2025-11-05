import { InputType, PartialType, Field } from '@nestjs/graphql';
import { CreateProductInput } from './create-product.input';
import { IsOptional, IsString } from 'class-validator';

@InputType()
export class UpdateProductInput extends PartialType(CreateProductInput) {
  @Field({ nullable: true })
  @IsOptional()
  @IsString({ message: 'El motivo del cambio de precio debe ser una cadena' })
  motivoCambioPrecio?: string;
} 