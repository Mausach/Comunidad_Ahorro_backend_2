const express = require('express');
const { dbConeccion } = require('./dataBase/config');
require('dotenv').config()
const cors= require("cors");
const app= express();


//llamar al servidor
app.listen(process.env.PORT, ()=>{
    console.log(`server corriendo en ${process.env.PORT}`)
})

//base de datos
dbConeccion();

//cors
app.use(cors());

//directorio publico
app.use(express.static('public'));

//lectura y parseo del body
app.use(express.json());

//midelwars son procesos que se van a correr durante la ejecucion
app.use("/auth",require('./rutes/auth'))

//para el admin
app.use("/admin",require('./rutes/admin'))

//para productos
app.use("/prod",require('./rutes/product'))

//para las ventas
app.use("/ventas",require('./rutes/RegVentas'))

//para aplicar mercadopago
app.use("/rend",require('./rutes/rendiciones'))

//para los cobros
app.use("/cobro",require('./rutes/regCobranza'))

//para las notificaciones
app.use("/notifi",require('./rutes/noti'))

//app.listen(process.env.PORT),()=>{
  //  console.log('server corriendo en puerto 4k');
//};