const Inventario = require("../models/Inventario");

const crearItemInventario = async (req, res) => {
    // Validar los datos de entrada
    const {
        nombre,
        tipo = 'dispositivo',
        modelo,
        memoria_ram,
        almacenamiento,
        bateria,
        color,
        caracteristicas,
        imei_serial,
        numero_serie,
        estado = 'disponible',
        fecha_ingreso = Date.now(),
        precio_compra,
        precio_venta,
        categoria_accesorio
    } = req.body;

    try {
        // Validaciones adicionales según el tipo
        if (tipo === 'dispositivo') {
            if (!modelo) {
                return res.status(400).json({
                    ok: false,
                    msg: 'El modelo es requerido para dispositivos'
                });
            }
            
            if (imei_serial && imei_serial.length !== 15) {
                return res.status(400).json({
                    ok: false,
                    msg: 'El IMEI/Serial debe tener 15 caracteres'
                });
            }
        }

        if (tipo === 'accesorio' && !categoria_accesorio) {
            return res.status(400).json({
                ok: false,
                msg: 'La categoría es requerida para accesorios'
            });
        }

        // Verificar si el IMEI/Serial ya existe
        if (imei_serial) {
            const existeImei = await Inventario.findOne({ imei_serial });
            if (existeImei) {
                return res.status(400).json({
                    ok: false,
                    msg: 'El IMEI/Serial ya está registrado en otro item'
                });
            }
        }

        // Verificar si el número de serie ya existe
        if (numero_serie) {
            const existeNumeroSerie = await Inventario.findOne({ numero_serie });
            if (existeNumeroSerie) {
                return res.status(400).json({
                    ok: false,
                    msg: 'El número de serie ya está registrado en otro item'
                });
            }
        }

        // Crear el nuevo item
        const nuevoItem = new Inventario({
            nombre: nombre.toUpperCase(),
            tipo,
            modelo: modelo ? modelo.toUpperCase() : undefined,
            memoria_ram,
            almacenamiento,
            bateria,
            color: color ? color.toUpperCase() : undefined,
            caracteristicas,
            imei_serial,
            numero_serie: numero_serie ? numero_serie.toUpperCase() : undefined,
            estado,
            fecha_ingreso,
            precio_compra,
            precio_venta,
            categoria_accesorio
        });

        // Guardar en la base de datos
        await nuevoItem.save();

        // Preparar respuesta
        const responseItem = nuevoItem.toObject();
        responseItem.mensaje = 'Item creado correctamente';

        res.status(201).json({
            ok: true,
            item: responseItem
        });

    } catch (error) {
        console.error('Error al crear item de inventario:', error);
        res.status(500).json({
            ok: false,
            msg: 'Error interno del servidor',
            error: error.message
        });
    }
};

const actualizarItemInventario = async (req, res) => {
    const { id, datosActualizados } = req.body;

    try {
        // Validar ID
        if (!id.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({
                ok: false,
                msg: 'ID de item no válido'
            });
        }

        // Buscar el item existente
        const itemExistente = await Inventario.findById(id);
        if (!itemExistente) {
            return res.status(404).json({
                ok: false,
                msg: 'Item no encontrado en el inventario'
            });
        }

        // Validar IMEI/Serial único si se está actualizando
        if (datosActualizados.imei_serial && datosActualizados.imei_serial !== itemExistente.imei_serial) {
            const existeImei = await Inventario.findOne({ 
                imei_serial: datosActualizados.imei_serial,
                _id: { $ne: id } // Excluir el item actual
            });
            if (existeImei) {
                return res.status(400).json({
                    ok: false,
                    msg: 'El nuevo IMEI/Serial ya está registrado en otro item'
                });
            }
        }

        // Validar Número de Serie único si se está actualizando
        if (datosActualizados.numero_serie && datosActualizados.numero_serie !== itemExistente.numero_serie) {
            const existeNumSerie = await Inventario.findOne({ 
                numero_serie: datosActualizados.numero_serie,
                _id: { $ne: id }
            });
            if (existeNumSerie) {
                return res.status(400).json({
                    ok: false,
                    msg: 'El nuevo número de serie ya está registrado en otro item'
                });
            }
        }

        // Normalizar datos antes de actualizar
        if (datosActualizados.nombre) datosActualizados.nombre = datosActualizados.nombre.toUpperCase();
        if (datosActualizados.modelo) datosActualizados.modelo = datosActualizados.modelo.toUpperCase();
        if (datosActualizados.color) datosActualizados.color = datosActualizados.color.toUpperCase();
        if (datosActualizados.numero_serie) datosActualizados.numero_serie = datosActualizados.numero_serie.toUpperCase();

        // Actualizar el item
        const itemActualizado = await Inventario.findByIdAndUpdate(
            id,
            datosActualizados,
            { new: true, runValidators: true } // Devolver el documento actualizado y correr validaciones
        );

        res.json({
            ok: true,
            msg: 'Item actualizado correctamente',
            item: itemActualizado,
            cambios: datosActualizados
        });

    } catch (error) {
        console.error('Error al actualizar item:', error);
        res.status(500).json({
            ok: false,
            msg: 'Error interno al actualizar el item',
            error: error.message
        });
    }
};

