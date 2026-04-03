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

// control de tiempo
let ultimaLectura = 0;

// VARIABLES SENSORES
let humedadSuelo = "--";
let humedadAire = "--";
let temperatura = "--";
let luz = "--";

// timestamps individuales
let tSuelo = 0;
let tAire = 0;
let tTemp = 0;
let tLuz = 0;

//ESTADOS ACTUADORES
let estados = {
  bomba: false,
  ventilador: false,
  luces: false
};

// ESTADO REAL
let estadoReal = {
  bomba: "--",
  ventilador: "--"
};

let tBomba = 0;
let tVentilador = 0;

client.on("connect", () => {
  console.log("Conectado a MQTT");

  // SUSCRIPCIONES
  client.subscribe("esp32/humedad_suelo");
  client.subscribe("esp32/humedad_amb");
  client.subscribe("esp32/temperatura");
  client.subscribe("esp32/luz");

  // estados reales
  client.subscribe("esp32/bomba_estado");
  client.subscribe("esp32/ventilador_estado");
});

// RECEPCIÓN DE DATOS
client.on("message", (topic, message) => {
  const data = message.toString();
  const now = Date.now();

  if (topic === "esp32/humedad_suelo") {
    humedadSuelo = data;
    tSuelo = now;
    ultimaLectura = now;
  }

  if (topic === "esp32/humedad_amb") {
    humedadAire = data;
    tAire = now;
  }

  if (topic === "esp32/temperatura") {
    temperatura = data;
    tTemp = now;
  }

  if (topic === "esp32/luz") {
    luz = data;
    tLuz = now;
  }

  // ACTUADORES
  if (topic === "esp32/bomba_estado") {
    estadoReal.bomba = data;
    tBomba = now;
  }

  if (topic === "esp32/ventilador_estado") {
    estadoReal.ventilador = data;
    tVentilador = now;
  }
});

//TIMEOUT
function verificarTimeouts() {
  const now = Date.now();

  if (now - tSuelo > 10000) humedadSuelo = "--";
  if (now - tAire > 10000) humedadAire = "--";
  if (now - tTemp > 10000) temperatura = "--";
  if (now - tLuz > 10000) luz = "--";

  if (now - tBomba > 10000) estadoReal.bomba = "--";
  if (now - tVentilador > 10000) estadoReal.ventilador = "--";
}

//DATOS PARA FRONTEND
app.get("/datos", (req, res) => {
  verificarTimeouts();

  res.json({
    suelo: humedadSuelo,
    aire: humedadAire,
    temp: temperatura,
    luz: luz,
    actuadores: estadoReal 
  });
});

// TOGGLE
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
    dispositivos: estados,
    actuadores: estadoReal
  });
});

app.listen(3000, () => {
  console.log("Servidor en http://localhost:3000");
});