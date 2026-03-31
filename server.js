const express = require("express");
const mqtt = require("mqtt");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

// 🔹 Servir HTML
app.use(express.static(path.join(__dirname, "public")));

// 🔹 MQTT
const client = mqtt.connect("mqtt://broker.hivemq.com");

let humedad = 0;

// 🔥 Estados de dispositivos
let estados = {
  bomba: false,
  ventilador: false,
  luces: false
};

client.on("connect", () => {
  console.log("Conectado a MQTT");
  client.subscribe("esp32/humedad");
});

client.on("message", (topic, message) => {
  if (topic === "esp32/humedad") {
    humedad = message.toString();
    console.log("Humedad:", humedad);
  }
});

// 🔹 Enviar datos al HTML
app.get("/datos", (req, res) => {
  res.json({
    suelo: humedad,
    aire: "--",
    temp: "--",
    luz: "--"
  });
});

// 🔥 FUNCIÓN TOGGLE
function toggle(dispositivo) {
  estados[dispositivo] = !estados[dispositivo];
  return estados[dispositivo] ? "ON" : "OFF";
}

// 🔹 BOMBA (toggle)
app.post("/bomba", (req, res) => {
  const estado = toggle("bomba");
  client.publish("esp32/bomba", estado);
  res.json({ estado });
});

// 🔹 VENTILADOR (toggle)
app.post("/ventilador", (req, res) => {
  const estado = toggle("ventilador");
  client.publish("esp32/ventilador", estado);
  res.json({ estado });
});

// 🔹 LUCES (toggle)
app.post("/luces", (req, res) => {
  const estado = toggle("luces");
  client.publish("esp32/luces", estado);
  res.json({ estado });
});

// 🔥 ESTADO DEL SERVIDOR + DISPOSITIVOS
app.get("/estado", (req, res) => {
  res.json({
    conectado: client.connected,
    dispositivos: estados
  });
});

app.listen(3000, () => {
  console.log("Servidor en http://localhost:3000");
});