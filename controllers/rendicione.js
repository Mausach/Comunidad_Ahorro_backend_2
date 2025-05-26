const Rendicion = require("../models/Rendicion");
const Usuario = require("../models/Usuario");


// Cargar rendiciones
const cargarRendiciones = async (req, res) => {
  try {
    const rendiciones = await Rendicion.find()
      .select('-__v')
      .lean();

    const formatFechaArg = (fecha) => {
      if (!fecha || !(fecha instanceof Date)) return undefined;
      return fecha.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    };

    const rendicionesFormateadas = rendiciones.map(r => {
      const rFormateada = { ...r };

      // Formatear fechas principales
      rFormateada.createdAt = formatFechaArg(r.createdAt);
      rFormateada.updatedAt = formatFechaArg(r.updatedAt);
      if (r.fechaRendida) {
        rFormateada.fechaRendida = formatFechaArg(r.fechaRendida);
      }

      // Si hay datoRendicion, formatear fechas internas (si tuvieran, opcional)
      // En este caso no hay fechas internas por campo, así que solo se copia
      if (r.datoRendicion?.length > 0) {
        rFormateada.datoRendicion = r.datoRendicion.map(item => ({
          ...item
          // acá podrías formatear fechas si se agregaran en el futuro
        }));
      }

      return rFormateada;
    });

    res.status(200).json({
      ok: true,
      msg: 'Rendiciones cargadas exitosamente',
      rendiciones: rendicionesFormateadas,
      total: rendiciones.length
    });

  } catch (error) {
    console.error('Error al cargar rendiciones:', error);
    res.status(500).json({
      ok: false,
      msg: 'Error interno al cargar rendiciones. Por favor, contacte al administrador.'
    });
  }
};

