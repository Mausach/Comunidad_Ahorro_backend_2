const { Schema, model } = require('mongoose');

const inventarioSchema = new Schema({
    // === Datos Básicos ===
    nombre: {
        type: String,
        required: true,
        trim: true,
        uppercase: true
    },

    tipo: {
        type: String,
        required: true,
        enum: ['dispositivo', 'accesorio'],
        default: 'dispositivo'
    },

    modelo: {
        type: String,
        
        trim: true,
        uppercase: true
    },

    // === Específicos para dispositivos ===
    memoria_ram: {
        type: String,
        
        trim: true
    },

    almacenamiento: {
        type: String,
        
        trim: true
    },

    bateria: {
        type: String,
        trim: true
    },

    color: {
        type: String,
        trim: true,
        
    },

    // === Campos para ambos tipos ===
    caracteristicas: {
        type: String,
        
    },

    imei_serial: {
        type: String,
        unique: true,
        sparse: true,
        trim: true,
    },

    numero_serie: {
        type: String,
        unique: true,
        sparse: true,
        trim: true,
        uppercase: true
    },

    // === Estado e inventario ===
    estado: {
        type: String,
        required: true,
        enum: ['disponible', 'asignado', 'en_reparacion', 'perdido', 'baja'],
        default: 'disponible'
    },

    fecha_ingreso: {
        type: Date,
        required: true,
        default: Date.now
    },

    fecha_baja: {
        type: Date
    },

    motivo_baja: {
        type: String,
        trim: true
    },

    // === Relaciones ===
    asignado_a: {
        type: Schema.Types.ObjectId,
        ref: 'Cliente'
    },

    // === Precios ===
    precio_compra: {
        type: Number,
        min: 0
    },

    precio_venta: {
        type: Number,
        min: 0
    },

    // === Para accesorios ===
    categoria_accesorio: {
        type: String,
        enum: ['cargador', 'auricular', 'funda', 'protector', 'cable', 'otros'],
        trim: true
    },


},{ timestamps: true });


module.exports = model("Inventario", inventarioSchema);