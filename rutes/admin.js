const express = require('express');


const { check } = require('express-validator');
const { validarCampos } = require('../midelwares/validarCampos');
const { crearUsuario, actualizarUsuario, cargarUsuarios, CambiarEstadoUsuario, crearEquipo, quitarDeEquipo, asignarAEquipo, rendirSaldo, cargarClientes, actualizarCliente, cargarGastos, crearGasto } = require('../controllers/admin');
const { validarJWTRolesSuperiores } = require('../midelwares/ValidarJWTSuperiores');

//const { validarJWTAdmin } = require('../Midelwares/validarJwtAdmin');

const routerAdmin = express.Router();

//RUTA PARA FUNCIONES SOBRE EL USUARIO EMPLEADO , PARA GERENTES CREADOR Y ADMIN.

//nuevo usuario
routerAdmin.post(
  '/new-user', validarJWTRolesSuperiores, [ //la ruta para crear un nuevo usuario empleado

  check("nombre", "El nombre es obligatorio").not().isEmpty().trim(),
  check("apellido", "El apellido es obligatorio").not().isEmpty().trim(),
  check("rol", "El rol es obligatorio").not().isEmpty(),
  check("direccion", "La dirección es obligatoria").not().isEmpty().trim(),
  check("email", "El email es obligatorio").not().isEmpty().isEmail().normalizeEmail(),
  check("telefono", "El teléfono es obligatorio").not().isEmpty().isMobilePhone(),
  check("localidad", "La localidad es obligatoria").not().isEmpty().trim(),
  check("userName", "El nombre de usuario es obligatorio").not().isEmpty().trim(),
  check("password", "la contraseña debe ser de minimo 5").isLength({
    min: 5,
  }),

  // === Validaciones adicionales (opcionales) ===
  check("dni", "El DNI debe tener 8 dígitos").isLength({ min: 8, max: 8 }),
  check("cuil", "El CUIL debe tener 11 dígitos").optional().isLength({ min: 11, max: 11 }),
  validarCampos,



], crearUsuario
);

// Ruta para crear equipos de venta
routerAdmin.post(
  '/new-equipos-venta',
  validarJWTRolesSuperiores, // Middleware de autenticación
  [
    // Validaciones con express-validator
    check('supervisorId', 'El ID del supervisor es obligatorio')
      .not().isEmpty()
      .isMongoId().withMessage('No es un ID válido'),

    check('vendedoresIds', 'Debe proporcionar al menos un vendedor')
      .isArray({ min: 1 }).withMessage('Debe ser un array con al menos un elemento'),

    check('vendedoresIds.*', 'Cada ID de vendedor debe ser válido')
      .isMongoId(),

    validarCampos
  ],
  crearEquipo
);

//realiza el pago de un saldo pendiente
routerAdmin.post(
  '/realizar-pago', validarJWTRolesSuperiores, [ //la ruta para crear un nuevo usuario empleado

  check("usuarioId", "El id del usuario es obligatorio").not().isEmpty(),
  check("monto", "El monto debe ser un número entero positivo").isInt({ gt: 0 }),
  check("responsable", "El responsable de la operacion es obligatorio").not().isEmpty(),
  validarCampos,
], rendirSaldo
);

//CREA GASTOS
routerAdmin.post(
  '/new-gasto', validarJWTRolesSuperiores, [ //la ruta para crear un nuevo usuario empleado

  check("descripcion_gasto", "La descripcion del gasto es obligatoria").not().isEmpty(),
  check("Monto_gasto", "El monto del gasto debe ser un numero positivo").isInt({ gt: 0 }),
  check("responsable", "El responsable de la operacion es obligatorio").not().isEmpty(),
  validarCampos,
], crearGasto
);

//editar datos del usuario
routerAdmin.put(
  '/update-user',
  validarJWTRolesSuperiores,
  [
    check("nombre", "El nombre es obligatorio").optional().not().isEmpty().trim(),
    check("apellido", "El apellido es obligatorio").optional().not().isEmpty().trim(),
    check("direccion", "La dirección es obligatoria").optional().not().isEmpty().trim(),
    check("email", "El email debe ser válido").optional().isEmail(),
    check("telefono", "El teléfono es obligatorio").optional().not().isEmpty(),
    check("localidad", "La localidad es obligatoria").optional().not().isEmpty().trim(),
    check("userName", "El nombre de usuario es obligatorio").optional().not().isEmpty().trim(),
    check("password", "La contraseña debe tener mínimo 5 caracteres").optional().isLength({ min: 5 }),
    check("dni", "El DNI debe tener 8 dígitos").optional().isLength({ min: 8, max: 8 }),
    check("cuil", "El CUIL debe tener 11 dígitos").optional().isLength({ min: 11, max: 11 }),
    validarCampos
  ],
  actualizarUsuario
);

//desvincular
routerAdmin.put(
  '/desv-user',
  validarJWTRolesSuperiores,
  [
    check("vendedorId", "error en la desvinculacion del vendedor").not().isEmpty(),

    validarCampos
  ],
  quitarDeEquipo
);

//vincular vendedor
routerAdmin.put(
  '/vin-user',
  validarJWTRolesSuperiores,
  [
    check("vendedorId", "error en la vinculacion del vendedor").not().isEmpty(),
    check("supervisorId", "error en la vinculacion del vendedor").not().isEmpty(),

    validarCampos
  ],
  asignarAEquipo
);

// Obtener todos los clientes
routerAdmin.get('/clientes', validarJWTRolesSuperiores, cargarClientes);

// Actualizar un cliente (envía _id en el body)
routerAdmin.put('/edit-usuarios',validarJWTRolesSuperiores, actualizarCliente);


routerAdmin.get('/usuarios', validarJWTRolesSuperiores, cargarUsuarios);


routerAdmin.get('/gastos', validarJWTRolesSuperiores, cargarGastos);

//routerAdmin.put('/confirmar', validarJWTAdmin, confirmarPedido);

routerAdmin.put('/change-state', validarJWTRolesSuperiores, CambiarEstadoUsuario);


//aclaras que se exporta todo lo trabajado con router
module.exports = routerAdmin;