const aceptaRendicionVenta = async (req, res) => {
  

  try {
    const { _id } = req.body;
    // 1. Buscar la rendición
    const rendicion = await Rendicion.findById(_id);
    if (!rendicion) { 
      return res.status(404).json({ ok: false, msg: "Rendición no encontrada" });
    }

    // 2. Supervisor de la rendición
    const supervisorDni = rendicion.usuario?.dni;
    const supervisor = supervisorDni ? await Usuario.findOne({ dni: supervisorDni }) : null;

    const saldosPorDni = {};
    let totalAsignado = 0;

    // 3. Recorrer cada venta/cobranza de la rendición
    for (const dato of rendicion.datoRendicion) {
      const { tipo, suscripcionInicial_MontoVenta = 0, montoPrestado = 0, costoAdministrativoProduct = 0 } = dato;
      const vendedorDni = dato.vendedor?.dni;

      let saldoVendedor = 0;
      let saldoSupervisor = 0;

      if (tipo === 'pres') {
        if (montoPrestado === 100000 || montoPrestado === 200000) {
          saldoVendedor = suscripcionInicial_MontoVenta;
        } else if (montoPrestado === 300000 || montoPrestado === 400000) {
          saldoVendedor = suscripcionInicial_MontoVenta - 15000;
        } else if (montoPrestado >= 500000) {
          saldoVendedor = suscripcionInicial_MontoVenta - 20000;
        }
      } else if (tipo === 'plan' || tipo === 'ei') {
        const restante = suscripcionInicial_MontoVenta - costoAdministrativoProduct;
        saldoVendedor = restante * 0.6;
        saldoSupervisor = restante * 0.4;
      } else if (tipo === 'vd') {
        saldoVendedor = suscripcionInicial_MontoVenta * 0.05;
      }

      if (vendedorDni) {
        saldosPorDni[vendedorDni] = (saldosPorDni[vendedorDni] || 0) + saldoVendedor;
      
        // Si el supervisor es el mismo vendedor, sumarle también el saldo del supervisor
        if (saldoSupervisor > 0 && supervisorDni === vendedorDni) {
          saldosPorDni[vendedorDni] += saldoSupervisor;
        }
      }
      
      if (saldoSupervisor > 0 && supervisorDni && supervisorDni !== vendedorDni) {
        saldosPorDni[supervisorDni] = (saldosPorDni[supervisorDni] || 0) + saldoSupervisor;
      }

      totalAsignado += saldoVendedor + saldoSupervisor;

     // console.log({ tipo, vendedorDni, saldoVendedor, saldoSupervisor });
    }

    // 4. Cargar todos los usuarios involucrados de una sola vez
    const dnisInvolucrados = Object.keys(saldosPorDni);
    const usuarios = await Usuario.find({ dni: { $in: dnisInvolucrados } });

    // 5. Crear operaciones en lote
    const bulkOps = usuarios.map(user => ({
      updateOne: {
        filter: { _id: user._id },
        update: { $inc: { saldoPendiente: saldosPorDni[user.dni] } }
      }
    }));

    //console.log('Usuarios encontrados:', usuarios.map(u => ({ dni: u.dni, _id: u._id })));
//console.log('Saldos a asignar:', saldosPorDni);

    await Usuario.bulkWrite(bulkOps);

    // 6. Actualizar y guardar la rendición
    rendicion.estado = true;
    rendicion.fechaRendida = new Date();
    rendicion.montoARendir = rendicion.montoARendir - totalAsignado;
    await rendicion.save();

    res.json({
      ok: true,
      msg: "Rendición finalizada correctamente",
      rendicionId: rendicion._id,
      totalAsignado,
      dineroRestante: rendicion.montoARendir,
      saldoUsuariosActualizado: saldosPorDni
    });

  } catch (error) {
    console.error('Error al finalizar rendición:', error);
    res.status(500).json({
      ok: false,
      msg: "Error interno del servidor",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const aceptarRendicionCobranza = async (req, res) => {
  const { _id } = req.body;

  try {
    // 1. Buscar la rendición
    const rendicion = await Rendicion.findById(_id);
    if (!rendicion) {
      return res.status(404).json({ ok: false, msg: "Rendición no encontrada" });
    }

    // 2. Validar que exista un usuario asociado
    const dniUsuario = rendicion.usuario?.dni;
    if (!dniUsuario) {
      return res.status(400).json({ ok: false, msg: "La rendición no tiene un usuario asociado" });
    }

    // 3. Calcular el 1% del monto a rendir
    const porcentajeComision = 0.04;
    const comision = rendicion.montoARendir * porcentajeComision;

    // 4. Actualizar el saldo del usuario
    const usuario = await Usuario.findOne({ dni: dniUsuario });
    if (!usuario) {
      return res.status(404).json({ ok: false, msg: "Usuario no encontrado" });
    }

    usuario.saldoPendiente = (usuario.saldoPendiente || 0) + comision;
   
    await usuario.save();

    // 5. Marcar la rendición como rendida
    rendicion.estado = true;
    rendicion.fechaRendida = new Date();
    rendicion.montoARendir = rendicion.montoARendir - comision;
    await rendicion.save();

    // 6. Responder al cliente
    res.json({
      ok: true,
      msg: "Rendición de cobranza aceptada correctamente",
      rendicionId: rendicion._id,
      comisionOtorgada: comision,
      saldoPendienteUsuario: usuario.saldoPendiente
    });

  } catch (error) {
    console.error('Error al aceptar rendición de cobranza:', error);
    res.status(500).json({
      ok: false,
      msg: "Error interno del servidor",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

//carga rendicion por id del usuario
const getRendicionesPendientesPorUsuario = async (req, res) => {
  try {
    const { dni } = req.params;

    // Buscar rendiciones pendientes del usuario
    const rendiciones = await Rendicion.find({
      'usuario.dni': dni,
      estado: false // false = pendiente
    })
    .select('-__v') // Excluir el campo __v
    .sort({ createdAt: -1 }) // Ordenar por fecha de creación (más reciente primero)
    .lean(); // Convertir a objetos JavaScript simples

    // Función para formatear fechas
    const formatFechaArg = (fecha) => {
      if (!fecha || !(fecha instanceof Date)) return undefined;
      return fecha.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    };

    // Formatear las rendiciones
    const rendicionesFormateadas = rendiciones.map(rendicion => {
      const rendicionFormateada = {
        _id: rendicion._id,
        montoARendir: rendicion.montoARendir,
        tipo: rendicion.tipo,
        estado: rendicion.estado,
        usuario: rendicion.usuario,
        createdAt: formatFechaArg(rendicion.createdAt),
        updatedAt: formatFechaArg(rendicion.updatedAt),
        // Mantener la estructura original de datoRendicion
        datoRendicion: rendicion.datoRendicion.map(dato => ({
          ...dato,
          // Aquí puedes agregar formateo adicional si es necesario
        }))
      };

      return rendicionFormateada;
    });
   

    res.status(200).json({
      ok: true,
      msg: 'Rendiciones pendientes cargadas exitosamente',
      rendiciones: rendicionesFormateadas,
      total: rendicionesFormateadas.length
    });

  } catch (error) {
    console.error('Error en getRendicionesPendientesPorUsuario:', error);
    res.status(500).json({
      ok: false,
      msg: 'Error interno del servidor',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  cargarRendiciones,
  aceptaRendicionVenta,
  aceptarRendicionCobranza,
  getRendicionesPendientesPorUsuario
};