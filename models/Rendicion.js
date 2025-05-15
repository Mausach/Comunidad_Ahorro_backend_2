const { Schema, model } = require('mongoose');

const rendicionSchema = new Schema({

  montoARendir: {
    type: Number,
    required: true
  },

  fechaRendida: {
    type: Date,
    // se coloca cuando se acepta la rendicion
  },

  tipo: {
    type: String,
    enum: ['cobranza', 'venta'],  // Ahora es ÚNICO tipo para todo datoRendicion
    required: true
  },

  estado: { // false seria pendiente todabia no rendido
    type: Boolean,
    default: false
  },

  // Un solo arreglo de datos relacionados a la rendición
  datoRendicion: [{

    // Común para venta y cuota
    nombreProducto: { type: String },
    tipo:{type: String},
    costoAdministrativoProduct: {type: Number},//coste administrativo del producto
    // Datos de venta (solo si tipo === 'venta')
    numeroContrato: { type: String },
    montoPrestado: { type: Number },//prestamo
    suscripcionInicial_MontoVenta: { type: Number },//plan/entrega inmediata/prestamo/directa
    objetoRecibido: { type: String },//permutada
    itemServicioEntregado: { type: String },//entrega inmediata/permutada/directa
    serialItem: { type: String },//imei
    vendedor: {
      nombre: { type: String },
      apellido: { type: String },
      dni: { type: String }
    },

    // Datos de cobro de cuota (solo si tipo === 'cobranza')
    numeroCuota: { type: Number },
    monto: { type: Number },
    metodoPago: {
      type: String,
      enum: ['efectivo', 'transferencia', 'tarjeta_credito', 'tarjeta_debito','dolares','usdt']
    },

    // Cliente (común para ambos)
    cliente: {
      nombre: { type: String },
      apellido: { type: String },
      dni: { type: String }
    }
  }],

  // Usuario que realiza la rendición (supervisor cobrador administrador)
  usuario: {
    id: { type: Schema.Types.ObjectId, ref: 'Usuario' },
    nombre: { type: String },
    apellido: { type: String },
    dni: { type: String }
  }

}, { timestamps: true });

module.exports = model('Rendicion', rendicionSchema);




