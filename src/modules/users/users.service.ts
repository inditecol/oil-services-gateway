import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import { CreateUserInput } from './dto/create-user.input';
import { UpdateUserInput } from './dto/update-user.input';
import { UpdateProfileInput } from './dto/update-profile.input';
import { FilterUsersInput } from './dto/filter-users.input';
import { User } from './entities/user.entity';
import { UserListResponse } from './entities/user-list-response.entity';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) { }

  async create(createUserInput: CreateUserInput): Promise<User> {
    // Verificar si el email ya existe
    const existingUser = await this.prisma.usuario.findUnique({
      where: { email: createUserInput.email },
    });

    if (existingUser) {
      throw new ConflictException('El email ya está en uso');
    }

    // Verificar si el username ya existe
    const existingUsername = await this.prisma.usuario.findUnique({
      where: { username: createUserInput.username },
    });

    if (existingUsername) {
      throw new ConflictException('El nombre de usuario ya está en uso');
    }

    // Verificar que el rol existe
    const rol = await this.prisma.rol.findUnique({
      where: { id: createUserInput.rolId },
    });

    if (!rol) {
      throw new NotFoundException('Rol no encontrado');
    }

    // Verificar que los puntos de venta existen (si se proporcionan)
    if (createUserInput.puntosVentaIds && createUserInput.puntosVentaIds.length > 0) {
      const puntosVenta = await this.prisma.puntoVenta.findMany({
        where: { id: { in: createUserInput.puntosVentaIds } },
      });

      if (puntosVenta.length !== createUserInput.puntosVentaIds.length) {
        throw new NotFoundException('Uno o más puntos de venta no existen');
      }
    }

    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash(createUserInput.password, 12);

    const { puntosVentaIds, ...userData } = createUserInput;

    const user = await this.prisma.usuario.create({
      data: {
        ...userData,
        tipoDeDocumento: createUserInput.tipoDeDocumento,
        numeroDeIdentificacion: BigInt(createUserInput.numeroDeIdentificacion),
        password: hashedPassword,
        puntosVenta: puntosVentaIds ? {
          connect: puntosVentaIds.map(id => ({ id }))
        } : undefined,
      },
      include: {
        rol: true,
        puntosVenta: {
          include: {
            empresa: true
          }
        }
      },
    });

    return this.formatUser(user);
  }

  async findAll(): Promise<User[]> {
    const users = await this.prisma.usuario.findMany({
      include: {
        rol: true,
        puntosVenta: {
          include: {
            empresa: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    console.log("users", users)
    return users.map(user => ({
      id: user.id,
      email: user.email,
      username: user.username,
      password: user.password,
      nombre: user.nombre,
      apellido: user.apellido,
      telefono: user.telefono,
      activo: user.activo,
      emailVerified: user.emailVerified,
      ultimoLogin: user.ultimoLogin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      rolId: user.rolId,
      rol: user.rol,
      puntosVenta: user.puntosVenta.map(pv => ({
        id: pv.id,
        codigo: pv.codigo,
        nombre: pv.nombre,
        descripcion: pv.descripcion,
        direccion: pv.direccion,
        ciudad: pv.ciudad,
        provincia: pv.provincia,
        pais: pv.pais,
        codigoPostal: pv.codigoPostal,
        telefono: pv.telefono,
        telefonoMovil: pv.telefonoMovil,
        email: pv.email,
        horarioApertura: pv.horarioApertura,
        horarioCierre: pv.horarioCierre,
        diasAtencion: pv.diasAtencion,
        coordenadasGPS: pv.coordenadasGPS,
        tipoEstacion: pv.tipoEstacion,
        serviciosAdicionales: pv.serviciosAdicionales,
        capacidadMaxima: pv.capacidadMaxima,
        fechaApertura: pv.fechaApertura,
        activo: pv.activo,
        createdAt: pv.createdAt,
        updatedAt: pv.updatedAt,
        empresaId: pv.empresaId,
        empresa: {
          id: pv.empresa.id,
          rut: pv.empresa.rut,
          razonSocial: pv.empresa.razonSocial,
          nombreComercial: pv.empresa.nombreComercial,
          nombre: pv.empresa.nombre,
          direccion: pv.empresa.direccion,
          ciudad: pv.empresa.ciudad,
          provincia: pv.empresa.provincia,
          pais: pv.empresa.pais,
          codigoPostal: pv.empresa.codigoPostal,
          telefono: pv.empresa.telefono,
          telefonoMovil: pv.empresa.telefonoMovil,
          email: pv.empresa.email,
          sitioWeb: pv.empresa.sitioWeb,
          logo: pv.empresa.logo,
          sector: pv.empresa.sector,
          tipoEmpresa: pv.empresa.tipoEmpresa,
          fechaConstitucion: pv.empresa.fechaConstitucion,
          activo: pv.empresa.activo,
          createdAt: pv.empresa.createdAt,
          updatedAt: pv.empresa.updatedAt,
          puntosVenta: [],
        },
      })),
    }));
  }

  async findAllWithFilters(
    filters?: FilterUsersInput,
    page: number = 1,
    limit: number = 10,
  ): Promise<UserListResponse> {
    // Si limit es -1, obtener todos los resultados sin paginación
    const usesPagination = limit !== -1;
    const skip = usesPagination ? (page - 1) * limit : 0;

    // Construir las condiciones de filtrado
    const where: any = {};

    if (filters?.activo !== undefined) {
      where.activo = filters.activo;
    }

    if (filters?.emailVerified !== undefined) {
      where.emailVerified = filters.emailVerified;
    }

    if (filters?.roleName) {
      where.rol = {
        nombre: filters.roleName,
      };
    }

    if (filters?.search) {
      where.OR = [
        { nombre: { contains: filters.search, mode: 'insensitive' } },
        { apellido: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { username: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // Contar total de registros
    const total = await this.prisma.usuario.count({ where });

    // Configurar la query
    const queryOptions: any = {
      where,
      include: {
        rol: true,
        puntosVenta: {
          include: {
            empresa: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc',
      },
    };

    // Solo agregar skip y take si se usa paginación
    if (usesPagination) {
      queryOptions.skip = skip;
      queryOptions.take = limit;
    }

    // Obtener usuarios con filtros
    const users = await this.prisma.usuario.findMany(queryOptions);

    const totalPages = usesPagination ? Math.ceil(total / limit) : 1;
    const actualLimit = usesPagination ? limit : total;

    return {
      users: users.map(user => this.formatUser(user)),
      total,
      page: usesPagination ? page : 1,
      limit: actualLimit,
      totalPages,
    };
  }

  async findById(id: string): Promise<User | null> {
    const user = await this.prisma.usuario.findUnique({
      where: { id },
      include: {
        rol: true,
        puntosVenta: {
          include: {
            empresa: true
          }
        }
      },
    });

    if (!user) return null;

    return this.formatUser(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    const user = await this.prisma.usuario.findUnique({
      where: { email },
      include: {
        rol: true,
        puntosVenta: {
          include: {
            empresa: true
          }
        }
      },
    });

    if (!user) return null;

    return this.formatUser(user);
  }

  async findByUsername(username: string): Promise<User | null> {
    const user = await this.prisma.usuario.findUnique({
      where: { username },
      include: {
        rol: true,
        puntosVenta: {
          include: {
            empresa: true
          }
        }
      },
    });

    return user ? this.formatUser(user) : null;
  }

  async update(id: string, updateUserInput: UpdateUserInput): Promise<User> {
    const existingUser = await this.findById(id);

    if (!existingUser) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Si se está actualizando el email, verificar que no exista
    if (updateUserInput.email && updateUserInput.email !== existingUser.email) {
      const emailExists = await this.prisma.usuario.findUnique({
        where: { email: updateUserInput.email },
      });

      if (emailExists) {
        throw new ConflictException('El email ya está en uso');
      }
    }

    // Si se está actualizando el username, verificar que no exista
    if (updateUserInput.username && updateUserInput.username !== existingUser.username) {
      const usernameExists = await this.prisma.usuario.findUnique({
        where: { username: updateUserInput.username },
      });

      if (usernameExists) {
        throw new ConflictException('El nombre de usuario ya está en uso');
      }
    }

    // Verificar que los puntos de venta existen (si se proporcionan)
    if (updateUserInput.puntosVentaIds && updateUserInput.puntosVentaIds.length > 0) {
      const puntosVenta = await this.prisma.puntoVenta.findMany({
        where: { id: { in: updateUserInput.puntosVentaIds } },
      });

      if (puntosVenta.length !== updateUserInput.puntosVentaIds.length) {
        throw new NotFoundException('Uno o más puntos de venta no existen');
      }
    }

    const { puntosVentaIds, ...updateData } = updateUserInput;

    // Si se está actualizando la contraseña, hashearla
    if (updateData.password) {
      updateData.password = await bcrypt.hash(updateData.password, 12);
    }

    const user = await this.prisma.usuario.update({
      where: { id },
      data: {
        ...updateData,
        puntosVenta: puntosVentaIds ? {
          set: puntosVentaIds.map(id => ({ id }))
        } : undefined,
      },
      include: {
        rol: true,
        puntosVenta: {
          include: {
            empresa: true
          }
        }
      },
    });

    return this.formatUser(user);
  }

  async updateProfile(userId: string, updateProfileInput: UpdateProfileInput): Promise<User> {
    const existingUser = await this.findById(userId);

    if (!existingUser) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // Si se está actualizando el email, verificar que no exista
    if (updateProfileInput.email && updateProfileInput.email !== existingUser.email) {
      const emailExists = await this.prisma.usuario.findUnique({
        where: { email: updateProfileInput.email },
      });

      if (emailExists) {
        throw new ConflictException('El email ya está en uso');
      }
    }

    // Si se está actualizando el username, verificar que no exista
    if (updateProfileInput.username && updateProfileInput.username !== existingUser.username) {
      const usernameExists = await this.prisma.usuario.findUnique({
        where: { username: updateProfileInput.username },
      });

      if (usernameExists) {
        throw new ConflictException('El nombre de usuario ya está en uso');
      }
    }

    // Solo actualizar los campos permitidos del perfil
    const user = await this.prisma.usuario.update({
      where: { id: userId },
      data: {
        ...(updateProfileInput.email && { email: updateProfileInput.email }),
        ...(updateProfileInput.username && { username: updateProfileInput.username }),
        ...(updateProfileInput.nombre && { nombre: updateProfileInput.nombre }),
        ...(updateProfileInput.apellido && { apellido: updateProfileInput.apellido }),
        ...(updateProfileInput.telefono !== undefined && { telefono: updateProfileInput.telefono }),
        ...(updateProfileInput.tipoDeDocumento && { tipoDeDocumento: updateProfileInput.tipoDeDocumento }),
        ...(updateProfileInput.numeroDeIdentificacion !== undefined && { 
          numeroDeIdentificacion: BigInt(updateProfileInput.numeroDeIdentificacion) 
        }),
      },
      include: {
        rol: true,
        puntosVenta: {
          include: {
            empresa: true
          }
        }
      },
    });

    return this.formatUser(user);
  }

  async remove(id: string): Promise<User> {
    const existingUser = await this.findById(id);

    if (!existingUser) {
      throw new NotFoundException('Usuario no encontrado');
    }

    // En lugar de eliminar, marcar como inactivo
    const user = await this.prisma.usuario.update({
      where: { id },
      data: { activo: false },
      include: {
        rol: true,
        puntosVenta: {
          include: {
            empresa: true
          }
        }
      },
    });

    return this.formatUser(user);
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.prisma.usuario.update({
      where: { id },
      data: { ultimoLogin: new Date() },
    });
  }

  async changePassword(id: string, newPassword: string): Promise<boolean> {
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await this.prisma.usuario.update({
      where: { id },
      data: { password: hashedPassword },
    });

    return true;
  }

  async toggleUserStatus(id: string): Promise<User> {
    const user = await this.findById(id);

    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const updatedUser = await this.prisma.usuario.update({
      where: { id },
      data: { activo: !user.activo },
      include: {
        rol: true,
        puntosVenta: {
          include: {
            empresa: true
          }
        }
      },
    });

    return this.formatUser(updatedUser);
  }

  async findUsersByRole(roleName: string): Promise<User[]> {
    const users = await this.prisma.usuario.findMany({
      where: {
        rol: {
          nombre: roleName,
        },
        activo: true, // Solo usuarios activos por defecto
      },
      include: {
        rol: true,
        puntosVenta: {
          include: {
            empresa: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return users.map(user => this.formatUser(user));
  }

  async addPointOfSaleToUser(userId: string, pointOfSaleId: string): Promise<User> {
    const user = await this.prisma.usuario.update({
      where: { id: userId },
      data: {
        puntosVenta: {
          connect: { id: pointOfSaleId }
        }
      },
      include: {
        rol: true,
        puntosVenta: {
          include: {
            empresa: true
          }
        }
      },
    });

    return this.formatUser(user);
  }

  async removePointOfSaleFromUser(userId: string, pointOfSaleId: string): Promise<User> {
    const user = await this.prisma.usuario.update({
      where: { id: userId },
      data: {
        puntosVenta: {
          disconnect: { id: pointOfSaleId }
        }
      },
      include: {
        rol: true,
        puntosVenta: {
          include: {
            empresa: true
          }
        }
      },
    });

    return this.formatUser(user);
  }

  private formatUser(user: any): User {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      password: user.password,
      nombre: user.nombre,
      apellido: user.apellido,
      telefono: user.telefono,
      tipoDeDocumento: user.tipoDeDocumento,
      numeroDeIdentificacion: user.numeroDeIdentificacion ? user.numeroDeIdentificacion.toString() : null,
      activo: user.activo,
      emailVerified: user.emailVerified,
      ultimoLogin: user.ultimoLogin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      rolId: user.rolId,
      rol: user.rol,
      puntosVenta: user.puntosVenta.map(pv => ({
        id: pv.id,
        codigo: pv.codigo,
        nombre: pv.nombre,
        descripcion: pv.descripcion,
        direccion: pv.direccion,
        ciudad: pv.ciudad,
        provincia: pv.provincia,
        pais: pv.pais,
        codigoPostal: pv.codigoPostal,
        telefono: pv.telefono,
        telefonoMovil: pv.telefonoMovil,
        email: pv.email,
        horarioApertura: pv.horarioApertura,
        horarioCierre: pv.horarioCierre,
        diasAtencion: pv.diasAtencion,
        coordenadasGPS: pv.coordenadasGPS,
        tipoEstacion: pv.tipoEstacion,
        serviciosAdicionales: pv.serviciosAdicionales,
        capacidadMaxima: pv.capacidadMaxima,
        fechaApertura: pv.fechaApertura,
        activo: pv.activo,
        createdAt: pv.createdAt,
        updatedAt: pv.updatedAt,
        empresaId: pv.empresaId,
        empresa: {
          id: pv.empresa.id,
          rut: pv.empresa.rut,
          razonSocial: pv.empresa.razonSocial,
          nombreComercial: pv.empresa.nombreComercial,
          nombre: pv.empresa.nombre,
          direccion: pv.empresa.direccion,
          ciudad: pv.empresa.ciudad,
          provincia: pv.empresa.provincia,
          pais: pv.empresa.pais,
          codigoPostal: pv.empresa.codigoPostal,
          telefono: pv.empresa.telefono,
          telefonoMovil: pv.empresa.telefonoMovil,
          email: pv.empresa.email,
          sitioWeb: pv.empresa.sitioWeb,
          logo: pv.empresa.logo,
          sector: pv.empresa.sector,
          tipoEmpresa: pv.empresa.tipoEmpresa,
          fechaConstitucion: pv.empresa.fechaConstitucion,
          activo: pv.empresa.activo,
          createdAt: pv.empresa.createdAt,
          updatedAt: pv.empresa.updatedAt,
          puntosVenta: [],
        },
      })),
    };
  }
} 