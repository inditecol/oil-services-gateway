import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { CreateConfiguracionEmpresaDto } from './dto/create-configuracion-empresa.dto';
import { UpdateConfiguracionEmpresaDto } from './dto/update-configuracion-empresa.dto';
import { Company } from './entities/company.entity';
import { ConfiguracionEmpresa } from './entities/configuracion-empresa.entity';

@Injectable()
export class CompanyService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createCompanyDto: CreateCompanyDto): Promise<Company> {
    // Verificar si el RUT ya existe
    const existingCompany = await this.prisma.empresa.findUnique({
      where: { rut: createCompanyDto.rut },
    });

    if (existingCompany) {
      throw new ConflictException('El RUT ya está en uso');
    }

    // Verificar si el email ya existe (si se proporciona)
    if (createCompanyDto.email) {
      const existingEmail = await this.prisma.empresa.findUnique({
        where: { email: createCompanyDto.email },
      });

      if (existingEmail) {
        throw new ConflictException('El email ya está en uso');
      }
    }

    const company = await this.prisma.empresa.create({
      data: {
        rut: createCompanyDto.rut,
        razonSocial: createCompanyDto.razonSocial,
        nombreComercial: createCompanyDto.nombreComercial,
        nombre: createCompanyDto.nombre,
        direccion: createCompanyDto.direccion,
        ciudad: createCompanyDto.ciudad,
        provincia: createCompanyDto.provincia,
        pais: createCompanyDto.pais || 'Perú',
        codigoPostal: createCompanyDto.codigoPostal,
        telefono: createCompanyDto.telefono,
        telefonoMovil: createCompanyDto.telefonoMovil,
        email: createCompanyDto.email,
        sitioWeb: createCompanyDto.sitioWeb,
        logo: createCompanyDto.logo,
        sector: createCompanyDto.sector,
        tipoEmpresa: createCompanyDto.tipoEmpresa,
        fechaConstitucion: createCompanyDto.fechaConstitucion 
          ? new Date(createCompanyDto.fechaConstitucion) 
          : null,
        activo: createCompanyDto.activo ?? true,
      },
      include: {
        puntosVenta: true,
      },
    });

