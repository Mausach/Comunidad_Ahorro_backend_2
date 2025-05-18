const Venta = require('../models/Venta');
const Cliente = require('../models/Cliente'); // Ajusta la ruta si es diferente
const Producto = require('../models/Producto');
const Rendicion = require('../models/Rendicion');

async function crearVentaCompleta(req, res) {
  try {

    const {
      //datos de cliente
      nombre,
      apellido,
      nombre_fam,
      apellido_fam,
      dni,
      cuil,
      numero_cliente,
      situacion_veraz,
      // === Contacto ===
      email,
      numero_telefono,
      numero_telefono_2,
      // === Dirección ===
      direccion_hogar,
      direccion_comercial,
      localidad,



      //datos de la venta
      numeroContrato,
      fechaRealizada,
      metodoPago_monto_sus_vta,
      monto_suscripcion_vta_dir,
      monto_cuota,
      cantidad_cuotas,

      //vendedor
      sup_id,//id del supervisor
      ve_id,
      dni_V,
      nombre_V,
      apellido_V,
      //producto
      nombreProd,
      tipo,
      productoId,
      costeAdmin,
      //detalle
      //prestamo
      montoPrestado,
      plazo,
      montoMaximoPorUsuario,//ver si es necesario
      capitalTotal,//ver si es necesario
      //venta
      // banderas
      ventaDirecta,
      largoPlazo,
      entregaInmediata,
      permutada,
      cuotasPactadas,//array

      //tipo de tarjeta
      tarjeta_tipo,

      //itemInventario
      nombre_I,
      modelo,
      serial,
      montoEntregaInmediata,
      objetoRecibido,
      montoObjetoRecibido,
      //cuotas se generan en el metodo
      //cobrador
      id_c,//ver si es necesario
      nombre_C,
      apellido_C,
      dni_C,

      //para rendicion 
      nombre_S,
      apellido_S,
      dni_S,

      clienteNuevo

      //la rendicion se genera con los datos ya dados
      //el actualizar sueldo se genera una vez se acepta la rendicion no cuando se genera

    } = req.body; // tomamos del body

    let cliente;
    let tipoR;

    if (clienteNuevo) {
      cliente = await crearCliente(req.body);
    } else {
      cliente = await Cliente.findOne({ dni: dni });
      if (!cliente) {
        throw new Error('Cliente no encontrado');
      }
    }

    const venta = await procesarOperacion(req.body, cliente);

    const rendicionExistente = await Rendicion.findOne({
      $or: [
        { 'usuario.id': sup_id },
        { 'usuario.id': ve_id }
      ],
      estado: false
    });

    if (montoPrestado) {
      tipoR = 'pres';
    } else if (permutada) {
      tipoR = 'perm';
    } else if (ventaDirecta) {
      tipoR = 'vd';
    } else if (entregaInmediata) {
      tipoR = 'ei';
    } else if (largoPlazo) {
      tipoR = 'plan';
    }

    if (rendicionExistente) {
      // Ya hay rendición pendiente: vamos a actualizarla
      await actualizarRendicion(rendicionExistente, costeAdmin, nombreProd, tipoR, venta);
    } else {
      // No hay rendición pendiente: vamos a crear una nueva
      await crearNuevaRendicion(ve_id, nombre_S, apellido_S, dni_S, costeAdmin, nombreProd, tipoR, venta);
    }

    // Opcional: actualizar saldo si es necesario
    // await actualizarSaldoUsuario(usuarioId, monto, 'sumar');

    res.status(201).json({
      ok: true,
      msg: 'venta realizada',

    });


  } catch (error) {
    console.error("Error en crearVentaCompleta:", error);
    res.status(500).json({
      success: false,
      msg: error.message || "Error al procesar la venta"
    });
  }

}


