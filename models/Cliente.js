const { Schema, model } = require('mongoose');

const clienteSchema = new Schema({
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
        required: true,
        trim: true
    },

    apellido_fam: {
        type: String,
        required: true,
        trim: true
    },

    dni: {
        type: String,
        required: true,
        unique: true
    },

    cuil: {
        type: String,
        default: undefined,
        unique: true,
        sparse: true, // Permite valores nulos sin romper el índice único
         default: undefined
    },

    numero_cliente: {
        type: String,
        required: true,
        unique: true
    },

    situacion_veraz: {
        type: Number
    },

    // === Contacto ===
    email: {
        type: String,
        default: undefined,
        unique: true,
        sparse: true, // Permite valores nulos sin romper el índice único
        default: undefined
    },

    numero_telefono: {
        type: String,
        required: true,
        
    },

    numero_telefono_2: {
        type: String,
       
    },

    // === Dirección ===
    direccion_hogar: {
        type: String,
        required: true
    },

    direccion_comercial: {
        type: String
    },

    localidad: {
        type: String,
        lowercase: true
    },

}, { timestamps: true });

module.exports = model("Cliente", clienteSchema);
