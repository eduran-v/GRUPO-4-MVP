/* ==========================================================
   Experimento Grupo 4 — CONFIGURACIÓN
   Edita SOLO este archivo para conectar Google Sheets y
   ajustar el experimento. Ver experimento/GUIA.md
   ========================================================== */
window.EXP_CONFIG = {
  // 1) Pega aquí la URL de tu Web App de Google Apps Script
  //    (termina en /exec). Si la dejas vacía, la página funciona
  //    en "modo demostración" y NO envía datos.
  SCRIPT_URL: "https://script.google.com/macros/s/AKfycbwbFP_P6Zv9oyyxl90j1wSDLCMdZa7tvWAnjcW4gR7vwnkI97OE-0laysxylN38XRTL-w/exec",

  // 2) Muestra del experimento: genera los códigos E01 … E15
  TOTAL_PARTICIPANTES: 15,
  PREFIJO_CODIGO: "E",

  // 3) Criterios de éxito de la Test Card
  META_CV: 10,            // estudiantes que envían su CV para auditoría
  META_POSTULACIONES: 7,  // estudiantes que aplican cambios y postulan
  DIAS_LIMITE: 7,         // "en la semana": días desde que abren el enlace

  // 4) Contacto del equipo (se muestra al final para dudas o
  //    para pedir que borren sus datos). Déjalo "" para ocultarlo.
  CONTACTO_EQUIPO: "",

  MATERIA: "Emprendimiento",
};
