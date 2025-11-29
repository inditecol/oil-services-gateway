import { ObjectType, Field, Float, Int } from '@nestjs/graphql';
import { ResumenFinanciero } from './shift-closure.entity';

@ObjectType()
export class ProductoResumenGeneral {
  @Field()
  codigo: string;

  @Field()
  nombre: string;
}

@ObjectType()
export class VentasResumenGeneral {
  @Field(() => Float)
  totalGalones: number;

  @Field(() => Float)
  totalLitros: number;

  @Field(() => Float)
  totalValor: number;

  @Field(() => Int)
  numeroTransacciones: number;
}

@ObjectType()
export class UltimaVentaResumenGeneral {
  @Field()
  fecha: Date;

  @Field(() => Float)
  galones: number;

  @Field(() => Float)
  litros: number;

  @Field(() => Float)
  valor: number;
}

@ObjectType()
export class TotalesSurtidorGeneral {
  @Field(() => Float)
  totalGalones: number;

  @Field(() => Float)
  totalLitros: number;

  @Field(() => Float)
  totalValor: number;
}

@ObjectType()
export class MangueraResumenGeneral {
  @Field()
  numeroManguera: string;

  @Field({ nullable: true })
  color?: string;

  @Field(() => ProductoResumenGeneral)
  producto: ProductoResumenGeneral;

  @Field(() => VentasResumenGeneral)
  ventas: VentasResumenGeneral;

  @Field(() => UltimaVentaResumenGeneral, { nullable: true })
  ultimaVenta?: UltimaVentaResumenGeneral;
}

@ObjectType()
export class SurtidorResumenGeneral {
  @Field()
  numero: string;

  @Field()
  nombre: string;

  @Field({ nullable: true })
  ubicacion?: string;

  @Field(() => [MangueraResumenGeneral])
  mangueras: MangueraResumenGeneral[];

  @Field(() => TotalesSurtidorGeneral)
  totales: TotalesSurtidorGeneral;
}

@ObjectType()
export class TotalesGenerales {
  @Field(() => Float)
  totalGalones: number;

  @Field(() => Float)
  totalLitros: number;

  @Field(() => Float)
  totalValor: number;

  @Field(() => Int)
  totalTransacciones: number;

  @Field(() => Int)
  totalSurtidores: number;

  @Field(() => Int)
  totalMangueras: number;
}

@ObjectType()
export class PeriodoResumenGeneral {
  @Field({ nullable: true })
  desde?: Date;

  @Field({ nullable: true })
  hasta?: Date;
}

@ObjectType()
export class ConsolidadoVentasGeneral {
  @Field(() => PeriodoResumenGeneral)
  periodo: PeriodoResumenGeneral;

  @Field(() => [SurtidorResumenGeneral])
  surtidores: SurtidorResumenGeneral[];

  @Field(() => TotalesGenerales)
  totalesGenerales: TotalesGenerales;

  @Field(() => ResumenFinanciero, { nullable: true })
  resumenFinanciero?: ResumenFinanciero;

  @Field()
  fechaGeneracion: Date;
} 