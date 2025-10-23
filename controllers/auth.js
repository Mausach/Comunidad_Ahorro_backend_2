const bcryptjs = require('bcrypt');
const jwt = require("jsonwebtoken");
const Usuario = require('../models/Usuario');



const loginUsuario = async (req, res) => {
    const { emailOrUsername, password } = req.body; // Cambiamos el nombre del campo

    try {
        // 1. Buscar usuario por email O username
        const user = await Usuario.findOne({
            $or: [
                { email: emailOrUsername },
                { userName: emailOrUsername }
            ]
        });

        if (!user) {
            return res.status(400).json({
                ok: false,
                msg: "Credenciales inválidas" // Mensaje genérico por seguridad
            });
        }

        // 2. Validar contraseña
        const validPassword = bcryptjs.compareSync(password, user.password);
        if (!validPassword) {
            return res.status(400).json({
                ok: false,
                msg: "Credenciales inválidas" // Mismo mensaje para evitar filtraciones
            });
        }

        // 3. Validar estado (ahora es booleano según tu schema)
        if (!user.estado) {
            return res.status(403).json({
                ok: false,
                msg: "Usuario inhabilitado. Contacte al administrador"
            });
        }

        // 4. Generar JWT
        const payload = {
            id: user._id,
            name: user.nombre, // Cambiado de 'name' a 'nombre' (consistente con tu schema)
            rol: user.rol,
        };

        const token = jwt.sign(payload, process.env.SECRET_JWT, {
            expiresIn: "6h",
        });

        // 5. Respuesta exitosa
        res.status(200).json({
            ok: true,
            usuario:user,
            token,
            msg: "Inicio de sesión exitoso",
        });

    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({
            ok: false,
            msg: "Error interno. Contacte al administrador"
        });
    }
};



module.exports = {
    loginUsuario,
   
};