const eliminarItemInventario = async (req, res) => {
    const { id } = req.params;

    try {
        // Validar ID
        if (!id.match(/^[0-9a-fA-F]{24}$/)) {
            return res.status(400).json({
                ok: false,
                msg: 'ID de item no válido'
            });
        }

        // Verificar si el item existe
        const itemExistente = await Inventario.findById(id);
        if (!itemExistente) {
            return res.status(404).json({
                ok: false,
                msg: 'Item no encontrado en el inventario'
            });
        }

        // Verificar si el item está asignado
        if (itemExistente.estado === 'asignado') {
            return res.status(400).json({
                ok: false,
                msg: 'No se puede eliminar un item asignado a un cliente'
            });
        }

        // Eliminar el item
        await Inventario.findByIdAndDelete(id);

        res.json({
            ok: true,
            msg: 'Item eliminado correctamente',
            itemEliminado: {
                nombre: itemExistente.nombre,
                modelo: itemExistente.modelo,
                tipo: itemExistente.tipo,
                _id: itemExistente._id
            }
        });

    } catch (error) {
        console.error('Error al eliminar item:', error);
        res.status(500).json({
            ok: false,
            msg: 'Error interno al eliminar el item',
            error: error.message
        });
    }
};

const agregarMultiplesItems = async (req, res) => {
    const { items } = req.body; // Array de items a agregar

    try {
        // Validar que se enviaron items
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                ok: false,
                msg: 'Debe proporcionar un array de items válido'
            });
        }

        // Preparar datos y validar
        const itemsParaInsertar = [];
        const imeisSeriales = new Set();
        const numerosSerie = new Set();
        const errores = [];

        // Validar cada item individualmente
        for (const [index, item] of items.entries()) {
            try {
                // Validaciones básicas
                if (!item.nombre) {
                    throw new Error(`Item ${index + 1}: El nombre es requerido`);
                }

                // Verificar IMEI/Serial único en el lote actual
                if (item.imei_serial) {
                    if (imeisSeriales.has(item.imei_serial)) {
                        throw new Error(`Item ${index + 1}: El IMEI/Serial ya existe en este lote`);
                    }
                    imeisSeriales.add(item.imei_serial);
                }

                // Verificar Número de Serie único en el lote actual
                if (item.numero_serie) {
                    if (numerosSerie.has(item.numero_serie)) {
                        throw new Error(`Item ${index + 1}: El número de serie ya existe en este lote`);
                    }
                    numerosSerie.add(item.numero_serie);
                }

                // Normalizar datos
                const nuevoItem = {
                    nombre: item.nombre.toUpperCase(),
                    tipo: item.tipo || 'dispositivo',
                    estado: item.estado || 'disponible',
                    fecha_ingreso: item.fecha_ingreso || new Date(),
                    ...(item.modelo && { modelo: item.modelo.toUpperCase() }),
                    ...(item.color && { color: item.color.toUpperCase() }),
                    ...(item.numero_serie && { numero_serie: item.numero_serie.toUpperCase() }),
                    // Resto de campos
                    memoria_ram: item.memoria_ram,
                    almacenamiento: item.almacenamiento,
                    bateria: item.bateria,
                    caracteristicas: item.caracteristicas,
                    imei_serial: item.imei_serial,
                    precio_compra: item.precio_compra,
                    precio_venta: item.precio_venta,
                    categoria_accesorio: item.categoria_accesorio
                };

                itemsParaInsertar.push(nuevoItem);
            } catch (error) {
                errores.push(error.message);
            }
        }

        // Si hay errores en algún item
        if (errores.length > 0) {
            return res.status(400).json({
                ok: false,
                msg: 'Errores en algunos items',
                errores,
                itemsValidos: itemsParaInsertar.length
            });
        }

        // Verificar duplicados en la base de datos
        const condicionesDuplicados = [];
        
        if (imeisSeriales.size > 0) {
            condicionesDuplicados.push({ imei_serial: { $in: [...imeisSeriales] } });
        }
        
        if (numerosSerie.size > 0) {
            condicionesDuplicados.push({ numero_serie: { $in: [...numerosSerie] } });
        }

        let itemsDuplicados = [];
        if (condicionesDuplicados.length > 0) {
            itemsDuplicados = await Inventario.find({
                $or: condicionesDuplicados
            }).select('imei_serial numero_serie nombre');
        }

        // Si hay duplicados en la base de datos
        if (itemsDuplicados.length > 0) {
            return res.status(400).json({
                ok: false,
                msg: 'Algunos items ya existen en el inventario',
                duplicados: itemsDuplicados.map(item => ({
                    imei: item.imei_serial,
                    serial: item.numero_serie,
                    nombre: item.nombre
                })),
                itemsValidos: itemsParaInsertar.length
            });
        }

        // Insertar todos los items válidos
        const resultado = await Inventario.insertMany(itemsParaInsertar);

        res.status(201).json({
            ok: true,
            msg: `${resultado.length} items agregados al inventario`,
            itemsAgregados: resultado.length,
            detalles: resultado.map(item => ({
                _id: item._id,
                nombre: item.nombre,
                tipo: item.tipo,
                estado: item.estado
            }))
        });

    } catch (error) {
        console.error('Error al agregar múltiples items:', error);
        res.status(500).json({
            ok: false,
            msg: 'Error interno al procesar el lote de items',
            error: process.env.NODE_ENV === 'development' ? error.message : null
        });
    }
};

