const express = require('express');

const { validarJWTRolesSuperiores } = require('../midelwares/ValidarJWTSuperiores');
const { getVentasConCuotasEspeciales, verificarNotificacionesNavbar } = require('../controllers/notificaciones');

const routerNoti = express.Router();

//cargar notificaciones
routerNoti.get('/cuotas-dia-pac', validarJWTRolesSuperiores,getVentasConCuotasEspeciales );

//cargar navbar
routerNoti.get('/camp', validarJWTRolesSuperiores,verificarNotificacionesNavbar );


module.exports = routerNoti;