const express = require('express');

const { check } = require('express-validator');
const { validarCampos } = require('../midelwares/validarCampos');
const { loginUsuario } = require('../controllers/auth');

const routerAuth = express.Router();


//para logear usuario
routerAuth.post('/login',
    [
        check("emailOrUsername", "El email o nombre de usuario es obligatorio").not().isEmpty(),
        check("password", "La contraseña es obligatoria").not().isEmpty(),
        validarCampos
    ],
    loginUsuario
);


module.exports = routerAuth;