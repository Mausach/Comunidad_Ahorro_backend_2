const Venta = require("../models/Venta");

let notificationCache = null;
let lastCacheUpdate = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos en milisegundos

// En tu controlador del backend (archivo .js)
const getVentasConCuotasEspeciales = async (req, res) => {
  try {
    // 1. Normalizar "hoy" a UTC+0 (medianoche)
    const hoy = new Date();
    hoy.setUTCHours(0, 0, 0, 0); // Fuerza UTC+0 sin horas/minutos/segundos
    

    const ventas = await Venta.find({ estado: true })
      .populate("cliente")
      .populate("producto")
      .lean();

    const cuotasImpagasHoy = [];
    const ventasConCuotaPactadaPagada = [];

    ventas.forEach((venta) => {
      const { cuotas, producto, cliente,fechaRealizada } = venta;
      const cuotasPactadas = producto?.detalle?.venta?.cuotasPactadas || [];

      // 2. Filtrar cuotas impagas HOY (comparando en UTC+0)
      const impagasHoy = cuotas.filter((cuota) => {
        if (!cuota.fechaCobro) return false;
        
        const fechaCuota = new Date(cuota.fechaCobro);
        fechaCuota.setUTCHours(0, 0, 0, 0); // Normaliza a UTC+0 (medianoche)

        return (
          (cuota.estado_cuota === "impago" || cuota.estado_cuota === "pendiente") &&
          fechaCuota.getTime() === hoy.getTime() // Compara timestamps
        );
      });

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

      

      // 3. Preparar datos para el frontend (sin modificar zonas horarias)
      impagasHoy.forEach((cuota) => {
        cuotasImpagasHoy.push({
          cliente: {
            ...cliente,
            numero_telefono: cliente.telefono,
            direccion_comersial: cliente.direccion,
          },
          objetoRelacionado: producto,
          ...cuota,
          // Mantenemos la fecha original para evitar confusiones
          cant: cuotas.length,
          fr: formatFechaArg(fechaRealizada),
          fechaCobro: formatFechaArg(cuota.fechaCobro), 
        });
      });

      // 4. Lógica de cuotas pactadas (sin cambios)
      if (cuotasPactadas.length > 0) {
        const cuotasPagadas = cuotas.filter((c) => c.estado_cuota === "pago");
        const cuotasPactadasPagadas = cuotasPagadas.filter((c) =>
          cuotasPactadas.includes(c.numeroCuota)
        );

        if (cuotasPactadasPagadas.length > 0) {
          ventasConCuotaPactadaPagada.push({
            cliente: {
              ...cliente,
              nombre_familiar: cliente.nombre_familiar || "No especificado",
              apellido_familiar: cliente.apellido_familiar || "",
            },
            plan: producto,
            cuotas: cuotasPactadasPagadas.map((c) => ({
              ...c,
              numero_cuota: c.numeroCuota,
              monto_cuota: c.montoCuota,
              fecha_cobrada: formatFechaArg(c.fechaCobrada), // Mantener formato original
            })),
          });
        }
      }
    });

    res.json({
      ok: true,
      cuotasImpagasHoy,
      ventasConCuotaPactadaPagada,
    });
  } catch (err) {
    console.error("Error en getVentasConCuotasEspeciales:", err);
    res.status(500).json({ ok: false, msg: "Error interno del servidor" });
  }
};


const verificarNotificacionesNavbar = async (req, res) => {
  try {

        const now = Date.now();
    
    // Si hay cache válido, lo devolvemos
    if (notificationCache && (now - lastCacheUpdate < CACHE_TTL)) {
      return res.json(notificationCache);
    }

    const hoy = new Date();
    hoy.setUTCHours(0, 0, 0, 0);
    

    let hayCuotasHoy = false;
    let hayCuotasPactadas = false;
    let debugInfo = [];

    // Usamos populate para asegurar consistencia con el otro método
    const ventas = await Venta.find({ estado: true })
      .populate("producto")
      .lean();

    for (const venta of ventas) {
      const cuotas = venta.cuotas || [];
      const pactadas = venta.producto?.detalle?.venta?.cuotasPactadas || [];

      // Verificación cuotas hoy (igual que antes, está bien)
      const impagaHoy = cuotas.find(c => {
        if (!c.fechaCobro) return false;
        const fechaCuota = new Date(c.fechaCobro);
        fechaCuota.setUTCHours(0, 0, 0, 0);
        return (
          (c.estado_cuota === "impago" || c.estado_cuota === "pendiente") &&
          fechaCuota.getTime() === hoy.getTime()
        );
      });

      if (impagaHoy && !hayCuotasHoy) {
        hayCuotasHoy = true;
        debugInfo.push(`Venta ${venta._id}: Cuota para hoy encontrada`);
      }

      // VERIFICACIÓN MODIFICADA DE CUOTAS PACTADAS (como en el segundo método)
      if (!hayCuotasPactadas && pactadas.length > 0) {
        const cuotasPagadas = cuotas.filter(c => c.estado_cuota === "pago");
        const cuotasPactadasPagadas = cuotasPagadas.filter(c => 
          pactadas.includes(c.numeroCuota)
        );

        if (cuotasPactadasPagadas.length > 0) {
          hayCuotasPactadas = true;
          debugInfo.push(`Venta ${venta._id}: Tiene cuotas pactadas pagadas`);
        } else if (pactadas.length > 0) {
          // También considerar si hay pactadas pero ninguna pagada aún
          hayCuotasPactadas = false;
          debugInfo.push(`Venta ${venta._id}: Tiene cuotas pactadas (0 pagadas)`);
        }
      }

      if (hayCuotasHoy && hayCuotasPactadas) break;
    }

    // Determinar código final (igual que antes)
    let codigo;
    if (hayCuotasHoy && hayCuotasPactadas) {
      codigo = 2;
    } else if (hayCuotasHoy || hayCuotasPactadas) {
      codigo = 1;
    } else {
      codigo = 0;
    }
 
  

   // Actualizamos el cache
    notificationCache = {
      ok: true,
      notificacion: codigo,
      _cached: true,
      timestamp: new Date().toISOString()
    };
    lastCacheUpdate = now;

    return res.json(notificationCache);

  } catch (err) {
    console.error("Error en verificarNotificacionesNavbar:", err);
    return res.status(500).json({ ok: false, msg: "Error interno del servidor" });
  }
};

module.exports = {
   getVentasConCuotasEspeciales,
   verificarNotificacionesNavbar
  };

