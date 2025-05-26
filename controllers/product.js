const Producto = require('../models/Producto');

//crear producto
const crearProducto = async (req, res) => {
    const {
        nombre,
        descripcion,
        tipo,
        bandera,
        detalles
    } = req.body;

    try {
        // === Validación manual adicional (por si fallan las de ruta) ===
        if (!nombre || !tipo) {
            return res.status(400).json({
                ok: false,
                msg: "Nombre y tipo son campos obligatorios"
            });
        }

        // === Validar detalles según tipo ===
        if (tipo === 'prestamo') {
            if (!detalles?.prestamo?.capitalTotal) {
                return res.status(400).json({
                    ok: false,
                    msg: "Para préstamos, el capitalTotal es obligatorio"
                });
            }
        } else if (tipo === 'sistema_venta') {
            const algunaBanderaActiva = bandera?.plan || bandera?.venta_directa || bandera?.entrega_inmediata || bandera?.permutada;

            if (!algunaBanderaActiva) {
                return res.status(400).json({
                    ok: false,
                    msg: "Debe activar al menos una modalidad de venta (bandera)."
                });
            }
        }

        // === Crear el producto ===
        const producto = new Producto({
            nombre,
            descripcion,
            tipo,
            bandera: {
                plan: tipo === 'sistema_venta' ? bandera?.plan || false : false,
                venta_directa: bandera?.venta_directa || false,
                entrega_inmediata: bandera?.entrega_inmediata || false,
                permutada: bandera?.permutada || false
            },
            detalles: {
                // Solo llenar los campos relevantes según el tipo
                prestamo: tipo === 'prestamo' ? {
                    capitalTotal: detalles.prestamo.capitalTotal,
                    montoMaximoPorUsuario: detalles.prestamo.montoMaximoPorUsuario || null,
                    plazoCobranza: detalles.prestamo.plazoCobranza || 'mensual'
                } : null,
                venta: tipo === 'sistema_venta' ? {
                    costoAdministrativo: detalles.venta.costoAdministrativo || 0,
                    plazo: detalles.venta.plazo || 'mensual',
                    plazosPactados: detalles.venta.plazosPactados || [],
                    inventario: detalles.venta.inventario?.map(item => ({
                        ...item,
                        estado: item.estado || 'disponible',
                        fechaIngreso: item.fechaIngreso || new Date()
                    })) || []
                } : null
            },
            estado: true
        });

        // === Guardar en BD ===
        await producto.save();

        // === Respuesta exitosa ===
        res.status(201).json({
            ok: true,
            msg: 'Producto creado correctamente',
            producto: {
                id: producto._id,
                nombre: producto.nombre,
                tipo: producto.tipo,
                bandera: producto.bandera
            }
        });

    } catch (error) {
        console.error('Error al crear producto:', error);

        // Manejar errores específicos
        if (error.code === 11000) {
            return res.status(400).json({
                ok: false,
                msg: "El serial de un ítem ya existe en otro producto"
            });
        }

        res.status(500).json({
            ok: false,
            msg: "Error interno del servidor",
            error: process.env.NODE_ENV === 'development' ? error.message : null
        });
    }
};
//actualiza datos como cambios en el productoi
const actualizarProducto = async (req, res) => {
    const {
        _id,
        nombre,
        descripcion,
        estado,
        bandera,
        detalles
    } = req.body; // Campos editables

    try {
        // === 1. Verificar existencia del producto ===
        const producto = await Producto.findById(_id);
        if (!producto) {
            return res.status(404).json({
                ok: false,
                msg: "Producto no encontrado"
            });
        }

        // === 2. Preparar updates genéricos ===
        const updates = {};
        if (nombre) updates.nombre = nombre;
        if (descripcion) updates.descripcion = descripcion;
        if (typeof estado === 'boolean') updates.estado = estado;

        // === 3. Actualizar banderas si existen ===
        if (bandera) {
            updates.bandera = {
                plan: bandera.plan !== undefined ? bandera.plan : producto.bandera.plan,
                venta_directa: bandera.venta_directa !== undefined ? bandera.venta_directa : producto.bandera.venta_directa,
                entrega_inmediata: bandera.entrega_inmediata !== undefined ? bandera.entrega_inmediata : producto.bandera.entrega_inmediata,
                permutada: bandera.permutada !== undefined ? bandera.permutada : producto.bandera.permutada
            };
        }

        // === 4. Actualizar detalles según tipo (sin cambiar el tipo original) ===
        if (detalles) {
            if (producto.tipo === 'prestamo' && detalles.prestamo) {
                updates.$set = {
                    'detalles.prestamo.capitalTotal': detalles.prestamo.capitalTotal || producto.detalles.prestamo.capitalTotal,
                    'detalles.prestamo.montoMaximoPorUsuario': detalles.prestamo.montoMaximoPorUsuario ?? producto.detalles.prestamo.montoMaximoPorUsuario,
                    'detalles.prestamo.plazoCobranza': detalles.prestamo.plazoCobranza || producto.detalles.prestamo.plazoCobranza
                };
            } else if (producto.tipo === 'sistema_venta' && detalles.venta) {
                const updateVenta = {};
                if (detalles.venta.costoAdministrativo !== undefined) {
                    updateVenta['detalles.venta.costoAdministrativo'] = detalles.venta.costoAdministrativo;
                }
                if (detalles.venta.plazo) {
                    updateVenta['detalles.venta.plazo'] = detalles.venta.plazo;
                }
                if (detalles.venta.plazosPactados) {
                    updateVenta['detalles.venta.plazosPactados'] = detalles.venta.plazosPactados;
                }
                // Actualizar inventario solo si se envía (no se mezcla con el existente)
                if (detalles.venta.inventario) {
                    updateVenta['detalles.venta.inventario'] = detalles.venta.inventario.map(item => ({
                        ...item,
                        estado: item.estado || 'disponible',
                        fechaIngreso: item.fechaIngreso || new Date()
                    }));
                }
                updates.$set = { ...updates.$set, ...updateVenta };
            }
        }

        // === 5. Validar coherencia de flags ===
        if (producto.tipo === 'prestamo' && updates.bandera?.venta_directa) {
            return res.status(400).json({
                ok: false,
                msg: "Un préstamo no puede tener venta directa"
            });
        }

        // === 6. Aplicar actualización (1 sola operación) ===
        const productoActualizado = await Producto.findByIdAndUpdate(
            _id,
            updates,
            { new: true, runValidators: true }
        );

        // === 7. Respuesta exitosa ===
        res.json({
            ok: true,
            msg: 'Producto actualizado correctamente',
            producto: productoActualizado
        });

    } catch (error) {
        console.error('Error al actualizar producto:', error);

        // Manejar errores de validación de Mongoose
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                ok: false,
                msg: "Error de validación",
                errors: error.errors
            });
        }

        res.status(500).json({
            ok: false,
            msg: "Error interno del servidor",
            error: process.env.NODE_ENV === 'development' ? error.message : null
        });
    }
};

