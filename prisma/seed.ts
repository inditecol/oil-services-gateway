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
    update: {
      empresaId: empresaPrincipal.id,
      puntosVenta: {
        set: [
          { id: puntoVentaGasol1.id },
          { id: puntoVentaGasol2.id },
        ]
      },
    },
    create: {
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
    update: {
      empresaId: empresaPrincipal.id,
      puntosVenta: {
        set: [
          { id: puntoVentaGasol1.id },
          { id: puntoVentaGasol2.id }
        ]
      },
    },
    create: {
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
    update: {
      empresaId: empresaPrincipal.id,
      puntosVenta: {
        set: [
          { id: puntoVentaGasol1.id },
          { id: puntoVentaGasol2.id }
        ]
      },
    },
    create: {
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

  // Empleado solo del punto de venta principal
  const empleadoPrincipal = await prisma.usuario.upsert({
    where: { email: 'empleado.principal@estacion.com' },
    update: {
      empresaId: empresaPrincipal.id,
      puntosVenta: {
        set: [{ id: puntoVentaGasol1.id }]
      },
    },
    create: {
      email: 'empleado.principal@estacion.com',
      username: 'empleado_principal',
      password: employeeHashedPassword,
      nombre: 'Juan',
      apellido: 'Pérez',
      telefono: '965432109',
      emailVerified: true,
      rolId: employeeRole.id,
      empresaId: empresaPrincipal.id,
      puntosVenta: {
        connect: [{ id: puntoVentaGasol1.id }, { id: puntoVentaGasol2.id }]
      },
    },
  });

  // Empleado solo del punto de venta norte
  const empleadoNorte = await prisma.usuario.upsert({
    where: { email: 'empleado.norte@estacion.com' },
    update: {
      empresaId: empresaPrincipal.id,
      puntosVenta: {
        set: [{ id: puntoVentaGasol1.id }, { id: puntoVentaGasol2.id }]
      },
    },
    create: {
      email: 'empleado.norte@estacion.com',
      username: 'empleado_norte',
      password: employeeHashedPassword,
      nombre: 'Ana',
      apellido: 'García',
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

  const gasolina95 = await prisma.producto.upsert({
    where: { codigo: 'GASOL-95' },
    update: {},
    create: {
      codigo: 'GASOL-95',
      nombre: 'Gasolina 95 Octanos',
      descripcion: 'Gasolina sin plomo 95 octanos premium',
      unidadMedida: 'Galones',
      precioCompra: 12500, // Precio de compra en COP
      precioVenta: 15900,  // Precio de venta en COP  
      moneda: 'COP',
      stockMinimo: 1000,
      stockActual: 5000,
      esCombustible: true,
      categoriaId: combustibleCategory.id,
    },
  });

  const diesel = await prisma.producto.upsert({
    where: { codigo: 'DIESEL' },
    update: {},
    create: {
      codigo: 'DIESEL',
      nombre: 'Diesel B5',
      descripcion: 'Diesel con 5% de biodiesel',
      unidadMedida: 'Galones',
      precioCompra: 11200, // Precio de compra en COP
      precioVenta: 14300,  // Precio de venta en COP
      moneda: 'COP',
      stockMinimo: 800,
      stockActual: 4000,
      esCombustible: true,
      categoriaId: combustibleCategory.id,
    },
  });

  const gasolina90 = await prisma.producto.upsert({
    where: { codigo: 'GASOL-90' },
    update: {},
    create: {
      codigo: 'GASOL-90',
      nombre: 'Gasolina 90 Octanos',
      descripcion: 'Gasolina sin plomo 90 octanos',
      unidadMedida: 'Galones',
      precioCompra: 11800, // Precio de compra en COP
      precioVenta: 14990,  // Precio de venta en COP
      moneda: 'COP',
      stockMinimo: 1200,
      stockActual: 6000,
      esCombustible: true,
      categoriaId: combustibleCategory.id,
    },
  });

  const hidroblue = await prisma.producto.upsert({
    where: { codigo: 'HIDROBLUE' },
    update: {},
    create: {
      codigo: 'HIDROBLUE',
      nombre: 'Hidroblue (AdBlue)',
      descripcion: 'Líquido reductor de emisiones para motores diesel',
      unidadMedida: 'Litros',
      precioCompra: 5200,  // Precio de compra en COP
      precioVenta: 7500,   // Precio de venta en COP
      moneda: 'COP',
      stockMinimo: 50,
      stockActual: 200,
      esCombustible: false,
      categoriaId: combustibleCategory.id,
    },
  });

  // PRODUCTOS DE TIENDA
  console.log('🏪 Creando productos de tienda...');

  const cocaCola350 = await prisma.producto.upsert({
    where: { codigo: 'COCA-350' },
    update: {},
    create: {
      codigo: 'COCA-350',
      nombre: 'Coca Cola 350ml',
      descripcion: 'Bebida gaseosa Coca Cola presentación 350ml',
      unidadMedida: 'Unidades',
      precioCompra: 2500,  // Precio de compra en COP
      precioVenta: 4000,   // Precio de venta en COP
      moneda: 'COP',
      stockMinimo: 50,
      stockActual: 120,    // Stock inicial
      esCombustible: false,
      categoriaId: tiendaCategory.id,
    },
  });

  const agua600 = await prisma.producto.upsert({
    where: { codigo: 'AGUA-600' },
    update: {},
    create: {
      codigo: 'AGUA-600',
      nombre: 'Agua Natural 600ml',
      descripcion: 'Agua purificada embotellada 600ml',
      unidadMedida: 'Unidades',
      precioCompra: 1200,  // Precio de compra en COP
      precioVenta: 2500,   // Precio de venta en COP
      moneda: 'COP',
      stockMinimo: 100,
      stockActual: 200,    // Stock inicial
      esCombustible: false,
      categoriaId: tiendaCategory.id,
    },
  });

  const jugoPiña = await prisma.producto.upsert({
    where: { codigo: 'JUGO-PINA-250' },
    update: {},
    create: {
      codigo: 'JUGO-PINA-250',
      nombre: 'Jugo de Piña 250ml',
      descripcion: 'Jugo natural de piña presentación 250ml',
      unidadMedida: 'Unidades',
      precioCompra: 1800,
      precioVenta: 3200,
      moneda: 'COP',
      stockMinimo: 30,
      stockActual: 80,
      esCombustible: false,
      categoriaId: tiendaCategory.id,
    },
  });

  const galletas = await prisma.producto.upsert({
    where: { codigo: 'GALLETAS-CHOCO' },
    update: {},
    create: {
      codigo: 'GALLETAS-CHOCO',
      nombre: 'Galletas de Chocolate',
      descripcion: 'Galletas rellenas de chocolate - paquete individual',
      unidadMedida: 'Unidades',
      precioCompra: 1500,
      precioVenta: 2800,
      moneda: 'COP',
      stockMinimo: 40,
      stockActual: 100,
      esCombustible: false,
      categoriaId: tiendaCategory.id,
    },
  });

  // LUBRICANTES
  console.log('🛢️ Creando lubricantes...');

  const aceite20W50 = await prisma.producto.upsert({
    where: { codigo: 'ACEITE-20W50-GAL' },
    update: {},
    create: {
      codigo: 'ACEITE-20W50-GAL',
      nombre: 'Aceite Motor 20W50 Galón',
      descripcion: 'Aceite para motor multigrado 20W50 presentación galón',
      unidadMedida: 'Galones',
      precioCompra: 45000,
      precioVenta: 65000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 24,
      esCombustible: false,
      categoriaId: lubricantesCategory.id,
    },
  });

  const aceite20W50Litro = await prisma.producto.upsert({
    where: { codigo: 'ACEITE-20W50-1L' },
    update: {},
    create: {
      codigo: 'ACEITE-20W50-1L',
      nombre: 'Aceite Motor 20W50 1 Litro',
      descripcion: 'Aceite para motor multigrado 20W50 presentación 1 litro',
      unidadMedida: 'Litros',
      precioCompra: 12000,
      precioVenta: 18000,
      moneda: 'COP',
      stockMinimo: 20,
      stockActual: 48,
      esCombustible: false,
      categoriaId: lubricantesCategory.id,
    },
  });

  const aceiteDiferencial = await prisma.producto.upsert({
    where: { codigo: 'ACEITE-DIFERENCIAL' },
    update: {},
    create: {
      codigo: 'ACEITE-DIFERENCIAL',
      nombre: 'Aceite para Diferencial 80W90',
      descripcion: 'Aceite para diferenciales y transmisiones manuales',
      unidadMedida: 'Litros',
      precioCompra: 15000,
      precioVenta: 22000,
      moneda: 'COP',
      stockMinimo: 15,
      stockActual: 30,
      esCombustible: false,
      categoriaId: lubricantesCategory.id,
    },
  });

  // ADITIVOS
  console.log('⚗️ Creando aditivos...');

  const aditivoGasolina = await prisma.producto.upsert({
    where: { codigo: 'ADITIVO-GASOL' },
    update: {},
    create: {
      codigo: 'ADITIVO-GASOL',
      nombre: 'Aditivo Limpiador de Gasolina',
      descripcion: 'Aditivo limpiador de inyectores para gasolina - 250ml',
      unidadMedida: 'Unidades',
      precioCompra: 8500,
      precioVenta: 15000,
      moneda: 'COP',
      stockMinimo: 20,
      stockActual: 40,
      esCombustible: false,
      categoriaId: aditivosCategory.id,
    },
  });

  const aditivoDiesel = await prisma.producto.upsert({
    where: { codigo: 'ADITIVO-DIESEL' },
    update: {},
    create: {
      codigo: 'ADITIVO-DIESEL',
      nombre: 'Aditivo Limpiador de Diesel',
      descripcion: 'Aditivo limpiador de inyectores para diesel - 250ml',
      unidadMedida: 'Unidades',
      precioCompra: 9200,
      precioVenta: 16500,
      moneda: 'COP',
      stockMinimo: 15,
      stockActual: 35,
      esCombustible: false,
      categoriaId: aditivosCategory.id,
    },
  });

  const selladorFugas = await prisma.producto.upsert({
    where: { codigo: 'SELLADOR-FUGAS' },
    update: {},
    create: {
      codigo: 'SELLADOR-FUGAS',
      nombre: 'Sellador de Fugas de Aceite',
      descripcion: 'Sellador para fugas menores de aceite del motor - 354ml',
      unidadMedida: 'Unidades',
      precioCompra: 12000,
      precioVenta: 20000,
      moneda: 'COP',
      stockMinimo: 10,
      stockActual: 25,
      esCombustible: false,
      categoriaId: aditivosCategory.id,
    },
  });

  const limpiavidrios = await prisma.producto.upsert({
    where: { codigo: 'LIMPIAVIDRIOS' },
    update: {},
    create: {
      codigo: 'LIMPIAVIDRIOS',
      nombre: 'Limpiavidrios Concentrado',
      descripcion: 'Líquido limpiavidrios concentrado para dilución - 500ml',
      unidadMedida: 'Unidades',
      precioCompra: 3500,
      precioVenta: 6500,
      moneda: 'COP',
      stockMinimo: 25,
      stockActual: 60,
      esCombustible: false,
      categoriaId: aditivosCategory.id,
    },
  });

  const refrigerante = await prisma.producto.upsert({
    where: { codigo: 'REFRIGERANTE' },
    update: {},
    create: {
      codigo: 'REFRIGERANTE',
      nombre: 'Refrigerante Anticongelante',
      descripcion: 'Refrigerante anticongelante para radiador - 1 galón',
      unidadMedida: 'Galones',
      precioCompra: 18000,
      precioVenta: 28000,
      moneda: 'COP',
      stockMinimo: 12,
      stockActual: 20,
      esCombustible: false,
      categoriaId: aditivosCategory.id,
    },
  });

  console.log('✅ Productos de tienda, lubricantes y aditivos creados');

  // 7. CREAR TANQUES PARA CADA PUNTO DE VENTA
  console.log('⛽ Creando tanques...');

  const tanques = [
    // Tanques Punto de Venta gasol 1
    { nombre: 'Tanque 5000G gasol 1 gasolina', puntoVentaId: puntoVentaGasol1.id, productoId: gasolina95.id, capacidad: 5000, unidadMedida: 'Galones' },
    { nombre: 'Tanque 15000 gasol 1 diesel', puntoVentaId: puntoVentaGasol1.id, productoId: diesel.id, capacidad: 15000, unidadMedida: 'Galones' },
  
    // Tanques Punto de Venta gasol 2
    { nombre: 'Tanque 5000G gasol 2 gasolina', puntoVentaId: puntoVentaGasol2.id, productoId: gasolina95.id, capacidad: 5000, unidadMedida: 'Galones' },
    { nombre: 'Tanque 15000 gasol 2 diesel', puntoVentaId: puntoVentaGasol2.id, productoId: diesel.id, capacidad: 15000, unidadMedida: 'Galones' },
    { nombre: 'Tanque 6500 gasol 2 hidroblue', puntoVentaId: puntoVentaGasol2.id, productoId: hidroblue.id, capacidad: 6500, unidadMedida: 'Litros' },
  ];

  for (const tanque of tanques) {
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
        nivelActual: tanque.capacidad * 0.7, // 70% lleno
        nivelMinimo: tanque.capacidad * 0.1, // 10% mínimo
        productoId: tanque.productoId,
        puntoVentaId: tanque.puntoVentaId,
        unidadMedida: tanque.unidadMedida,
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

  // Función helper para cargar archivos JSON de aforo
  function loadAforoData(filePath: string): Array<{altura: number, volumen: number}> {
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
    // Surtidores Punto de Venta Principal
    {
      numero: 'S-001',
      nombre: 'Surtidor Principal 1',
      puntoVentaId: puntoVentaGasol1.id,
      mangueras: [
        { numero: '1', color: 'Rojo', productoId: gasolina95.id },
        { numero: '2', color: 'Amarillo', productoId: diesel.id },
      ]
    },
    {
      numero: 'S-002',
      nombre: 'Surtidor Principal 2',
      puntoVentaId: puntoVentaGasol1.id,
      mangueras: [
        { numero: '3', color: 'Rojo', productoId: gasolina95.id },
        { numero: '4', color: 'Amarillo', productoId: diesel.id },
      ]
    },

    // Surtidores Punto de Venta Norte
    {
      numero: 'S-003',
      nombre: 'Surtidor Principal 3',
      puntoVentaId: puntoVentaGasol1.id,
      mangueras: [
        { numero: '5', color: 'Rojo', productoId: gasolina95.id },
        { numero: '6', color: 'Amarillo', productoId: diesel.id },
      ]
    },
    {
      numero: 'S-004',
      nombre: 'Surtidor Principal 4',
      puntoVentaId: puntoVentaGasol1.id,
      mangueras: [
        { numero: '7', color: 'Rojo', productoId: gasolina95.id },
        { numero: '8', color: 'Amarillo', productoId: diesel.id },
      ]
    },
    {
      numero: 'S-005',
      nombre: 'Surtidor Principal 5',
      puntoVentaId: puntoVentaGasol2.id,
      mangueras: [
        { numero: '7', color: 'Rojo', productoId: gasolina95.id },
        { numero: '8', color: 'Amarillo', productoId: diesel.id },
      ]
    },
    {
      numero: 'S-006',
      nombre: 'Surtidor Principal 6',
      puntoVentaId: puntoVentaGasol2.id,
      mangueras: [
        { numero: '7', color: 'Rojo', productoId: gasolina95.id },
        { numero: '8', color: 'Amarillo', productoId: diesel.id },
      ]
    },
    {
      numero: 'S-007',
      nombre: 'Surtidor Principal 7',
      puntoVentaId: puntoVentaGasol2.id,
      mangueras: [
        { numero: '7', color: 'Rojo', productoId: gasolina95.id },
        { numero: '8', color: 'Amarillo', productoId: diesel.id },
      ]
    },
    {
      numero: 'S-008',
      nombre: 'Surtidor Principal 8',
      puntoVentaId: puntoVentaGasol2.id,
      mangueras: [
        { numero: '9', color: 'Rojo', productoId: gasolina95.id },
        { numero: '10', color: 'Amarillo', productoId: diesel.id },
      ]
    },
    { 
      numero: 'S-009', 
      nombre: 'Surtidor Principal 9', 
      puntoVentaId: puntoVentaGasol2.id,
      mangueras: [
        { numero: '11', color: 'Azul', productoId: hidroblue.id },
      ]
    },
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
          lecturaActual: Math.floor(Math.random() * 50000) + 10000, // Lectura aleatoria
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

  // 10. CREAR TURNOS DE EJEMPLO
  console.log('🕐 Creando turnos de ejemplo...');

  const ahora = new Date();
  const ayer = new Date(ahora);
  ayer.setDate(ayer.getDate() - 1);

  const turnoActual = await prisma.turno.create({
    data: {
      fechaInicio: ahora,
      fechaFin: null,
      horaInicio: '08:00',
      horaFin: null,
      observaciones: 'Turno matutino en curso',
      activo: true,
      usuarioId: empleadoPrincipal.id,
      puntoVentaId: puntoVentaGasol1.id,
    },
  });

  const turnoCompletado = await prisma.turno.create({
    data: {
      fechaInicio: ayer,
      fechaFin: ayer,
      horaInicio: '08:00',
      horaFin: '16:00',
      observaciones: 'Turno matutino completado',
      activo: false,
      usuarioId: empleadoNorte.id,
      puntoVentaId: puntoVentaGasol2.id,
    },
  });

  const turnoSupervisor = await prisma.turno.create({
    data: {
      fechaInicio: ahora,
      fechaFin: null,
      horaInicio: '14:00',
      horaFin: null,
      observaciones: 'Turno vespertino supervisión',
      activo: true,
      usuarioId: supervisorUser.id,
      puntoVentaId: puntoVentaGasol2.id,
    },
  });

  console.log('✅ Turnos de ejemplo creados');

  // 11. CREAR INVENTARIO ACTUAL
  console.log('📊 Creando inventario actual...');

  const inventarioData = [
    // Inventario Principal
    { puntoVentaId: puntoVentaGasol1.id, productoId: gasolina95.id, stockActual: 5000, precio: 15900 },
    { puntoVentaId: puntoVentaGasol1.id, productoId: diesel.id, stockActual: 4000, precio: 14300 },
    { puntoVentaId: puntoVentaGasol1.id, productoId: gasolina90.id, stockActual: 6000, precio: 14990 },

    // Inventario Gasol 2
    { puntoVentaId: puntoVentaGasol2.id, productoId: gasolina95.id, stockActual: 3500, precio: 15900 },
    { puntoVentaId: puntoVentaGasol2.id, productoId: diesel.id, stockActual: 2800, precio: 14300 },
    { puntoVentaId: puntoVentaGasol2.id, productoId: gasolina90.id, stockActual: 4200, precio: 14990 },
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