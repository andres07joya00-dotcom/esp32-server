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

// 🔹 Controlar dispositivos
app.post("/bomba", (req, res) => {
  client.publish("esp32/bomba", "ON");
  res.send("Bomba ON");
});

app.post("/ventilador", (req, res) => {
  client.publish("esp32/ventilador", "ON");
  res.send("Ventilador ON");
});

app.post("/luces", (req, res) => {
  client.publish("esp32/luces", "ON");
  res.send("Luces ON");
});

app.listen(3000, () => {
  console.log("Servidor en http://localhost:3000");
});