const crearCliente = async (datosCliente) => {

  const {
    nombre,
    apellido,
    nombre_fam,
    apellido_fam,
    dni,
    cuil,
    situacion_veraz,
    // === Contacto ===
    email,
    numero_telefono,
    numero_telefono_2,
    // === Dirección ===
    direccion_hogar,
    direccion_comercial,
    localidad,
  } = datosCliente;
  try {

    // Verificar campos obligatorios
    if (
      !nombre ||
      !apellido ||
      !nombre_fam ||
      !apellido_fam ||
      !dni ||
      !direccion_hogar ||
      !numero_telefono
    ) {
      throw new Error('Por favor, complete todos los campos obligatorios.');
    }

    // Validar email solo si viene
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error('El formato del email no es válido.');
    }

    // Validar situación veraz si viene
    if (situacion_veraz !== undefined) {
      const situacionVerazParsed = parseInt(situacion_veraz, 10);
      if (isNaN(situacionVerazParsed) || situacionVerazParsed < 1 || situacionVerazParsed > 6) {
        throw new Error('La situación veraz debe estar entre 1 y 6.');
      }
    }

    const cantidadClientes = await Cliente.countDocuments();
    const numero_cliente = (cantidadClientes + 1).toString().padStart(5, '0');
    //si se elimina un cliente dejaria de funcionar por que si cuenta la cantidad y generaria un numero ya existente

    // Creamos el nuevo cliente
    const nuevoCliente = new Cliente({
      nombre: datosCliente.nombre,
      apellido: datosCliente.apellido,
      nombre_fam: datosCliente.nombre_fam,
      apellido_fam: datosCliente.apellido_fam,
      dni: datosCliente.dni,
      cuil: datosCliente.cuil || undefined, // opcional
      numero_cliente: numero_cliente,
      situacion_veraz: datosCliente.situacion_veraz || null, // opcional
      email: datosCliente.email || undefined, // opcional
      numero_telefono: datosCliente.numero_telefono,
      numero_telefono_2: datosCliente.numero_telefono_2 || null, // opcional
      direccion_hogar: datosCliente.direccion_hogar,
      direccion_comercial: datosCliente.direccion_comercial || null, // opcional
      localidad: datosCliente.localidad
    });

    // Guardamos el cliente en la base de datos
    const clienteGuardado = await nuevoCliente.save();

    return clienteGuardado;

  } catch (error) {
    // Si el error es de clave duplicada
    if (error.code === 11000) {
      // Podés extraer qué campo causó el conflicto
      const campoDuplicado = Object.keys(error.keyValue)[0];
      throw new Error(`Ya existe un cliente con el mismo ${campoDuplicado}.`);
    } else {
      // Otros errores (problemas de validación, etc.)
      throw new Error(`Error al crear cliente: ${error.message}`);
    }
  }
}