//cambiar estadod e producto
const cambiarEstadoProducto = async (req, res) => {
     const {_id} = req.body;
    try {
        // 1. Buscar producto por ID
        const producto = await Producto.findById(_id);



        // 2. Verificar existencia
        if (!producto) {
            return res.status(404).json({
                ok: false,
                msg: 'Producto no encontrado'
            });
        }

        // 3. Alternar estado
        producto.estado = !producto.estado;
        await producto.save();

        // 4. Respuesta
        res.json({
            ok: true,
            msg: producto.estado
                ? 'Producto habilitado'
                : 'Producto inhabilitado',
            producto: {
                _id: producto._id,
                nombre: producto.nombre,
                estado: producto.estado
            }
        });

    } catch (error) {
        console.error('Error al cambiar estado:', error);
        res.status(500).json({
            ok: false,
            msg: 'Error interno',
            error: process.env.NODE_ENV === 'development' ? error.message : null
        });
    }
};

//agregar multiples Items
const agregarMultiplesItems = async (req, res) => {
    const { inventario, _id } = req.body;

    try {
        const producto = await Producto.findById(_id);

        if (!producto) {
            return res.status(404).json({
                ok: false,
                msg: 'Producto no encontrado'
            });
        }

        const inventarioExistente = producto.detalles?.venta?.inventario || [];

        // Seriales existentes
        const serialesExistentes = new Set(inventarioExistente.map(item => item.serial));

        // Filtrar ítems con seriales no duplicados
        const itemsValidos = inventario.filter(item => !serialesExistentes.has(item.serial));

        if (itemsValidos.length === 0) {
            return res.status(400).json({
                ok: false,
                msg: 'Todos los seriales ya existen en el inventario'
            });
        }

        // Actualizar el inventario
        await Producto.updateOne(
            { _id },
            { $push: { 'detalles.venta.inventario': { $each: itemsValidos } } }
        );

        res.json({
            ok: true,
            msg: producto.estado
                ? 'Producto habilitado'
                : 'Producto inhabilitado',
            producto: {
                _id: producto._id,
                nombre: producto.nombre,
                estado: producto.estado
            }
        });

    } catch (error) {
        console.error('Error al agregar ítems al inventario:', error);
        res.status(500).json({
            ok: false,
            msg: 'Error interno del servidor',
            error: process.env.NODE_ENV === 'development' ? error.message : null
        });
    }
};

