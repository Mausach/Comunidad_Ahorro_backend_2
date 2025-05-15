const { model, Schema } = require('mongoose');

const userSchema = new Schema({
    // === Datos Básicos ===
    nombre: {
        type: String,
        required: true,
        trim: true
    },

    apellido: {
        type: String,
        required: true,
        trim: true
    },

    nombre_fam: {
        type: String,
        trim: true
    },

    apellido_fam: {
        type: String,
        trim: true
    },

    dni: {
        type: String,
        required: true,
        unique: true
    },

    cuil: {
        type: String,
        unique: true,
        sparse: true // Ignora nulos/vacíos en la 
    },

    localidad: {
        type: String,
        lowercase: true
    },

    // === Contacto ===
    email: {
        type: String,
        required: true,
        unique: true
    },

    telefono: {
        type: String,
        required: true
    },

    telefonoSecundario: {
        type: String
    },

    // === Dirección ===
    direccion: {
        type: String,
        required: true
    },

    direccionSecundaria: {
        type: String
    },

    // === Datos Laborales ===
    fechaIngreso: {
        type: Date,
        default: Date.now
    },

    fechaSalida: {
        type: Date
    },

    estado: {
        type: Boolean,
        default: true
    },

    monotributo: {
        type: Boolean,
        default: false
    },

    // === Saldos ===

    saldoPendiente: {
        type: Number,
        default: 0, // Comisiones no pagadas
        min: 0
    },

    saldoRendido: {
        type: [ // Array para historial de pagos
            {
                responsable: { type: String, required: true },
                monto: { type: Number, required: true },
                fecha: { type: Date, default: Date.now }
            }
        ],
        default: []
    },

    // === Autenticación ===
    userName: {
        type: String,
        required: true
    },

    password: {
        type: String,
        required: true
    },

    // === Roles y Jerarquía ===
    rol: {
        type: String,
        enum: ["creador", "gerente", "administrador", "supervisor", "vendedor", "cobrador"],
        default: "vendedor"
    },

    supervisorId: {
        type: Schema.Types.ObjectId,
        ref: "Usuario" // Referencia sin validación integrada
    },


}, { timestamps: true });//lo dejamos por si hay consultas de fecha de creacion o fechas de actualizacion con (createdAt,updatedAt)

module.exports = model("Usuario", userSchema);