async function procesarOperacion(datosOperacion, cliente) {

  const {

    tipo,
    productoId
  } = datosOperacion;

  const producto = await Producto.findById(productoId);

  if (tipo === 'prestamo') {
    return await procesarPrestamo(datosOperacion, cliente, producto);
  } else if (tipo === 'sistema_venta') {
    return await procesarVenta(datosOperacion, cliente, producto);
  } else {
    throw new Error('Tipo de producto desconocido.');
  }
}
/**************************** Prestamo ****************************************** */
async function procesarPrestamo(datosOperacion, cliente, producto) {
  const {

    numeroContrato,
    fechaRealizada,
    metodoPago_monto_sus_vta,
    monto_suscripcion_vta_dir,
    monto_cuota,
    cantidad_cuotas,
    montoPrestado,
    plazo,
    montoMaximoPorUsuario,//
    capitalTotal,//
    tarjeta_tipo,

    sup_id,//id del supervisor
    dni_V,
    nombre_V,
    apellido_V,

    nombreProd,
    tipo,


    id_c,//ver si es necesario
    nombre_C,
    apellido_C,
    dni_C,

  } = datosOperacion;

  // 1. Validar monto máximo permitido
  if (montoPrestado > producto.detalles.prestamo.montoMaximoPorUsuario) {
    throw new Error('El monto solicitado excede el máximo permitido por cliente.');
  }

  // 2. Validar monto disponible para prestar
  if (montoPrestado > producto.detalles.prestamo.capitalTotal) {
    throw new Error('El monto solicitado excede el total disponible para préstamos.');
  }

  // 3. Generar las cuotas
  const cuotas = generarCuotas({ //para prestamo manualmente pagar la primera como paga 
    montoCuota: monto_cuota,
    cantidadCuotas: cantidad_cuotas,
    cobrador: { nombre: nombre_C, apellido: apellido_C, dni: dni_C },
    fechaInicio: fechaRealizada,
    plazo
  });

  // 3.1 Marcar la primera cuota como pagada
  if (cuotas.length > 0) {
    cuotas[0].estado_cuota = 'pago';
    cuotas[0].fechaCobrada = new Date(); // opcional
  }

  // 4. Crear la nueva venta
  const nuevaVenta = new Venta({
    numeroContrato,
    fechaRealizada: fechaRealizada || new Date(),
    metodoPago_monto_sus_vta,
    monto_suscripcion_vta_dir,
    vendedor: {
      sup_id, // lo podés completar si querés
      dni: dni_V,
      nombre: nombre_V,
      apellido: apellido_V
    },
    producto: {
      nombre: nombreProd,
      tipo: tipo,
      detalle: {
        prestamo: {
          montoPrestado: montoPrestado,
          plazo
        }
      }
    },
    cuotas: cuotas,
    cliente: {
      nombre: cliente.nombre,
      apellido: cliente.apellido,
      dni: cliente.dni,
      telefono: cliente.numero_telefono,
      tipo_Tarjeta: tarjeta_tipo,
      email: cliente.email,
      direccion: cliente.direccion_hogar,
      direccion_2: cliente.direccion_comercial,
      nombre_fam: cliente.nombre_fam,
      apellido_fam: cliente.apellido_fam,

    },
    conducta_o_instancia: 'al dia',
    estado: true //activo o pendiente
  });

  // 5. Guardar la venta
  const ventaGuardada = await nuevaVenta.save();

  // 6. Actualizar total disponible del producto
  producto.detalles.prestamo.capitalTotal -= montoPrestado;
  await producto.save();

  return ventaGuardada;
}

