import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed completo de la base de datos...');

  // 1. CREAR EMPRESAS
  console.log('🏢 Creando empresas...');

  const empresaPrincipal = await prisma.empresa.upsert({
    where: { rut: '9013097068' },
    update: {},
    create: {
      rut: '9013097068',
      razonSocial: 'Estación de Servicios Principal Gasol',
      nombre: 'Estación Principal',
      nombreComercial: 'EsPrincipal',
      direccion: 'Av. Principal 123',
      ciudad: 'Lima',
      provincia: 'Lima',
      pais: 'Perú',
      codigoPostal: '15001',
      telefono: '01-234-5678',
      telefonoMovil: '987-654-321',
      email: 'info@estacionprincipal.com',
      sitioWeb: 'https://www.estacionprincipal.com',
      sector: 'Combustibles y Lubricantes',
      tipoEmpresa: 'S.A.C.',
      fechaConstitucion: new Date('2020-01-01'),
      activo: true,
    },
  });

  // 2. CREAR PUNTOS DE VENTA
  console.log('🏪 Creando puntos de venta...');

  const puntoVentaGasol1 = await prisma.puntoVenta.upsert({
    where: { codigo: '90130970681' },
    update: {},
    create: {
      codigo: '90130970681',
      nombre: 'Gasol 1',
      descripcion: 'Gasol 1',
      direccion: 'FINCA LA ESTRELLA VEREDA LUZ CHIQUITA',
      ciudad: 'La Gloria',
      provincia: 'Cesar',
      pais: 'Perú',
      codigoPostal: '203041',
      telefono: '3107646380',
      telefonoMovil: '3107646380',
      email: 'ventas@estacionprincipal.com',
      horarioApertura: '',
      horarioCierre: '',
      diasAtencion: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'],
      coordenadasGPS: '8.6182682, -73.0695801',
      tipoEstacion: 'urbana',
      serviciosAdicionales: ['tienda'],
      capacidadMaxima: 10000,
      fechaApertura: new Date('2023-01-15'),
      activo: true,
      empresaId: empresaPrincipal.id,
    },
  });

  const puntoVentaGasol2 = await prisma.puntoVenta.upsert({
    where: { codigo: '90130970683' },
    update: {},
    create: {
      codigo: '90130970683',
      nombre: 'Gasol 2',
      descripcion: 'Gasol 2',
      direccion: 'FINCA LA ESTRELLA VEREDA LUZ CHIQUITA',
      ciudad: 'La Gloria',
      provincia: 'Cesar',
      pais: 'Perú',
      codigoPostal: '203041',
      telefono: '3107646380',
      telefonoMovil: '3107646380',
      email: 'ventas@estacionprincipal.com',
      horarioApertura: '',
      horarioCierre: '',
      diasAtencion: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'],
      coordenadasGPS: '8.6182682, -73.0695801',
      tipoEstacion: 'urbana',
      serviciosAdicionales: ['tienda'],
      capacidadMaxima: 10000,
      fechaApertura: new Date('2023-01-15'),
      activo: true,
      empresaId: empresaPrincipal.id,
    },
  });

  console.log('✅ Puntos de venta creados:', puntoVentaGasol1.nombre, puntoVentaGasol2.nombre);

  // 3. CREAR ROLES
  console.log('👔 Creando roles...');

  const adminRole = await prisma.rol.upsert({
    where: { nombre: 'admin' },
    update: {},
    create: {
      nombre: 'admin',
      descripcion: 'Administrador con acceso completo al sistema',
      permisos: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'MANAGE_USERS', 'MANAGE_INVENTORY', 'VIEW_REPORTS'],
      activo: true,
    },
  });

  const managerRole = await prisma.rol.upsert({
    where: { nombre: 'manager' },
    update: {},
    create: {
      nombre: 'manager',
      descripcion: 'Gerente con acceso a operaciones y reportes',
      permisos: ['CREATE', 'READ', 'UPDATE', 'MANAGE_INVENTORY', 'VIEW_REPORTS'],
      activo: true,
    },
  });

  const employeeRole = await prisma.rol.upsert({
    where: { nombre: 'employee' },
    update: {},
    create: {
      nombre: 'employee',
      descripcion: 'Empleado con acceso básico a ventas',
      permisos: ['CREATE', 'READ', 'UPDATE'],
      activo: true,
    },
  });

  const supervisorRole = await prisma.rol.upsert({
    where: { nombre: 'supervisor' },
    update: {},
    create: {
      nombre: 'supervisor',
      descripcion: 'Supervisor con acceso a múltiples puntos de venta',
      permisos: ['CREATE', 'READ', 'UPDATE', 'VIEW_REPORTS'],
      activo: true,
    },
  });

  console.log('✅ Roles creados');

  // 4. CREAR USUARIOS CON DIFERENTES RELACIONES
  console.log('👤 Creando usuarios con diferentes relaciones...');

  const hashedPassword = await bcrypt.hash('admin123', 12);
  const managerHashedPassword = await bcrypt.hash('manager123', 12);
  const employeeHashedPassword = await bcrypt.hash('empleado123', 12);

  // Admin con acceso a todos los puntos de venta de la empresa principal
  const adminUser = await prisma.usuario.upsert({
    where: { email: 'admin@estacion.com' },
    update: {},
    create: {
      tipoDeDocumento: 'CC',
      numeroDeIdentificacion: 1000000000,
      email: 'admin@estacion.com',
      username: 'admin',
      password: hashedPassword,
      nombre: 'Administrador',
      apellido: 'Sistema',
      telefono: '123456789',
      emailVerified: true,
      rolId: adminRole.id,
      empresaId: empresaPrincipal.id,
      puntosVenta: {
        connect: [
          { id: puntoVentaGasol1.id },
          { id: puntoVentaGasol2.id },
        ]
      },
    },
  });

  // Gerente con acceso a 2 puntos de venta
  const gerenteUser = await prisma.usuario.upsert({
    where: { email: 'gerente@estacion.com' },
    update: {},
    create: {
      tipoDeDocumento: 'CC',
      numeroDeIdentificacion: 1000000001,
      email: 'gerente@estacion.com',
      username: 'gerente',
      password: managerHashedPassword,
      nombre: 'Carlos',
      apellido: 'Rodríguez',
      telefono: '987654321',
      emailVerified: true,
      rolId: managerRole.id,
      empresaId: empresaPrincipal.id,
      puntosVenta: {
        connect: [
          { id: puntoVentaGasol1.id },
          { id: puntoVentaGasol2.id }
        ]
      },
    },
  });

  // Supervisor con acceso a puntos de venta norte y sur
  const supervisorUser = await prisma.usuario.upsert({
    where: { email: 'supervisor@estacion.com' },
    update: {},
    create: {
      tipoDeDocumento: 'CC',
      numeroDeIdentificacion: 1000000002,
      email: 'supervisor@estacion.com',
      username: 'supervisor',
      password: hashedPassword,
      nombre: 'María',
      apellido: 'González',
      telefono: '976543210',
      emailVerified: true,
      rolId: supervisorRole.id,
      empresaId: empresaPrincipal.id,
      puntosVenta: {
        connect: [
          { id: puntoVentaGasol1.id },
          { id: puntoVentaGasol2.id }
        ]
      },
    },
  });

  // Empleado
  const anayerlyGarcia = await prisma.usuario.upsert({
    where: { email: 'anayerly.garcia@estacion.com' },
    update: {},
    create: {
      email: 'anayerly.garcia@estacion.com',
      username: 'anayerlygarcia',
      password: employeeHashedPassword,
      nombre: 'Anayerly',
      apellido: 'Garcia Garcia',
      tipoDeDocumento: 'CC',
      numeroDeIdentificacion: 1065877110,
      telefono: '954321098',
      emailVerified: true,
      rolId: employeeRole.id,
      empresaId: empresaPrincipal.id,
      puntosVenta: {
        connect: [{ id: puntoVentaGasol1.id }, { id: puntoVentaGasol2.id }]
      },
    },
  });

  const luisChogo = await prisma.usuario.upsert({
    where: { email: 'luis.chogo@estacion.com' },
    update: {},
    create: {
      email: 'luis.chogo@estacion.com',
      username: 'luischogo',
      password: employeeHashedPassword,
      nombre: 'Luis armenio',
      apellido: 'Chogo Quiroz',
      tipoDeDocumento: 'CC',
      numeroDeIdentificacion: 1007676909,
      telefono: '954321098',
      emailVerified: true,
      rolId: employeeRole.id,
      empresaId: empresaPrincipal.id,
      puntosVenta: {
        connect: [{ id: puntoVentaGasol1.id }, { id: puntoVentaGasol2.id }]
      },
    },
  });

  const cristianSequea = await prisma.usuario.upsert({
    where: { email: 'cristian.sequea@estacion.com' },
    update: {},
    create: {
      email: 'cristian.sequea@estacion.com',
      username: 'cristiansequea',
      password: employeeHashedPassword,
      nombre: 'Cristian Gabriel',
      apellido: 'Sequea Pacheco',
      tipoDeDocumento: 'CC',
      numeroDeIdentificacion: 1007582721,
      telefono: '954321098',
      emailVerified: true,
      rolId: employeeRole.id,
      empresaId: empresaPrincipal.id,
      puntosVenta: {
        connect: [{ id: puntoVentaGasol1.id }, { id: puntoVentaGasol2.id }]
      },
    },
  });

  const andresRuidiaz = await prisma.usuario.upsert({
    where: { email: 'andres.ruidiaz@estacion.com' },
    update: {},
    create: {
      email: 'andres.ruidiaz@estacion.com',
      username: 'andresruidiaz',
      password: employeeHashedPassword,
      nombre: 'Andres',
      apellido: 'Ruidiaz Navarro',
      tipoDeDocumento: 'CC',
      numeroDeIdentificacion: 1006686469,
      telefono: '954321098',
      emailVerified: true,
      rolId: employeeRole.id,
      empresaId: empresaPrincipal.id,
      puntosVenta: {
        connect: [{ id: puntoVentaGasol1.id }, { id: puntoVentaGasol2.id }]
      },
    },
  });

  const juanCervantes = await prisma.usuario.upsert({
    where: { email: 'juan.cervantes@estacion.com' },
    update: {},
    create: {
      email: 'juan.cervantes@estacion.com',
      username: 'juancervantes',
      password: employeeHashedPassword,
      nombre: 'Juan Carlos',
      apellido: 'Cervantes Hernandez',
      tipoDeDocumento: 'CC',
      numeroDeIdentificacion: 1063482673,
      telefono: '954321098',
      emailVerified: true,
      rolId: employeeRole.id,
      empresaId: empresaPrincipal.id,
      puntosVenta: {
        connect: [{ id: puntoVentaGasol1.id }, { id: puntoVentaGasol2.id }]
      },
    },
  });


  console.log('✅ Usuarios creados con diferentes relaciones empresa-puntos de venta');

  // 5. CREAR CATEGORÍAS
  console.log('📦 Creando categorías de productos...');

  const combustibleCategory = await prisma.categoria.upsert({
    where: { nombre: 'Combustibles' },
    update: {},
    create: {
      nombre: 'Combustibles',
      descripcion: 'Productos de combustible para vehículos',
    },
  });

  const lubricantesCategory = await prisma.categoria.upsert({
    where: { nombre: 'Lubricantes' },
    update: {},
    create: {
      nombre: 'Lubricantes',
      descripcion: 'Aceites y lubricantes para vehículos',
    },
  });

  const tiendaCategory = await prisma.categoria.upsert({
    where: { nombre: 'Tienda' },
    update: {},
    create: {
      nombre: 'Tienda',
      descripcion: 'Productos de tienda y conveniencia',
    },
  });

  const aditivosCategory = await prisma.categoria.upsert({
    where: { nombre: 'Aditivos' },
    update: {},
    create: {
      nombre: 'Aditivos',
      descripcion: 'Aditivos para combustibles y mantenimiento vehicular',
    },
  });

  console.log('✅ Categorías creadas');

  // 6. CREAR PRODUCTOS
  console.log('🛢️ Creando productos...');

  const dieselGasol1 = await prisma.producto.upsert({
    where: { codigo: 'DIESEL-Gasol-1' },
    update: {},
    create: {
      codigo: 'DIESEL-Gasol-1',
      nombre: 'Diesel B5 Gasol 1',
      descripcion: 'Diesel con 5% de biodiesel',
      unidadMedida: 'Galones',
      precioCompra: 9512.39, // Precio de compra en COP
      precioVenta: 10020.00,  // Precio de venta en COP
      moneda: 'COP',
      stockMinimo: 800,
      stockActual: 4000,
      tipoProducto: 'Combustible',
      esCombustible: true,
      categoriaId: combustibleCategory.id,
    },
  });

  const gasolina90Gasol1 = await prisma.producto.upsert({
    where: { codigo: 'GASOL-90-Gasol-1' },
    update: {},
    create: {
      codigo: 'GASOL-90-Gasol-1',
      nombre: 'Gasolina 90 Octanos Gasol 1',
      descripcion: 'Gasolina sin plomo 90 octanos',
      unidadMedida: 'Galones',
      precioCompra: 12595.85, // Precio de compra en COP
      precioVenta: 13990.00,  // Precio de venta en COP
      moneda: 'COP',
      stockMinimo: 1200,
      stockActual: 6000,
      tipoProducto: 'Combustible',
      esCombustible: true,
      categoriaId: combustibleCategory.id,
    },
  });

  const dieselGasol2 = await prisma.producto.upsert({
    where: { codigo: 'DIESEL-Gasol-2' },
    update: {},
    create: {
      codigo: 'DIESEL-Gasol-2',
      nombre: 'Diesel B5 Gasol 2',
      descripcion: 'Diesel con 5% de biodiesel',
      unidadMedida: 'Galones',
      precioCompra: 9512.39, // Precio de compra en COP
      precioVenta: 10020.00,  // Precio de venta en COP
      moneda: 'COP',
      stockMinimo: 800,
      stockActual: 4000,
      tipoProducto: 'Combustible',
      esCombustible: true,
      categoriaId: combustibleCategory.id,
    },
  });

  const gasolina90Gasol2 = await prisma.producto.upsert({
    where: { codigo: 'GASOL-90-Gasol-2' },
    update: {},
    create: {
      codigo: 'GASOL-90-Gasol-2',
      nombre: 'Gasolina 90 Octanos Gasol 2',
      descripcion: 'Gasolina sin plomo 90 octanos',
      unidadMedida: 'Galones',
      precioCompra: 12595.85, // Precio de compra en COP
      precioVenta: 13990.00,  // Precio de venta en COP
      moneda: 'COP',
      stockMinimo: 1200,
      stockActual: 6000,
      tipoProducto: 'Combustible',
      esCombustible: true,
      categoriaId: combustibleCategory.id,
    },
  });

  const hidroblue = await prisma.producto.upsert({
    where: { codigo: 'HIDROBLUE-Gasol-1' },
    update: {},
    create: {
      codigo: 'HIDROBLUE-Gasol-1',
      nombre: 'Hidroblue (AdBlue)',
      descripcion: 'Líquido reductor de emisiones para motores diesel',
      unidadMedida: 'Litros',
      precioCompra: 2950,  // Precio de compra en COP
      precioVenta: 3200,   // Precio de venta en COP
      moneda: 'COP',
      stockMinimo: 50,
      stockActual: 200,
      tipoProducto: 'Combustible',
      esCombustible: false,
      categoriaId: combustibleCategory.id,
    },
  });

  // PRODUCTOS DE TIENDA
  console.log('🏪 Creando productos de tienda...');

  //BEBIDAS GASSOL 1
  const aguaSaborisadaGas600_G1 = await prisma.producto.upsert({
    where: { codigo: 'AGUASABORISADA-600' },
    update: {},
    create: {
      codigo: 'AGUASABORISADA-600',
      nombre: 'Agua Brisa Saborisada Con Gas (600ML)',
      descripcion: 'Agua gasificada con saborisante',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 3000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 0,
      tipoProducto: 'Bebida',
      codigoPlu: 21201,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const aguaCristal300_G1 = await prisma.producto.upsert({
    where: { codigo: 'AGUACRISTAL-300' },
    update: {},
    create: {
      codigo: 'AGUACRISTAL-300',
      nombre: 'Agua Cristal (300ML) Pet',
      descripcion: 'Agua natural en botella',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 1000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 0,
      tipoProducto: 'Bebida',
      codigoPlu: 21236,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const aguaCristal600_G1 = await prisma.producto.upsert({
    where: { codigo: 'AGUACRISTAL-600' },
    update: {},
    create: {
      codigo: 'AGUACRISTAL-600',
      nombre: 'Agua Cristal (600ML) Pet',
      descripcion: 'Agua natural en botella',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 2000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 16,
      tipoProducto: 'Bebida',
      codigoPlu: 21238,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const aguaCristal1Litro_G1 = await prisma.producto.upsert({
    where: { codigo: 'AGUACRISTAL-1000' },
    update: {},
    create: {
      codigo: 'AGUACRISTAL-1000',
      nombre: 'Agua Cristal (1Litro) Pet',
      descripcion: 'Agua natural en botella',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 3000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 6,
      tipoProducto: 'Bebida',
      codigoPlu: 22454,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const aguaCristalAloe330_G1 = await prisma.producto.upsert({
    where: { codigo: 'AGUACRISTALALOE-330' },
    update: {},
    create: {
      codigo: 'AGUACRISTALALOE-330',
      nombre: 'Agua Cristal Aloe (330ML) Pet',
      descripcion: 'Agua natural con Aloe vera',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 2500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 0,
      tipoProducto: 'Bebida',
      codigoPlu: 21239,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const aguaCristalGas250_G1 = await prisma.producto.upsert({
    where: { codigo: 'AGUACRISTALGAS-250' },
    update: {},
    create: {
      codigo: 'AGUACRISTALGAS-330',
      nombre: 'Agua Cristal Con Gas (250ML) Pet',
      descripcion: 'Agua natural gasificada',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 1000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 4,
      tipoProducto: 'Bebida',
      codigoPlu: 21237,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const aguaSaborisadaGas280_G1 = await prisma.producto.upsert({
    where: { codigo: 'AGUASABORISADA-280' },
    update: {},
    create: {
      codigo: 'AGUASABORISADA-280',
      nombre: 'Agua Saborizada Brisa Con Gas (280ML)',
      descripcion: 'Agua gasificada con saborisante',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 2000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 0,
      tipoProducto: 'Bebida',
      codigoPlu: 21200,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const avena250_G1 = await prisma.producto.upsert({
    where: { codigo: 'AVENA-250' },
    update: {},
    create: {
      codigo: 'AVENA-250',
      nombre: 'Avena Alpina (250GR)',
      descripcion: 'Bebida lactea con leche y avena',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 4000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 7,
      tipoProducto: 'Bebida',
      codigoPlu: 23251,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const bonyurt170_G1 = await prisma.producto.upsert({
    where: { codigo: 'BONYURT-170' },
    update: {},
    create: {
      codigo: 'BONYURT-170',
      nombre: 'Bonyurt Alpina + Zucaritas (170GR)',
      descripcion: 'Bebida lactea con leche y avena',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 5500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 2,
      tipoProducto: 'Bebida',
      codigoPlu: 23264,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const bretañaPostobon300_G1 = await prisma.producto.upsert({
    where: { codigo: 'BRETAÑA-300' },
    update: {},
    create: {
      codigo: 'BRETAÑA-300',
      nombre: 'Bretaña Postobon Vidrio (300ML)',
      descripcion: 'Bebida carbonatada de tipo soda',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 3000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 11,
      tipoProducto: 'Bebida',
      codigoPlu: 21246,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const canadaDry300_G1 = await prisma.producto.upsert({
    where: { codigo: 'CANADADRY-300' },
    update: {},
    create: {
      codigo: 'CANADADRY-300',
      nombre: 'Canada Dry (300ML)',
      descripcion: 'Bebida gaseosa con sabor a jengibre y dulce',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 3000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 12,
      tipoProducto: 'Bebida',
      codigoPlu: 21247,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const chocorramo65gr_G1 = await prisma.producto.upsert({
    where: { codigo: 'CHOCORRAMO-65' },
    update: {},
    create: {
      codigo: 'CHOCORRAMO-65',
      nombre: 'Chocorramo (65GR)',
      descripcion: 'Ponqué rectangular tradicional cubierto de chocolate',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 3500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 2,
      tipoProducto: 'Bebida',
      codigoPlu: 23267,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const chocoramoFrutosRojos40_G1 = await prisma.producto.upsert({
    where: { codigo: 'CHOCORAMO-FRUTOS-ROJOS-40' },
    update: {},
    create: {
      codigo: 'CHOCORAMO-FRUTOS-ROJOS-40',
      nombre: 'Chocorramo Barrita Frutos Rojos (40GR)',
      descripcion: 'Barra de chocolate con frutos rojos',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 2700,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 0,
      tipoProducto: 'Bebida',
      codigoPlu: 26797,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const chocorramoBrownieArequipe65_G1 = await prisma.producto.upsert({
    where: { codigo: 'CHOCORRAMO-BROWNIE-AREQUIPE-65' },
    update: {},
    create: {
      codigo: 'CHOCORRAMO-BROWNIE-AREQUIPE-65',
      nombre: 'Chocorramo Brownie Arequipe (65G)',
      descripcion: 'Brownie de chocolate con relleno de arequipe',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 3800,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 0,
      tipoProducto: 'Bebida',
      codigoPlu: 26798,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const gansitoBarrita_G1 = await prisma.producto.upsert({
    where: { codigo: 'GANSITO-BARRITA' },
    update: {},
    create: {
      codigo: 'GANSITO-BARRITA',
      nombre: 'Gansito Barrita',
      descripcion: 'Barra de pastel con relleno dulce',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 2500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 0,
      tipoProducto: 'Bebida',
      codigoPlu: 26713,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: tiendaCategory.id,
    },
  });



  //COCA COLA
  const cocaCola3000_G1 = await prisma.producto.upsert({
    where: { codigo: 'COCACOLA-3000' },
    update: {},
    create: {
      codigo: 'COCACOLA-3000',
      nombre: 'Coca Cola (3 Litros) Pet',
      descripcion: 'Bebida Coca Cola original presentación 3000ml',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 14000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 2,
      tipoProducto: 'Bebida',
      codigoPlu: 23214,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const cocaCola2500_G1 = await prisma.producto.upsert({
    where: { codigo: 'COCACOLA-2500' },
    update: {},
    create: {
      codigo: 'COCACOLA-2500',
      nombre: 'Coca Cola (2.5 Litros) Pet',
      descripcion: 'Bebida Coca Cola original presentación 2500ml',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 8000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 0,
      tipoProducto: 'Bebida',
      codigoPlu: 21199,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const cocaCola1500_G1 = await prisma.producto.upsert({
    where: { codigo: 'COCACOLA-1500' },
    update: {},
    create: {
      codigo: 'COCACOLA-1500',
      nombre: 'Coca Cola Sabor Original (1.5 Litros) Pet',
      descripcion: 'Bebida Coca Cola original presentación 1500ml',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 8500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 0,
      tipoProducto: 'Bebida',
      codigoPlu: 21198,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const cocaCola400_G1 = await prisma.producto.upsert({
    where: { codigo: 'COCACOLA-400' },
    update: {},
    create: {
      codigo: 'COCACOLA-400',
      nombre: 'Coca Cola Sabor Original (400ML) Pet',
      descripcion: 'Bebida Coca Cola original presentación 400ml',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 3500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 0,
      tipoProducto: 'Bebida',
      codigoPlu: 21196,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: tiendaCategory.id,
    },
  });


  const cocaColaZero_G1 = await prisma.producto.upsert({
    where: { codigo: 'COCAZERO-400' },
    update: {},
    create: {
      codigo: 'COCAZERO-400',
      nombre: 'Coca Cola Zero (400ML) Pet',
      descripcion: 'Bebida gaseosa Coca Cola Zero presentación 400ml',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 4000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 0,
      tipoProducto: 'Bebida',
      codigoPlu: 21197,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const coca225Litros_G1 = await prisma.producto.upsert({
    where: { codigo: 'COCA-225-LITROS' },
    update: {},
    create: {
      codigo: 'COCA-225-LITROS',
      nombre: 'Coca cola (2.25 Litros) Pet',
      descripcion: 'Bebida gaseosa refrescante',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 10000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 0,
      tipoProducto: 'Bebida',
      codigoPlu: 21199,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const coca100Litro_G1 = await prisma.producto.upsert({
    where: { codigo: 'COCA-100-LITRO' },
    update: {},
    create: {
      codigo: 'COCA-100-LITRO',
      nombre: 'COCA COLA SABOR ORIGINAL (100 LITRO) PET',
      descripcion: 'Bebida gaseosa refrescante',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 6000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 0,
      tipoProducto: 'Bebida',
      codigoPlu: 26516,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const coca250ml_G1 = await prisma.producto.upsert({
    where: { codigo: 'COCA-250-ML' },
    update: {},
    create: {
      codigo: 'COCA-250-ML',
      nombre: 'Coca Cola Sabor Original (250 ML)',
      descripcion: 'Bebida gaseosa refrescante',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 2500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 0,
      tipoProducto: 'Bebida',
      codigoPlu: 25990,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const coca330mlLata_G1 = await prisma.producto.upsert({
    where: { codigo: 'COCA-330-ML-LATA' },
    update: {},
    create: {
      codigo: 'COCA-330-ML-LATA',
      nombre: 'Coca Cola Sabor Original (330 ML) Lata',
      descripcion: 'Bebida gaseosa refrescante',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 4500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 0,
      tipoProducto: 'Bebida',
      codigoPlu: 25989,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: tiendaCategory.id,
    },
  });

  //POSTOBON
  const postobon3125_G1 = await prisma.producto.upsert({
    where: { codigo: 'POSTOBON-3125' },
    update: {},
    create: {
      codigo: 'POSTOBON-3125',
      nombre: 'Gaseosa Postobon Surtida (3.125 Litros) Pet',
      descripcion: 'Bebida gaseosa Postobon surtida presentación 3125ml',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 8500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 0,
      tipoProducto: 'Bebida',
      codigoPlu: 21244,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const postobon2500_G1 = await prisma.producto.upsert({
    where: { codigo: 'POSTOBON-2500' },
    update: {},
    create: {
      codigo: 'POSTOBON-2500',
      nombre: 'Gaseosa Postobon Surtida (2.5 Litros) Pet',
      descripcion: 'Bebida gaseosa Postobon surtida presentación 2500ml',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 7500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 0,
      tipoProducto: 'Bebida',
      codigoPlu: 21243,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: tiendaCategory.id,
    },
  });


  const postobon1500_G1 = await prisma.producto.upsert({
    where: { codigo: 'POSTOBON-1500' },
    update: {},
    create: {
      codigo: 'POSTOBON-1500',
      nombre: 'Gaseosa Postobon Surtida (1.5 Litros) Pet',
      descripcion: 'Bebida gaseosa Postobon surtida presentación 1500ml',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 6000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 0,
      tipoProducto: 'Bebida',
      codigoPlu: 21242,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: tiendaCategory.id,
    },
  });


  const postobon400_G1 = await prisma.producto.upsert({
    where: { codigo: 'POSTOBON-400' },
    update: {},
    create: {
      codigo: 'POSTOBON-400',
      nombre: 'Gaseosa Postobon Surtida (400ML) Pet',
      descripcion: 'Bebida gaseosa Postobon surtida presentación 400ml',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 3000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 0,
      tipoProducto: 'Bebida',
      codigoPlu: 21241,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const postobon1000_G1 = await prisma.producto.upsert({
    where: { codigo: 'POSTOBON-1000' },
    update: {},
    create: {
      codigo: 'POSTOBON-1000',
      nombre: 'Gaseosa Postobon Surtida (Econolitro)',
      descripcion: 'Bebida gaseosa Postobon surtida presentación 1000ml',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 4000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 0,
      tipoProducto: 'Bebida',
      codigoPlu: 21245,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const postobon250_G1 = await prisma.producto.upsert({
    where: { codigo: 'POSTOBON-250' },
    update: {},
    create: {
      codigo: 'POSTOBON-250',
      nombre: 'Gaseosa Postobon Surtida (250ML) Pet',
      descripcion: 'Bebida gaseosa Postobon surtida presentación 250ml',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 1500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 0,
      tipoProducto: 'Bebida',
      codigoPlu: 21240,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: tiendaCategory.id,
    },
  });

  //GATORADE
  const gatorade500_G1 = await prisma.producto.upsert({
    where: { codigo: 'GATORADE-500' },
    update: {},
    create: {
      codigo: 'GATORADE-500',
      nombre: 'Gatorade Sabores Surtidos (500ML)',
      descripcion: 'Bebida deportiva rehidratante',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 4800,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 8,
      tipoProducto: 'Bebida',
      codigoPlu: 21256,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const gatoradeAzul500_G1 = await prisma.producto.upsert({
    where: { codigo: 'GATORADEAZUL-500' },
    update: {},
    create: {
      codigo: 'GATORADEAZUL-500',
      nombre: 'Gatorade Azul (500ML) Pet',
      descripcion: 'Bebida deportiva rehidratante',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 4800,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 8,
      tipoProducto: 'Bebida',
      codigoPlu: 23249,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: tiendaCategory.id,
    },
  });

  //JUGO HIT
  const hit500_G1 = await prisma.producto.upsert({
    where: { codigo: 'HIT-500' },
    update: {},
    create: {
      codigo: 'HIT-500',
      nombre: 'Hit Sabores Surtidos (500ML) Pet',
      descripcion: 'Bebida con jugo de nectar de frutas',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 3500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 11,
      tipoProducto: 'Bebida',
      codigoPlu: 21252,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const hit1500_G1 = await prisma.producto.upsert({
    where: { codigo: 'HIT-1500' },
    update: {},
    create: {
      codigo: 'HIT-1500',
      nombre: 'Hit Sabores Surtidos (1.5 Litros) Pet',
      descripcion: 'Bebida con jugo de nectar de frutas',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 5600,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 11,
      tipoProducto: 'Bebida',
      codigoPlu: 21253,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const nectar237_G1 = await prisma.producto.upsert({
    where: { codigo: 'NECTAR-237' },
    update: {},
    create: {
      codigo: 'NECTAR237',
      nombre: 'Jugo Nectar Sabores Surtidos (237ML) Vidrio',
      descripcion: 'Bebida con jugo de nectar de frutas',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 2500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 13,
      tipoProducto: 'Bebida',
      codigoPlu: 21254,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const mrTea500_G1 = await prisma.producto.upsert({
    where: { codigo: 'MRTEA-500' },
    update: {},
    create: {
      codigo: 'MRTEA500',
      nombre: 'Mr Tea Sabores Surtidos (500ML) Pet',
      descripcion: 'Bebida refrescante con sabor a té',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 3200,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 9,
      tipoProducto: 'Bebida',
      codigoPlu: 21255,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const squash500_G1 = await prisma.producto.upsert({
    where: { codigo: 'SQUASH-500' },
    update: {},
    create: {
      codigo: 'SQUASH-500',
      nombre: 'Squash Sabores Surtidos (500ML) Pet',
      descripcion: 'Bebida rehidratante',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 3500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 9,
      tipoProducto: 'Bebida',
      codigoPlu: 21257,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const natuMalta200_G1 = await prisma.producto.upsert({
    where: { codigo: 'NATUMALTA-200' },
    update: {},
    create: {
      codigo: 'NATUMALTA-200',
      nombre: 'Natu Malta (200ML) Pet',
      descripcion: 'Bebida con malta',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 2000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 3,
      tipoProducto: 'Bebida',
      codigoPlu: 21258,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const quatroToronja400_G1 = await prisma.producto.upsert({
    where: { codigo: 'QUATROTORONJA-400' },
    update: {},
    create: {
      codigo: 'QUATROTORONJA-400',
      nombre: 'Quatro Toronja (400ML) Pet',
      descripcion: 'Bebida gaseosa con sabor a Toronja',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 3000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 0,
      tipoProducto: 'Bebida',
      codigoPlu: 23250,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const natuMalta400_G1 = await prisma.producto.upsert({
    where: { codigo: 'NATUMALTA-400' },
    update: {},
    create: {
      codigo: 'NATUMALTA-400',
      nombre: 'Natu Malta (400 ML) Pet',
      descripcion: 'Bebida con malta',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 3000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 5,
      tipoProducto: 'Bebida',
      codigoPlu: 21259,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const natuMalta1000_G1 = await prisma.producto.upsert({
    where: { codigo: 'NATUMALTA-1000' },
    update: {},
    create: {
      codigo: 'NATUMALTA-1000',
      nombre: 'Natu Malta (1 Litro) Pet',
      descripcion: 'Bebida con malta',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 5000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 3,
      tipoProducto: 'Bebida',
      codigoPlu: 21260,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const ponyMalta330_G1 = await prisma.producto.upsert({
    where: { codigo: 'PONYMALTA-330' },
    update: {},
    create: {
      codigo: 'PONYMALTA-330',
      nombre: 'Pony Malta Lata (330CM)',
      descripcion: 'Bebida refrescante con sabor a malta de cebada',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 3000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 0,
      tipoProducto: 'Bebida',
      codigoPlu: 23563,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const saviloe320_G1 = await prisma.producto.upsert({
    where: { codigo: 'SAVILOE-320' },
    update: {},
    create: {
      codigo: 'SAVILOE-320',
      nombre: 'Saviloe 320 ML',
      descripcion: 'Bebida con Aloe vera',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 3500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 3,
      tipoProducto: 'Bebida',
      codigoPlu: 24004,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const vive100Original380_G1 = await prisma.producto.upsert({
    where: { codigo: 'VIVE100-380' },
    update: {},
    create: {
      codigo: 'VIVE100-380',
      nombre: 'Vive100% Original (380 ML)',
      descripcion: 'Bebida energizante con guarana',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 3500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 0,
      tipoProducto: 'Bebida',
      codigoPlu: 24003,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: tiendaCategory.id,
    },
  });
  const speedMaxBlue310_G1 = await prisma.producto.upsert({
    where: { codigo: 'SPEEDMAXBLUE-310' },
    update: {},
    create: {
      codigo: 'SPEEDMAXBLUE-310',
      nombre: 'Speed Max Blue (310 ML) Lata',
      descripcion: 'Bebida energizante con presentación Azul',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 2500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 0,
      tipoProducto: 'Bebida',
      codigoPlu: 21251,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const speedMax473_G1 = await prisma.producto.upsert({
    where: { codigo: 'SPEEDMAX-473' },
    update: {},
    create: {
      codigo: 'SPEEDMAX-473',
      nombre: 'Speed Max (473ML) Lata Grande',
      descripcion: 'Bebida energizante',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 3500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 0,
      tipoProducto: 'Bebida',
      codigoPlu: 21249,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const speedMax310_G1 = await prisma.producto.upsert({
    where: { codigo: 'SPEEDMAX-310' },
    update: {},
    create: {
      codigo: 'SPEEDMAX-310',
      nombre: 'Speed Max (310ML) Lata',
      descripcion: 'Bebida energizante',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 2500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 0,
      tipoProducto: 'Bebida',
      codigoPlu: 21248,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const speedMax250_G1 = await prisma.producto.upsert({
    where: { codigo: 'SPEEDMAX-250' },
    update: {},
    create: {
      codigo: 'SPEEDMAX-250',
      nombre: 'Speed Max (250ML) Pet',
      descripcion: 'Bebida con jugo de nectar de frutas',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 2000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 0,
      tipoProducto: 'Bebida',
      codigoPlu: 21250,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const speedMax1000_G1 = await prisma.producto.upsert({
    where: { codigo: 'SPEEDMAX-1000' },
    update: {},
    create: {
      codigo: 'SPEEDMAX-1000',
      nombre: 'Speed Max (1 Litro) Pet',
      descripcion: 'Bebida energizante',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 4500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 0,
      tipoProducto: 'Bebida',
      codigoPlu: 21251,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: tiendaCategory.id,
    },
  });

  //BEBIDAS GASSOL 2
  const aguaCristalAloe330_G2 = await prisma.producto.upsert({
    where: { codigo: 'AGUA-CRISTAL-ALOE-330' },
    update: {},
    create: {
      codigo: 'AGUA-CRISTAL-ALOE-330',
      nombre: 'Agua Cristal Aloe (330ML) Pet',
      descripcion: 'Bebida de agua natural con Aloe vera',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 2500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 7,
      tipoProducto: 'Bebida',
      codigoPlu: 21264,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const canadaDry300_G2 = await prisma.producto.upsert({
    where: { codigo: 'CANADA-ADRY-300' },
    update: {},
    create: {
      codigo: 'CANADA-ADRY-300',
      nombre: 'Canada Dry (300ML)',
      descripcion: 'Bebida saborizada con Jengibre',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 3000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 13,
      tipoProducto: 'Bebida',
      codigoPlu: 21272,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const speedMax250_G2 = await prisma.producto.upsert({
    where: { codigo: 'SPEED-MAX-250' },
    update: {},
    create: {
      codigo: 'SPEED-MAX-250',
      nombre: 'Speed Max (250 ML) Pet',
      descripcion: 'Bebida energizante',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 2000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 2,
      tipoProducto: 'Bebida',
      codigoPlu: 21275,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const speedMax1000_G2 = await prisma.producto.upsert({
    where: { codigo: 'SPEED-MAX-1000' },
    update: {},
    create: {
      codigo: 'SPEED-MAX-1000',
      nombre: 'Speed Max (1 Litro) Pet',
      descripcion: 'Bebida energizante',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 4500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 0,
      tipoProducto: 'Bebida',
      codigoPlu: 21276,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const hit500_G2 = await prisma.producto.upsert({
    where: { codigo: 'JUGO-HIT-500' },
    update: {},
    create: {
      codigo: 'JUGO-HIT-500',
      nombre: 'Hit Sabores Surtidos (500ML) Pet',
      descripcion: 'Bebida con jugo nectar',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 3500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 5,
      tipoProducto: 'Bebida',
      codigoPlu: 21277,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const hit1500_G2 = await prisma.producto.upsert({
    where: { codigo: 'JUGO-HIT-1500' },
    update: {},
    create: {
      codigo: 'JUGO-HIT-1500',
      nombre: 'Hit Sabores Surtidos (15 Litros) Pet',
      descripcion: 'Bebida con jugo nectar',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 5600,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 0,
      tipoProducto: 'Bebida',
      codigoPlu: 21278,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const nectar237_G2 = await prisma.producto.upsert({
    where: { codigo: 'JUGO-NECTAR-237' },
    update: {},
    create: {
      codigo: 'JUGO-NECTAR-237',
      nombre: 'Jugo Nectar Sabores Surtidos (237ML) Vidrio',
      descripcion: 'Bebida con jugo nectar',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 2500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 13,
      tipoProducto: 'Bebida',
      codigoPlu: 21279,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const mrTea500_G2 = await prisma.producto.upsert({
    where: { codigo: 'MR-TEA-500' },
    update: {},
    create: {
      codigo: 'MR-TEA-500',
      nombre: 'Mr Tea Sabores Surtidos (500ML) Pet',
      descripcion: 'Bebida con sabor a té',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 3200,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 10,
      tipoProducto: 'Bebida',
      codigoPlu: 21280,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const gatoradeSurtidos500_G2 = await prisma.producto.upsert({
    where: { codigo: 'GATORADE-SURTIDOS-500' },
    update: {},
    create: {
      codigo: 'GATORADE-SURTIDOS-500',
      nombre: 'Gatorade Sabores Surtidos (500ML)',
      descripcion: 'Bebida rehidratante con sabores surtidos',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 4800,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 12,
      tipoProducto: 'Bebida',
      codigoPlu: 21281,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const squash500_G2 = await prisma.producto.upsert({
    where: { codigo: 'SQUASHG-500' },
    update: {},
    create: {
      codigo: 'SQUASHG-500',
      nombre: 'Squash Sabores Surtidos (500ML) Pet',
      descripcion: 'Bebida rehidratante con sabores surtidos',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 3500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 7,
      tipoProducto: 'Bebida',
      codigoPlu: 21282,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const natuMalta200_G2 = await prisma.producto.upsert({
    where: { codigo: 'NATU-MALTA-200' },
    update: {},
    create: {
      codigo: 'NATU-MALTA-200',
      nombre: 'Natu Malta (200 ML) Pet',
      descripcion: 'Bebida con sabor a malta',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 2000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 0,
      tipoProducto: 'Bebida',
      codigoPlu: 21283,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const cocaOriginal400_G2 = await prisma.producto.upsert({
    where: { codigo: 'COCA-ORIGINAL-400' },
    update: {},
    create: {
      codigo: 'COCA-ORIGINAL-400',
      nombre: 'Coca Cola Sabor Original (400ML) Pet',
      descripcion: 'Bebida gaseosa refrescante',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 3800,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 13,
      tipoProducto: 'Bebida',
      codigoPlu: 21289,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const cocaZero400_G2 = await prisma.producto.upsert({
    where: { codigo: 'COCA-ZERO-400' },
    update: {},
    create: {
      codigo: 'COCA-ZERO-400',
      nombre: 'Coca Cola Zero (400ML) Pet',
      descripcion: 'Bebida gaseosa refrescante',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 4000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 0,
      tipoProducto: 'Bebida',
      codigoPlu: 21290,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const cocaOriginal1500_G2 = await prisma.producto.upsert({
    where: { codigo: 'COCA-ORIGINAL-1500' },
    update: {},
    create: {
      codigo: 'COCA-ORIGINAL-1500',
      nombre: 'Coca Cola Sabor Original (1.5 Litros) Pet',
      descripcion: 'Bebida gaseosa refrescante',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 8500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 3,
      tipoProducto: 'Bebida',
      codigoPlu: 21291,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const coca2500_G2 = await prisma.producto.upsert({
    where: { codigo: 'COCA-2500' },
    update: {},
    create: {
      codigo: 'COCA-2500',
      nombre: 'Coca Cola (2.5 Litros) Pet',
      descripcion: 'Bebida gaseosa refrescante',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 8000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 0,
      tipoProducto: 'Bebida',
      codigoPlu: 21292,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const brisaGas280_G2 = await prisma.producto.upsert({
    where: { codigo: 'BRISA-GAS-280' },
    update: {},
    create: {
      codigo: 'BRISA-GAS-280',
      nombre: 'Agua Saborizada Brisa Con Gas (280ML) Pet',
      descripcion: 'Bebida saborizada con agua natural gasificada',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 2000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 1,
      tipoProducto: 'Bebida',
      codigoPlu: 21293,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const brisaGas600_G2 = await prisma.producto.upsert({
    where: { codigo: 'BRISA-GAS-600' },
    update: {},
    create: {
      codigo: 'BRISA-GAS-600',
      nombre: 'Agua Brisa Saborizada Con Gas (600ML)',
      descripcion: 'Bebida saborizada con agua natural gasificada',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 3000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 3,
      tipoProducto: 'Bebida',
      codigoPlu: 21294,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const natuMalta400_G2 = await prisma.producto.upsert({
    where: { codigo: 'NATU-MALTA-400' },
    update: {},
    create: {
      codigo: 'NATU-MALTA-400',
      nombre: 'Natu Malta (400 ML) Pet',
      descripcion: 'Bebida con sabor a mlta',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 3500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 3,
      tipoProducto: 'Bebida',
      codigoPlu: 21284,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const bretana300_G2 = await prisma.producto.upsert({
    where: { codigo: 'BRETANA-300' },
    update: {},
    create: {
      codigo: 'BRETANA-300',
      nombre: 'Bretaña Postobon Vidrio (300ML)',
      descripcion: 'Bebida de soda',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 3000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 7,
      tipoProducto: 'Bebida',
      codigoPlu: 21271,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const speedMax310_G2 = await prisma.producto.upsert({
    where: { codigo: 'SPEED-MAX-310' },
    update: {},
    create: {
      codigo: 'SPEED-MAX-310',
      nombre: 'Speed Max (310 ML) Lata',
      descripcion: 'Bebida energizante',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 2500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 5,
      tipoProducto: 'Bebida',
      codigoPlu: 21273,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const coca3000_G2 = await prisma.producto.upsert({
    where: { codigo: 'COCA-3000' },
    update: {},
    create: {
      codigo: 'COCA-3000',
      nombre: 'Coca Cola (3 Litros) Pet',
      descripcion: 'Bebida gaseosa refrescante ',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 14000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 0,
      tipoProducto: 'Bebida',
      codigoPlu: 23268,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const coca100Litros_G2 = await prisma.producto.upsert({
    where: { codigo: 'COCA-100-LITROS' },
    update: {},
    create: {
      codigo: 'COCA-100-LITROS',
      nombre: 'Coca cola sabor original (100 Litros) Pet',
      descripcion: 'Bebida gaseosa refrescante',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 6000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 2,
      tipoProducto: 'Bebida',
      codigoPlu: 26517,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const coca225Litro_G2 = await prisma.producto.upsert({
    where: { codigo: 'COCA-225-LITRO' },
    update: {},
    create: {
      codigo: 'COCA-225-LITRO',
      nombre: 'Coca cola (225 Litro) Pet',
      descripcion: 'Bebida gaseosa refrescante',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 10000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 4,
      tipoProducto: 'Bebida',
      codigoPlu: 21292,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const coca250ml_G2 = await prisma.producto.upsert({
    where: { codigo: 'COCA-250-ML' },
    update: {},
    create: {
      codigo: 'COCA-250-ML',
      nombre: 'Coca Cola Sabor Original (250ML) Pet',
      descripcion: 'Bebida gaseosa refrescante',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 2500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 0,
      tipoProducto: 'Bebida',
      codigoPlu: 25986,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const coca330mlLata_G2 = await prisma.producto.upsert({
    where: { codigo: 'COCA-330-ML-LATA' },
    update: {},
    create: {
      codigo: 'COCA-330-ML-LATA',
      nombre: 'Coca Cola Sabor Original (330ML) Lata',
      descripcion: 'Bebida gaseosa refrescante',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 4500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 5,
      tipoProducto: 'Bebida',
      codigoPlu: 25988,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const gatoradeAzul500_G2 = await prisma.producto.upsert({
    where: { codigo: 'GATORADE-AZUL-500' },
    update: {},
    create: {
      codigo: 'GATORADE-AZUL-500',
      nombre: 'Gatorade Azul (500ML) Pet',
      descripcion: 'Bebida rehidratante blue ice',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 4800,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 7,
      tipoProducto: 'Bebida',
      codigoPlu: 23269,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const quatroToronja400_G2 = await prisma.producto.upsert({
    where: { codigo: 'QUATRO-TORONJA-400' },
    update: {},
    create: {
      codigo: 'QUATRO-TORONJA-400',
      nombre: 'Quatro Toronja Pet (400ML) Pet',
      descripcion: 'Bebida gaseosa con sabor a Toronja',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 3000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 2,
      tipoProducto: 'Bebida',
      codigoPlu: 23270,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const avenaAlpina250_G2 = await prisma.producto.upsert({
    where: { codigo: 'AVENAALPINA-250' },
    update: {},
    create: {
      codigo: 'AVENAALPINA-250',
      nombre: 'Avena Alpina (250 GR)',
      descripcion: 'Bebida lactea con sabor a avena',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 4500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 5,
      tipoProducto: 'Bebida',
      codigoPlu: 23271,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const natuMalta1000_G2 = await prisma.producto.upsert({
    where: { codigo: 'NATU-MALTA-1000' },
    update: {},
    create: {
      codigo: 'NATU-MALTA-1000',
      nombre: 'Natu Malta (1 Litro) Pet',
      descripcion: 'Bebida con sabor a malta',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 4500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 0,
      tipoProducto: 'Bebida',
      codigoPlu: 21285,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const aguaConGasCristal250_G2 = await prisma.producto.upsert({
    where: { codigo: 'AGUA-CRISTAL-GAS-250' },
    update: {},
    create: {
      codigo: 'AGUA-CRISTAL-GAS-250',
      nombre: 'Agua Con Gas Cristal (250ML) Pet',
      descripcion: 'Bebida con agua natural gasificada',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 1000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 0,
      tipoProducto: 'Bebida',
      codigoPlu: 21262,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const aguaCristal300_G2 = await prisma.producto.upsert({
    where: { codigo: 'AGUA-CRISTAL-300' },
    update: {},
    create: {
      codigo: 'AGUA-CRISTAL-300',
      nombre: 'Agua Cristal (300ML) Pet',
      descripcion: 'Bebida de agua natural',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 1000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 31,
      tipoProducto: 'Bebida',
      codigoPlu: 21261,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const bonyurt170_G2 = await prisma.producto.upsert({
    where: { codigo: 'BONYURT-ALPINA-170' },
    update: {},
    create: {
      codigo: 'BONYURT-ALPINA-170',
      nombre: 'Bonyur Alpina + Zucaritas (170GR)',
      descripcion: 'Alimento combinado con yugurt y cereales',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 5500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 3,
      tipoProducto: 'Bebida',
      codigoPlu: 23272,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const chocorramo65_G2 = await prisma.producto.upsert({
    where: { codigo: 'CHOCORRAMO-65GR' },
    update: {},
    create: {
      codigo: 'CHOCORRAMO-65GR',
      nombre: 'Chocorramo (65GR)',
      descripcion: 'Ponqué rectangular tradicional cubierto de chocolate',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 3500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 14,
      tipoProducto: 'Bebida',
      codigoPlu: 23273,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const chocoramoFrutosRojos40_G2 = await prisma.producto.upsert({
    where: { codigo: 'CHOCORAMO-FRUTOS-ROJOS-40' },
    update: {},
    create: {
      codigo: 'CHOCORAMO-FRUTOS-ROJOS-40',
      nombre: 'Chocorramo Barrita Frutos Rojos (40G)',
      descripcion: 'Barra de chocolate con frutos rojos',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 2700,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 5,
      tipoProducto: 'Bebida',
      codigoPlu: 26795,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const chocorramoBrownieArequipe65_G2 = await prisma.producto.upsert({
    where: { codigo: 'CHOCORRAMO-BROWNIE-AREQUIPE-65' },
    update: {},
    create: {
      codigo: 'CHOCORRAMO-BROWNIE-AREQUIPE-65',
      nombre: 'Chocorramo Brownie Arequipe (65G)',
      descripcion: 'Brownie de chocolate con relleno de arequipe',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 3800,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 6,
      tipoProducto: 'Bebida',
      codigoPlu: 26796,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const gansitoBarrita_G2 = await prisma.producto.upsert({
    where: { codigo: 'GANSITO-BARRITA' },
    update: {},
    create: {
      codigo: 'GANSITO-BARRITA',
      nombre: 'Gansito Barrita',
      descripcion: 'Barra de pastel con relleno dulce',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 4500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 6,
      tipoProducto: 'Bebida',
      codigoPlu: 26714,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const aguaCristal600_G2 = await prisma.producto.upsert({
    where: { codigo: 'AGUA-CRISTAL-600' },
    update: {},
    create: {
      codigo: 'AGUA-CRISTAL-600',
      nombre: 'Agua Cristal (600ML) Pet',
      descripcion: 'Bebida con agua natural',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 2000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 0,
      tipoProducto: 'Bebida',
      codigoPlu: 21238,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const speedMax473_G2 = await prisma.producto.upsert({
    where: { codigo: 'SPEED-MAX-473' },
    update: {},
    create: {
      codigo: 'SPEED-MAX-473',
      nombre: 'Speed Max (473ML) Lata Grande',
      descripcion: 'Bebida energizante',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 3500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 5,
      tipoProducto: 'Bebida',
      codigoPlu: 21249,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const aguaCristal1000_G2 = await prisma.producto.upsert({
    where: { codigo: 'AGUA-CRISTAL-1000' },
    update: {},
    create: {
      codigo: 'AGUA-CRISTAL-1000',
      nombre: 'Agua Cristal (1Litro) Pet',
      descripcion: 'Bebida con agua natural litro',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 3000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 7,
      tipoProducto: 'Bebida',
      codigoPlu: 22453,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const ponyMalta330_G2 = await prisma.producto.upsert({
    where: { codigo: 'PONY-MALTA-330' },
    update: {},
    create: {
      codigo: 'PONY-MALTA-330',
      nombre: 'Pony Malta Lata (330CM)',
      descripcion: 'Bebida refrescante con sabor a malta',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 3000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 1,
      tipoProducto: 'Bebida',
      codigoPlu: 23564,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const saviloe320_G2 = await prisma.producto.upsert({
    where: { codigo: 'SAVILOEQ-320' },
    update: {},
    create: {
      codigo: 'SAVILOEQ-320',
      nombre: 'Saviloe X 320ML',
      descripcion: 'Bebida con agua natural y Aloe vera',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 3500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 7,
      tipoProducto: 'Bebida',
      codigoPlu: 24005,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const vive100Original_G2 = await prisma.producto.upsert({
    where: { codigo: 'VIVE100-ORIGINAL' },
    update: {},
    create: {
      codigo: 'VIVE100-ORIGINAL',
      nombre: 'Vive100% Original (380 ML)',
      descripcion: 'Bebida energizante',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 3500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 7,
      tipoProducto: 'Bebida',
      codigoPlu: 24006,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const speedMaxBlue310_G2 = await prisma.producto.upsert({
    where: { codigo: 'SPEED-MAX-BLUE-310' },
    update: {},
    create: {
      codigo: 'SPEED-MAX-BLUE-310',
      nombre: 'Speed Max Blue (310 ML) Lata',
      descripcion: 'Bebida energizante',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 2500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 5,
      tipoProducto: 'Bebida',
      codigoPlu: 25566,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const postobon250_G2 = await prisma.producto.upsert({
    where: { codigo: 'GASEOSA-POSTOBON-250' },
    update: {},
    create: {
      codigo: 'GASEOSA-POSTOBON-250',
      nombre: 'Gaseosa Postobon Surtida (250ML) Pet',
      descripcion: 'Bebida gaseosa con sabor surtido',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 1500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 0,
      tipoProducto: 'Bebida',
      codigoPlu: 21265,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const postobon400_G2 = await prisma.producto.upsert({
    where: { codigo: 'GASEOSA-POSTOBON-400' },
    update: {},
    create: {
      codigo: 'GASEOSA-POSTOBON-400',
      nombre: 'Gaseosa Postobon Surtida (400ML) Pet',
      descripcion: 'Bebida gaseosa con sabor surtido',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 3000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 0,
      tipoProducto: 'Bebida',
      codigoPlu: 21266,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const postobon1500_G2 = await prisma.producto.upsert({
    where: { codigo: 'GASEOSA-POSTOBON-1500' },
    update: {},
    create: {
      codigo: 'GASEOSA-POSTOBON-1500',
      nombre: 'Gaseosa Postobon Surtida (1.5 Litros) Pet',
      descripcion: 'Bebida gaseosa con sabor surtido',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 6000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 0,
      tipoProducto: 'Bebida',
      codigoPlu: 21267,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const postobon2500_G2 = await prisma.producto.upsert({
    where: { codigo: 'GASEOSA-POSTOBON-2500' },
    update: {},
    create: {
      codigo: 'GASEOSA-POSTOBON-2500',
      nombre: 'Gaseosa Postobon Surtida (2.5 Litros) Pet',
      descripcion: 'Bebida gaseosa con sabor surtido',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 7500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 0,
      tipoProducto: 'Bebida',
      codigoPlu: 21268,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const postobon3125_G2 = await prisma.producto.upsert({
    where: { codigo: 'GASEOSA-POSTOBON-3125' },
    update: {},
    create: {
      codigo: 'GASEOSA-POSTOBON-3125',
      nombre: 'Gaseosa Postobon Surtida (3.125 Litros) Pet',
      descripcion: 'Bebida gaseosa con sabor surtido',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 8500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 0,
      tipoProducto: 'Bebida',
      codigoPlu: 21269,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: tiendaCategory.id,
    },
  });

  const postobonEconolitro_G2 = await prisma.producto.upsert({
    where: { codigo: 'POSTOBON-ECONOLITRO' },
    update: {},
    create: {
      codigo: 'POSTOBON-ECONOLITRO',
      nombre: 'Gaseosa Postobon Surtida (Econolitro)',
      descripcion: 'Bebida gaseosa con sabor surtido',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 4000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 0,
      tipoProducto: 'Bebida',
      codigoPlu: 21270,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: tiendaCategory.id,
    },
  });

  // LUBRICANTES
  console.log('🛢️ Creando lubricantes...');

  //LUBRICANTE GASSOL 1
  const simonizCadenas_G1 = await prisma.producto.upsert({
    where: { codigo: 'SIMONIZCADENAS-UNID' },
    update: {},
    create: {
      codigo: 'SIMONIZCADENAS-UNID',
      nombre: 'Lubricante Cadenas Simoniz',
      descripcion: 'Lubricante para cadena',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 7000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 0,
      tipoProducto: 'Lubricante',
      codigoPlu: 2291,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: lubricantesCategory.id,
    },
  });

  const mobilSuper20w50_G1 = await prisma.producto.upsert({
    where: { codigo: 'MOBILSUPER-20W50' },
    update: {},
    create: {
      codigo: 'MOBIL-SUPER-20W50',
      nombre: 'Mobil Super 20W-50 Moto 4T (Litro)',
      descripcion: 'Aceite motor 20W-50 para moto 4T',
      unidadMedida: 'Litros',
      precioCompra: 0,
      precioVenta: 33000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 4,
      tipoProducto: 'Lubricante',
      codigoPlu: 4215,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: lubricantesCategory.id,
    },
  });

  const delvac15w40_G1 = await prisma.producto.upsert({
    where: { codigo: 'MOBILDELVAC-15W40' },
    update: {},
    create: {
      codigo: 'MOBIL-DELVAC-15W40',
      nombre: 'Mobil Delvac Modern 15W-40 Full Protection (1/4) Cuarto',
      descripcion: 'Aceite diésel 15W-40',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 36000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 6,
      tipoProducto: 'Lubricante',
      codigoPlu: 3207,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: lubricantesCategory.id,
    },
  });

  const ultrtek25w50_G1 = await prisma.producto.upsert({
    where: { codigo: 'TERPELULTRTEK-25W50' },
    update: {},
    create: {
      codigo: 'TERPEL-ULTRTEK-25W50',
      nombre: 'Terpel Ultrek 25W50 Alto Km Galon',
      descripcion: 'Aceite motor 25W-50 alto kilometraje',
      unidadMedida: 'Galones',
      precioCompra: 0,
      precioVenta: 90000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 3,
      tipoProducto: 'Lubricante',
      codigoPlu: 9264,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: lubricantesCategory.id,
    },
  });

  const mobilHydraulicAw68_G1 = await prisma.producto.upsert({
    where: { codigo: 'MOBILHIDRAULIC-AW68' },
    update: {},
    create: {
      codigo: 'MOBIL-HIDRAULIC-AW68',
      nombre: 'Aceite Mobil Hidraulic AW-68 (1/4) Cuarto',
      descripcion: 'Aceite hidráulico AW-68',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 21500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 9,
      tipoProducto: 'Lubricante',
      codigoPlu: 11276,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: lubricantesCategory.id,
    },
  });

  const celerity20w50_G1 = await prisma.producto.upsert({
    where: { codigo: 'TERPELCELERITY-20W50' },
    update: {},
    create: {
      codigo: 'TERPEL-CELERITY-20W50',
      nombre: 'Terpel Celerity 20W-50 Titanio Moto 4T (Litro)',
      descripcion: 'Aceite moto 4T 20W-50 con titanio',
      unidadMedida: 'Litros',
      precioCompra: 0,
      precioVenta: 26000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 8,
      tipoProducto: 'Lubricante',
      codigoPlu: 11274,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: lubricantesCategory.id,
    },
  });

  const ultrek50_G1 = await prisma.producto.upsert({
    where: { codigo: 'TERPELULTREK-50' },
    update: {},
    create: {
      codigo: 'TERPEL-ULTREK-50',
      nombre: 'Terpel Ultrek 50 Monogrado (1/4) Cuarto',
      descripcion: 'Aceite monogrado 50',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 22500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 10,
      tipoProducto: 'Lubricante',
      codigoPlu: 11271,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: lubricantesCategory.id,
    },
  });

  const delvac1Galon15w40_G1 = await prisma.producto.upsert({
    where: { codigo: 'MOBILDELVAC-15W40-1G' },
    update: {},
    create: {
      codigo: 'MOBILDELVAC-15W40-1G',
      nombre: 'Mobil Delvac Modern 15W-40 Full Protection (Galon)',
      descripcion: 'Aceite diésel 15W-40 galón',
      unidadMedida: 'Galones',
      precioCompra: 0,
      precioVenta: 135000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 2,
      tipoProducto: 'Lubricante',
      codigoPlu: 11051,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: lubricantesCategory.id,
    },
  });

  const oiltec50_G1 = await prisma.producto.upsert({
    where: { codigo: 'TERPELOILTEC-50' },
    update: {},
    create: {
      codigo: 'TERPEL-OILTEC-50',
      nombre: 'Terpel Oiltec 50 Monogrado (1/4) Cuarto',
      descripcion: 'Aceite monogrado 50',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 23000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 4,
      tipoProducto: 'Lubricante',
      codigoPlu: 14504,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: lubricantesCategory.id,
    },
  });

  const oiltec501Galon_G1 = await prisma.producto.upsert({
    where: { codigo: 'TERPELOILTEC-50-1G' },
    update: {},
    create: {
      codigo: 'TERPELOILTEC-50-1G',
      nombre: 'Terpel Oiltec 50 Monogrado (Galon)',
      descripcion: 'Aceite monogrado 50 galón',
      unidadMedida: 'Galones',
      precioCompra: 0,
      precioVenta: 73000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 2,
      tipoProducto: 'Lubricante',
      codigoPlu: 14505,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: lubricantesCategory.id,
    },
  });

  const celerity2t_G1 = await prisma.producto.upsert({
    where: { codigo: 'TERPELCELERITY-2T' },
    update: {},
    create: {
      codigo: 'TERPEL-CELERITY-2T',
      nombre: 'Terpel Celerity Bio Antihumo Moto 2T (Litro)',
      descripcion: 'Aceite 2T antihumo 1L',
      unidadMedida: 'Litros',
      precioCompra: 0,
      precioVenta: 26000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 7,
      tipoProducto: 'Lubricante',
      codigoPlu: 11279,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: lubricantesCategory.id,
    },
  });

  const mobilSuper1000_G1 = await prisma.producto.upsert({
    where: { codigo: 'MOBILSUPER1000-20W50-1Q' },
    update: {},
    create: {
      codigo: 'MOBILSUPER1000-20W50-1Q',
      nombre: 'Mobil Super 1000 20W-50 (1/4) Cuarto',
      descripcion: 'Aceite motor Mobil Super 1000 20W-50 1/4',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 36500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 4,
      tipoProducto: 'Lubricante',
      codigoPlu: 18047,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: lubricantesCategory.id,
    },
  });

  const mobilSuper1000Ungalon_G1 = await prisma.producto.upsert({
    where: { codigo: 'MOBILSUPER1000-20W50-1G' },
    update: {},
    create: {
      codigo: 'MOBILSUPER1000-20W50-1G',
      nombre: 'Mobil Super 1000 20W-50 (Galon)',
      descripcion: 'Aceite motor Mobil Super 1000 20W-50 galón',
      unidadMedida: 'Galones',
      precioCompra: 0,
      precioVenta: 107000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 2,
      tipoProducto: 'Lubricante',
      codigoPlu: 18048,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: lubricantesCategory.id,
    },
  });

  const ultrtek50_G1 = await prisma.producto.upsert({
    where: { codigo: 'TERPELULTRTEK-50' },
    update: {},
    create: {
      codigo: 'TERPEL-ULTRTEK-50',
      nombre: 'Terpel Ultrek 50 Monogrado (Galon)',
      descripcion: 'Aceite monogrado 50 galón',
      unidadMedida: 'Galones',
      precioCompra: 0,
      precioVenta: 75000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 2,
      tipoProducto: 'Lubricante',
      codigoPlu: 23928,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: lubricantesCategory.id,
    },
  });

  //LUBRICANTE GASSOL 2
  const mobilSuper20w50Litro_G2 = await prisma.producto.upsert({
    where: { codigo: 'MOBIL-SUPER-20W50-1L' },
    update: {},
    create: {
      codigo: 'MOBIL-SUPER-20W50-1L',
      nombre: 'Mobil Super 20W-50 Moto 4T (Litro)',
      descripcion: 'Lubricante automotriz para moto 4T 20W-50',
      unidadMedida: 'Litros',
      precioCompra: 0,
      precioVenta: 33000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 5,
      tipoProducto: 'Lubricante',
      codigoPlu: 4215,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: lubricantesCategory.id,
    },
  });

  const mobilDelvac15w40Cuarto_G2 = await prisma.producto.upsert({
    where: { codigo: 'MOBIL-DELVAC-15W40-1Q' },
    update: {},
    create: {
      codigo: 'MOBIL-DELVAC-15W40-1Q',
      nombre: 'Mobil Delvac Modern 15W-40 Full Protection (1/4) Cuarto',
      descripcion: 'Lubricante diésel 15W-40 presentación 1/4',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 36000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 6,
      tipoProducto: 'Lubricante',
      codigoPlu: 3207,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: lubricantesCategory.id,
    },
  });

  const mobilDelvac15w40Galon_G2 = await prisma.producto.upsert({
    where: { codigo: 'MOBIL-DELVAC-15W40-1G' },
    update: {},
    create: {
      codigo: 'MOBIL-DELVAC-15W40-1G',
      nombre: 'Mobil Delvac Modern 15W-40 Full Protection (Galon)',
      descripcion: 'Lubricante diésel 15W-40 galón',
      unidadMedida: 'Galones',
      precioCompra: 0,
      precioVenta: 135000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 2,
      tipoProducto: 'Lubricante',
      codigoPlu: 11326,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: lubricantesCategory.id,
    },
  });

  const terpelCelerity20w50Litro_G2 = await prisma.producto.upsert({
    where: { codigo: 'TERPEL-CELERITY-20W50-1L' },
    update: {},
    create: {
      codigo: 'TERPEL-CELERITY-20W50-1L',
      nombre: 'Terpel Celerity 20W-50 Titanio Moto 4T (Litro)',
      descripcion: 'Lubricante moto 4T 20W-50 con titanio',
      unidadMedida: 'Litros',
      precioCompra: 0,
      precioVenta: 26000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 7,
      tipoProducto: 'Lubricante',
      codigoPlu: 11315,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: lubricantesCategory.id,
    },
  });

  const mobilHydraulicAw68Cuarto_G2 = await prisma.producto.upsert({
    where: { codigo: 'MOBIL-HIDRAULIC-AW68-1Q' },
    update: {},
    create: {
      codigo: 'MOBIL-HIDRAULIC-AW68-1Q',
      nombre: 'Aceite Mobil Hidraulic AW-68 (1/4) Cuarto',
      descripcion: 'Lubricante hidráulico AW-68 presentación 1/4',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 21500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 8,
      tipoProducto: 'Lubricante',
      codigoPlu: 11280,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: lubricantesCategory.id,
    },
  });

  const terpelUltrtek25w50Galon_G2 = await prisma.producto.upsert({
    where: { codigo: 'TERPEL-ULTRTEK-25W50-1G' },
    update: {},
    create: {
      codigo: 'TERPEL-ULTRTEK-25W50-1G',
      nombre: 'Terpel Ultrek 25W-50 Alto Km (Galon)',
      descripcion: 'Lubricante 25W50 alto kilometraje galón',
      unidadMedida: 'Galones',
      precioCompra: 0,
      precioVenta: 90000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 2,
      tipoProducto: 'Lubricante',
      codigoPlu: 11323,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: lubricantesCategory.id,
    },
  });

  const terpelCelerity2tLitro_G2 = await prisma.producto.upsert({
    where: { codigo: 'TERPEL-CELERITY-2T-1L' },
    update: {},
    create: {
      codigo: 'TERPEL-CELERITY-2T-1L',
      nombre: 'Terpel Celerity Bio Antihumo Moto 2T (Litro)',
      descripcion: 'Lubricante 2T antihumo 1 litro',
      unidadMedida: 'Litros',
      precioCompra: 0,
      precioVenta: 26000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 8,
      tipoProducto: 'Lubricante',
      codigoPlu: 11049,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: lubricantesCategory.id,
    },
  });

  const terpelOiltec50Cuarto_G2 = await prisma.producto.upsert({
    where: { codigo: 'TERPEL-OILTEC-50-1Q' },
    update: {},
    create: {
      codigo: 'TERPEL-OILTEC-50-1Q',
      nombre: 'Terpel Oiltec 50 Monogrado (1/4) Cuarto',
      descripcion: 'Lubricante monogrado 50 presentación 1/4',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 23000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 4,
      tipoProducto: 'Lubricante',
      codigoPlu: 14502,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: lubricantesCategory.id,
    },
  });

  const terpelOiltec50Galon_G2 = await prisma.producto.upsert({
    where: { codigo: 'TERPEL-OILTEC-50-1G' },
    update: {},
    create: {
      codigo: 'TERPEL-OILTEC-50-1G',
      nombre: 'Terpel Oiltec 50 Monogrado (Galon)',
      descripcion: 'Lubricante monogrado 50 galón',
      unidadMedida: 'Galones',
      precioCompra: 0,
      precioVenta: 73000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 2,
      tipoProducto: 'Lubricante',
      codigoPlu: 14503,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: lubricantesCategory.id,
    },
  });

  const simonizCadenas_G2 = await prisma.producto.upsert({
    where: { codigo: 'SIMONIZ-CADENAS-UNID' },
    update: {},
    create: {
      codigo: 'SIMONIZ-CADENAS-UNID',
      nombre: 'Lubricante Cadenas Simoniz',
      descripcion: 'Lubricante para cadenas Simoniz',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 7000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 0,
      tipoProducto: 'Lubricante',
      codigoPlu: 13131,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: lubricantesCategory.id,
    },
  });

  const terpelUltrtek50Cuarto_G2 = await prisma.producto.upsert({
    where: { codigo: 'TERPEL-ULTRTEK-50-1Q' },
    update: {},
    create: {
      codigo: 'TERPEL-ULTRTEK-50-1Q',
      nombre: 'Terpel Ultrek 50 Monogrado (1/4) Cuarto',
      descripcion: 'Lubricante monogrado 50 presentación 1/4',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 22500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 9,
      tipoProducto: 'Lubricante',
      codigoPlu: 11271,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: lubricantesCategory.id,
    },
  });

  const terpelUltrtek50Galon_G2 = await prisma.producto.upsert({
    where: { codigo: 'TERPEL-ULTRTEK-50-1G' },
    update: {},
    create: {
      codigo: 'TERPEL-ULTRTEK-50-1G',
      nombre: 'Terpel Ultrek 50 Monogrado (Galon)',
      descripcion: 'Lubricante monogrado 50 galón',
      unidadMedida: 'Galones',
      precioCompra: 0,
      precioVenta: 75000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 0,
      tipoProducto: 'Lubricante',
      codigoPlu: 23930,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: lubricantesCategory.id,
    },
  });

  const mobilSuper1000Cuarto_G2 = await prisma.producto.upsert({
    where: { codigo: 'MOBIL-SUPER1000-20W50-1Q' },
    update: {},
    create: {
      codigo: 'MOBIL-SUPER1000-20W50-1Q',
      nombre: 'Mobil Super 1000 20W-50 (1/4) Cuarto',
      descripcion: 'Lubricante Mobil Super 1000 20W-50 presentación 1/4',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 36500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 5,
      tipoProducto: 'Lubricante',
      codigoPlu: 18045,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: lubricantesCategory.id,
    },
  });

  const mobilSuper1000Galon_G2 = await prisma.producto.upsert({
    where: { codigo: 'MOBIL-SUPER1000-20W50-1G' },
    update: {},
    create: {
      codigo: 'MOBIL-SUPER1000-20W50-1G',
      nombre: 'Mobil Super 1000 20W-50 (1Galon)',
      descripcion: 'Lubricante Mobil Super 1000 20W-50 galón',
      unidadMedida: 'Galones',
      precioCompra: 0,
      precioVenta: 107000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 2,
      tipoProducto: 'Lubricante',
      codigoPlu: 18046,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: lubricantesCategory.id,
    },
  });

  // ADITIVOS
  console.log('⚗️ Creando aditivos...');

  //ADITIVO GASSOL 1
  const limpiadorInyNegro250_G1 = await prisma.producto.upsert({
    where: { codigo: 'LIMPIADORINYECTORES-250ML' },
    update: {},
    create: {
      codigo: 'LIMPIADORINYECTORES-250ML',
      nombre: 'Limpiador De Inyectores Y Carburador 250 ML (Negro) Simoniz',
      descripcion: 'Limpiador de inyectores y carburador 250ml',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 18500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 9,
      tipoProducto: 'Lubricante',
      codigoPlu: 8414,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: lubricantesCategory.id,
    },
  });

  const refrigRojo_G1 = await prisma.producto.upsert({
    where: { codigo: 'SIMONIZREFRIGERANTE-ROJO' },
    update: {},
    create: {
      codigo: 'SIMONIZ-REFRIGERANTE-ROJO',
      nombre: 'Refrigerante Radiador (Galon) Rojo Simoniz',
      descripcion: 'Refrigerante rojo 1 galón',
      unidadMedida: 'Galones',
      precioCompra: 0,
      precioVenta: 25500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 5,
      tipoProducto: 'Lubricante',
      codigoPlu: 11277,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: lubricantesCategory.id,
    },
  });

  const refrigVerde_G1 = await prisma.producto.upsert({
    where: { codigo: 'SIMONIZREFRIGERANTE-VERDE' },
    update: {},
    create: {
      codigo: 'SIMONIZ-REFRIGERANTE-VERDE',
      nombre: 'Refrigerante Radiador (Litro) Surtido Simoniz',
      descripcion: 'Refrigerante verde 1 litro',
      unidadMedida: 'Litros',
      precioCompra: 0,
      precioVenta: 8000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 8,
      tipoProducto: 'Lubricante',
      codigoPlu: 13102,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: lubricantesCategory.id,
    },
  });

  const aditivoGasolina140_G1 = await prisma.producto.upsert({
    where: { codigo: 'SIMONIZADITIVO-GASOLINA-140ML' },
    update: {},
    create: {
      codigo: 'SIMONIZADITIVO-GASOLINA-140ML',
      nombre: 'Aditivo Gasolina (140 ML) Simoniz',
      descripcion: 'Aditivo para gasolina 140 ml',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 10000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 9,
      tipoProducto: 'Lubricante',
      codigoPlu: 13030,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: lubricantesCategory.id,
    },
  });

  const refrigVerdeUnGalon_G1 = await prisma.producto.upsert({
    where: { codigo: 'SIMONIZREFRIGERANTE-VERDE-1G' },
    update: {},
    create: {
      codigo: 'SIMONIZREFRIGERANTE-VERDE-1G',
      nombre: 'Refrigerante Radiador (Galon) Azul Simoniz',
      descripcion: 'Refrigerante Azul 1 galón',
      unidadMedida: 'Galones',
      precioCompra: 0,
      precioVenta: 25500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 6,
      tipoProducto: 'Lubricante',
      codigoPlu: 13026,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: lubricantesCategory.id,
    },
  });

  const limpiadorInyDiesel250_G1 = await prisma.producto.upsert({
    where: { codigo: 'LIMPIADORINYECTORES-DIESEL-250ML' },
    update: {},
    create: {
      codigo: 'LIMPIADORINYECTORES-DIESEL-250ML',
      nombre: 'Limpiador De Inyectores Diesel (250ML) Amarillo Simoniz',
      descripcion: 'Limpiador de inyectores diésel 250 ml',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 18500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 8,
      tipoProducto: 'Lubricante',
      codigoPlu: 13025,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: lubricantesCategory.id,
    },
  });

  const acpmax500ck_G1 = await prisma.producto.upsert({
    where: { codigo: 'ACPMAX500CK-DIESEL-UNID' },
    update: {},
    create: {
      codigo: 'ACPMAX-500CC-DIESEL-UNID',
      nombre: 'Aditivo Diesel Acpmax 500 CC (Multinsa)',
      descripcion: 'Aditivo diésel ACPMAX 500 CK',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 18500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 6,
      tipoProducto: 'Lubricante',
      codigoPlu: 18280,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: lubricantesCategory.id,
    },
  });

  const octamax375cc_G1 = await prisma.producto.upsert({
    where: { codigo: 'OCTAMAX-375CC' },
    update: {},
    create: {
      codigo: 'OCTAMAX-375CC',
      nombre: 'Aditivo Gasolina Octamax 375 CC (Multinsa)',
      descripcion: 'Aditivo gasolina Octamax 375 cc',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 15500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 10,
      tipoProducto: 'Lubricante',
      codigoPlu: 18281,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: lubricantesCategory.id,
    },
  });

  const refrigerante_G1 = await prisma.producto.upsert({
    where: { codigo: 'REFRIGERANTEVERDE-1Q' },
    update: {},
    create: {
      codigo: 'REFRIGERANTE-VERDE-1Q',
      nombre: 'Terpel Refrigerante Estandar (1/4) Verde',
      descripcion: 'Aceite refrigerante verde 1/4',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 7000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 8,
      tipoProducto: 'Lubricante',
      codigoPlu: 23927,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: lubricantesCategory.id,
    },
  });

  const mejoradorOctanaje250_G1 = await prisma.producto.upsert({
    where: { codigo: 'MEJORADOROCTANAJE-250ML' },
    update: {},
    create: {
      codigo: 'MEJORADOROCTANAJE-250ML',
      nombre: 'Mejorador De Octanaje (250ML) Naranja',
      descripcion: 'Mejorador de octanaje 250 ml',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 16000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 7,
      tipoProducto: 'Lubricante',
      codigoPlu: 23929,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol1.id,
      categoriaId: lubricantesCategory.id,
    },
  });

  //ADITIVO GASSOL 2
  const terpelRefrigeranteCuartoVerde_G2 = await prisma.producto.upsert({
    where: { codigo: 'TERPEL-REFRIGERANTE-VERDE-1Q' },
    update: {},
    create: {
      codigo: 'TERPEL-REFRIGERANTE-VERDE-1Q',
      nombre: 'Terpel Refrigerante Estándar (1/4) Verde',
      descripcion: 'Aditivo refrigerante color verde presentación 1/4',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 7000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 6,
      tipoProducto: 'Lubricante',
      codigoPlu: 4426,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: lubricantesCategory.id,
    },
  });

  const limpiadorInyectoresNegro250_G2 = await prisma.producto.upsert({
    where: { codigo: 'LIMPIADOR-INYECTORES-250ML' },
    update: {},
    create: {
      codigo: 'LIMPIADOR-INYECTORES-250ML',
      nombre: 'Limpiador De Inyectores Y Carburador (250ML) Negro Simoniz',
      descripcion: 'Aditivo limpiador de inyectores y carburador 250 ml',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 18500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 7,
      tipoProducto: 'Lubricante',
      codigoPlu: 8414,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: lubricantesCategory.id,
    },
  });

  const acpmax500cc_G2 = await prisma.producto.upsert({
    where: { codigo: 'ACPMAX-500CC' },
    update: {},
    create: {
      codigo: 'ACPMAX-500CC',
      nombre: 'Aditivo Diesel Acpmax 500CC (Multinsa)',
      descripcion: 'Aditivo diésel ACPMAX 500 cc',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 18500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 6,
      tipoProducto: 'Lubricante',
      codigoPlu: 18315,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: lubricantesCategory.id,
    },
  });

  const octamax375cc_G2 = await prisma.producto.upsert({
    where: { codigo: 'OCTA-MAX-375CC' },
    update: {},
    create: {
      codigo: 'OCTA-MAX-375CC',
      nombre: 'Aditivo Gasolina Octamax 375 CC (Multinsa)',
      descripcion: 'Aditivo gasolina Octamax 375 cc',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 15500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 7,
      tipoProducto: 'Lubricante',
      codigoPlu: 18316,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: lubricantesCategory.id,
    },
  });

  const limpiadorInyectoresDiesel250_G2 = await prisma.producto.upsert({
    where: { codigo: 'LIMPIADOR-INYECTORES-DIESEL-250ML' },
    update: {},
    create: {
      codigo: 'LIMPIADOR-INYECTORES-DIESEL-250ML',
      nombre: 'Limpiador De Inyectores Diesel (250ML) Amarillo Simoniz',
      descripcion: 'Aditivo limpiador de inyectores diésel 250 ml',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 18500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 6,
      tipoProducto: 'Lubricante',
      codigoPlu: 13127,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: lubricantesCategory.id,
    },
  });

  const refrigeranteVerdeGalon_G2 = await prisma.producto.upsert({
    where: { codigo: 'SIMONIZ-REFRIGERANTE-VERDE-1G' },
    update: {},
    create: {
      codigo: 'SIMONIZ-REFRIGERANTE-VERDE-1G',
      nombre: 'Refrigerante Radiador (1Galon) Verde Simoniz',
      descripcion: 'Aditivo refrigerante verde 1 galón',
      unidadMedida: 'Galones',
      precioCompra: 0,
      precioVenta: 25500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 7,
      tipoProducto: 'Lubricante',
      codigoPlu: 13128,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: lubricantesCategory.id,
    },
  });

  const refrigeranteVerdeLitro_G2 = await prisma.producto.upsert({
    where: { codigo: 'SIMONIZ-REFRIGERANTE-VERDE-1L' },
    update: {},
    create: {
      codigo: 'SIMONIZ-REFRIGERANTE-VERDE-1L',
      nombre: 'Refrigerante Radiador (Litro) Surtido Simoniz',
      descripcion: 'Aditivo refrigerante verde 1 litro',
      unidadMedida: 'Litros',
      precioCompra: 0,
      precioVenta: 8000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 8,
      tipoProducto: 'Lubricante',
      codigoPlu: 13129,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: lubricantesCategory.id,
    },
  });

  const aditivoGasolina140_G2 = await prisma.producto.upsert({
    where: { codigo: 'SIMONIZ-ADITIVO-GASOLINA-140ML' },
    update: {},
    create: {
      codigo: 'SIMONIZ-ADITIVO-GASOLINA-140ML',
      nombre: 'Aditivo Gasolina (140ML) Rojo Simoniz',
      descripcion: 'Aditivo para gasolina 140 ml',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 10000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 9,
      tipoProducto: 'Lubricante',
      codigoPlu: 13130,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: lubricantesCategory.id,
    },
  });

  const refrigeranteRojoGalon_G2 = await prisma.producto.upsert({
    where: { codigo: 'SIMONIZ-REFRIGERANTE-ROJO-1G' },
    update: {},
    create: {
      codigo: 'SIMONIZ-REFRIGERANTE-ROJO-1G',
      nombre: 'Refrigerante Radiador (Galon) Rojo Simoniz',
      descripcion: 'Aditivo refrigerante rojo 1 galón',
      unidadMedida: 'Galones',
      precioCompra: 0,
      precioVenta: 25500,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 4,
      tipoProducto: 'Lubricante',
      codigoPlu: 21662,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: lubricantesCategory.id,
    },
  });

  const mejoradorOctanaje250_G2 = await prisma.producto.upsert({
    where: { codigo: 'MEJORADOR-OCTANAJE-250ML' },
    update: {},
    create: {
      codigo: 'MEJORADOR-OCTANAJE-250ML',
      nombre: 'Mejorador De Octanaje (250ML) Naranja',
      descripcion: 'Aditivo mejorador de octanaje 250 ml',
      unidadMedida: 'Unidades',
      precioCompra: 0,
      precioVenta: 16000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 10,
      tipoProducto: 'Lubricante',
      codigoPlu: 23931,
      esCombustible: false,
      puntoVentaId: puntoVentaGasol2.id,
      categoriaId: lubricantesCategory.id,
    },
  });


  console.log('✅ Productos de tienda, lubricantes y aditivos creados');

  // 7. CREAR TANQUES PARA CADA PUNTO DE VENTA
  console.log('⛽ Creando tanques...');

  // Función helper para cargar archivos JSON de aforo
  function loadAforoData(filePath: string): Array<{ altura: number, volumen: number }> {
    try {
      const fullPath = path.join(__dirname, '..', 'tablas aforo gasol', filePath);
      const fileContent = fs.readFileSync(fullPath, 'utf8');

      // Algunos archivos tienen formato diferente (sin comillas en las propiedades)
      // Intentar parsear directamente primero, si falla, limpiar el formato
      try {
        return JSON.parse(fileContent);
      } catch {
        // Limpiar formato de archivos sin comillas
        const cleanedContent = fileContent
          .replace(/\{altura:/g, '{"altura":')
          .replace(/,volumen:/g, ',"volumen":')
          .replace(/\}/g, '}');
        return JSON.parse(cleanedContent);
      }
    } catch (error) {
      console.warn(`⚠️ No se pudo cargar el archivo de aforo: ${filePath}`, error);
      return [];
    }
  }

  // Función helper para obtener volumen desde altura usando tabla de aforo
  function getVolumeFromAforo(aforoData: Array<{ altura: number, volumen: number }>, altura: number): number {
    if (aforoData.length === 0) return 0;

    // Ordenar por altura para búsqueda binaria o lineal
    const sortedData = [...aforoData].sort((a, b) => a.altura - b.altura);

    // Buscar el valor exacto o el más cercano
    for (let i = 0; i < sortedData.length; i++) {
      if (sortedData[i].altura >= altura) {
        // Si encontramos el valor exacto
        if (sortedData[i].altura === altura) {
          return sortedData[i].volumen;
        }
        // Interpolación lineal entre el valor anterior y el actual
        if (i > 0) {
          const prev = sortedData[i - 1];
          const curr = sortedData[i];
          const factor = (altura - prev.altura) / (curr.altura - prev.altura);
          return prev.volumen + (curr.volumen - prev.volumen) * factor;
        }
        return sortedData[i].volumen;
      }
    }
    // Si la altura es mayor que todos, retornar el último volumen
    return sortedData[sortedData.length - 1].volumen;
  }

  const tanques = [
    // Tanques Punto de Venta gasol 1
    { nombre: 'Tanque 5000G gasol 1 gasolina', puntoVentaId: puntoVentaGasol1.id, productoId: gasolina90Gasol1.id, capacidad: 5000, unidadMedida: 'Galones', alturaActual: 83.7, aforoFile: 'gasol 1/tabla-aforo-tanque-5000gal.json' },
    { nombre: 'Tanque 15000 gasol 1 diesel', puntoVentaId: puntoVentaGasol1.id, productoId: dieselGasol1.id, capacidad: 15000, unidadMedida: 'Galones', alturaActual: 49.9, aforoFile: 'gasol 1/tabla-aforo-tanque-15000gal.json' },

    // Tanques Punto de Venta gasol 2
    { nombre: 'Tanque 5000G gasol 2 gasolina', puntoVentaId: puntoVentaGasol2.id, productoId: gasolina90Gasol2.id, capacidad: 5000, unidadMedida: 'Galones', alturaActual: 74.5, aforoFile: 'gasol 2/tabla-aforo-tanque-5000gal gasol 2.json' },
    { nombre: 'Tanque 15000 gasol 2 diesel', puntoVentaId: puntoVentaGasol2.id, productoId: dieselGasol2.id, capacidad: 15000, unidadMedida: 'Galones', alturaActual: 75.4, aforoFile: 'gasol 2/tabla-aforo-tanque-15000 gal.json' },
    { nombre: 'Tanque 6500 gasol 2 hidroblue', puntoVentaId: puntoVentaGasol2.id, productoId: hidroblue.id, capacidad: 6500, unidadMedida: 'Litros', alturaActual: 200, aforoFile: 'gasol 2/tabla-aforo-tanque-hidroblue.json' },
  ];

  for (const tanque of tanques) {
    // Cargar tabla de aforo para este tanque
    const aforoData = loadAforoData(tanque.aforoFile);

    // Calcular el nivel actual basado en la altura y la tabla de aforo
    let nivelActualCalculado = tanque.capacidad * 0.7; // valor por defecto
    if (aforoData.length > 0) {
      nivelActualCalculado = getVolumeFromAforo(aforoData, tanque.alturaActual);
      console.log(`📊 Tanque ${tanque.nombre}: Altura ${tanque.alturaActual} → Volumen ${nivelActualCalculado}`);
    }

    await prisma.tanque.upsert({
      where: {
        puntoVentaId_nombre: {
          puntoVentaId: tanque.puntoVentaId,
          nombre: tanque.nombre
        }
      },
      update: {},
      create: {
        nombre: tanque.nombre,
        capacidadTotal: tanque.capacidad,
        nivelActual: nivelActualCalculado,
        nivelMinimo: tanque.capacidad * 0.1, // 10% mínimo
        productoId: tanque.productoId,
        puntoVentaId: tanque.puntoVentaId,
        unidadMedida: tanque.unidadMedida,
        alturaActual: tanque.alturaActual,
      },
    });
  }


  console.log('✅ Tanques creados');

  // CREAR CARROTANQUES
  console.log('🚛 Creando carrotanques...');

  const carrotanques = [
    { nombre: 'Carrotanque compartimiento 1 SSY683', placa: 'SSY683-C1', capacidad: 3650, unidadMedida: 'Galones', conductor: 'Juan Pérez', empresa: 'Transportes Gasol' },
    { nombre: 'Carrotanque compartimiento 2 SSY683', placa: 'SSY683-C2', capacidad: 4250, unidadMedida: 'Galones', conductor: 'Juan Pérez', empresa: 'Transportes Gasol' },
    { nombre: 'Carrotanque compartimiento 3 SSY683', placa: 'SSY683-C3', capacidad: 3450, unidadMedida: 'Galones', conductor: 'Juan Pérez', empresa: 'Transportes Gasol' },
  ];

  for (const carrotanque of carrotanques) {
    await prisma.carrotanque.upsert({
      where: { placa: carrotanque.placa },
      update: {},
      create: {
        nombre: carrotanque.nombre,
        placa: carrotanque.placa,
        capacidadTotal: carrotanque.capacidad,
        nivelActual: carrotanque.capacidad * 0.8, // 80% lleno
        nivelMinimo: carrotanque.capacidad * 0.05, // 5% mínimo
        unidadMedida: carrotanque.unidadMedida,
        conductor: carrotanque.conductor,
        empresa: carrotanque.empresa,
      },
    });
  }

  console.log('✅ Carrotanques creados');

  // CREAR TABLAS DE AFORO PARA CADA TANQUE
  console.log('📊 Creando tablas de aforo...');

  // Mapeo de tanques a sus archivos de aforo correspondientes
  const tanqueAforoMapping = [
    {
      tanqueNombre: 'Tanque 5000G gasol 1 gasolina',
      aforoFile: 'gasol 1/tabla-aforo-tanque-5000gal.json'
    },
    {
      tanqueNombre: 'Tanque 15000 gasol 1 diesel',
      aforoFile: 'gasol 1/tabla-aforo-tanque-15000gal.json'
    },
    {
      tanqueNombre: 'Tanque 5000G gasol 2 gasolina',
      aforoFile: 'gasol 2/tabla-aforo-tanque-5000gal gasol 2.json'
    },
    {
      tanqueNombre: 'Tanque 15000 gasol 2 diesel',
      aforoFile: 'gasol 2/tabla-aforo-tanque-15000 gal.json'
    },
    {
      tanqueNombre: 'Tanque 6500 gasol 2 hidroblue',
      aforoFile: 'gasol 2/tabla-aforo-tanque-hidroblue.json'
    }
  ];

  // Mapeo de carrotanques a sus archivos de aforo correspondientes
  const carrotanqueAforoMapping = [
    {
      carrotanqueNombre: 'Carrotanque compartimiento 1 SSY683',
      aforoFile: 'carrotanque/tabla-aforo-tanque-compartiminto-1.json'
    },
    {
      carrotanqueNombre: 'Carrotanque compartimiento 2 SSY683',
      aforoFile: 'carrotanque/tabla-aforo-tanque-compartiminto-2.json'
    },
    {
      carrotanqueNombre: 'Carrotanque compartimiento 3 SSY683',
      aforoFile: 'carrotanque/tabla-aforo-tanque-compartiminto-3.json'
    }
  ];

  // Crear tablas de aforo para cada tanque
  for (const mapping of tanqueAforoMapping) {
    try {
      // Buscar el tanque en la base de datos
      const tanque = await prisma.tanque.findFirst({
        where: { nombre: mapping.tanqueNombre }
      });

      if (!tanque) {
        console.warn(`⚠️ No se encontró el tanque: ${mapping.tanqueNombre}`);
        continue;
      }

      // Cargar datos de aforo
      const aforoData = loadAforoData(mapping.aforoFile);

      if (aforoData.length === 0) {
        console.warn(`⚠️ No se encontraron datos de aforo para: ${mapping.tanqueNombre}`);
        continue;
      }

      console.log(`📈 Creando tabla de aforo para ${mapping.tanqueNombre} (${aforoData.length} registros)...`);

      // Borrar tabla de aforo existente para este tanque (si existe)
      await prisma.tablaAforo.deleteMany({
        where: { tanqueId: tanque.id }
      });

      // Crear registros de aforo en lotes para mejor rendimiento
      const batchSize = 100;
      for (let i = 0; i < aforoData.length; i += batchSize) {
        const batch = aforoData.slice(i, i + batchSize);
        await prisma.tablaAforo.createMany({
          data: batch.map(item => ({
            altura: item.altura,
            volumen: item.volumen,
            tanqueId: tanque.id
          }))
        });
      }

      console.log(`✅ Tabla de aforo creada para ${mapping.tanqueNombre}`);

    } catch (error) {
      console.error(`❌ Error creando tabla de aforo para ${mapping.tanqueNombre}:`, error);
    }
  }

  // Crear tablas de aforo para cada carrotanque
  for (const mapping of carrotanqueAforoMapping) {
    try {
      // Buscar el carrotanque en la base de datos
      const carrotanque = await prisma.carrotanque.findFirst({
        where: { nombre: mapping.carrotanqueNombre }
      });

      if (!carrotanque) {
        console.warn(`⚠️ No se encontró el carrotanque: ${mapping.carrotanqueNombre}`);
        continue;
      }

      // Cargar datos de aforo
      const aforoData = loadAforoData(mapping.aforoFile);

      if (aforoData.length === 0) {
        console.warn(`⚠️ No se encontraron datos de aforo para: ${mapping.carrotanqueNombre}`);
        continue;
      }

      console.log(`📈 Creando tabla de aforo para ${mapping.carrotanqueNombre} (${aforoData.length} registros)...`);

      // Borrar tabla de aforo existente para este carrotanque (si existe)
      await prisma.tablaAforoCarrotanque.deleteMany({
        where: { carrotanqueId: carrotanque.id }
      });

      // Crear registros de aforo en lotes para mejor rendimiento
      const batchSize = 100;
      for (let i = 0; i < aforoData.length; i += batchSize) {
        const batch = aforoData.slice(i, i + batchSize);
        await prisma.tablaAforoCarrotanque.createMany({
          data: batch.map(item => ({
            altura: item.altura,
            volumen: item.volumen,
            carrotanqueId: carrotanque.id
          }))
        });
      }

      console.log(`✅ Tabla de aforo creada para ${mapping.carrotanqueNombre}`);

    } catch (error) {
      console.error(`❌ Error creando tabla de aforo para ${mapping.carrotanqueNombre}:`, error);
    }
  }

  console.log('✅ Tablas de aforo creadas');

  // 8. CREAR SURTIDORES Y MANGUERAS
  console.log('🚗 Creando surtidores y mangueras...');

  const surtidores = [
    // Surtidores Punto de Venta gasol 1
    {
      numero: 'S-001',
      nombre: 'Surtidor Principal 1',
      puntoVentaId: puntoVentaGasol1.id,
      mangueras: [
        { numero: '1', color: 'Amarillo', productoId: dieselGasol1.id, activo: true, lecturaActual: 0 },
        { numero: '2', color: 'Rojo', productoId: gasolina90Gasol1.id, activo: true, lecturaActual: 0 },
        { numero: '3', color: 'Amarillo', productoId: dieselGasol1.id, activo: true, lecturaActual: 0 },
        { numero: '4', color: 'Rojo', productoId: gasolina90Gasol1.id, activo: true, lecturaActual: 0 },
      ],
      activo: false,
    },
    {
      numero: 'S-002',
      nombre: 'Surtidor Principal 2',
      puntoVentaId: puntoVentaGasol1.id,
      mangueras: [
        { numero: '1', color: 'Amarillo', productoId: dieselGasol1.id, activo: true, lecturaActual: 0 },
        { numero: '2', color: 'Rojo', productoId: gasolina90Gasol1.id, activo: true, lecturaActual: 0 },
        { numero: '3', color: 'Amarillo', productoId: dieselGasol1.id, activo: true, lecturaActual: 0 },
        { numero: '4', color: 'Rojo', productoId: gasolina90Gasol1.id, activo: true, lecturaActual: 0 },
      ],
      activo: false,
    },

    // Surtidores Punto de Venta gasol 1 (continuación)
    {
      numero: 'S-003',
      nombre: 'Surtidor Principal 3',
      puntoVentaId: puntoVentaGasol1.id,
      mangueras: [
        { numero: '1', color: 'Amarillo', productoId: dieselGasol1.id, activo: true, lecturaActual: 58528.40 },
        { numero: '2', color: 'Rojo', productoId: gasolina90Gasol1.id, activo: true, lecturaActual: 28304.93 },
        { numero: '3', color: 'Amarillo', productoId: dieselGasol1.id, activo: true, lecturaActual: 52787.89 },
        { numero: '4', color: 'Rojo', productoId: gasolina90Gasol1.id, activo: true, lecturaActual: 44744.04 },
      ]
    },
    {
      numero: 'S-004',
      nombre: 'Surtidor Principal 4',
      puntoVentaId: puntoVentaGasol1.id,
      mangueras: [
        { numero: '1', color: 'Amarillo', productoId: dieselGasol1.id, activo: true, lecturaActual: 272117.94 },
        { numero: '2', color: 'Rojo', productoId: gasolina90Gasol1.id, activo: false, lecturaActual: 0 },
        { numero: '3', color: 'Amarillo', productoId: dieselGasol1.id, activo: true, lecturaActual: 264990.48 },
        { numero: '4', color: 'Rojo', productoId: gasolina90Gasol1.id, activo: false, lecturaActual: 0 },
      ]
    },
    {
      numero: 'S-001',
      nombre: 'Surtidor Principal 1',
      puntoVentaId: puntoVentaGasol2.id,
      mangueras: [
        { numero: '1', color: 'Amarillo', productoId: dieselGasol2.id, activo: true, lecturaActual: 0 },
        { numero: '2', color: 'Rojo', productoId: gasolina90Gasol2.id, activo: true, lecturaActual: 0 },
        { numero: '3', color: 'Amarillo', productoId: dieselGasol2.id, activo: true, lecturaActual: 0 },
        { numero: '4', color: 'Rojo', productoId: gasolina90Gasol2.id, activo: true, lecturaActual: 0 },
      ],
      activo: false,
    },
    {
      numero: 'S-002',
      nombre: 'Surtidor Principal 2',
      puntoVentaId: puntoVentaGasol2.id,
      mangueras: [
        { numero: '1', color: 'Amarillo', productoId: dieselGasol2.id, activo: true, lecturaActual: 0 },
        { numero: '2', color: 'Rojo', productoId: gasolina90Gasol2.id, activo: true, lecturaActual: 0 },
        { numero: '3', color: 'Amarillo', productoId: dieselGasol2.id, activo: true, lecturaActual: 0 },
        { numero: '4', color: 'Rojo', productoId: gasolina90Gasol2.id, activo: true, lecturaActual: 0 },
      ],
      activo: false,
    },
    {
      numero: 'S-003',
      nombre: 'Surtidor Principal 3',
      puntoVentaId: puntoVentaGasol2.id,
      mangueras: [
        { numero: '1', color: 'Amarillo', productoId: dieselGasol2.id, activo: true, lecturaActual: 59592.13 },
        { numero: '2', color: 'Rojo', productoId: gasolina90Gasol2.id, activo: true, lecturaActual: 25589.40 },
        { numero: '3', color: 'Amarillo', productoId: dieselGasol2.id, activo: true, lecturaActual: 49918.91 },
        { numero: '4', color: 'Rojo', productoId: gasolina90Gasol2.id, activo: true, lecturaActual: 37871.68 },
      ],
      activo: true,
    },
    {
      numero: 'S-004',
      nombre: 'Surtidor Principal 4',
      puntoVentaId: puntoVentaGasol2.id,
      mangueras: [
        { numero: '1', color: 'Amarillo', productoId: dieselGasol2.id, activo: true, lecturaActual: 311834.88 },
        { numero: '2', color: 'Rojo', productoId: gasolina90Gasol2.id, activo: false, lecturaActual: 0 },
        { numero: '3', color: 'Amarillo', productoId: dieselGasol2.id, activo: true, lecturaActual: 254251.97 },
        { numero: '4', color: 'Rojo', productoId: gasolina90Gasol2.id, activo: false, lecturaActual: 0 },
      ],
      activo: true,
    },
    {
      numero: 'S-005',
      nombre: 'Surtidor Hidroblue',
      puntoVentaId: puntoVentaGasol2.id,
      mangueras: [
        { numero: '1', color: 'Azul', productoId: hidroblue.id, activo: true, lecturaActual: 17117.3 },
      ],
      activo: true,
    }
  ];

  for (const surtidor of surtidores) {
    const createdSurtidor = await prisma.surtidor.upsert({
      where: {
        puntoVentaId_numero: {
          puntoVentaId: surtidor.puntoVentaId,
          numero: surtidor.numero
        }
      },
      update: {},
      create: {
        numero: surtidor.numero,
        nombre: surtidor.nombre,
        descripcion: `Surtidor ${surtidor.numero}`,
        ubicacion: 'Zona de despacho',
        activo: surtidor.activo,
        cantidadMangueras: surtidor.mangueras.length,
        fechaInstalacion: new Date('2020-01-01'),
        puntoVentaId: surtidor.puntoVentaId,
      },
    });

    // Crear mangueras para cada surtidor
    for (const manguera of surtidor.mangueras) {
      await prisma.mangueraSurtidor.upsert({
        where: {
          surtidorId_numero: {
            surtidorId: createdSurtidor.id,
            numero: manguera.numero
          }
        },
        update: {},
        create: {
          numero: manguera.numero,
          color: manguera.color,
          lecturaAnterior: 0,
          lecturaActual: manguera.lecturaActual,
          activo: manguera.activo,
          surtidorId: createdSurtidor.id,
          productoId: manguera.productoId,
        },
      });
    }
  }

  console.log('✅ Surtidores y mangueras creados');

  // 9. CREAR CLIENTES DE EJEMPLO
  console.log('👥 Creando clientes de ejemplo...');

  const clienteEjemplo = await prisma.cliente.upsert({
    where: { numeroDocumento: '12345678' },
    update: {},
    create: {
      tipoDocumento: 'DNI',
      numeroDocumento: '12345678',
      nombre: 'Juan Carlos',
      apellido: 'Pérez González',
      email: 'juancarlos.perez@email.com',
      telefono: '987654321',
      direccion: 'Av. Ejemplo 123',
    },
  });

  const clienteEmpresa = await prisma.cliente.upsert({
    where: { numeroDocumento: '20123456789' },
    update: {},
    create: {
      tipoDocumento: 'RUC',
      numeroDocumento: '20123456789',
      nombre: 'Empresa',
      razonSocial: 'Transportes Rápidos S.A.C.',
      email: 'empresa@transportesrapidos.com',
      telefono: '01-2345678',
      direccion: 'Av. Industrial 456',
    },
  });

  console.log('✅ Clientes creados');

  // 11. CREAR INVENTARIO ACTUAL
  console.log('📊 Creando inventario actual...');

  const inventarioData = [
    // Inventario Principal
    { puntoVentaId: puntoVentaGasol1.id, productoId: gasolina90Gasol1.id, stockActual: 5000, precio: 15900 },
    { puntoVentaId: puntoVentaGasol1.id, productoId: dieselGasol1.id, stockActual: 4000, precio: 14300 },
    { puntoVentaId: puntoVentaGasol1.id, productoId: gasolina90Gasol1.id, stockActual: 6000, precio: 14990 },

    // Inventario Punto de Venta gasol 2
    { puntoVentaId: puntoVentaGasol2.id, productoId: gasolina90Gasol2.id, stockActual: 3500, precio: 15900 },
    { puntoVentaId: puntoVentaGasol2.id, productoId: dieselGasol2.id, stockActual: 2800, precio: 14300 },
    { puntoVentaId: puntoVentaGasol2.id, productoId: gasolina90Gasol2.id, stockActual: 4200, precio: 14990 },
    { puntoVentaId: puntoVentaGasol2.id, productoId: hidroblue.id, stockActual: 200, precio: 7500 },
  ];

  for (const inventario of inventarioData) {
    await prisma.inventarioActual.upsert({
      where: {
        puntoVentaId_productoId: {
          puntoVentaId: inventario.puntoVentaId,
          productoId: inventario.productoId
        }
      },
      update: {},
      create: {
        stockActual: inventario.stockActual,
        valorInventario: inventario.stockActual * inventario.precio, // Calcular valor total
        fechaActualizacion: new Date(),
        puntoVentaId: inventario.puntoVentaId,
        productoId: inventario.productoId,
      },
    });
  }

  console.log('✅ Inventario actual creado');

  // 12. CREAR MÉTODOS DE PAGO
  console.log('💳 Creando métodos de pago...');

  const metodosPago = [
    {
      codigo: 'EFECTIVO',
      nombre: 'Efectivo',
      descripcion: 'Pago en efectivo',
      esEfectivo: true,
      esTarjeta: false,
      esDigital: false,
      orden: 1
    },
    {
      codigo: 'TARJETA_CREDITO',
      nombre: 'Tarjeta de Crédito',
      descripcion: 'Pago con tarjeta de crédito',
      esEfectivo: false,
      esTarjeta: true,
      esDigital: false,
      orden: 2
    },
    {
      codigo: 'TARJETA_DEBITO',
      nombre: 'Tarjeta de Débito',
      descripcion: 'Pago con tarjeta de débito',
      esEfectivo: false,
      esTarjeta: true,
      esDigital: false,
      orden: 3
    },
    {
      codigo: 'TRANSFERENCIA',
      nombre: 'Transferencia Bancaria',
      descripcion: 'Pago por transferencia bancaria',
      esEfectivo: false,
      esTarjeta: false,
      esDigital: true,
      orden: 4
    },
    {
      codigo: 'NEQUI',
      nombre: 'Nequi',
      descripcion: 'Pago con billetera digital Nequi',
      esEfectivo: false,
      esTarjeta: false,
      esDigital: true,
      orden: 5
    },
    {
      codigo: 'DAVIPLATA',
      nombre: 'Daviplata',
      descripcion: 'Pago con billetera digital Daviplata',
      esEfectivo: false,
      esTarjeta: false,
      esDigital: true,
      orden: 6
    },
    {
      codigo: 'PSE',
      nombre: 'PSE',
      descripcion: 'Pago Seguro en Línea (PSE)',
      esEfectivo: false,
      esTarjeta: false,
      esDigital: true,
      orden: 7
    },
    {
      codigo: 'CHEQUE',
      nombre: 'Cheque',
      descripcion: 'Pago con cheque',
      esEfectivo: false,
      esTarjeta: false,
      esDigital: false,
      orden: 8
    }
    ,
    {
      codigo: 'Rumbo',
      nombre: 'Rumbo',
      descripcion: 'Pago con Rumbo',
      esEfectivo: false,
      esTarjeta: false,
      esDigital: false,
      orden: 9
    },
    {
      codigo: 'Regalo',
      nombre: 'Regalo',
      descripcion: 'Pago con Regalo',
      esEfectivo: false,
      esTarjeta: false,
      esDigital: false,
      orden: 9
    },
    {
      codigo: 'Bonos vive terpel',
      nombre: 'Bonos vive terpel',
      descripcion: 'Pago con Bonos vive terpel',
      esEfectivo: false,
      esTarjeta: false,
      esDigital: false,
      orden: 10
    }
  ];

  for (const metodoPago of metodosPago) {
    await prisma.metodoPago.upsert({
      where: { codigo: metodoPago.codigo },
      update: {},
      create: {
        codigo: metodoPago.codigo,
        nombre: metodoPago.nombre,
        descripcion: metodoPago.descripcion,
        activo: true,
        esEfectivo: metodoPago.esEfectivo,
        esTarjeta: metodoPago.esTarjeta,
        esDigital: metodoPago.esDigital,
        orden: metodoPago.orden
      }
    });
  }

  console.log('✅ Métodos de pago creados');

  // 13. CREAR CAJAS PARA CADA PUNTO DE VENTA
  console.log('💰 Creando cajas para cada punto de venta...');

  const cajaGasol1 = await prisma.caja.upsert({
    where: { puntoVentaId: puntoVentaGasol1.id },
    update: {},
    create: {
      puntoVentaId: puntoVentaGasol1.id,
      saldoActual: 7722952.55,
      saldoInicial: 7722952.55,
      activa: true,
      observaciones: 'Caja inicial para Gasol 1',
    },
  });

  const cajaGasol2 = await prisma.caja.upsert({
    where: { puntoVentaId: puntoVentaGasol2.id },
    update: {},
    create: {
      puntoVentaId: puntoVentaGasol2.id,
      saldoActual: 5238965.91,
      saldoInicial: 5238965.91,
      activa: true,
      observaciones: 'Caja inicial para Gasol 2',
    },
  });

  console.log('✅ Cajas creadas para cada punto de venta');

  // ==========================================
  // CATEGORÍAS DE GASTOS
  // ==========================================
  console.log('\n💸 Creando categorías de gastos...');

  const categoriasGastos = [
    {
      nombre: 'Nómina',
      descripcion: 'Sueldos y salarios de empleados',
    },
    {
      nombre: 'Seguridad Social',
      descripcion: 'Aportes a seguridad social (EPS, AFP, ARL)',
    },
    {
      nombre: 'Proveedores',
      descripcion: 'Pago a proveedores de productos y combustible',
    },
    {
      nombre: 'Servicios Públicos',
      descripcion: 'Agua, luz, gas, internet, teléfono',
    },
    {
      nombre: 'Mantenimiento',
      descripcion: 'Reparaciones y mantenimiento de equipos',
    },
    {
      nombre: 'Transporte',
      descripcion: 'Gastos de transporte y combustible administrativo',
    },
    {
      nombre: 'Arriendo',
      descripcion: 'Pago de arriendo del local',
    },
    {
      nombre: 'Impuestos',
      descripcion: 'Impuestos, tasas y contribuciones',
    },
    {
      nombre: 'Marketing',
      descripcion: 'Publicidad y promoción',
    },
    {
      nombre: 'Seguros',
      descripcion: 'Pólizas de seguro',
    },
    {
      nombre: 'Papelería y Suministros',
      descripcion: 'Material de oficina y suministros',
    },
    {
      nombre: 'Otros Gastos',
      descripcion: 'Otros gastos operacionales',
    },
  ];

  for (const catGasto of categoriasGastos) {
    await prisma.categoriaGasto.upsert({
      where: { nombre: catGasto.nombre },
      update: {},
      create: catGasto,
    });
  }

  console.log('✅ Categorías de gastos creadas');

  console.log('\n🎉 Seed completo ejecutado exitosamente!');
  console.log('\n📋 RESUMEN DE DATOS CREADOS:');
  console.log(`🏢 Empresas: ${empresaPrincipal.nombre}`);
  console.log(`🏪 Puntos de Venta: 2 (Gasol 1, Gasol 2)`);
  console.log(`👥 Usuarios: 5 con diferentes roles y relaciones`);
  console.log(`📦 Categorías: 4 (Combustibles, Lubricantes, Tienda, Aditivos)`);
  console.log(`🛍️ Productos: 17 productos creados`);
  console.log(`   - 4 Combustibles (Gasolina 95, Gasolina 90, Diesel, Hidroblue)`);
  console.log(`   - 4 Productos de Tienda (Coca Cola, Agua, Jugo de Piña, Galletas)`);
  console.log(`   - 3 Lubricantes (Aceite 20W50 Galón, Aceite 20W50 1L, Aceite Diferencial)`);
  console.log(`   - 6 Aditivos (Limpiador Gasolina, Limpiador Diesel, Sellador Fugas, Limpiavidrios, Refrigerante)`);
  console.log(`⛽ Tanques: 5 distribuidos en todos los puntos de venta`);
  console.log(`🚛 Carrotanques: 3 con placas SSY683-C1, SSY683-C2, SSY683-C3`);
  console.log(`📊 Tablas de Aforo: Configuradas para todos los tanques y carrotanques`);
  console.log(`🚗 Surtidores: 9 con múltiples mangueras`);
  console.log(`🕐 Turnos: 3 de ejemplo (2 activos, 1 completado)`);
  console.log(`📈 Inventario: Configurado para todos los puntos de venta`);
  console.log(`💳 Métodos de Pago: 8 métodos configurados (Efectivo, Tarjetas, Digitales)`);
  console.log(`💸 Categorías de Gastos: 12 categorías (Nómina, Proveedores, Servicios, etc.)`);

  console.log('\n💰 EJEMPLOS DE PRECIOS (COP):');
  console.log('🏪 Tienda:');
  console.log('   - Coca Cola 350ml: $2,500 → $4,000 (60% ganancia)');
  console.log('   - Agua 600ml: $1,200 → $2,500 (108% ganancia)');
  console.log('   - Jugo de Piña: $1,800 → $3,200 (78% ganancia)');
  console.log('🛢️ Lubricantes:');
  console.log('   - Aceite 20W50 Galón: $45,000 → $65,000 (44% ganancia)');
  console.log('   - Aceite 20W50 1L: $12,000 → $18,000 (50% ganancia)');
  console.log('⚗️ Aditivos:');
  console.log('   - Limpiador Gasolina: $8,500 → $15,000 (76% ganancia)');
  console.log('   - Refrigerante: $18,000 → $28,000 (56% ganancia)');

  console.log('\n🔑 CREDENCIALES DE ACCESO:');
  console.log('📧 Admin: admin@estacion.com | 🔑 Contraseña: admin123');
  console.log('📧 Gerente: gerente@estacion.com | 🔑 Contraseña: manager123');
  console.log('📧 Supervisor: supervisor@estacion.com | 🔑 Contraseña: admin123');
  console.log('📧 Empleado Principal: empleado.principal@estacion.com | 🔑 Contraseña: empleado123');
  console.log('📧 Empleado Norte: empleado.norte@estacion.com | 🔑 Contraseña: empleado123');
}

main()
  .catch((e) => {
    console.error('❌ Error durante el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 