//editar dato del Item
const editarItemPorSerial = async (req, res) => {
    const { productoId, serial, camposActualizados } = req.body;

    try {
        // Buscar el producto
        const producto = await Producto.findById(productoId);

        if (!producto) {
            return res.status(404).json({
                success: false,
                msg: 'Producto no encontrado.'
            });
        }

        // Validar que sea tipo sistema_venta
        if (producto.tipo !== "sistema_venta") {
            return res.status(400).json({
                success: false,
                msg: 'Este producto no tiene un inventario asociado.'
            });
        }

        // Buscar el ítem por serial
        const item = producto.detalles.venta.inventario.find(
            item => item.serial === serial
        );

        if (!item) {
            return res.status(404).json({
                success: false,
                msg: 'Ítem no encontrado en el inventario.'
            });
        }

        // Actualizar campos permitidos
        for (const campo in camposActualizados) {
            if (camposActualizados.hasOwnProperty(campo)) {
                item[campo] = camposActualizados[campo];
            }
        }

        // Guardar los cambios
        await producto.save();

        res.status(200).json({
            success: true,
            msg: 'Ítem actualizado correctamente.',
            data: producto
        });

    } catch (error) {
        console.error('Error al editar el ítem:', error);
        res.status(500).json({
            success: false,
            msg: 'Error al editar el ítem.',
            error: process.env.NODE_ENV === 'development' ? error.message : null
        });
    }
};

//eliminar 1 item de stock
const eliminarItemPorSerial = async (req, res) => {
    
    const { productoId, serial } = req.body; // tomamos del body

    try {
        // Buscamos el producto que contiene el ítem
        const producto = await Producto.findById(productoId);

        if (!producto) {
            return res.status(404).json({
                success: false,
                msg: "Producto no encontrado."
            });
        }

        // Verificamos si el producto es de tipo "sistema_venta" (tiene inventario)
        if (producto.tipo !== "sistema_venta") {
            return res.status(400).json({
                success: false,
                msg: "Este producto no tiene un inventario asociado."
            });
        }

        // Buscamos el índice del ítem en el array 'inventario'
        const itemIndex = producto.detalles.venta.inventario.findIndex(
            item => item.serial === serial
        );

        if (itemIndex === -1) {
            return res.status(404).json({
                success: false,
                msg: "Ítem no encontrado en el inventario."
            });
        }

        // Eliminamos el ítem del array
        producto.detalles.venta.inventario.splice(itemIndex, 1);

        // Guardamos el producto actualizado
        await producto.save();

        res.status(200).json({
            success: true,
            msg: "Ítem eliminado correctamente.",
            data: producto
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            msg: "Error al eliminar el ítem.",
            error: error.msg
        });
    }
};


const cargarProductos = async (req, res) => {
    try {
        // 1. Obtener productos (excluyendo campos internos)
        const productos = await Producto.find()
            .select('-__v -createdAt -updatedAt')
            .lean();

        // 2. Función para formatear fechas en formato argentino
        const formatFechaArg = (fecha) => {
            if (!fecha || !(fecha instanceof Date)) return undefined;
            return fecha.toLocaleDateString('es-AR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        };

        // 3. Formatear cada producto
        const productosFormateados = productos.map(producto => {
            const productoFormateado = { ...producto };

            // Formatear fechas en inventario (si es sistema_venta)
            if (producto.tipo === 'sistema_venta' && producto.detalles?.venta?.inventario) {
                productoFormateado.detalles.venta.inventario = producto.detalles.venta.inventario.map(item => ({
                    ...item,
                    fechaIngreso: item.fechaIngreso ? formatFechaArg(item.fechaIngreso) : undefined,
                    // Si tienes fechaSalida en items:
                    //fechaSalida: item.fechaSalida ? formatFechaArg(item.fechaSalida) : undefined
                }));
            }

            // Formatear fechas de creación/actualización si las necesitas
            //productoFormateado.fechaCreacion = formatFechaArg(producto.createdAt);
            //productoFormateado.fechaActualizacion = formatFechaArg(producto.updatedAt);

            return productoFormateado;
        });

        // 4. Respuesta
        res.status(200).json({
            ok: true,
            msg: "Productos cargados exitosamente",
            productos: productosFormateados,
            total: productos.length,
            tipos: {
                prestamo: productos.filter(p => p.tipo === 'prestamo').length,
                sistema_venta: productos.filter(p => p.tipo === 'sistema_venta').length
            }
        });

    } catch (error) {
        console.error('Error al cargar productos:', error);
        res.status(500).json({
            ok: false,
            msg: "Error interno al cargar productos",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};



module.exports = {
    crearProducto,
    actualizarProducto,
    cambiarEstadoProducto,
    agregarMultiplesItems,
    editarItemPorSerial,
    eliminarItemPorSerial,
    cargarProductos

};