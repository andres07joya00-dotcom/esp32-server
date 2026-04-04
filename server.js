const express = require("express");
const mqtt = require("mqtt");
const cors = require("cors");
const path = require("path");
const sqlite3 = require("sqlite3").verbose(); //NUEVO

const app = express();
app.use(cors());
app.use(express.json());

// Servir HTML
app.use(express.static(path.join(__dirname, "public")));

//BASE DE DATOS
const db = new sqlite3.Database("sensores.db");

db.run(`
  CREATE TABLE IF NOT EXISTS datos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    suelo INTEGER,
    aire REAL,
    temperatura REAL,
    luz INTEGER,
    fecha DATETIME DEFAULT (datetime('now', 'localtime'))
  )
`);

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

// ESTADOS ACTUADORES
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

  client.subscribe("esp32/humedad_suelo");
  client.subscribe("esp32/humedad_amb");
  client.subscribe("esp32/temperatura");
  client.subscribe("esp32/luz");

  client.subscribe("esp32/bomba_estado");
  client.subscribe("esp32/ventilador_estado");
});

// RECEPCIÓN
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

  if (topic === "esp32/bomba_estado") {
    estadoReal.bomba = data;
    tBomba = now;
  }

  if (topic === "esp32/ventilador_estado") {
    estadoReal.ventilador = data;
    tVentilador = now;
  }
});

//GUARDAR DATOS AUTOMÁTICAMENTE
setInterval(() => {

  if (
  humedadSuelo !== "--" &&
  humedadAire !== "--" &&
  temperatura !== "--" &&
  luz !== "--" &&
  !isNaN(humedadSuelo) &&
  !isNaN(humedadAire) &&
  !isNaN(temperatura) &&
  !isNaN(luz)
  ) {
    db.run(
      `INSERT INTO datos (suelo, aire, temperatura, luz, fecha) 
        VALUES (?, ?, ?, ?, datetime('now','localtime'))`,
      [
        parseInt(humedadSuelo),
        parseFloat(humedadAire),
        parseFloat(temperatura),
        parseInt(luz)
      ]
    );

    console.log("Datos guardados");
  }

}, 5000);

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

//HISTORIAL
app.get("/historial", (req, res) => {

  db.all(
    "SELECT * FROM datos ORDER BY id ASC LIMIT 100",
    [],
    (err, rows) => {
      if (err) {
        res.status(500).send(err);
      } else {
        res.json(rows);
      }
    }
  );

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

app.get("/historial/:fecha", (req, res) => {

  const fecha = req.params.fecha; // formato: YYYY-MM-DD

  db.all(
    `
    SELECT * FROM datos 
    WHERE date(fecha) = ?
    ORDER BY fecha ASC
    `,
    [fecha],
    (err, rows) => {
      if (err) {
        res.status(500).send(err);
      } else {
        res.json(rows);
      }
    }
  );

});

app.get("/fechas", (req, res) => {

  db.all(
    `
    SELECT DISTINCT date(fecha) as dia 
    FROM datos 
    ORDER BY dia DESC
    `,
    [],
    (err, rows) => {
      if (err) res.status(500).send(err);
      else res.json(rows);
    }
  );

});

app.listen(3000, () => {
  console.log("Servidor en http://localhost:3000");
});