/********************************* venta ********************************************** */
async function procesarVenta(datosOperacion, cliente, producto) {
  const {

    // Datos venta
    numeroContrato, fechaRealizada, metodoPago_monto_sus_vta, monto_suscripcion_vta_dir,
    monto_cuota, cantidad_cuotas, tarjeta_tipo,
    // Vendedor
    sup_id, dni_V, nombre_V, apellido_V,
    // Producto
    nombreProd, tipo, productoId,
    // Venta detalles
    ventaDirecta, largoPlazo, entregaInmediata, permutada, plazo,
    // Item inventario (si aplica)
    nombre_I, modelo, serial, montoEntregaInmediata, metodoPago_EntregaInm, objetoRecibido, montoObjetoRecibido,
    // Cuotas pactadas
    cuotasPactadas,
    // Cobrador
    id_c, nombre_C, apellido_C, dni_C
  } = datosOperacion;

  const cobrador = { nombre: nombre_C, apellido: apellido_C, dni: dni_C }

  // 1. Validación básica para asegurarnos de que todo esté presente
  if (!numeroContrato || !monto_suscripcion_vta_dir || !metodoPago_monto_sus_vta) {
    throw new Error("Faltan datos esenciales para procesar la venta.");
  }


  // Base de la venta (común para todos)
  const venta = {
    numeroContrato,
    fechaRealizada,
    metodoPago_monto_sus_vta,//suscripcion o venta
    monto_suscripcion_vta_dir,//metodo de sus o vnta dir
    vendedor: {
      sup_id: sup_id,
      dni: dni_V,
      nombre: nombre_V,
      apellido: apellido_V
    },
    producto: {
      nombre: nombreProd,
      tipo: tipo,
      detalle: {
        venta: {
          banderas: {
            ventaDirecta,
            largoPlazo,
            entregaInmediata,
            permutada
          },
          cuotasPactadas: producto.detalles.venta.plazosPactados,
          itemInventario: {
            nombre: nombre_I,//cuando es plan solo se asigna el nombre no el resto de datos
            modelo: modelo,
            serial: serial
          },
          montoEntregaInmediata,
          metodoPago_EntregaInm,
          objetoRecibido,
          montoObjetoRecibido
        }
      }
    },

    conducta_o_instancia: 'al dia',
    estado: true,
    cuotas: [],

    cliente: {
      nombre: cliente.nombre,
      apellido: cliente.apellido,
      dni: cliente.dni,
      telefono: cliente.numero_telefono,
      tipo_Tarjeta: tarjeta_tipo,
      email: cliente.email,
      direccion: cliente.direccion_hogar,
      direccion_2: cliente.direccion_comercial,
      nombre_fam: cliente.nombre_fam,
      apellido_fam: cliente.apellido_fam,

    },

    detalleVenta: {}
  };



  // Ahora, según la bandera
  if (ventaDirecta) {
    // Solo monto total igual a venta directa
    //hacer el control del item
    actualizarEstadoItemInventario(serial, producto)

    // Actualizar item inventario a 'vendido'
  }
  else if (entregaInmediata) {


    venta.cuotas = generarCuotas({ //para prestamo manualmente pagar la primera como paga 
      montoCuota: monto_cuota,
      cantidadCuotas: cantidad_cuotas,
      cobrador: { nombre: nombre_C, apellido: apellido_C, dni: dni_C },
      fechaInicio: fechaRealizada,
      plazo
    });

    actualizarEstadoItemInventario(serial, producto)

  }
  else if (largoPlazo) {

    venta.cuotas = generarCuotas({ //para prestamo manualmente pagar la primera como paga 
      montoCuota: monto_cuota,
      cantidadCuotas: cantidad_cuotas,
      cobrador: { nombre: nombre_C, apellido: apellido_C, dni: dni_C },
      fechaInicio: fechaRealizada,
      plazo
    });
    // No actualizar inventario
  }
  else if (permutada) {

    if (cantidad_cuotas && monto_cuota) {
      venta.cuotas = generarCuotas({ //para prestamo manualmente pagar la primera como paga 
        montoCuota: monto_cuota,
        cantidadCuotas: cantidad_cuotas,
        cobrador: { nombre: nombre_C, apellido: apellido_C, dni: dni_C },
        fechaInicio: fechaRealizada,
        plazo
      });
    }

    actualizarEstadoItemInventario(serial, producto)
    // Actualizar item inventario a 'vendido'
  }
  else {
    throw new Error("Tipo de venta no reconocido.");
  }

  // Guardar la venta
  const ventaGuardada = await Venta.create(venta);

  return ventaGuardada;
}

//actualisa estado en stock
// Actualiza el estado de un item dentro del inventario de un producto
async function actualizarEstadoItemInventario(serial, producto) {
  // Buscar el item dentro del array inventario
  const item = producto.detalles.venta.inventario.find(item => item.serial === serial);

  if (!item) {
    throw new Error('Item no encontrado en el inventario del producto.');
  }

  // Cambiar el estado del item
  item.estado = "vendido";

  // Guardar el producto actualizado en la base de datos
  await producto.save();

  return item; // Devolvemos el item actualizado
}

/*************************** Cuotas ***************************************** */
function generarCuotas({ montoCuota, cantidadCuotas, cobrador, fechaInicio, plazo }) {
  const cuotas = [];

  // Si no hay fechaInicio, usamos fecha actual
  let fechaActual = fechaInicio ? new Date(fechaInicio) : new Date();

  for (let i = 1; i <= cantidadCuotas; i++) {
    fechaActual = calcularProximaFecha(fechaActual, plazo);

    cuotas.push({
      numeroCuota: i,
      montoCuota: Number(montoCuota), // número, sin toFixed
      metodoPago: null, // inicializado en null
      comentario: '',
      fechaCobro: fechaActual,
      estado_cuota: 'impago',
      fechaCobrada: null,
      cobrador: {
        //id: id_c || null,
        dni: cobrador.dni,
        nombre: cobrador.nombre,
        apellido: cobrador.apellido
      }
    });
  }

  return cuotas;
}

