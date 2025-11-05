import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma/prisma.service';
import { MetodoPago } from '../entities/metodo-pago.entity';
import { CrearMetodoPagoInput, ActualizarMetodoPagoInput, FiltrosMetodosPagoInput } from '../dto/metodo-pago.input';

@Injectable()
export class MetodosPagoService {
  constructor(private prisma: PrismaService) {}

  async obtenerTodos(filtros?: FiltrosMetodosPagoInput): Promise<MetodoPago[]> {
    const where: any = {};

    if (filtros?.codigo) {
      where.codigo = { contains: filtros.codigo, mode: 'insensitive' };
    }

    if (filtros?.activo !== undefined) {
      where.activo = filtros.activo;
    }

    if (filtros?.esEfectivo !== undefined) {
      where.esEfectivo = filtros.esEfectivo;
    }

    if (filtros?.esTarjeta !== undefined) {
      where.esTarjeta = filtros.esTarjeta;
    }

    if (filtros?.esDigital !== undefined) {
      where.esDigital = filtros.esDigital;
    }

    return this.prisma.metodoPago.findMany({
      where,
      orderBy: { orden: 'asc' }
    });
  }

  async obtenerPorCategoria(categoria: 'efectivo' | 'tarjeta' | 'digital'): Promise<MetodoPago[]> {
    const where: any = { activo: true };

    switch (categoria) {
      case 'efectivo':
        where.esEfectivo = true;
        break;
      case 'tarjeta':
        where.esTarjeta = true;
        break;
      case 'digital':
        where.esDigital = true;
        break;
    }

    return this.prisma.metodoPago.findMany({
      where,
      orderBy: { orden: 'asc' }
    });
  }

  async obtenerPorCodigo(codigo: string): Promise<MetodoPago | null> {
    return this.prisma.metodoPago.findUnique({
      where: { codigo }
    });
  }

  async crearMetodoPago(input: CrearMetodoPagoInput): Promise<MetodoPago> {
    // Verificar si ya existe un método de pago con el mismo código
    const existente = await this.prisma.metodoPago.findUnique({
      where: { codigo: input.codigo }
    });

    if (existente) {
      throw new ConflictException(`Ya existe un método de pago con el código: ${input.codigo}`);
    }

    return this.prisma.metodoPago.create({
      data: {
        codigo: input.codigo,
        nombre: input.nombre,
        descripcion: input.descripcion,
        activo: input.activo ?? true,
        esEfectivo: input.esEfectivo ?? false,
        esTarjeta: input.esTarjeta ?? false,
        esDigital: input.esDigital ?? false,
        orden: input.orden ?? 0
      }
    });
  }

  async actualizarMetodoPago(id: string, input: ActualizarMetodoPagoInput): Promise<MetodoPago> {
    // Verificar si existe el método de pago
    const existente = await this.prisma.metodoPago.findUnique({
      where: { id }
    });

    if (!existente) {
      throw new NotFoundException(`Método de pago con ID ${id} no encontrado`);
    }

    // Si se está cambiando el código, verificar que no exista otro con el mismo código
    if (input.codigo && input.codigo !== existente.codigo) {
      const codigoExistente = await this.prisma.metodoPago.findUnique({
        where: { codigo: input.codigo }
      });

      if (codigoExistente) {
        throw new ConflictException(`Ya existe un método de pago con el código: ${input.codigo}`);
      }
    }

    return this.prisma.metodoPago.update({
      where: { id },
      data: {
        ...(input.codigo && { codigo: input.codigo }),
        ...(input.nombre && { nombre: input.nombre }),
        ...(input.descripcion !== undefined && { descripcion: input.descripcion }),
        ...(input.activo !== undefined && { activo: input.activo }),
        ...(input.esEfectivo !== undefined && { esEfectivo: input.esEfectivo }),
        ...(input.esTarjeta !== undefined && { esTarjeta: input.esTarjeta }),
        ...(input.esDigital !== undefined && { esDigital: input.esDigital }),
        ...(input.orden !== undefined && { orden: input.orden })
      }
    });
  }

  async eliminarMetodoPago(id: string): Promise<boolean> {
    // Verificar si existe el método de pago
    const existente = await this.prisma.metodoPago.findUnique({
      where: { id }
    });

    if (!existente) {
      throw new NotFoundException(`Método de pago con ID ${id} no encontrado`);
    }

    // Verificar si tiene ventas asociadas
    const ventasAsociadas = await this.prisma.historialVentasProductos.count({
      where: { metodoPagoId: id }
    });

    if (ventasAsociadas > 0) {
      throw new ConflictException('No se puede eliminar un método de pago que tiene ventas asociadas');
    }

    await this.prisma.metodoPago.delete({
      where: { id }
    });

    return true;
  }
}
