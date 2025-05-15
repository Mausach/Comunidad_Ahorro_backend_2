const express = require('express');

const { check } = require('express-validator');
const { validarCampos } = require('../midelwares/validarCampos');
const { validarJWTVentas } = require('../midelwares/ValidarSWTVentas');
const { cargarRendiciones, aceptaRendicionVenta, aceptarRendicionCobranza, getRendicionesPendientesPorUsuario } = require('../controllers/rendicione');
const { validarJWTRolesCreadorGerente } = require('../midelwares/validarJWTCreadorGerente');

const routerRen = express.Router();

//aceptar rendicion 
routerRen.put(
  '/acept-rend-vta',
  validarJWTRolesCreadorGerente,
 
  aceptaRendicionVenta
);

//aceptar cobranza
routerRen.put(
    '/acept-rend-cob',
    validarJWTRolesCreadorGerente,
   
    aceptarRendicionCobranza
  );

//para logear usuario
routerRen.get('/rendiciones', validarJWTVentas, cargarRendiciones);

routerRen.get('/rend-pend/:dni', getRendicionesPendientesPorUsuario);


module.exports = routerRen;