function calcularProximaFecha(fechaBase, plazo) {
  const nuevaFecha = new Date(fechaBase);

  switch (plazo) {
    case "diario":
      nuevaFecha.setDate(nuevaFecha.getDate() + 1);
      break;
    case "semanal":
      nuevaFecha.setDate(nuevaFecha.getDate() + 7);
      break;
    case "quincenal":
      nuevaFecha.setDate(nuevaFecha.getDate() + 15);
      break;
    case "mensual":
      nuevaFecha.setMonth(nuevaFecha.getMonth() + 1);
      break;
    default:
      throw new Error(`Plazo no válido: ${plazo}`);
  }

  // Si cae en domingo (0 = Domingo)
  if (nuevaFecha.getDay() === 0) {
    nuevaFecha.setDate(nuevaFecha.getDate() + 1); // Pasarlo a lunes
  }

  return nuevaFecha;
}
/********************** Rendicion *********************************** */
async function actualizarRendicion(rendicion, costeAdmin, nombreProd, tipoR, venta) {
  // Crear el objeto datoRendicion con datos de la venta
  const nuevoDatoRendicion = {
    nombreProducto: nombreProd,
    tipo: tipoR,
    costoAdministrativoProduct: costeAdmin || 0,//coste administrativo del producto
    numeroContrato: venta.numeroContrato,
    montoPrestado: venta.producto.detalle.prestamo.montoPrestado,
    suscripcionInicial_MontoVenta: venta.monto_suscripcion_vta_dir,
    objetoRecibido: venta.producto.detalle.venta.objetoRecibido || '',
    itemServicioEntregado: venta.producto.detalle.venta.itemInventario.nombre || '',
    serialItem: venta.producto.detalle.venta.itemInventario.serial || '',
    vendedor: {
      nombre: venta.vendedor.nombre,
      apellido: venta.vendedor.apellido,
      dni: venta.vendedor.dni
    },
    cliente: {
      nombre: venta.cliente.nombre,
      apellido: venta.cliente.apellido,
      dni: venta.cliente.dni
    }
  };

  // Sumar el nuevo datoRendicion
  rendicion.datoRendicion.push(nuevoDatoRendicion);

  // Actualizar monto a rendir (calcularemos comisiones y coste admin antes de cambiarle el estado)
  rendicion.montoARendir += venta.monto_suscripcion_vta_dir;

  await rendicion.save();
}

async function crearNuevaRendicion(ve_id, nombre_S, apellido_S, dni_S, costeAdmin, nombreProd, tipoR, venta) {
  const nuevaRendicion = new Rendicion({
    montoARendir: venta.monto_suscripcion_vta_dir,
    tipo: 'venta', // ya sabemos que es venta
    estado: false,
    datoRendicion: [
      {
        nombreProducto: nombreProd,
        tipo: tipoR,
        costoAdministrativoProduct: costeAdmin || 0,//coste administrativo del producto
        numeroContrato: venta.numeroContrato,
        montoPrestado: venta.producto.detalle.prestamo.montoPrestado,
        suscripcionInicial_MontoVenta: venta.monto_suscripcion_vta_dir,
        objetoRecibido: venta.producto.detalle.venta.objetoRecibido || '',
        itemServicioEntregado: venta.producto.detalle.venta.itemInventario.nombre || '',
        serialItem: venta.producto.detalle.venta.itemInventario.serial || '',
        vendedor: {
          nombre: venta.vendedor.nombre,
          apellido: venta.vendedor.apellido,
          dni: venta.vendedor.dni
        },
        cliente: {
          nombre: venta.cliente.nombre,
          apellido: venta.cliente.apellido,
          dni: venta.cliente.dni
        }
      }
    ],
    usuario: {
      id: venta.vendedor.sup_id || ve_id, // toma el id del supervisor o de el vendedor
      nombre: nombre_S || venta.vendedor.nombre,
      apellido: apellido_S || venta.vendedor.apellido,
      dni: dni_S || venta.vendedor.dni
    }
  });

  await nuevaRendicion.save();
}



