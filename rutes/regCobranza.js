const express = require('express');

const { check } = require('express-validator');
const { validarCampos } = require('../midelwares/validarCampos');


const { validarJWTCobranza } = require('../midelwares/validarJWTCobranza');
const { cargarVentas, procesarCobranzaCuota, getCuotasHoyPorDNI, editarMontoCuota } = require('../controllers/regCobranza');


const routerCobros = express.Router();



/*
//para crear la venbta completa
routerCobros.post('/new-venta',validarJWTCobranza,

    [
      check('dni', 'El DNI es obligatorio y debe tener 8 caracteres').isLength({ min: 8, max: 8 }).isNumeric(),
  
      validarCampos, // Middleware para validar los campos de entrada
    ],
    crearVentaCompleta
);
*/

routerCobros.put('/cuotas/editar-monto',validarJWTCobranza, editarMontoCuota);

//
routerCobros.get('/cuotas-hoy/:dni', getCuotasHoyPorDNI);
//para logear usuario
routerCobros.get('/ventas-cli', validarJWTCobranza, cargarVentas);

routerCobros.put('/cobranza/procesar', validarJWTCobranza, procesarCobranzaCuota);



module.exports = routerCobros;