const express = require('express');

const { check } = require('express-validator');
const { validarCampos } = require('../midelwares/validarCampos');
const { validarJWTVentas } = require('../midelwares/ValidarSWTVentas');
const { crearVentaCompleta, cargarPrestamos, cargarSistemaVentas, procesarVenta2, crearCliente2, actualizarVenta,buscarClientePorDNI } = require('../controllers/RegVentas');


const routerVentas = express.Router();




//para crear la venbta completa
routerVentas.post('/new-venta',validarJWTVentas,

    [
      check('dni', 'El DNI es obligatorio y debe tener 8 caracteres').isLength({ min: 8, max: 8 }).isNumeric(),
  
      validarCampos, // Middleware para validar los campos de entrada
    ],
    crearVentaCompleta
);

//crear cliente 2
routerVentas.post('/new-clientes',
  validarJWTVentas,

    [
      check('dni', 'El DNI es obligatorio y debe tener 8 caracteres').isLength({ min: 8, max: 8 }).isNumeric(),
  
      validarCampos, // Middleware para validar los campos de entrada
    ],
  crearCliente2);


//para actualizar toda la venta
routerVentas.put('/update-vta/:id', actualizarVenta);
  //procesar venta 2
routerVentas.post('/ventas-procesar', validarJWTVentas, procesarVenta2);

routerVentas.get('/buscar-cliente', validarJWTVentas, buscarClientePorDNI);

routerVentas.get('/ventas-pres', validarJWTVentas, cargarPrestamos);

routerVentas.get('/ventas-sis-vta', validarJWTVentas, cargarSistemaVentas);





module.exports = routerVentas;