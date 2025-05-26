
const Venta = require('../models/Venta');
const Rendicion = require('../models/Rendicion');

//carga ventas 
const cargarVentas = async (req, res) => {
    try {
      const ventas = await Venta.find()
        .select('-__v')
        .lean();
  
   const formatFechaArg = (fecha) => {
    if (!fecha || !(fecha instanceof Date)) return undefined;
    
    // Ajuste clave: forzar la fecha a mediodía UTC antes de formatear
    const fechaAjustada = new Date(fecha);
    fechaAjustada.setUTCHours(12, 0, 0, 0); // Evita el cruce de días
    
    return fechaAjustada.toLocaleDateString('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires', // Fuerza zona horaria AR
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
};
  
      const ventasFormateadas = ventas.map(v => {
        const vFormateada = { ...v };
  
        // Fechas principales
        vFormateada.createdAt = formatFechaArg(v.createdAt);
        vFormateada.updatedAt = formatFechaArg(v.updatedAt);
        vFormateada.fechaRealizada = formatFechaArg(v.fechaRealizada);
  
        // Fechas de cuotas (si existen)
        if (v.cuotas?.length > 0) {
          vFormateada.cuotas = v.cuotas.map(cuota => ({
            ...cuota,
            fechaCobro: formatFechaArg(cuota.fechaCobro),
            fechaCobrada: formatFechaArg(cuota.fechaCobrada)
          }));
        }
  
        return vFormateada;
      });
  
      res.status(200).json({
        ok: true,
        msg: 'Ventas cargadas exitosamente',
        ventas: ventasFormateadas,
        total: ventas.length
      });
  
    } catch (error) {
      console.error('Error al cargar ventas:', error);
      res.status(500).json({
        ok: false,
        msg: 'Error interno al cargar ventas. Por favor, contacte al administrador.'
      });
    }
};

//procesa cobranza
const procesarCobranzaCuota = async (req, res) => {
    const { 
        ventaId, 
        cuotaId, 
        estado_cuota, 
        metodoPago, 
        montoCuota, 
        comentario, 
        fechaCobro,
        cobrador 
    } = req.body;

    try {
        // 1. Validación básica de estados permitidos
        if (!['pago', 'pendiente', 'no pagado'].includes(estado_cuota)) {
            return res.status(400).json({ 
                ok: false, 
                msg: 'Estado de cuota no válido' 
            });
        }

        // 2. Buscar venta y cuota (optimizado para solo los campos necesarios)
        const venta = await Venta.findOne({
            _id: ventaId,
            'cuotas._id': cuotaId
        }).select('cuotas cliente producto conducta_o_instancia estado numeroContrato');

        if (!venta) {
            return res.status(404).json({ 
                ok: false, 
                msg: "Venta no encontrada" 
            });
        }

        const cuota = venta.cuotas.id(cuotaId);
        if (!cuota) {
            return res.status(404).json({ 
                ok: false, 
                msg: "Cuota no encontrada" 
            });
        }

        

        // 3. Validación de secuencia de cuotas (nuevo control)
        if (estado_cuota === 'pago' || estado_cuota === 'pendiente' || estado_cuota === 'no pagado') {
            const cuotasAnterioresImpagas = venta.cuotas.some(c => 
                c.numeroCuota < cuota.numeroCuota && 
                (c.estado_cuota === 'impago' || c.estado_cuota === 'pendiente')
            );

            if (cuotasAnterioresImpagas) {
                return res.status(400).json({
                    ok: false,
                    msg: 'No se puede pagar esta cuota porque hay cuotas anteriores pendientes o impagas'
                });
            }
        }

        // 4. Procesamiento según tipo de acción
        switch (estado_cuota) {
            case 'pago':
                await procesarPagoCompleto(cuota, { metodoPago });
                break;

            case 'pendiente':
                await procesarPendiente(cuota, { 
                    comentario, 
                    fechaCobro, 
                    montoCuota, 
                    metodoPago 
                });
                break;

            case 'no pagado':
                await procesarNoPago(cuota, { comentario });
                break;
        }

        // 5. Actualizar datos comunes
        Object.assign(cuota, {
            cobrador: {
                _id: cobrador._id,
                dni: cobrador.dni,
                nombre: cobrador.nombre,
                apellido: cobrador.apellido
            },
            ...(fechaCobro && { fechaCobro: new Date(fechaCobro) })
        });

        // 6. Actualizar estado general de la venta
        actualizarEstadoVenta(venta);

        // 7. Procesar rendición
        await procesarRendicion({
            venta,
            cuota,
            cobrador,
            monto: montoCuota || 0,
            metodoPago
        });

        // 8. Guardar cambios
        await venta.save();

        // 9. Respuesta exitosa
        res.json({
            ok: true,
            venta: {
                _id: venta._id,
                conducta: venta.conducta_o_instancia,
                estado: venta.estado,
                numeroContrato: venta.numeroContrato
            },
            cuota: {
                numeroCuota: cuota.numeroCuota,
                estado: cuota.estado_cuota,
                saldoPendiente: cuota.montoCuota
            }
        });

    } catch (error) {
        console.error('Error en procesarCobranza:', error);
        res.status(500).json({
            ok: false,
            msg: error.message || 'Error interno del servidor'
        });
    }
};

// Editar monto de cuota sin cambiar su estado
const editarMontoCuota = async (req, res) => {
    const { 
        ventaId, 
        cuotaId, 
        montoCuota, 
        comentario,
        cobrador 
    } = req.body;

    try {
        // 1. Validación básica del monto
        if (!montoCuota || isNaN(montoCuota) || parseFloat(montoCuota) <= 0) {
            return res.status(400).json({ 
                ok: false, 
                msg: 'El monto debe ser un número mayor a cero' 
            });
        }

        // 2. Buscar venta y cuota
        const venta = await Venta.findOne({
            _id: ventaId,
            'cuotas._id': cuotaId
        }).select('cuotas cliente producto estado numeroContrato');

        if (!venta) {
            return res.status(404).json({ 
                ok: false, 
                msg: "Venta no encontrada" 
            });
        }

        const cuota = venta.cuotas.id(cuotaId);
        if (!cuota) {
            return res.status(404).json({ 
                ok: false, 
                msg: "Cuota no encontrada" 
            });
        }

        // 3. Registrar el cambio en el historial (opcional)
        const historialCambio = {
            fecha: new Date(),
            montoAnterior: cuota.montoCuota,
            montoNuevo: parseFloat(montoCuota),
            modificadoPor: {
                _id: cobrador._id,
                nombre: cobrador.nombre,
                apellido: cobrador.apellido
            },
            comentario: comentario || "Monto de cuota modificado"
        };

        // 4. Actualizar la cuota
        cuota.montoCuota = parseFloat(montoCuota);
        cuota.cobrador = {
            _id: cobrador._id,
            dni: cobrador.dni,
            nombre: cobrador.nombre,
            apellido: cobrador.apellido
        };

        // Agregar al historial si tienes este campo
        if (!cuota.historialCambios) {
            cuota.historialCambios = [];
        }
        cuota.historialCambios.push(historialCambio);

        // 5. Recalcular totales de la venta si es necesario
        if (venta.estado === 'activa' || venta.estado === 'pendiente') {
            venta.totalPagado = venta.cuotas.reduce((sum, c) => 
                c.estado_cuota === 'pago' ? sum + c.montoCuota : sum, 0);
            venta.saldoPendiente = venta.totalVenta - venta.totalPagado;
        }

        // 6. Guardar cambios
        await venta.save();

        // 7. Respuesta exitosa
        res.json({
            ok: true,
            msg: 'Monto de cuota actualizado correctamente',
            venta: {
                _id: venta._id,
                estado: venta.estado,
                numeroContrato: venta.numeroContrato
            },
            cuota: {
                numeroCuota: cuota.numeroCuota,
                montoAnterior: historialCambio.montoAnterior,
                montoActual: cuota.montoCuota,
                estado: cuota.estado_cuota
            },
            historial: historialCambio
        });

    } catch (error) {
        console.error('Error en editarMontoCuota:', error);
        res.status(500).json({
            ok: false,
            msg: error.message || 'Error interno al actualizar el monto'
        });
    }
};

// Funciones auxiliares (privadas)
const procesarPagoCompleto = (cuota, { metodoPago }) => {
    if (!metodoPago) throw new Error('Método de pago es requerido');
    
    cuota.estado_cuota = 'pago';
    cuota.metodoPago = metodoPago;
    cuota.fechaCobrada = new Date();
    //cuota.montoCuota = 0;
};

const procesarPendiente = (cuota, { comentario, fechaCobro, montoCuota, metodoPago }) => {
    if (!comentario || !fechaCobro) throw new Error('Comentario y fecha son obligatorios');
    
    if (montoCuota) {
        if (!metodoPago) throw new Error('Método de pago es requerido para pagos parciales');
        cuota.montoCuota -= parseFloat(montoCuota);
        cuota.metodoPago = metodoPago;
    }
    cuota.fechaCobro=fechaCobro;
    cuota.estado_cuota = 'pendiente';
    cuota.comentario = comentario;
    
};

const procesarNoPago = (cuota, { comentario }) => {
    if (!comentario) throw new Error('Razón del no pago es requerida');
    cuota.estado_cuota = 'no pagado';
    cuota.comentario = comentario;
};

const actualizarEstadoVenta = (venta) => {
    const cuotasNoPagadas = venta.cuotas.filter(c => 
        ['no pagado'].includes(c.estado_cuota)
    ).length;

    if (venta.cuotas.every(c => c.estado_cuota === 'pago')) {
        venta.conducta_o_instancia = 'al dia';
        venta.estado = false;
    } else if (cuotasNoPagadas >= 4) {
        venta.conducta_o_instancia = 'caducado';
    } else if (cuotasNoPagadas >= 2) {
        venta.conducta_o_instancia = 'atrasado';
    } else {
        venta.conducta_o_instancia = 'al dia';
    }
};

const procesarRendicion = async ({ venta, cuota, cobrador, monto, metodoPago }) => {
    if (monto <= 0) return; // No registrar en rendición si no hay pago

    let rendicion = await Rendicion.findOne({
        'usuario.dni': cobrador.dni,
        estado: false
    });

    const datoRendicion = {
        tipo: 'cobranza',
        numeroCuota: cuota.numeroCuota,
        monto,
        metodoPago,
        cliente: {
            nombre: venta.cliente.nombre,
            apellido: venta.cliente.apellido,
            dni: venta.cliente.dni
        },
        nombreProducto: venta.producto.nombre
    };

    if (!rendicion) {
        rendicion = new Rendicion({
            usuario: cobrador,
            tipo: 'cobranza',
            datoRendicion: [datoRendicion],
            montoARendir: monto
        });
    } else {
        rendicion.datoRendicion.push(datoRendicion);
        rendicion.montoARendir += monto;
    }

    await rendicion.save();
};

/********************************** Cobrador ************************************/
const getCuotasHoyPorDNI = async (req, res) => {
  try {
    const { dni } = req.params; // Obtener DNI del cobrador de los parámetros de la URL

    // 1. Normalizar fecha actual a UTC+0 (medianoche)
    const hoy = new Date();
    hoy.setUTCHours(0, 0, 0, 0);

    // 2. Buscar ventas activas que tengan cuotas asignadas a este cobrador (por DNI)
    const ventas = await Venta.find({ 
      estado: true,
      'cuotas.cobrador.dni': dni // Filtro por DNI del cobrador
    })
    .populate("cliente")
    .populate("producto")
    .lean();

    // 3. Formateador de fechas para Argentina
    const formatFechaArg = (fecha) => {
      if (!fecha || !(fecha instanceof Date)) return undefined;
      const fechaAjustada = new Date(fecha);
      fechaAjustada.setUTCHours(12, 0, 0, 0); // Ajuste horario
      return fechaAjustada.toLocaleDateString('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    };

    // 4. Filtrar y preparar cuotas impagas para hoy asignadas a este cobrador
    const cuotasImpagasHoy = ventas.flatMap((venta) => {
      const { cuotas, producto, cliente, fechaRealizada } = venta;

      return cuotas
        .filter((cuota) => {
          if (!cuota.fechaCobro || cuota.cobrador?.dni !== dni) return false;
          
          const fechaCuota = new Date(cuota.fechaCobro);
          fechaCuota.setUTCHours(0, 0, 0, 0);

          return (
            (cuota.estado_cuota === "impago" || cuota.estado_cuota === "pendiente") &&
            fechaCuota.getTime() === hoy.getTime() &&
            cuota.cobrador?.dni === dni // Asegurar que la cuota es de este cobrador
          );
        })
        .map((cuota) => ({
          cliente: {
            ...cliente,
            numero_telefono: cliente.telefono,
            direccion_comercial: cliente.direccion_2 || cliente.direccion,
          },
          producto: {
            nombre: producto.nombre,
            tipo: producto.tipo,
            monto: producto.detalle?.prestamo?.montoPrestado || 
                  producto.detalle?.venta?.montoEntregaInmediata ||
                  venta.monto_suscripcion_vta_dir
          },
          venta: {
            _id:venta._id,
            numeroContrato: venta.numeroContrato,
            fechaRealizada: formatFechaArg(fechaRealizada)
          },
          cuota: {
            ...cuota,
            fechaCobro: formatFechaArg(cuota.fechaCobro),
            fechaCobrada: cuota.fechaCobrada ? formatFechaArg(cuota.fechaCobrada) : undefined,
            cobrador: cuota.cobrador // Incluimos la info del cobrador
          }
        }));
    });

    res.json({
      ok: true,
      totalCuotas: cuotasImpagasHoy.length,
      cuotas: cuotasImpagasHoy,
      cliente: cuotasImpagasHoy[0]?.cliente || null // Datos del primer cliente encontrado
    });

  } catch (err) {
    console.error("Error en getCuotasHoyPorDNI:", err);
    res.status(500).json({ 
      ok: false, 
      msg: "Error interno del servidor",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};


module.exports = {
    cargarVentas,
    procesarCobranzaCuota,
    getCuotasHoyPorDNI,
    editarMontoCuota
  };