const obtenerTodosLosItems = async (req, res) => {
    try {
        // Opciones de filtrado desde query params
        const { estado, tipo, search } = req.query;
        
        // Construir el objeto de filtro
        const filtro = {};
        
        if (estado && estado !== 'todos') {
            filtro.estado = estado;
        }
        
        if (tipo && tipo !== 'todos') {
            filtro.tipo = tipo;
        }
        
        if (search) {
            // Búsqueda en múltiples campos
            filtro.$or = [
                { nombre: { $regex: search, $options: 'i' } },
                { modelo: { $regex: search, $options: 'i' } },
                { imei_serial: { $regex: search, $options: 'i' } },
                { numero_serie: { $regex: search, $options: 'i' } },
                { caracteristicas: { $regex: search, $options: 'i' } }
            ];
        }

        // Obtener items con filtros
        const items = await Inventario.find(filtro)
            .populate('asignado_a', 'nombre apellido dni') // Populate si está asignado
            .sort({ fecha_ingreso: -1 }); // Ordenar por fecha más reciente

        // Estadísticas para el frontend
        const totalItems = await Inventario.countDocuments();
        const disponibles = await Inventario.countDocuments({ estado: 'disponible' });
        const asignados = await Inventario.countDocuments({ estado: 'asignado' });
        const enReparacion = await Inventario.countDocuments({ estado: 'en_reparacion' });

        res.json({
            ok: true,
            items,
            estadisticas: {
                total: totalItems,
                disponibles,
                asignados,
                enReparacion
            }
        });

    } catch (error) {
        console.error('Error al obtener items:', error);
        res.status(500).json({
            ok: false,
            msg: 'Error interno al obtener el inventario',
            error: process.env.NODE_ENV === 'development' ? error.message : null
        });
    }
};

module.exports = {
    crearItemInventario,
    actualizarItemInventario,
    eliminarItemInventario,
    agregarMultiplesItems,
    obtenerTodosLosItems
};