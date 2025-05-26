const express = require('express');

const { check } = require('express-validator');
const { validarJWTRolesCreadorGerente } = require('../midelwares/validarJWTCreadorGerente');
const { agregarMultiplesItems, actualizarItemInventario, eliminarItemInventario, obtenerTodosLosItems } = require('../controllers/Inventario');

const routerInv = express.Router();

// Middleware de validación común
const validarItem = [
    check('nombre', 'El nombre es requerido').not().isEmpty(),
    check('tipo', 'El tipo debe ser dispositivo o accesorio').isIn(['dispositivo', 'accesorio']),
    check('estado', 'Estado no válido').optional().isIn(['disponible', 'asignado', 'en_reparacion', 'perdido', 'baja']),
    check('precio_compra', 'El precio de compra debe ser un número').optional().isNumeric(),
    check('precio_venta', 'El precio de venta debe ser un número').optional().isNumeric(),
    check('imei_serial', 'El IMEI/Serial debe tener 15 caracteres').optional().isLength({ min: 15, max: 15 })
];


//agregar a stock
routerInv.post(
  '/push-stock',
  validarJWTRolesCreadorGerente,
  agregarMultiplesItems
);

//editar a stock
routerInv.put(
  '/edit_item-stock',
  validarJWTRolesCreadorGerente,
  validarItem,
  actualizarItemInventario
);

routerInv.delete(
    '/delete-inv/:id', 
    validarJWTRolesCreadorGerente,
    eliminarItemInventario
);

// Rutas de Inventario
routerInv.get('/inv',
    validarJWTRolesCreadorGerente,  
    obtenerTodosLosItems
);


module.exports = routerInv;