const bcryptjs = require('bcrypt');
const jwt = require("jsonwebtoken");
const Usuario = require('../models/Usuario');
const Cliente = require('../models/Cliente');
const Gastos = require('../models/Gastos');


//crear usuario empleado
const crearUsuario = async (req, res) => {
    const { nombre, apellido,nombre_fam,apellido_fam, email, userName, password, rol, direccion,
         telefono,telefonoSecundario, localidad, dni,cuil,monotributo } = req.body;

    try {
        // Validar campos obligatorios
        if (!nombre || !apellido || !email || !password || !rol || !direccion || !telefono || !localidad || !dni) {
            return res.status(400).json({
                ok: false,
                msg: "Faltan campos obligatorios: nombre, apellido, email, password, rol, direccion, telefono, localidad"
            });
        }

        // Verificar si el usuario ya existe
        let user = await Usuario.findOne({ dni });
        if (user) {
            return res.status(400).json({
                ok: false,
                msg: "Ya existe un usuario con ese DNI"
            });
        }

        // Crear nuevo usuario con datos mínimos requeridos
        user = new Usuario({
            nombre,
            apellido,
            nombre_fam,
            apellido_fam,
            dni,
            cuil,
            email,
            userName,
            password, // Será encriptado
            rol,
            monotributo,
            direccion,
           //direccionSecundaria,
            telefono,
            telefonoSecundario,
            localidad,
            estado: true, // Por defecto activo
            fechaIngreso: new Date() // Fecha actual por defecto
        });

        // Encriptar contraseña
        const salt = bcryptjs.genSaltSync(10);
        user.password = bcryptjs.hashSync(password, salt);

        // Guardar usuario
        await user.save();

        // Generar JWT
        const payload = {
            id: user._id,
            nombre: user.nombre,
            rol: user.rol,
        };

        const token = jwt.sign(payload, process.env.SECRET_JWT, {
            expiresIn: "2h",
        });

        // Respuesta exitosa
        res.status(201).json({
            ok: true,
            msg: 'Usuario creado correctamente'
        });

    } catch (error) {
        console.error('Error al crear usuario:', error);
        res.status(500).json({
            ok: false,
            msg: "Error interno del servidor. Por favor contacte al administrador"
        });
    }
};

