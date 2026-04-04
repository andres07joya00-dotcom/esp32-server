const express = require("express");
const mqtt = require("mqtt");
const cors = require("cors");
const path = require("path");
const { createClient } = require('@supabase/supabase-js');

//SUPABASE
const supabase = createClient(
  "https://lzujcfptslakotqjxtwu.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6dWpjZnB0c2xha290cWp4dHd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUzMzU3MTQsImV4cCI6MjA5MDkxMTcxNH0.MejQ8OWgfBX244Uet_9LKJRGlkGw2Ihwzrb6UyBXxRA"
);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// MQTT
const client = mqtt.connect("mqtt://broker.hivemq.com");

// CONTROL
let ultimaLectura = 0;

// VARIABLES
let humedadSuelo = "--";
let humedadAire = "--";
let temperatura = "--";
let luz = "--";

// TIMESTAMPS
let tSuelo = 0;
let tAire = 0;
let tTemp = 0;
let tLuz = 0;

// BUFFER PROMEDIO
let buffer = [];

// ACTUADORES
let estados = {
  bomba: false,
  ventilador: false,
  luces: false
};

let estadoReal = {
  bomba: "--",
  ventilador: "--"
};

let tBomba = 0;
let tVentilador = 0;

// MQTT CONNECT
client.on("connect", () => {
  console.log("Conectado a MQTT");

  client.subscribe("esp32/humedad_suelo");
  client.subscribe("esp32/humedad_amb");
  client.subscribe("esp32/temperatura");
  client.subscribe("esp32/luz");

  client.subscribe("esp32/bomba_estado");
  client.subscribe("esp32/ventilador_estado");
});

// MQTT RECEIVE
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

  //BUFFER
  if (
    humedadSuelo !== "--" &&
    humedadAire !== "--" &&
    temperatura !== "--" &&
    luz !== "--"
  ) {
    buffer.push({
      suelo: parseInt(humedadSuelo),
      aire: parseFloat(humedadAire),
      temperatura: parseFloat(temperatura),
      luz: parseInt(luz)
    });
  }

  if (topic === "esp32/bomba_estado") {
    estadoReal.bomba = data;
    tBomba = now;
  }

  if (topic === "esp32/ventilador_estado") {
    estadoReal.ventilador = data;
    tVentilador = now;
  }
});

// GUARDAR PROMEDIO EN SUPABASE
setInterval(async () => {

  if (buffer.length === 0) return;

  let suma = { suelo: 0, aire: 0, temperatura: 0, luz: 0 };

  buffer.forEach(d => {
    suma.suelo += d.suelo;
    suma.aire += d.aire;
    suma.temperatura += d.temperatura;
    suma.luz += d.luz;
  });

  const n = buffer.length;

  const promedio = {
    suelo: Math.round(suma.suelo / n),
    aire: parseFloat((suma.aire / n).toFixed(1)),
    temperatura: parseFloat((suma.temperatura / n).toFixed(1)),
    luz: Math.round(suma.luz / n)
  };

  const { error } = await supabase
    .from("datos")
    .insert([promedio]);

  if (error) {
    console.error("❌ Error guardando:", error);
  } else {
    console.log("📦 Guardado en Supabase:", promedio);
  }

  buffer = [];

}, 60000);

// TIMEOUT
function verificarTimeouts() {
  const now = Date.now();

  if (now - tSuelo > 10000) humedadSuelo = "--";
  if (now - tAire > 10000) humedadAire = "--";
  if (now - tTemp > 10000) temperatura = "--";
  if (now - tLuz > 10000) luz = "--";

  if (now - tBomba > 10000) estadoReal.bomba = "--";
  if (now - tVentilador > 10000) estadoReal.ventilador = "--";
}

// DATOS FRONTEND
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

//HISTORIAL GENERAL
app.get("/historial", async (req, res) => {

  const { data, error } = await supabase
    .from("datos")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) return res.status(500).send(error);

  res.json(data);
});

//HISTORIAL POR FECHA
app.get("/historial/:fecha", async (req, res) => {

  const fecha = req.params.fecha;

  const { data, error } = await supabase
    .from("datos")
    .select("*")
    .gte("created_at", fecha + "T00:00:00")
    .lte("created_at", fecha + "T23:59:59")
    .order("created_at", { ascending: true });

  if (error) return res.status(500).send(error);

  res.json(data);
});

//LISTA DE FECHAS
app.get("/fechas", async (req, res) => {

  const { data, error } = await supabase
    .from("datos")
    .select("created_at");

  if (error) return res.status(500).send(error);

  const fechas = [...new Set(
    data.map(d => d.created_at.split("T")[0])
  )];

  res.json(fechas);
});

// TOGGLE
function toggle(dispositivo) {
  estados[dispositivo] = !estados[dispositivo];
  return estados[dispositivo] ? "ON" : "OFF";
}

app.post("/bomba", (req, res) => {
  const estado = toggle("bomba");
  client.publish("esp32/bomba", estado);
  res.json({ estado });
});

app.post("/ventilador", (req, res) => {
  const estado = toggle("ventilador");
  client.publish("esp32/ventilador", estado);
  res.json({ estado });
});

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