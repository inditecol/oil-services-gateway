import { InputType, Field, Float, Int } from '@nestjs/graphql';
import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, Min, IsIn, ValidateBy, ValidationOptions } from 'class-validator';

// Validador personalizado para verificar que precio de venta > precio de compra
// Solo valida cuando ambos campos están presentes en el input
// Si precioCompra no está presente, la validación se hace en el resolver usando el valor de la BD
function IsPrecioVentaMayorQueCompra(validationOptions?: ValidationOptions) {
  return ValidateBy(
    {
      name: 'isPrecioVentaMayorQueCompra',
      validator: {
        validate(value: any, args: any) {
          const precioCompra = args?.object?.precioCompra;
          // Si precioCompra no está presente, pasar la validación (se validará en el resolver)
          if (precioCompra === undefined || precioCompra === null) {
            return true;
          }
          // Si ambos están presentes, validar que precioVenta > precioCompra
          return typeof value === 'number' && typeof precioCompra === 'number' && value > precioCompra;
        },
        defaultMessage() {
          return 'El precio de venta debe ser mayor al precio de compra';
        },
      },
    },
    validationOptions,
  );
}

@InputType()
export class CreateProductInput {
  @Field()
  @IsNotEmpty({ message: 'El código es requerido' })
  @IsString({ message: 'El código debe ser una cadena' })
  codigo: string;

  @Field()
  @IsNotEmpty({ message: 'El nombre es requerido' })
  @IsString({ message: 'El nombre debe ser una cadena' })
  nombre: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString({ message: 'La descripción debe ser una cadena' })
  descripcion?: string;

  @Field()
  @IsNotEmpty({ message: 'La unidad de medida es requerida' })
  @IsString({ message: 'La unidad de medida debe ser una cadena' })
  unidadMedida: string;

  @Field(() => Float)
  @IsNumber({}, { message: 'El precio de compra debe ser un número' })
  @Min(0, { message: 'El precio de compra debe ser mayor o igual a 0' })
  precioCompra: number;

  @Field(() => Float)
  @IsNumber({}, { message: 'El precio de venta debe ser un número' })
  @Min(0, { message: 'El precio de venta debe ser mayor o igual a 0' })
  @IsPrecioVentaMayorQueCompra({ message: 'El precio de venta debe ser mayor al precio de compra' })
  precioVenta: number;

  @Field({ defaultValue: 'COP' })
  @IsOptional()
  @IsString({ message: 'La moneda debe ser una cadena' })
  @IsIn(['COP', 'USD', 'EUR'], { message: 'La moneda debe ser COP, USD o EUR' })
  moneda?: string = 'COP';

  @Field(() => Int, { defaultValue: 0 })
  @IsOptional()
  @IsNumber({}, { message: 'El stock mínimo debe ser un número' })
  @Min(0, { message: 'El stock mínimo debe ser mayor o igual a 0' })
  stockMinimo: number = 0;

  @Field(() => Int, { defaultValue: 0 })
  @IsOptional()
  @IsNumber({}, { message: 'El stock actual debe ser un número' })
  @Min(0, { message: 'El stock actual debe ser mayor o igual a 0' })
  stockActual: number = 0;

  @Field({ nullable: true })
  @IsOptional()
  @IsString({ message: 'El tipo de producto debe ser una cadena' })
  tipoProducto?: string;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsNumber({}, { message: 'El código PLU debe ser un número' })
  codigoPlu?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString({ message: 'El punto de venta debe ser una cadena' })
  puntoVentaId?: string;

  @Field({ defaultValue: false })
  @IsOptional()
  @IsBoolean({ message: 'esCombustible debe ser un valor booleano' })
  esCombustible: boolean = false;

  @Field()
  @IsNotEmpty({ message: 'La categoría es requerida' })
  @IsString({ message: 'La categoría debe ser una cadena' })
  categoriaId: string;

  @Field({ defaultValue: true })
  @IsOptional()
  @IsBoolean({ message: 'activo debe ser un valor booleano' })
  activo: boolean = true;
} 