/* ==========================================================
   Experimento Grupo 4 — Receptor de métricas (Google Apps Script)
   Pega este código en Extensiones › Apps Script de tu Google Sheet.
   Instrucciones completas: experimento/GUIA.md
   ========================================================== */

// Cambia esta clave: se pide en resultados.html para ver los datos.
const CLAVE_LECTURA = "cambia-esta-clave";

const HOJA = "Eventos";
const CARPETA_CVS = "CVs compartidos - Experimento Grupo 4";
const COLUMNAS = [
  "id_evento", "fecha_servidor", "fecha_cliente", "participante", "evento", "vacante",
  "puntaje", "puntaje_anterior", "nombre", "carrera", "universidad", "semestre", "contacto",
  "comparte_cv", "enlace_cv", "detalle", "sesion", "navegador",
];

/* Recibe cada evento enviado por experimento.html */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const d = JSON.parse(e.postData.contents);
    const hoja = obtenerHoja_();
    if (d.id && yaExiste_(hoja, d.id)) return json_({ ok: true, duplicado: true });

    let enlaceCv = "";
    if (d.comparte_cv && d.archivo && d.archivo.base64) enlaceCv = guardarCv_(d);

    const datos = d.datos || {};
    hoja.appendRow([
      d.id || "", new Date(), d.fecha_cliente || "", d.participante || "", d.evento || "", d.vacante || "",
      d.puntaje === undefined ? "" : d.puntaje, d.puntaje_anterior === undefined ? "" : d.puntaje_anterior,
      datos.nombre || "", datos.carrera || "", datos.universidad || "", datos.semestre || "", datos.contacto || "",
      d.comparte_cv ? "sí" : "no", enlaceCv, JSON.stringify(d.detalle || {}), d.sesion || "", d.navegador || "",
    ].map(seguro_));
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/* Devuelve todos los eventos a resultados.html (requiere la clave) */
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (!p.key) return json_({ ok: true, mensaje: "El receptor del experimento está funcionando ✅" });
  if (p.key !== CLAVE_LECTURA) return json_({ ok: false, error: "Clave incorrecta" });
  const hoja = obtenerHoja_();
  const filas = hoja.getDataRange().getValues();
  const cab = filas.shift();
  const eventos = filas.map((f) => {
    const o = {};
    cab.forEach((c, i) => (o[c] = f[i] instanceof Date ? f[i].toISOString() : f[i]));
    try { o.detalle = JSON.parse(o.detalle || "{}"); } catch (_) { o.detalle = {}; }
    return o;
  });
  return json_({ ok: true, eventos: eventos });
}

/* Ejecútala desde el editor (botón ▶ Ejecutar) para probar:
   escribe una fila de prueba y muestra el enlace a tu hoja en el registro. */
function probar() {
  const hoja = obtenerHoja_();
  hoja.appendRow(["prueba-" + Date.now(), new Date(), "", "PRUEBA", "prueba_desde_editor"]);
  Logger.log("✅ Todo bien. Tu hoja de resultados está aquí: " + hoja.getParent().getUrl());
}

/* ---------- Utilidades ---------- */
// Usa la hoja donde está el script; si el script se creó por separado
// (desde script.google.com), crea una hoja nueva en tu Drive y la recuerda.
function obtenerLibro_() {
  const activo = SpreadsheetApp.getActiveSpreadsheet();
  if (activo) return activo;
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty("SHEET_ID");
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (_) { /* fue borrada: se crea otra */ }
  }
  const ss = SpreadsheetApp.create("Experimento Grupo 4 - Resultados");
  props.setProperty("SHEET_ID", ss.getId());
  return ss;
}

function obtenerHoja_() {
  const ss = obtenerLibro_();
  let hoja = ss.getSheetByName(HOJA);
  if (!hoja) {
    hoja = ss.insertSheet(HOJA);
    hoja.appendRow(COLUMNAS);
    hoja.setFrozenRows(1);
    hoja.getRange(1, 1, 1, COLUMNAS.length).setFontWeight("bold").setBackground("#eef3ff");
  }
  return hoja;
}

function yaExiste_(hoja, id) {
  const n = hoja.getLastRow();
  if (n < 2) return false;
  return hoja.getRange(2, 1, n - 1, 1).createTextFinder(id).matchEntireCell(true).findNext() !== null;
}

function guardarCv_(d) {
  const carpetas = DriveApp.getFoldersByName(CARPETA_CVS);
  const carpeta = carpetas.hasNext() ? carpetas.next() : DriveApp.createFolder(CARPETA_CVS);
  const a = d.archivo;
  const nombre = (d.participante || "SIN-CODIGO") + " - " + (d.evento || "cv") + " - " + (a.nombre || "cv");
  const blob = Utilities.newBlob(Utilities.base64Decode(a.base64), a.tipo || "application/octet-stream", nombre);
  return carpeta.createFile(blob).getUrl(); // el archivo queda privado (solo tu cuenta)
}

// Evita que un texto se interprete como fórmula en la hoja
function seguro_(v) {
  return typeof v === "string" && /^[=+\-@]/.test(v) ? "'" + v : v;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
