const { model, Schema } = require('mongoose');

const ventaSchema = new Schema({
    numeroContrato: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },

    fechaRealizada: {
        type: Date,
        default: Date.now
    },

    metodoPago_monto_sus_vta: {// metodo de pago de el monto de suscripcion o venta directa segun corresponda
        type: String,
        required: true,
        trim: true
    },

    monto_suscripcion_vta_dir: {//generalizamos en el objeto el monto de suscripcion o sera monto de venta directa o de venta permutada
        type: Number,
        required: true,
        min: 0
    },


    vendedor: {

        sup_id: { type: Schema.Types.ObjectId, ref: 'Usuario' },//id del supervisor
        dni: String,
        nombre: String,
        apellido: String
    },

    producto: {
        nombre: String,
        tipo: String,
        detalle: {
            prestamo: {
                montoPrestado: Number,
                plazo: {
                    type: String,
                    enum: ["diario", "semanal", "quincenal", "mensual"]
                }
            },
            venta: {
                banderas: {
                    ventaDirecta: { type: Boolean, default: false },
                    largoPlazo: { type: Boolean, default: false },
                    entregaInmediata: { type: Boolean, default: false },
                    permutada: { type: Boolean, default: false }
                },
                cuotasPactadas: [Number],
                itemInventario: {
                    nombre: String,
                    modelo: String,
                    serial: String
                },
                montoEntregaInmediata: Number,
                metodoPago_EntregaInm: String,//metodo de pago de la entrega
                objetoRecibido: String,
                montoObjetoRecibido: Number
            }
        }
    },

    cuotas: [{
        numeroCuota: Number,
        montoCuota: Number,
        metodoPago: String,
        comentario: String,
        fechaCobro: Date,
        estado_cuota: {
            type: String,
            //-(cuando paga algo o se atrasa pero si paga)-(cuando no quiere pagar)(es base comoa rrancan todas las cuotas)
            enum: ["pago", "pendiente", "no pagado", "impago"]
        },
         
        fechaCobrada: Date,
        cobrador: {
            id: { type: Schema.Types.ObjectId, ref: "Usuario" },
            dni: String,
            nombre: String,
            apellido: String
        }
    }],

    cliente: {
        nombre: String,
        apellido: String,
        dni: String,
        telefono: String,
        tipo_Tarjeta: String,
        email: String,
        direccion: String,
        direccion_2: String,
        nombre_fam: String,
        apellido_fam: String,

    },

    conducta_o_instancia: { //al dia, canselado:(termino de pagar),refinanciado:(se le refinancia las cuotas),atrasado:(debe meses),cobro judicial(ya debe aprox un mes)
        type: String,
        enum: ["al dia", "canselado", "refinanciado", "atrasado", "cobro judicial", "caducado"],//cobro judicial o caduco podrian hacer referencia a lo mismo
        default: "al dia",
        required: true
    },

    estado: {
        type: Boolean,
        default: true   //activo/inactivo (pendiente,canselado)
    },

}, { timestamps: true });

module.exports = model("Venta", ventaSchema);