// Modifica datos personales del usuario empleado
const actualizarUsuario = async (req, res) => {
    const { _id } = req.body; // Obtener el ID del cuerpo de la solicitud
    
    try {
        // 1. Verificar existencia
        const usuario = await Usuario.findById(_id);
        if (!usuario) {
            return res.status(404).json({ ok: false, msg: "Usuario no encontrado" });
        }

        // 2. Extraer campos editables
        const { nombre, apellido, email, userName, password,
                direccion, direccionSecundaria, telefono,
                telefonoSecundario, localidad, dni, cuil,
                monotributo, fechaSalida, rol,
                nombre_fam, apellido_fam } = req.body;

        const updates = { 
            nombre, apellido, email, userName,
            direccion, direccionSecundaria, telefono,
            telefonoSecundario, localidad, dni, cuil,
            monotributo, fechaSalida, rol,
            nombre_fam, apellido_fam 
        };

        // 3. Solo incluir password si se proporciona
        if (password) {
            const salt = bcryptjs.genSaltSync(10);
            updates.password = bcryptjs.hashSync(password, salt);
        }

        // 4. Validar unicidad solo si cambian email/dni
        if (updates.email && updates.email !== usuario.email) {
            const existe = await usuario.findOne({ email: updates.email, _id: { $ne: _id } });
            if (existe) return res.status(400).json({ ok: false, msg: "Email ya en uso" });
        }
        
        if (updates.dni && updates.dni !== usuario.dni) {
            const existe = await usuario.findOne({ dni: updates.dni, _id: { $ne: _id } });
            if (existe) return res.status(400).json({ ok: false, msg: "DNI ya en uso" });
        }

        // 5. Validar rol si se modifica
        const rolesPermitidos = ['creador', 'gerente', 'administrador', 'supervisor', 'vendedor', 'cobrador'];
        if (updates.rol && !rolesPermitidos.includes(updates.rol)) {
            return res.status(400).json({ ok: false, msg: "Rol no válido" });
        }

        // 6. Actualizar usuario
        const usuarioActualizado = await Usuario.findByIdAndUpdate(_id, updates, { 
            new: true,
            select: '-password -__v' // Excluir campos sensibles
        });

        res.json({
            ok: true,
            msg: 'Usuario actualizado correctamente',
            usuario: usuarioActualizado,
            camposActualizados: Object.keys(updates)
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ 
            ok: false, 
            msg: "Error interno del servidor",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

//cargar usuarios
const cargarUsuarios = async (req, res) => {
    try {
        const usuarios = await Usuario.find({ rol: { $ne: "creador" } }) // $ne = not equal
        .select('-password -__v')
        .lean();

        // Función segura para formatear fechas (solo si existe)
        const formatFechaArg = (fecha) => {
            if (!fecha || !(fecha instanceof Date)) return undefined;
            return fecha.toLocaleDateString('es-AR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        };

        const usuariosFormateados = usuarios.map(usuario => {
            const usuarioFormateado = { ...usuario };

            // Formatear fechas directas (solo si existen)
            if (usuario.fechaIngreso) {
                usuarioFormateado.fechaIngreso = formatFechaArg(usuario.fechaIngreso);
            }
            if (usuario.fechaSalida) {
                usuarioFormateado.fechaSalida = formatFechaArg(usuario.fechaSalida);
            }

            // Formatear fechas en saldoRendido (si existe el array)
            if (usuario.saldoRendido?.length > 0) {
                usuarioFormateado.saldoRendido = usuario.saldoRendido.map(pago => ({
                    ...pago,
                    fecha: pago.fecha ? formatFechaArg(pago.fecha) : undefined
                }));
            }

            return usuarioFormateado;
        });

        res.status(200).json({
            ok: true,
            msg: "Usuarios cargados exitosamente",
            usuarios: usuariosFormateados,
            total: usuarios.length
        });

    } catch (error) {
        console.error('Error al cargar usuarios:', error);
        res.status(500).json({
            ok: false,
            msg: "Error interno. Por favor contacte al administrador"
        });
    }
};

//cambiar estado de usuario
const CambiarEstadoUsuario = async (req, res) => {
    try {
        // 1. Buscar usuario por ID
        const usuario = await Usuario.findById(req.body._id); // Soporta ambos formatos

        // 2. Verificar existencia
        if (!usuario) {
            return res.status(404).json({
                ok: false,
                msg: 'No existe ningún usuario con este ID',
            });
        }

       // 3. Alternar estado (true → false, false → true)
       usuario.estado = !usuario.estado;

       // 4. Guardar cambios
       await usuario.save();

       // 5. Respuesta con nuevo estado
       res.status(200).json({
           ok: true,
           msg: usuario.estado 
               ? 'Usuario habilitado correctamente' 
               : 'Usuario deshabilitado correctamente',
           usuario: {
               _id: usuario._id,
               nombre: usuario.nombre,
               estado: usuario.estado
           }
       });


    } catch (error) {
        console.error('Error al deshabilitar usuario:', error);
        res.status(500).json({
            ok: false,
            msg: 'Error interno. Por favor contacte al administrador',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

//rendirsaldo a empleado
const rendirSaldo = async (req, res) => {
    const { usuarioId, monto,responsable } = req.body;

    try {
        const usuario = await Usuario.findById(usuarioId);
        if (!usuario) {
            return res.status(404).json({
                ok: false,
                msg: 'Usuario no encontrado'
            });
        }

        // Validar que el monto no exceda el saldo pendiente
        if (monto > usuario.saldoPendiente) {
            return res.status(400).json({
                ok: false,
                msg: 'El monto excede el saldo pendiente'
            });
        }

        // 1. Agregar registro al array saldoRendido
        usuario.saldoRendido.push({
            responsable: responsable,
            monto: monto,
            fecha: new Date()  // Fecha automática del sistema
        });

        // 2. Actualizar saldos
        usuario.saldoPendiente -= monto;

        await usuario.save();

        res.status(200).json({
            ok: true,
            msg: 'Saldo rendido correctamente',
            saldoActualizado: {
                pendiente: usuario.saldoPendiente
            }
        });

    } catch (error) {
        console.error('Error al rendir saldo:', error);
        res.status(500).json({
            ok: false,
            msg: 'Error interno. Contacte al administrador'
        });
    }
};

//crear equipo de venta
const crearEquipo = async (req, res) => {
    const { supervisorId, vendedoresIds } = req.body;

    // Validar que vendedoresIds sea un array
    if (!Array.isArray(vendedoresIds)) {
        return res.status(400).json({
            ok: false,
            msg: 'vendedoresIds debe ser un array de IDs'
        });
    }

    try {
        // Validar supervisor
        const supervisor = await Usuario.findOne({
            _id: supervisorId,
            rol: 'supervisor'
        });
        if (!supervisor) {
            return res.status(400).json({
                ok: false,
                msg: 'Supervisor no válido'
            });
        }

        // Validar vendedores (solo IDs válidos y rol vendedor)
        const vendedoresValidos = await Usuario.find({
            _id: { $in: vendedoresIds },
            rol: 'vendedor'
        });
        if (vendedoresValidos.length !== vendedoresIds.length) {
            return res.status(400).json({
                ok: false,
                msg: 'Algunos vendedores no son válidos'
            });
        }

        // Asignar supervisor
        await Usuario.updateMany(
            { _id: { $in: vendedoresIds } },
            { $set: { supervisorId: supervisorId } }
        );

        res.status(201).json({
            ok: true,
            msg: 'Equipo creado',
            supervisor: supervisor.nombre,
            totalVendedores: vendedoresIds.length
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({
            ok: false,
            msg: 'Error interno'
        });
    }
};

//quitar vendedor de un equipo
const quitarDeEquipo = async (req, res) => {
    const { vendedorId } = req.body;

    try {
        // 1. Validar que el vendedor existe y tiene supervisor
        const vendedor = await Usuario.findOne({
            _id: vendedorId,
            rol: 'vendedor'
        });

        if (!vendedor) {
            return res.status(404).json({
                ok: false,
                msg: 'Vendedor no encontrado o no tiene rol válido'
            });
        }

        if (!vendedor.supervisorId) {
            return res.status(400).json({
                ok: false,
                msg: 'El vendedor no está asignado a ningún equipo'
            });
        }

        // 2. Quitar supervisorId (usando $unset para limpiar el campo)
        await Usuario.findByIdAndUpdate(
            vendedorId,
            { $unset: { supervisorId: "" } }
        );

        res.status(200).json({
            ok: true,
            msg: 'Vendedor removido del equipo',
            vendedor: {
                _id: vendedor._id,
                nombre: vendedor.nombre,
                supervisorId: null // Confirmar que ahora es null
            }
        });

    } catch (error) {
        console.error('Error al quitar vendedor:', error);
        res.status(500).json({
            ok: false,
            msg: 'Error interno. Contacte al administrador'
        });
    }
};

//asignar vendedor a un equipo
const asignarAEquipo = async (req, res) => {
    const { vendedorId, supervisorId } = req.body;

    try {
        // 1. Validar que el supervisor existe y tiene rol correcto
        const supervisor = await Usuario.findOne({
            _id: supervisorId,
            rol: 'supervisor'
        });

        if (!supervisor) {
            return res.status(404).json({
                ok: false,
                msg: 'Supervisor no encontrado o no tiene rol válido'
            });
        }

        // 2. Validar que el vendedor existe y no está ya asignado
        const vendedor = await Usuario.findOne({
            _id: vendedorId,
            rol: 'vendedor'
        });

        if (!vendedor) {
            return res.status(404).json({
                ok: false,
                msg: 'Vendedor no encontrado o no tiene rol válido'
            });
        }

        if (vendedor.supervisorId?.equals(supervisorId)) {
            return res.status(400).json({
                ok: false,
                msg: 'El vendedor ya está asignado a este supervisor'
            });
        }

        // 3. Asignar nuevo supervisorId
        const vendedorActualizado = await Usuario.findByIdAndUpdate(
            vendedorId,
            { $set: { supervisorId: supervisorId } },
            { new: true }
        ).select('nombre email supervisorId');

        res.status(200).json({
            ok: true,
            msg: 'Vendedor asignado al equipo correctamente',
            vendedor: vendedorActualizado,
            supervisor: supervisor.nombre
        });

    } catch (error) {
        console.error('Error al asignar vendedor:', error);
        res.status(500).json({
            ok: false,
            msg: 'Error interno. Contacte al administrador'
        });
    }
};

/*********************  apartado de clientes *******************/ 

const actualizarCliente = async (req, res) => {
    const { _id } = req.body;

    try {
        // 1. Verificar existencia del cliente
        const clienteExistente = await Cliente.findById(_id);
        if (!clienteExistente) {
            return res.status(404).json({ ok: false, msg: "Cliente no encontrado" });
        }

        // 2. Preparar updates (convertir strings vacíos a undefined)
        const updates = {};
        const camposUnicos = ['dni', 'cuil', 'email', 'numero_cliente'];
        
        Object.entries(req.body).forEach(([key, value]) => {
            if (clienteExistente.schema.paths[key]) {
                // Para campos únicos opcionales, convertir "" a undefined
                if ((key === 'cuil' || key === 'email') && value === "") {
                    // No asignar nada (undefined) para eliminar el campo
                } else {
                    updates[key] = value;
                }
            }
        });

        // 3. Validar unicidad solo para campos con valores definidos
        for (const campo of camposUnicos) {
            if (updates[campo] !== undefined && updates[campo] !== null) {
                if (updates[campo] !== clienteExistente[campo]) {
                    const existe = await Cliente.findOne({ 
                        [campo]: updates[campo],
                        _id: { $ne: _id }
                    });
                    if (existe) {
                        return res.status(400).json({ 
                            ok: false, 
                            msg: `El ${campo.replace('_', ' ')} ya está en uso` 
                        });
                    }
                }
            }
        }

        // 4. Construir operación de actualización
        const updateOperation = {};
        
        // Agregar solo campos con valores definidos al $set
        if (Object.keys(updates).length > 0) {
            updateOperation.$set = {};
            Object.entries(updates).forEach(([key, value]) => {
                if (value !== undefined) {
                    updateOperation.$set[key] = value;
                }
            });
        }

        // Para campos que se quieren "eliminar" (email/cuil vacíos)
        if (req.body.email === "") {
            updateOperation.$unset = { email: "" };
        }
        if (req.body.cuil === "") {
            updateOperation.$unset = { cuil: "" };
        }

        // 5. Ejecutar actualización
        const clienteActualizado = await Cliente.findByIdAndUpdate(
            _id,
            updateOperation,
            { 
                new: true,
                runValidators: true,
                context: 'query',
                select: '-__v'
            }
        );

        res.json({
            ok: true,
            msg: "Cliente actualizado correctamente",
            cliente: clienteActualizado
        });

    } catch (error) {
        console.error("Error en actualizarCliente:", error);
        
        // Manejar errores de duplicados
        if (error.code === 11000) {
            const campo = Object.keys(error.keyPattern)[0];
            return res.status(400).json({
                ok: false,
                msg: `El ${campo} ya está registrado en otro cliente`
            });
        }

        // Manejar otros errores
        res.status(500).json({
            ok: false,
            msg: "Error interno del servidor",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

const cargarClientes = async (req, res) => {
    try {
        const clientes = await Cliente.find() // Todos los clientes (incluye inactivos si agregas estado)
            .select('-__v')
            .lean();

        // Función para formatear fechas en formato argentino
        const formatFechaArg = (fecha) => {
            if (!fecha || !(fecha instanceof Date)) return undefined;
            return fecha.toLocaleDateString('es-AR', {
                timeZone: 'America/Argentina/Buenos_Aires',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        };

        const clientesFormateados = clientes.map(cliente => {
            // Clonar el objeto para no modificar el original
            const clienteFormateado = { ...cliente };

            // Formatear fechas de creación/actualización
            if (cliente.createdAt) clienteFormateado.createdAt = formatFechaArg(cliente.createdAt);
            if (cliente.updatedAt) clienteFormateado.updatedAt = formatFechaArg(cliente.updatedAt);

            return clienteFormateado;
        });

        res.status(200).json({
            ok: true,
            msg: "Clientes cargados exitosamente",
            clientes: clientesFormateados,
            total: clientes.length
        });

    } catch (error) {
        console.error("Error en cargarClientes:", error);
        res.status(500).json({
            ok: false,
            msg: "Error al cargar clientes. Contacte al administrador"
        });
    }
};

/********************************** Gastos *********************************** */
const cargarGastos = async (req, res) => {
    try {
        const gastos = await Gastos.find()
            .sort({ fecha: -1 }) // Ordenar por fecha descendente (más reciente primero)
            .lean();

        // Función segura para formatear fechas (solo si existe)
        const formatFechaArg = (fecha) => {
            if (!fecha || !(fecha instanceof Date)) return undefined;
            return fecha.toLocaleDateString('es-AR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        };

        const gastosFormateados = gastos.map(gasto => {
            const gastoFormateado = { ...gasto };

            // Formatear fechas directas (solo si existen)
            if (gasto.fecha) {
                gastoFormateado.fecha = formatFechaArg(gasto.fecha);
            }
            if (gasto.createdAt) {
                gastoFormateado.createdAt = formatFechaArg(gasto.createdAt);
            }
            if (gasto.updatedAt) {
                gastoFormateado.updatedAt = formatFechaArg(gasto.updatedAt);
            }

            return gastoFormateado;
        });

        // Calcular total de gastos
        const total = gastos.reduce((sum, gasto) => sum + gasto.Monto_gasto, 0);

        res.status(200).json({
            ok: true,
            msg: "Gastos cargados exitosamente",
            gastos: gastosFormateados,
            total: total,
            count: gastos.length
        });

    } catch (error) {
        console.error('Error al cargar gastos:', error);
        res.status(500).json({
            ok: false,
            msg: "Error interno. Por favor contacte al administrador"
        });
    }
};

const crearGasto = async (req, res) => {
    try {
        const { descripcion_gasto, Monto_gasto,responsable } = req.body;

        // Validación básica (opcional)
        if (!descripcion_gasto || !Monto_gasto) {
            return res.status(400).json({ mensaje: 'Faltan campos obligatorios.' });
        }

        const nuevoGasto = new Gastos({
            descripcion_gasto,
            Monto_gasto,
            responsable,
            fecha: new Date() // Fecha actual del sistema
        });

        await nuevoGasto.save();

        res.status(201).json({
            mensaje: 'Gasto creado correctamente.',
            gasto: nuevoGasto
        });

    } catch (error) {
        console.error('Error al crear el gasto:', error);
        res.status(500).json({ mensaje: 'Error interno del servidor.' });
    }
};

module.exports = {
    crearUsuario,
    actualizarUsuario,
    cargarUsuarios,
    CambiarEstadoUsuario,
    rendirSaldo,
    crearEquipo,
    quitarDeEquipo,
    asignarAEquipo,
    actualizarCliente,
    cargarClientes,
    cargarGastos,
    crearGasto

};