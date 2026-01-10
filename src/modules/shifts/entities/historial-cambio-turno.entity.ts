import { ObjectType, Field, ID, registerEnumType, Int } from '@nestjs/graphql';
import { User } from '../../users/entities/user.entity';

export enum TipoModificacionTurno {
  INFORMACION_GENERAL = 'INFORMACION_GENERAL',
  LECTURA_MANGUERA = 'LECTURA_MANGUERA',
  PRODUCTO_VENDIDO = 'PRODUCTO_VENDIDO',
  METODO_PAGO = 'METODO_PAGO',
  MOVIMIENTO_EFECTIVO = 'MOVIMIENTO_EFECTIVO',
}

registerEnumType(TipoModificacionTurno, {
  name: 'TipoModificacionTurno',
  description: 'Tipos de modificaciones que se pueden registrar en el historial de un turno',
});

@ObjectType()
export class HistorialCambioTurno {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  turnoId: string;

  @Field(() => ID)
  usuarioId: string;

  @Field()
  fechaModificacion: Date;

  @Field(() => TipoModificacionTurno)
  tipoModificacion: TipoModificacionTurno;

  @Field(() => String) // JSON string
  datosAnteriores: string;

  @Field(() => String) // JSON string
  datosNuevos: string;

  @Field({ nullable: true })
  descripcion?: string;

  @Field()
  createdAt: Date;

  @Field(() => User, { nullable: true })
  usuario?: Partial<User>;
}

@ObjectType()
export class HistorialCambioTurnoListResponse {
  @Field(() => [HistorialCambioTurno])
  lecturas: HistorialCambioTurno[];

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  totalPages: number;

  @Field(() => Int)
  currentPage: number;
}

@ObjectType()
export class DetalleHistorialCambioTurno {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  turnoId: string;

  @Field(() => ID)
  usuarioId: string;

  @Field()
  fechaModificacion: Date;

  @Field(() => TipoModificacionTurno)
  tipoModificacion: TipoModificacionTurno;

  @Field(() => String) // JSON string - datos anteriores
  datosAnteriores: string;

  @Field(() => String) // JSON string - datos nuevos
  datosNuevos: string;

  @Field({ nullable: true })
  descripcion?: string;

  @Field()
  createdAt: Date;

  @Field(() => User, { nullable: true })
  usuario?: Partial<User>;
}
