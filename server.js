const mqtt = require("mqtt");
const express = require("express");

const app = express();
const client = mqtt.connect("mqtt://broker.hivemq.com");

client.on("connect", () => {
  console.log("MQTT conectado");
});

// Rutas
app.get("/on", (req, res) => {
  client.publish("esp32/led", "ON");
  console.log("LED ENCENDIDO");
  res.send("LED ENCENDIDO");
});

app.get("/off", (req, res) => {
  client.publish("esp32/led", "OFF");
  console.log("LED APAGADO");
  res.send("LED APAGADO");
});

// Servir la página web
app.use(express.static(__dirname));

// Levantar servidor
app.listen(3000, () => {
  console.log("Servidor en http://localhost:3000");
});