/* ==========================================================
   Experimento Grupo 4 — Auditoría de CV (se ejecuta en el navegador)
   Basado en el evaluador de la app principal (app.js).
   ========================================================== */
window.CVAudit = (() => {
  "use strict";
  const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = (s = "") => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  const SKILL_LEXICON = [
    "javascript", "typescript", "react", "html", "css", "node", "python", "java", "sql", "git", "github",
    "api", "responsive", "figma", "ux", "ui", "prototipado", "excel", "power bi", "tableau", "estadística",
    "testing", "jira", "scrum", "agile", "comunicación", "trabajo en equipo", "liderazgo", "inglés",
    "marketing", "seo", "google analytics", "meta ads", "copywriting", "redes sociales", "canva", "tiktok", "instagram",
    "community manager", "atención al cliente", "servicio al cliente", "empatía", "resolución de problemas", "documentación",
    "photoshop", "illustrator", "adobe", "finanzas", "contabilidad", "análisis de datos", "presupuesto", "ventas",
    "crm", "word", "powerpoint", "wordpress", "tablas dinámicas", "creatividad", "ortografía",
  ];
  const STOP = new Set("para como con que los las del una uno por sus nuestro nuestra nuestros equipo buscamos ser estar sobre entre desde hasta este esta estos estas tener tiene puede donde cuando quien muy mas pero tambien todo toda todos todas cada otro otra alguien persona personas semana semanal horas meses mes junto real reales ganas aprender nuestros apoyaras trabajaras requisitos habilidades deseadas perfil conocimientos ultimos semestres estudiantes estudiante disponibilidad basicos basico deseable buscado bienvenidos pasante pasantes practicante practicas pasantia cooperativa socios lumbre kinti ahorro quito medio tiempo flexible clases cafeteria locales startup quitena colegios usuarios mananas tardes mensual mensuales crecer clientes jovenes promociones eventos ayude apoye curioso conectar nuestra nuestras plataformas pichincha queremos especialidad organizando aprendizaje preparando decisiones toma junto mejorar aprenda".split(" "));
  const ACTION_VERBS = ["desarrolle", "lidere", "disene", "implemente", "cree", "optimice", "aumente", "reduje", "gestione", "coordine", "organice", "logre", "construi", "automatice", "mejore", "analice", "colabore", "participe", "dirigi", "propuse", "lance", "investigue", "documente", "capacite"];

  function analyzeCV(cv, job) {
    const C = norm(cv), J = norm(job);
    const has = (txt, term) => new RegExp(`(^|[^a-z0-9])${term.replace(/[.+#]/g, "\\$&")}([^a-z0-9]|$)`).test(txt);
    let keys = SKILL_LEXICON.map(norm).filter((k) => has(J, k));
    keys = keys.filter((k) => !keys.some((o) => o !== k && o.includes(k) && o.length > k.length)); // quitar duplicados contenidos
    // Términos frecuentes adicionales de la vacante
    const freq = {};
    J.split(/[^a-zñ]+/).filter((w) => w.length >= 6 && !STOP.has(w)).forEach((w) => (freq[w] = (freq[w] || 0) + 1));
    const extra = Object.entries(freq).sort((a, b) => b[1] - a[1]).map(([w]) => w).filter((w) => !keys.some((k) => k.includes(w) || w.includes(k))).slice(0, Math.max(3, 10 - keys.length));
    const allKeys = [...new Set([...keys, ...extra])].slice(0, 14);
    const matched = allKeys.filter((k) => has(C, k) || C.includes(k));
    const missing = allKeys.filter((k) => !matched.includes(k));
    const kw = allKeys.length ? (matched.length / allKeys.length) * 100 : 50;

    const sections = [
      ["Experiencia o Proyectos", /experiencia|proyectos?/],
      ["Educación / Formación", /educacion|formacion|estudios|academic/],
      ["Habilidades", /habilidades|skills|competencias|conocimientos/],
      ["Idiomas", /idiomas|ingles|english/],
      ["Datos de contacto", /@|\+?\d[\d\s-]{7,}/],
      ["Perfil profesional", /perfil|resumen|sobre mi|objetivo/],
    ];
    const foundSec = sections.filter(([, r]) => r.test(C));
    const missingSec = sections.filter(([, r]) => !r.test(C)).map(([n]) => n);
    const structure = (foundSec.length / sections.length) * 100;

    const verbs = ACTION_VERBS.filter((v) => C.includes(v));
    const nums = (C.match(/(\+\d+|\d+\s?%|\d+\s?(usuarios|personas|clientes|proyectos|facultades|puesto))/g) || []).length;
    const impact = Math.min(100, verbs.length * 14 + nums * 16);

    const words = cv.trim().split(/\s+/).length;
    let format = words < 60 ? 30 : words < 120 ? 60 : words <= 750 ? 100 : words <= 1000 ? 75 : 50;
    if ((cv.match(/\n/g) || []).length < 4) format -= 15;
    format = Math.max(10, format);

    const score = Math.max(1, Math.min(100, Math.round(kw * 0.45 + structure * 0.2 + impact * 0.2 + format * 0.15)));

    const sugg = [];
    if (missing.length) sugg.push({ i: "🔑", c: "#ffeef0", t: `Incluye estas palabras clave de la vacante (si tienes la habilidad): <b>${missing.slice(0, 5).map(esc).join(", ")}</b>. Los filtros ATS buscan coincidencias exactas.` });
    if (missingSec.length) sugg.push({ i: "🧱", c: "#fff5e6", t: `Agrega las secciones faltantes: <b>${missingSec.join(", ")}</b>. Una estructura estándar facilita la lectura en 7 segundos.` });
    if (verbs.length < 3) sugg.push({ i: "⚡", c: "#eef3ff", t: "Empieza tus viñetas con verbos de acción en pasado: <b>Desarrollé, Lideré, Optimicé, Automaticé</b>." });
    if (nums < 2) sugg.push({ i: "📈", c: "#e6fbf5", t: "Cuantifica tus logros: usa números y porcentajes (p. ej. “+300 usuarios”, “reduje un 40% el tiempo”)." });
    if (words < 120) sugg.push({ i: "📝", c: "#f1edff", t: `Tu CV tiene solo ${words} palabras. Desarrolla más tus proyectos, cursos y voluntariados (ideal: 250–600).` });
    if (words > 800) sugg.push({ i: "✂️", c: "#f1edff", t: `Tu CV tiene ${words} palabras. Resúmelo a una página priorizando lo relevante para el puesto.` });
    if (!/github|behance|portafolio|portfolio|linkedin|dribbble/.test(C)) sugg.push({ i: "🔗", c: "#eef3ff", t: "Añade un enlace a tu portafolio, GitHub, Behance o LinkedIn en el encabezado." });
    sugg.push({ i: "🎯", c: "#e6fbf5", t: "Adapta tu perfil profesional mencionando el nombre del puesto al que aplicas." });

    return { score, kw: Math.round(kw), structure: Math.round(structure), impact: Math.round(impact), format: Math.round(format), matched, missing, sugg: sugg.slice(0, 6), words, date: Date.now() };
  }

  function jobText(v) {
    return `${v.titulo} — ${v.empresa}\n${v.descripcion}\n${v.responsabilidades.join("; ")}\nRequisitos: ${v.requisitos.join("; ")}\nHabilidades deseadas: ${v.habilidades.join(", ")}`;
  }

  // Audita el CV contra las 3 vacantes y devuelve la mejor
  function auditAll(cv, vacantes) {
    const porVacante = {};
    vacantes.forEach((v) => (porVacante[v.id] = analyzeCV(cv, jobText(v))));
    const mejorId = vacantes.map((v) => v.id).sort((a, b) => porVacante[b].score - porVacante[a].score)[0];
    return { porVacante, mejorId, palabras: porVacante[mejorId].words, fecha: Date.now() };
  }

  /* ---------- Lectura de archivos (PDF, DOCX, TXT) ---------- */
  async function readFile(file) {
    if (file.size > 5 * 1024 * 1024) throw new Error("El archivo supera los 5 MB");
    const ext = file.name.split(".").pop().toLowerCase();
    let text = "";
    if (ext === "txt") text = await file.text();
    else if (ext === "docx") {
      if (!window.mammoth) throw new Error("Lector de Word no disponible (revisa tu conexión)");
      text = (await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
    } else if (ext === "pdf") {
      const pdfjs = await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";
      const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
      for (let i = 1; i <= doc.numPages; i++) {
        const c = await (await doc.getPage(i)).getTextContent();
        let line = "", lastY = null;
        c.items.forEach((it) => { const y = it.transform[5]; if (lastY !== null && Math.abs(y - lastY) > 4) line += "\n"; line += it.str + " "; lastY = y; });
        text += line + "\n";
      }
    } else throw new Error("Formato no soportado: usa PDF, Word (.docx) o .txt");
    text = text.replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
    if (!text) throw new Error("No se encontró texto (¿es un PDF escaneado?)");
    return text;
  }

  const toBase64 = (file) => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(",")[1] || "");
    r.onerror = () => rej(r.error);
    r.readAsDataURL(file);
  });

  return { analyzeCV, auditAll, jobText, readFile, toBase64, esc, norm };
})();
