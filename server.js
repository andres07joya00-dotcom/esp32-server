const express = require("express");
const mqtt = require("mqtt");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// Servir HTML
app.use(express.static(path.join(__dirname, "public")));

// MQTT
const client = mqtt.connect("mqtt://broker.hivemq.com");

let ultimaLectura = 0;

//VARIABLES
let humedadSuelo = "--";
let humedadAire = "--";
let temperatura = "--";
let luz = "--"; //NUEVO

// Estados de dispositivos
let estados = {
  bomba: false,
  ventilador: false,
  luces: false
};

client.on("connect", () => {
  console.log("Conectado a MQTT");

  //SUSCRIPCIONES
  client.subscribe("esp32/humedad_suelo");
  client.subscribe("esp32/humedad_amb");
  client.subscribe("esp32/temperatura");
  client.subscribe("esp32/luz"); 
});

//RECEPCIÓN DE DATOS
client.on("message", (topic, message) => {
  const data = message.toString();

  if (topic === "esp32/humedad_suelo") {
    humedadSuelo = data;
    ultimaLectura = Date.now();
    console.log("Suelo:", humedadSuelo);
  }

  if (topic === "esp32/humedad_amb") {
    humedadAire = data;
    console.log("Aire:", humedadAire);
  }

  if (topic === "esp32/temperatura") {
    temperatura = data;
    console.log("Temp:", temperatura);
  }

  if (topic === "esp32/luz") {
    luz = data;
    console.log("Luz:", luz);
  }
});

//DATOS PARA EL FRONTEND
app.get("/datos", (req, res) => {
  res.json({
    suelo: humedadSuelo,
    aire: humedadAire,
    temp: temperatura,
    luz: luz 
  });
});

//FUNCIÓN TOGGLE
function toggle(dispositivo) {
  estados[dispositivo] = !estados[dispositivo];
  return estados[dispositivo] ? "ON" : "OFF";
}

// BOMBA
app.post("/bomba", (req, res) => {
  const estado = toggle("bomba");
  client.publish("esp32/bomba", estado);
  res.json({ estado });
});

// VENTILADOR
app.post("/ventilador", (req, res) => {
  const estado = toggle("ventilador");
  client.publish("esp32/ventilador", estado);
  res.json({ estado });
});

// LUCES
app.post("/luces", (req, res) => {
  const estado = toggle("luces");
  client.publish("esp32/luces", estado);
  res.json({ estado });
});

// ESTADO GENERAL
app.get("/estado", (req, res) => {
  let ahora = Date.now();
  let conectadoESP32 = (ahora - ultimaLectura) < 10000;

  res.json({
    esp32: conectadoESP32,
    dispositivos: estados
  });
});

app.listen(3000, () => {
  console.log("Servidor en http://localhost:3000");
});