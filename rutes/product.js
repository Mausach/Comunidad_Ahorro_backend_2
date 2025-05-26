const express = require('express');


const { check } = require('express-validator');
const { validarCampos } = require('../midelwares/validarCampos');
const { validarJWTRolesCreadorGerente } = require('../midelwares/validarJWTCreadorGerente');
const { crearProducto, cargarProductos, actualizarProducto, agregarMultiplesItems, eliminarItemPorSerial, editarItemPorSerial, cambiarEstadoProducto } = require('../controllers/product');
const { validarJWTRolesSuperiores } = require('../midelwares/ValidarJWTSuperiores');
//const { crearUsuario, actualizarUsuario, cargarUsuarios, CambiarEstadoUsuario, crearEquipo, quitarDeEquipo, asignarAEquipo, rendirSaldo } = require('../controllers/admin');


//const { validarJWTAdmin } = require('../Midelwares/validarJwtAdmin');

const routerProduct = express.Router();

//RUTA PARA FUNCIONES SOBRE EL USUARIO EMPLEADO , PARA GERENTES CREADOR Y ADMIN.

//nuevo usuario


//nuevo producto
routerProduct.post(
    '/new-product',
    validarJWTRolesCreadorGerente,
    [
      check('nombre', 'El nombre es obligatorio').not().isEmpty(),
      check('descripcion', 'La descripción es obligatoria').not().isEmpty(),
      check('tipo', 'el tipo es obligatorio').not().isEmpty(),
  
      validarCampos
    ],
    crearProducto
  );

//editar producto 
routerProduct.put(
  '/update-product',
  validarJWTRolesCreadorGerente,
  [
    check('nombre', 'El nombre es obligatorio').not().isEmpty(),
    check('descripcion', 'La descripción es obligatoria').not().isEmpty(),
    check('tipo', 'el tipo es obligatorio').not().isEmpty(),
    validarCampos
  ],
  actualizarProducto
);

//agregar a stock
routerProduct.put(
  '/push-stock',
  validarJWTRolesCreadorGerente,
  agregarMultiplesItems
);

//editar a stock
routerProduct.put(
  '/edit_item-stock',
  validarJWTRolesCreadorGerente,
  editarItemPorSerial
);

//cambiar estado
routerProduct.put(
  '/cambiar-estado',
  validarJWTRolesCreadorGerente,
  cambiarEstadoProducto
);

//quitar un item de stock
routerProduct.put(
  '/drop-stock',
  validarJWTRolesCreadorGerente,
  eliminarItemPorSerial
);


//routerAdmin.delete('/eliminar/:id', validarJWTAdmin, eliminarProducto);

//routerAdmin.get('/productos', cargarProducto);//no lleva validar token asi los usuarios no logueados puedan ver la tienda

routerProduct.get('/productos',validarJWTRolesSuperiores,cargarProductos);

//routerAdmin.get('/pedidos', validarJWTAdmin, cargarPedidos);

//routerAdmin.put('/confirmar', validarJWTAdmin, confirmarPedido);

//aclaras que se exporta todo lo trabajado con router
module.exports = routerProduct;