const cargarPrestamos = async (req, res) => {
  try {
    // Paso 1: Filtrar por tipo "sistema_venta" desde la consulta a MongoDB
    const prestamos = await Venta.find({
      'producto.tipo': 'prestamo'  // Filtro clave
    })
      .select('-__v')
      .lean();

    const formatFechaArg = (fecha) => {
      if (!fecha || !(fecha instanceof Date)) return undefined;
      const fechaAjustada = new Date(fecha);
      fechaAjustada.setUTCHours(12, 0, 0, 0);
      return fechaAjustada.toLocaleDateString('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    };

    const prestamosFormateados = prestamos.map(p => {
      const pFormateado = { ...p };

      // Fechas principales
      pFormateado.createdAt = formatFechaArg(p.createdAt);
      pFormateado.updatedAt = formatFechaArg(p.updatedAt);
      pFormateado.fechaDesembolso = formatFechaArg(p.fechaDesembolso); // Fecha específica de préstamo

      // Cuotas o pagos (estructura típica de préstamos)
      if (p.pagos?.length > 0) {
        pFormateado.pagos = p.pagos.map(pago => ({
          ...pago,
          fechaVencimiento: formatFechaArg(pago.fechaVencimiento),
          fechaPago: formatFechaArg(pago.fechaPago)
        }));
      }

      // Campos específicos de préstamos
      pFormateado.tasaInteres = p.tasaInteres; // Ejemplo: Formatear tasa
      pFormateado.montoTotal = p.montoTotal; // Formato monetario

      return pFormateado;
    });

    res.status(200).json({
      ok: true,
      msg: 'Préstamos cargados exitosamente',
      prestamos: prestamosFormateados,
      total: prestamos.length
    });

  } catch (error) {
    console.error('Error al cargar préstamos:', error);
    res.status(500).json({
      ok: false,
      msg: 'Error interno al cargar préstamos. Por favor, contacte al administrador.'
    });
  }
};

//cargar ventas para reportes
const cargarSistemaVentas = async (req, res) => {
  try {
    // Paso 1: Filtrar por tipo "sistema_venta" desde la consulta a MongoDB
    const ventas = await Venta.find({
      'producto.tipo': 'sistema_venta'  // Filtro clave
    })
      .select('-__v')
      .lean();

    // Paso 2: Formatear fechas (función auxiliar)
    const formatFechaArg = (fecha) => {
      if (!fecha || !(fecha instanceof Date)) return undefined;
      const fechaAjustada = new Date(fecha);
      fechaAjustada.setUTCHours(12, 0, 0, 0);
      return fechaAjustada.toLocaleDateString('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    };

    // Paso 3: Formatear los datos de cada venta
    const ventasFormateadas = ventas.map(v => {
      const vFormateada = { ...v };

      // Fechas principales
      vFormateada.createdAt = formatFechaArg(v.createdAt);
      vFormateada.updatedAt = formatFechaArg(v.updatedAt);
      vFormateada.fechaVenta = formatFechaArg(v.fechaRealizada); // Usamos fechaRealizada del modelo

      // Items de venta (si existen)
      if (v.producto?.detalle?.venta?.itemInventario) {
        vFormateada.itemInventario = {
          ...v.producto.detalle.venta.itemInventario,
          fechaEntrega: formatFechaArg(v.producto.detalle.venta.itemInventario.fechaEntrega)
        };
      }

      // Campos monetarios
      vFormateada.total = v.monto_suscripcion_vta_dir;
      vFormateada.estado = v.estado;

      return vFormateada;
    });

    res.status(200).json({
      ok: true,
      msg: 'Ventas (sistema_venta) cargadas exitosamente',
      ventas: ventasFormateadas,
      total: ventas.length
    });

  } catch (error) {
    console.error('Error al cargar ventas (sistema_venta):', error);
    res.status(500).json({
      ok: false,
      msg: 'Error interno al cargar ventas. Por favor, contacte al administrador.'
    });
  }
};

module.exports = {
  crearVentaCompleta,
  cargarPrestamos,
  cargarSistemaVentas

};