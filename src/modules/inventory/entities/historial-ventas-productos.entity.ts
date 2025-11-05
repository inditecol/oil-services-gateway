import { ObjectType, Field, ID, Float, Int } from '@nestjs/graphql';
import { Producto } from './producto.entity';
import { MetodoPago } from './metodo-pago.entity';
import { Cliente } from '../../clients/entities/cliente.entity';
import { User } from '../../users/entities/user.entity';
import { Shift } from '../../shifts/entities/shift.entity';
import { PointOfSale } from '../../point-of-sale/entities/point-of-sale.entity';

@ObjectType()
export class HistorialVentasProductos {
  @Field(() => ID)
  id: string;

  @Field()
  fechaVenta: Date;

  @Field(() => Float)
  cantidadVendida: number;

  @Field(() => Float)
  precioUnitario: number;

  @Field(() => Float)
  valorTotal: number;

  @Field()
  unidadMedida: string;

  @Field({ nullable: true })
  observaciones?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  // Relaciones
  @Field(() => String)
  productoId: string;

  @Field(() => Producto)
  producto: Producto;

  @Field(() => String)
  metodoPagoId: string;

  @Field(() => MetodoPago)
  metodoPago: MetodoPago;

  @Field(() => String, { nullable: true })
  clienteId?: string;

  @Field(() => Cliente, { nullable: true })
  cliente?: Cliente;

  @Field(() => String)
  usuarioId: string;

  @Field(() => User)
  usuario: User;

  @Field(() => String)
  turnoId: string;

  @Field(() => Shift)
  turno: Shift;

  @Field(() => String)
  puntoVentaId: string;

  @Field(() => PointOfSale)
  puntoVenta: PointOfSale;
}
