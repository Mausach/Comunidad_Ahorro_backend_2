const { model, Schema } = require('mongoose');

const productoSchema = new Schema({
    // === Datos Básicos ===
    nombre: {
        type: String,
        required: true,
        trim: true
    },

    descripcion: {
        type: String,
        trim: true
    },

    tipo: {
        type: String,
        enum: ["prestamo", "sistema_venta"],
        required: true
    },

    estado: {
        type: Boolean,
        default: true   //activo/inactivo
    },

    // === Flags de Comportamiento ===
    bandera: {
        plan: {
            type: Boolean,
            default: false
        },
        venta_directa: { //en este caso lo usaremos tambien para hacer la venta de servicios y o accesorios
            type: Boolean,
            default: false
        },
        entrega_inmediata: {
            type: Boolean,
            default: false
        },
        permutada: {
            type: Boolean,
            default: false
        }
    },

    // === Campos Condicionales por Tipo ===
    detalles: {
        // >>> PARA PRÉSTAMOS
        prestamo: {
            capitalTotal: {
                type: Number,
                min: 0,
                
            },
            montoMaximoPorUsuario: {
                type: Number,
                min: 0,
               
            },
            plazoCobranza: {
                type: String,
                enum: ["diario", "semanal", "quincenal", "mensual"],
               
            }
        },

        // >>> PARA SISTEMA DE VENTA
        venta: {
            costoAdministrativo: {
                type: Number,
                min: 0,
               
            },
            plazo: {
                type: String,
                enum: ["diario", "semanal", "quincenal", "mensual"],
               
            },
            plazosPactados: {
                type: [Number],
                
            },
            inventario: {
                type: [{
                    nombreItem: {
                        type: String,
                        required: true,
                        trim: true
                    },
                    modelo: {
                        type: String,
                        trim: true
                    },
                    serial: {
                        type: String,
                        required: true,
                        unique: true,
                        sparse: true // Permite nulos pero evita duplicados en no-nulos
                    },
                    fechaIngreso: {
                        type: Date,
                        default: Date.now
                    },
                    estado: {
                        type: String,
                        enum: ["disponible", "reservado", "vendido", "en_reparacion"],
                        default: "disponible"
                    }
                }],
               
            }
        }
    }

}, { timestamps: true }); // Agrega createdAt y updatedAt automáticamente

module.exports = model("Producto", productoSchema);