    return {
      id: company.id,
      rut: company.rut,
      razonSocial: company.razonSocial,
      nombreComercial: company.nombreComercial,
      nombre: company.nombre,
      direccion: company.direccion,
      ciudad: company.ciudad,
      provincia: company.provincia,
      pais: company.pais,
      codigoPostal: company.codigoPostal,
      telefono: company.telefono,
      telefonoMovil: company.telefonoMovil,
      email: company.email,
      sitioWeb: company.sitioWeb,
      logo: company.logo,
      sector: company.sector,
      tipoEmpresa: company.tipoEmpresa,
      fechaConstitucion: company.fechaConstitucion,
      activo: company.activo,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
      puntosVenta: company.puntosVenta.map(pv => ({
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
          id: company.id,
          rut: company.rut,
          razonSocial: company.razonSocial,
          nombreComercial: company.nombreComercial,
          nombre: company.nombre,
          direccion: company.direccion,
          ciudad: company.ciudad,
          provincia: company.provincia,
          pais: company.pais,
          codigoPostal: company.codigoPostal,
          telefono: company.telefono,
          telefonoMovil: company.telefonoMovil,
          email: company.email,
          sitioWeb: company.sitioWeb,
          logo: company.logo,
          sector: company.sector,
          tipoEmpresa: company.tipoEmpresa,
          fechaConstitucion: company.fechaConstitucion,
          activo: company.activo,
          createdAt: company.createdAt,
          updatedAt: company.updatedAt,
          puntosVenta: [],
        },
      })),
    };
  }

  async findAll(): Promise<Company[]> {
    const companies = await this.prisma.empresa.findMany({
      include: {
        puntosVenta: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return companies.map(company => ({
      id: company.id,
      rut: company.rut,
      razonSocial: company.razonSocial,
      nombreComercial: company.nombreComercial,
      nombre: company.nombre,
      direccion: company.direccion,
      ciudad: company.ciudad,
      provincia: company.provincia,
      pais: company.pais,
      codigoPostal: company.codigoPostal,
      telefono: company.telefono,
      telefonoMovil: company.telefonoMovil,
      email: company.email,
      sitioWeb: company.sitioWeb,
      logo: company.logo,
      sector: company.sector,
      tipoEmpresa: company.tipoEmpresa,
      fechaConstitucion: company.fechaConstitucion,
      activo: company.activo,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
      puntosVenta: company.puntosVenta.map(pv => ({
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
          id: company.id,
          rut: company.rut,
          razonSocial: company.razonSocial,
          nombreComercial: company.nombreComercial,
          nombre: company.nombre,
          direccion: company.direccion,
          ciudad: company.ciudad,
          provincia: company.provincia,
          pais: company.pais,
          codigoPostal: company.codigoPostal,
          telefono: company.telefono,
          telefonoMovil: company.telefonoMovil,
          email: company.email,
          sitioWeb: company.sitioWeb,
          logo: company.logo,
          sector: company.sector,
          tipoEmpresa: company.tipoEmpresa,
          fechaConstitucion: company.fechaConstitucion,
          activo: company.activo,
          createdAt: company.createdAt,
          updatedAt: company.updatedAt,
          puntosVenta: [],
        },
      })),
    }));
  }

  async findById(id: string): Promise<Company | null> {
    const company = await this.prisma.empresa.findUnique({
      where: { id },
      include: {
        puntosVenta: true,
      },
    });

    if (!company) return null;

    return {
      id: company.id,
      rut: company.rut,
      razonSocial: company.razonSocial,
      nombreComercial: company.nombreComercial,
      nombre: company.nombre,
      direccion: company.direccion,
      ciudad: company.ciudad,
      provincia: company.provincia,
      pais: company.pais,
      codigoPostal: company.codigoPostal,
      telefono: company.telefono,
      telefonoMovil: company.telefonoMovil,
      email: company.email,
      sitioWeb: company.sitioWeb,
      logo: company.logo,
      sector: company.sector,
      tipoEmpresa: company.tipoEmpresa,
      fechaConstitucion: company.fechaConstitucion,
      activo: company.activo,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
      puntosVenta: company.puntosVenta.map(pv => ({
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
          id: company.id,
          rut: company.rut,
          razonSocial: company.razonSocial,
          nombreComercial: company.nombreComercial,
          nombre: company.nombre,
          direccion: company.direccion,
          ciudad: company.ciudad,
          provincia: company.provincia,
          pais: company.pais,
          codigoPostal: company.codigoPostal,
          telefono: company.telefono,
          telefonoMovil: company.telefonoMovil,
          email: company.email,
          sitioWeb: company.sitioWeb,
          logo: company.logo,
          sector: company.sector,
          tipoEmpresa: company.tipoEmpresa,
          fechaConstitucion: company.fechaConstitucion,
          activo: company.activo,
          createdAt: company.createdAt,
          updatedAt: company.updatedAt,
          puntosVenta: [],
        },
      })),
    };
  }

  async findByRut(rut: string): Promise<Company | null> {
    const company = await this.prisma.empresa.findUnique({
      where: { rut: rut },
      include: {
        puntosVenta: true,
      },
    });

    if (!company) return null;

    return {
      id: company.id,
      rut: company.rut,
      razonSocial: company.razonSocial,
      nombreComercial: company.nombreComercial,
      nombre: company.nombre,
      direccion: company.direccion,
      ciudad: company.ciudad,
      provincia: company.provincia,
      pais: company.pais,
      codigoPostal: company.codigoPostal,
      telefono: company.telefono,
      telefonoMovil: company.telefonoMovil,
      email: company.email,
      sitioWeb: company.sitioWeb,
      logo: company.logo,
      sector: company.sector,
      tipoEmpresa: company.tipoEmpresa,
      fechaConstitucion: company.fechaConstitucion,
      activo: company.activo,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
      puntosVenta: company.puntosVenta.map(pv => ({
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
          id: company.id,
          rut: company.rut,
          razonSocial: company.razonSocial,
          nombreComercial: company.nombreComercial,
          nombre: company.nombre,
          direccion: company.direccion,
          ciudad: company.ciudad,
          provincia: company.provincia,
          pais: company.pais,
          codigoPostal: company.codigoPostal,
          telefono: company.telefono,
          telefonoMovil: company.telefonoMovil,
          email: company.email,
          sitioWeb: company.sitioWeb,
          logo: company.logo,
          sector: company.sector,
          tipoEmpresa: company.tipoEmpresa,
          fechaConstitucion: company.fechaConstitucion,
          activo: company.activo,
          createdAt: company.createdAt,
          updatedAt: company.updatedAt,
          puntosVenta: [],
        },
      })),
    };
  }

  async update(updateCompanyDto: UpdateCompanyDto): Promise<Company> {
    const { id, ...updateData } = updateCompanyDto;
    
    const existingCompany = await this.findById(id);
    
    if (!existingCompany) {
      throw new NotFoundException('Empresa no encontrada');
    }

    // Si se está actualizando el RUT, verificar que no exista
    if (updateData.rut && updateData.rut !== existingCompany.rut) {
      const rutExists = await this.prisma.empresa.findUnique({
        where: { rut: updateData.rut },
      });

      if (rutExists) {
        throw new ConflictException('El RUT ya está en uso');
      }
    }

    // Si se está actualizando el email, verificar que no exista
    if (updateData.email && updateData.email !== existingCompany.email) {
      const emailExists = await this.prisma.empresa.findUnique({
        where: { email: updateData.email },
      });

      if (emailExists) {
        throw new ConflictException('El email ya está en uso');
      }
    }

    const company = await this.prisma.empresa.update({
      where: { id },
      data: {
        ...(updateData.rut && { rut: updateData.rut }),
        ...(updateData.razonSocial && { razonSocial: updateData.razonSocial }),
        ...(updateData.nombreComercial && { nombreComercial: updateData.nombreComercial }),
        ...(updateData.nombre && { nombre: updateData.nombre }),
        ...(updateData.direccion && { direccion: updateData.direccion }),
        ...(updateData.ciudad && { ciudad: updateData.ciudad }),
        ...(updateData.provincia && { provincia: updateData.provincia }),
        ...(updateData.pais && { pais: updateData.pais }),
        ...(updateData.codigoPostal && { codigoPostal: updateData.codigoPostal }),
        ...(updateData.telefono && { telefono: updateData.telefono }),
        ...(updateData.telefonoMovil && { telefonoMovil: updateData.telefonoMovil }),
        ...(updateData.email && { email: updateData.email }),
        ...(updateData.sitioWeb && { sitioWeb: updateData.sitioWeb }),
        ...(updateData.logo && { logo: updateData.logo }),
        ...(updateData.sector && { sector: updateData.sector }),
        ...(updateData.tipoEmpresa && { tipoEmpresa: updateData.tipoEmpresa }),
        ...(updateData.fechaConstitucion && { fechaConstitucion: new Date(updateData.fechaConstitucion) }),
        ...(updateData.activo !== undefined && { activo: updateData.activo }),
      },
      include: {
        puntosVenta: true,
      },
    });

    return {
      id: company.id,
      rut: company.rut,
      razonSocial: company.razonSocial,
      nombreComercial: company.nombreComercial,
      nombre: company.nombre,
      direccion: company.direccion,
      ciudad: company.ciudad,
      provincia: company.provincia,
      pais: company.pais,
      codigoPostal: company.codigoPostal,
      telefono: company.telefono,
      telefonoMovil: company.telefonoMovil,
      email: company.email,
      sitioWeb: company.sitioWeb,
      logo: company.logo,
      sector: company.sector,
      tipoEmpresa: company.tipoEmpresa,
      fechaConstitucion: company.fechaConstitucion,
      activo: company.activo,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
      puntosVenta: company.puntosVenta.map(pv => ({
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
          id: company.id,
          rut: company.rut,
          razonSocial: company.razonSocial,
          nombreComercial: company.nombreComercial,
          nombre: company.nombre,
          direccion: company.direccion,
          ciudad: company.ciudad,
          provincia: company.provincia,
          pais: company.pais,
          codigoPostal: company.codigoPostal,
          telefono: company.telefono,
          telefonoMovil: company.telefonoMovil,
          email: company.email,
          sitioWeb: company.sitioWeb,
          logo: company.logo,
          sector: company.sector,
          tipoEmpresa: company.tipoEmpresa,
          fechaConstitucion: company.fechaConstitucion,
          activo: company.activo,
          createdAt: company.createdAt,
          updatedAt: company.updatedAt,
          puntosVenta: [],
        },
      })),
    };
  }

  async remove(id: string): Promise<Company> {
    const existingCompany = await this.findById(id);
    
    if (!existingCompany) {
      throw new NotFoundException('Empresa no encontrada');
    }

    // Verificar si tiene puntos de venta asociados
    const puntosVenta = await this.prisma.puntoVenta.count({
      where: { empresaId: id },
    });

    if (puntosVenta > 0) {
      throw new ConflictException('No se puede eliminar la empresa porque tiene puntos de venta asociados');
    }

    const company = await this.prisma.empresa.delete({
      where: { id },
      include: {
        puntosVenta: true,
      },
    });

    return {
      id: company.id,
      rut: company.rut,
      razonSocial: company.razonSocial,
      nombreComercial: company.nombreComercial,
      nombre: company.nombre,
      direccion: company.direccion,
      ciudad: company.ciudad,
      provincia: company.provincia,
      pais: company.pais,
      codigoPostal: company.codigoPostal,
      telefono: company.telefono,
      telefonoMovil: company.telefonoMovil,
      email: company.email,
      sitioWeb: company.sitioWeb,
      logo: company.logo,
      sector: company.sector,
      tipoEmpresa: company.tipoEmpresa,
      fechaConstitucion: company.fechaConstitucion,
      activo: company.activo,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
      puntosVenta: company.puntosVenta.map(pv => ({
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
          id: company.id,
          rut: company.rut,
          razonSocial: company.razonSocial,
          nombreComercial: company.nombreComercial,
          nombre: company.nombre,
          direccion: company.direccion,
          ciudad: company.ciudad,
          provincia: company.provincia,
          pais: company.pais,
          codigoPostal: company.codigoPostal,
          telefono: company.telefono,
          telefonoMovil: company.telefonoMovil,
          email: company.email,
          sitioWeb: company.sitioWeb,
          logo: company.logo,
          sector: company.sector,
          tipoEmpresa: company.tipoEmpresa,
          fechaConstitucion: company.fechaConstitucion,
          activo: company.activo,
          createdAt: company.createdAt,
          updatedAt: company.updatedAt,
          puntosVenta: [],
        },
      })),
    };
  }

  async toggleStatus(id: string): Promise<Company> {
    const existingCompany = await this.findById(id);
    
    if (!existingCompany) {
      throw new NotFoundException('Empresa no encontrada');
    }

    const company = await this.prisma.empresa.update({
      where: { id },
      data: {
        activo: !existingCompany.activo,
      },
      include: {
        puntosVenta: true,
      },
    });

    return {
      id: company.id,
      rut: company.rut,
      razonSocial: company.razonSocial,
      nombreComercial: company.nombreComercial,
      nombre: company.nombre,
      direccion: company.direccion,
      ciudad: company.ciudad,
      provincia: company.provincia,
      pais: company.pais,
      codigoPostal: company.codigoPostal,
      telefono: company.telefono,
      telefonoMovil: company.telefonoMovil,
      email: company.email,
      sitioWeb: company.sitioWeb,
      logo: company.logo,
      sector: company.sector,
      tipoEmpresa: company.tipoEmpresa,
      fechaConstitucion: company.fechaConstitucion,
      activo: company.activo,
      createdAt: company.createdAt,
      updatedAt: company.updatedAt,
      puntosVenta: company.puntosVenta.map(pv => ({
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
          id: company.id,
          rut: company.rut,
          razonSocial: company.razonSocial,
          nombreComercial: company.nombreComercial,
          nombre: company.nombre,
          direccion: company.direccion,
          ciudad: company.ciudad,
          provincia: company.provincia,
          pais: company.pais,
          codigoPostal: company.codigoPostal,
          telefono: company.telefono,
          telefonoMovil: company.telefonoMovil,
          email: company.email,
          sitioWeb: company.sitioWeb,
          logo: company.logo,
          sector: company.sector,
          tipoEmpresa: company.tipoEmpresa,
          fechaConstitucion: company.fechaConstitucion,
          activo: company.activo,
          createdAt: company.createdAt,
          updatedAt: company.updatedAt,
          puntosVenta: [],
        },
      })),
    };
  }

  // ==========================================
  // MÉTODOS PARA CONFIGURACIÓN DE EMPRESA
  // ==========================================

  async createConfiguracionEmpresa(
    createConfiguracionDto: CreateConfiguracionEmpresaDto,
  ): Promise<ConfiguracionEmpresa> {
    // Verificar que la empresa existe
    const empresa = await this.prisma.empresa.findUnique({
      where: { id: createConfiguracionDto.empresaId },
    });

    if (!empresa) {
      throw new NotFoundException('Empresa no encontrada');
    }

    // Verificar si ya existe una configuración para esta empresa
    const configuracionExistente = await this.prisma.configuracionEmpresa.findUnique({
      where: { empresaId: createConfiguracionDto.empresaId },
    });

    if (configuracionExistente) {
      throw new ConflictException('Ya existe una configuración para esta empresa');
    }

    const configuracion = await this.prisma.configuracionEmpresa.create({
      data: {
        empresaId: createConfiguracionDto.empresaId,
        seleccionPorProducto: createConfiguracionDto.seleccionPorProducto,
      },
    });

    return {
      id: configuracion.id,
      empresaId: configuracion.empresaId,
      seleccionPorProducto: configuracion.seleccionPorProducto,
      createdAt: configuracion.createdAt,
      updatedAt: configuracion.updatedAt,
    };
  }

  async getConfiguracionEmpresa(empresaId: string): Promise<ConfiguracionEmpresa | null> {
    const configuracion = await this.prisma.configuracionEmpresa.findUnique({
      where: { empresaId },
    });

    if (!configuracion) {
      return null;
    }

    return {
      id: configuracion.id,
      empresaId: configuracion.empresaId,
      seleccionPorProducto: configuracion.seleccionPorProducto,
      createdAt: configuracion.createdAt,
      updatedAt: configuracion.updatedAt,
    };
  }

  async updateConfiguracionEmpresa(
    updateConfiguracionDto: UpdateConfiguracionEmpresaDto,
  ): Promise<ConfiguracionEmpresa> {
    // Verificar que la empresa existe
    const empresa = await this.prisma.empresa.findUnique({
      where: { id: updateConfiguracionDto.empresaId },
    });

    if (!empresa) {
      throw new NotFoundException('Empresa no encontrada');
    }

    // Verificar si existe la configuración
    const configuracionExistente = await this.prisma.configuracionEmpresa.findUnique({
      where: { empresaId: updateConfiguracionDto.empresaId },
    });

    if (!configuracionExistente) {
      throw new NotFoundException('Configuración no encontrada para esta empresa');
    }

    const configuracion = await this.prisma.configuracionEmpresa.update({
      where: { empresaId: updateConfiguracionDto.empresaId },
      data: {
        seleccionPorProducto: updateConfiguracionDto.seleccionPorProducto,
      },
    });

    return {
      id: configuracion.id,
      empresaId: configuracion.empresaId,
      seleccionPorProducto: configuracion.seleccionPorProducto,
      createdAt: configuracion.createdAt,
      updatedAt: configuracion.updatedAt,
    };
  }

  async createOrUpdateConfiguracionEmpresa(
    createConfiguracionDto: CreateConfiguracionEmpresaDto,
  ): Promise<ConfiguracionEmpresa> {
    // Verificar que la empresa existe
    const empresa = await this.prisma.empresa.findUnique({
      where: { id: createConfiguracionDto.empresaId },
    });

    if (!empresa) {
      throw new NotFoundException('Empresa no encontrada');
    }

    // Intentar actualizar, si no existe, crear
    const configuracion = await this.prisma.configuracionEmpresa.upsert({
      where: { empresaId: createConfiguracionDto.empresaId },
      update: {
        seleccionPorProducto: createConfiguracionDto.seleccionPorProducto,
      },
      create: {
        empresaId: createConfiguracionDto.empresaId,
        seleccionPorProducto: createConfiguracionDto.seleccionPorProducto,
      },
    });

    return {
      id: configuracion.id,
      empresaId: configuracion.empresaId,
      seleccionPorProducto: configuracion.seleccionPorProducto,
      createdAt: configuracion.createdAt,
      updatedAt: configuracion.updatedAt,
    };
  }
} 