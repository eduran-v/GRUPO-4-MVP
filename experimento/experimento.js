/* ==========================================================
   Experimento Grupo 4 — Flujo del estudiante
   Bienvenida → Auditoría de CV → 3 vacantes → CV actualizado →
   Confirmación de postulación → Cierre
   Cada paso registra un evento en Google Sheets (ver config.js).
   ========================================================== */
(() => {
  "use strict";
  const C = window.EXP_CONFIG;
  const VAC = window.VACANTES_QUITO;
  const { auditAll, analyzeCV, jobText, readFile, toBase64, esc } = window.CVAudit;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const view = $("#view");
  const vac = (id) => VAC.find((v) => v.id === id);
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const first = (n = "") => n.trim().split(/\s+/)[0] || "";
  const fmtFecha = (ms) => new Date(ms).toLocaleDateString("es-EC", { weekday: "long", day: "numeric", month: "long" });

  /* ---------------- Estado (por dispositivo) ---------------- */
  const KEY = "exp-g4-estado-v1";
  const OUTBOX = "exp-g4-pendientes-v1";
  const safeGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const safeSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

  const urlPid = (new URLSearchParams(location.search).get("p") || "").toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 20);
  const nuevoEstado = (pid) => ({ pid, sesion: uid(), paso: "bienvenida", datos: null, comparteCV: false, abiertoEn: Date.now(), audit: null, vacante: null, post: null, postulaciones: [] });
  let st = safeGet(KEY, null);
  if (!st || (urlPid && st.pid !== urlPid)) st = nuevoEstado(urlPid || "SC-" + Math.random().toString(36).slice(2, 6).toUpperCase());
  const save = () => safeSet(KEY, st);
  save();

  const ui = { cvText: "", cvFile: null, nuevoText: "", nuevoFile: null };

  /* ---------------- Registro de eventos ---------------- */
  const archivos = {}; // los archivos sólo viven en memoria (no en localStorage)
  let enviando = false;

  function track(evento, extra = {}) {
    const ev = {
      id: uid(), fecha_cliente: new Date().toISOString(), participante: st.pid, sesion: st.sesion, evento,
      vacante: extra.vacante || "", puntaje: extra.puntaje ?? "", puntaje_anterior: extra.puntaje_anterior ?? "",
      datos: st.datos || {}, comparte_cv: !!st.comparteCV, detalle: extra.detalle || {}, navegador: navigator.userAgent,
    };
    if (extra.archivo) archivos[ev.id] = extra.archivo;
    const q = safeGet(OUTBOX, []); q.push(ev); safeSet(OUTBOX, q);
    if (!C.SCRIPT_URL) console.info("[experimento · modo demo] evento:", ev);
    flush();
  }

  async function flush() {
    if (!C.SCRIPT_URL || enviando) return;
    enviando = true;
    try {
      let q = safeGet(OUTBOX, []);
      while (q.length) {
        const ev = q[0];
        const body = JSON.stringify(archivos[ev.id] ? { ...ev, archivo: archivos[ev.id] } : ev);
        await fetch(C.SCRIPT_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body, keepalive: body.length < 60000 });
        delete archivos[ev.id];
        q = safeGet(OUTBOX, []).filter((x) => x.id !== ev.id); safeSet(OUTBOX, q);
      }
    } catch (err) {
      console.warn("No se pudo enviar el evento; se reintentará.", err);
      setTimeout(() => { enviando = false; flush(); }, 8000);
      return;
    }
    enviando = false;
  }
  window.addEventListener("online", flush);

  /* ---------------- UI helpers ---------------- */
  function toast(msg, ico = "✅") {
    const t = document.createElement("div");
    t.className = "toast"; t.innerHTML = `<span>${ico}</span><span>${msg}</span>`;
    $("#toasts").appendChild(t);
    setTimeout(() => { t.style.opacity = "0"; setTimeout(() => t.remove(), 300); }, 3200);
  }
  const PASOS = [["bienvenida", "Tus datos"], ["cv", "Auditoría"], ["vacantes", "Vacantes"], ["postular", "Postulación"]];
  function drawSteps() {
    const idx = { bienvenida: 0, cv: 1, resultado: 2, vacante: 2, postular: 3, cierre: 4 }[st.paso] ?? 0;
    $("#steps").innerHTML = PASOS.map(([, n], i) => `<li class="${i < idx ? "done" : i === idx ? "on" : ""}"><b>${i < idx ? "✓" : i + 1}</b><span>${n}</span></li>`).join("");
  }
  function go(paso, extra = {}) { Object.assign(st, extra, { paso }); save(); render(); window.scrollTo({ top: 0 }); view.focus({ preventScroll: true }); }

  function scoreColor(s) { return s >= 80 ? "var(--mint)" : s >= 60 ? "var(--blue)" : s >= 40 ? "var(--amber)" : "var(--red)"; }
  function verdict(s) {
    if (s >= 80) return ["¡Excelente! Tu CV está listo para postular. 🚀", "#e6fbf5", "#0c8a69"];
    if (s >= 60) return ["Buen CV. Con unos ajustes puedes destacar aún más. 💪", "#eef3ff", "#1d4ed8"];
    if (s >= 40) return ["CV promedio. Aplica las sugerencias antes de postular. 🛠️", "#fff5e6", "#b76e00"];
    return ["Tu CV necesita adaptarse a estas vacantes. 📌", "#ffeef0", "#d63447"];
  }
  function animateRing(root, target) {
    const ring = $(".ring", root), num = $(".ring b", root); if (!ring) return;
    const t0 = performance.now();
    const step = (t) => { const p = Math.min(1, (t - t0) / 1100), v = Math.round(target * (1 - Math.pow(1 - p, 3))); ring.style.setProperty("--v", v); num.textContent = v; if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
    requestAnimationFrame(() => $$("[data-w]", root).forEach((b) => (b.style.width = b.dataset.w + "%")));
  }
  function scanning(box, titulo, done) {
    const steps = ["Leyendo tu CV", "Comparando con las vacantes en Quito", "Evaluando estructura e impacto", "Generando recomendaciones"];
    box.innerHTML = `<div class="scanning" style="min-height:320px"><div>
      <div class="scan-doc">${[18, 34, 50, 66, 82, 98, 114].map((t, i) => `<i style="top:${t}px;right:${i % 2 ? 36 : 16}px"></i>`).join("")}<span class="beam"></span></div>
      <h3 style="margin:20px 0 12px">${titulo}</h3><ul class="scan-steps">${steps.map((s) => `<li>${s}</li>`).join("")}</ul></div></div>`;
    let i = 0;
    const tick = setInterval(() => { $$(".scan-steps li", box)[i]?.classList.add("on"); i++; if (i > steps.length) { clearInterval(tick); done(); } }, 480);
  }

  function uploader(prefix, texto) {
    return `
      <label class="dropzone" id="${prefix}Drop">
        <span class="dz-ico">⬆️</span>
        <b>Arrastra tu CV aquí o toca para subirlo</b>
        <span class="muted small">PDF, Word (.docx) o .txt · máx. 5 MB</span>
        <input type="file" id="${prefix}File" accept=".pdf,.docx,.txt" hidden />
      </label>
      <div id="${prefix}Pill" style="margin-top:10px"></div>
      <div class="divider">o pega el texto de tu CV</div>
      <textarea class="textarea" id="${prefix}Text" placeholder="Pega aquí el contenido de tu CV…" style="min-height:160px">${esc(texto || "")}</textarea>`;
  }
  function bindUploader(prefix, onText) {
    const dz = $(`#${prefix}Drop`), input = $(`#${prefix}File`), pill = $(`#${prefix}Pill`), ta = $(`#${prefix}Text`);
    const handle = async (file) => {
      pill.innerHTML = `<div class="file-pill">⏳ Leyendo ${esc(file.name)}…</div>`;
      try {
        const text = await readFile(file);
        ta.value = text; onText(text, file);
        pill.innerHTML = `<div class="file-pill">✓ ${esc(file.name)} · ${text.split(/\s+/).length} palabras</div>`;
      } catch (err) {
        onText(ta.value, null);
        pill.innerHTML = `<div class="file-pill" style="background:#ffeef0;color:#d63447">⚠️ ${esc(err.message || "No se pudo leer el archivo")}. Pega el texto manualmente.</div>`;
      }
    };
    ["dragenter", "dragover"].forEach((e) => dz.addEventListener(e, (ev) => { ev.preventDefault(); dz.classList.add("drag"); }));
    ["dragleave", "drop"].forEach((e) => dz.addEventListener(e, (ev) => { ev.preventDefault(); dz.classList.remove("drag"); }));
    dz.addEventListener("drop", (e) => e.dataTransfer.files[0] && handle(e.dataTransfer.files[0]));
    input.addEventListener("change", () => input.files[0] && handle(input.files[0]));
    ta.addEventListener("input", () => onText(ta.value, null, true));
  }
  async function archivoParaCompartir(file, texto, nombreTxt) {
    if (!st.comparteCV) return null;
    if (file) return { nombre: file.name, tipo: file.type || "application/octet-stream", base64: await toBase64(file) };
    const b64 = btoa(unescape(encodeURIComponent(texto)));
    return { nombre: nombreTxt, tipo: "text/plain", base64: b64 };
  }

  /* ================= PASO 1 · Bienvenida + consentimiento ================= */
  const UNIS = ["PUCE", "USFQ", "EPN", "Universidad Central del Ecuador", "UDLA", "UTE", "UIDE", "ESPE", "UPS", "Universidad Hemisferios", "UTI", "Otra"];
  function viewBienvenida() {
    const d = st.datos || {};
    view.innerHTML = `
      <section class="x-hero">
        <span class="eyebrow">Pasantías en Quito · Sin experiencia</span>
        <h1>Optimiza tu CV gratis y postula a <span class="x-grad">3 pasantías curadas en Quito</span></h1>
        <p>Sube tu CV y en segundos recibes una auditoría con sugerencias concretas. Luego accedes a 3 vacantes locales donde <b>no se exige experiencia</b>.</p>
        <ul class="x-bullets"><li>⚡ Auditoría inmediata</li><li>📍 Vacantes en Quito</li><li>🌱 Sin experiencia previa</li></ul>
      </section>
      <form class="card card-pad form-stack x-narrow" id="fDatos" novalidate>
        <h2 class="x-h2">Cuéntanos sobre ti</h2>
        <div class="x-grid2">
          <label class="x-field"><span class="x-lbl">Nombre y apellido *</span><input class="input" name="nombre" required maxlength="80" value="${esc(d.nombre || "")}" autocomplete="name" /></label>
          <label class="x-field"><span class="x-lbl">Carrera *</span><input class="input" name="carrera" required maxlength="80" placeholder="Ej. Administración de Empresas" value="${esc(d.carrera || "")}" /></label>
          <label class="x-field"><span class="x-lbl">Universidad *</span><select class="input" name="universidad" required><option value="">Elige…</option>${UNIS.map((u) => `<option ${d.universidad === u ? "selected" : ""}>${u}</option>`).join("")}</select></label>
          <label class="x-field"><span class="x-lbl">Semestre</span><select class="input" name="semestre"><option value="">Elige…</option>${["1.º–3.º", "4.º–6.º", "7.º–8.º", "9.º o más", "Recién graduado/a"].map((s) => `<option ${d.semestre === s ? "selected" : ""}>${s}</option>`).join("")}</select></label>
        </div>
        <label class="x-field"><span class="x-lbl">WhatsApp o correo *</span><input class="input" name="contacto" required maxlength="80" placeholder="Para avisarte sobre tu postulación" value="${esc(d.contacto || "")}" /></label>
        <label class="x-check"><input type="checkbox" name="consent" ${st.datos ? "checked" : ""} required />
          <span>Acepto participar en esta prueba de un prototipo desarrollado por estudiantes universitarios para la materia de ${esc(C.MATERIA)}. Entiendo que se registrará mi uso de la página (por ejemplo, si envío mi CV y si me postulo) y mi puntaje de CV con fines académicos. Al final me contarán más detalles del estudio.</span></label>
        <button class="btn btn-grad btn-block x-cta">Comenzar →</button>
      </form>`;
    $("#fDatos").addEventListener("submit", (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const datos = { nombre: f.get("nombre").trim(), carrera: f.get("carrera").trim(), universidad: f.get("universidad"), semestre: f.get("semestre"), contacto: f.get("contacto").trim() };
      if (!datos.nombre || !datos.carrera || !datos.universidad || !datos.contacto) return toast("Completa los campos marcados con *", "⚠️");
      if (!f.get("consent")) return toast("Necesitamos tu consentimiento para continuar", "⚠️");
      st.datos = datos; save();
      track("consentimiento_aceptado");
      go("cv");
    });
  }

  /* ================= PASO 2 · Envío del CV para auditoría ================= */
  function viewCV() {
    view.innerHTML = `
      <div class="x-head"><span class="eyebrow">Paso 2 · Auditoría</span><h1>Hola ${esc(first(st.datos.nombre))}, sube tu CV 📄</h1><p class="muted">Lo compararemos con las 3 vacantes de Quito y te diremos exactamente qué mejorar.</p></div>
      <form class="card card-pad form-stack x-narrow" id="fCV">
        ${uploader("cv", ui.cvText)}
        <label class="x-check x-check-soft"><input type="checkbox" id="share" ${st.comparteCV ? "checked" : ""} />
          <span><b>Opcional:</b> acepto compartir mi CV (el archivo) con el equipo del Grupo 4 para que lo revisen personalmente. Si no lo marcas, tu CV se analiza solo en tu navegador y únicamente guardamos tu puntaje.</span></label>
        <button class="btn btn-grad btn-block x-cta">✨ Auditar mi CV</button>
      </form>
      <section class="card card-pad x-narrow" id="scanBox" hidden></section>`;
    bindUploader("cv", (t, file, typed) => { ui.cvText = t; if (!typed) ui.cvFile = file; else ui.cvFile = null; });
    $("#fCV").addEventListener("submit", (e) => {
      e.preventDefault();
      const texto = $("#cvText").value.trim(); ui.cvText = texto;
      if (texto.length < 40) return toast("Sube o pega tu CV (mínimo 40 caracteres)", "⚠️");
      st.comparteCV = $("#share").checked; save();
      const box = $("#scanBox"); box.hidden = false; $("#fCV").hidden = true;
      scanning(box, "Auditando tu CV…", async () => {
        const audit = auditAll(texto, VAC);
        const archivo = await archivoParaCompartir(ui.cvFile, texto, "cv-pegado.txt").catch(() => null);
        track("cv_enviado", {
          vacante: audit.mejorId, puntaje: audit.porVacante[audit.mejorId].score, archivo,
          detalle: { puntajes: Object.fromEntries(VAC.map((v) => [v.id, audit.porVacante[v.id].score])), palabras: audit.palabras, origen: ui.cvFile ? "archivo" : "texto", archivo: ui.cvFile?.name || "" },
        });
        go("resultado", { audit });
      });
    });
  }

  /* ================= PASO 3 · Resultado + vacantes ================= */
  function barras(r) {
    const bar = (l, v, c) => `<div class="bar-row"><div class="row"><span>${l}</span><span>${v}%</span></div><div class="progress"><span data-w="${v}" style="width:0;background:${c}"></span></div></div>`;
    return `<div class="bars">${bar("🔑 Palabras clave", r.kw, "var(--blue)")}${bar("🧱 Estructura y secciones", r.structure, "var(--violet)")}${bar("📈 Impacto y logros medibles", r.impact, "var(--mint)")}${bar("📝 Formato y extensión", r.format, "var(--amber)")}</div>`;
  }
  const sugerencias = (r) => `<ul class="sugg">${r.sugg.map((s) => `<li><span class="s-ico" style="background:${s.c}">${s.i}</span><span>${s.t}</span></li>`).join("")}</ul>`;
  const limite = () => fmtFecha(st.abiertoEn + C.DIAS_LIMITE * 864e5);

  function vacCard(v) {
    const s = st.audit.porVacante[v.id].score, ya = st.postulaciones.includes(v.id);
    return `<article class="card x-vac">
      <div class="x-vac-head"><span class="x-logo" style="background:linear-gradient(135deg,${v.color[0]},${v.color[1]})">${esc(v.iniciales)}</span>
        <div><h3>${esc(v.titulo)}</h3><p class="muted small">${esc(v.empresa)} · ${esc(v.ubicacion)}</p></div></div>
      <div class="chips"><span class="chip mint">🌱 Sin experiencia</span><span class="chip">${esc(v.modalidad)}</span><span class="chip">💵 ${esc(v.estipendio)}</span></div>
      <div class="x-match"><span>Afinidad de tu CV</span><b style="color:${scoreColor(s)}">${s}%</b></div>
      <button class="btn ${ya ? "btn-mint" : "btn-primary"} btn-block" data-vac="${v.id}">${ya ? "✓ Ya postulaste · Ver" : "Ver vacante y postular"}</button>
    </article>`;
  }

  function viewResultado() {
    const a = st.audit, r = a.porVacante[a.mejorId], [vt, vbg, vfg] = verdict(r.score);
    view.innerHTML = `
      <div class="x-head"><span class="eyebrow">Paso 3 · Resultado</span><h1>Tu auditoría está lista</h1></div>
      <section class="card card-pad" id="res">
        <div class="score-wrap">
          <div class="ring" style="--c:${scoreColor(r.score)}"><div><b>0</b><small>de 100</small></div></div>
          <div style="display:grid;gap:10px"><span class="eyebrow">Puntaje de tu CV</span>
            <h2 style="font-size:1.3rem">Mejor afinidad: ${esc(vac(a.mejorId).titulo)}</h2>
            <div class="verdict" style="background:${vbg};color:${vfg}">${vt}</div></div>
        </div>
        <div class="x-res-grid">
          <div>${barras(r)}</div>
          <div><h4 style="margin-bottom:10px">💡 Qué mejorar en tu CV</h4>${sugerencias(r)}</div>
        </div>
      </section>
      <div class="x-head" style="margin-top:28px"><span class="eyebrow">Solo para ti</span><h2 class="x-h2">Tus 3 vacantes curadas en Quito</h2>
        <p class="muted">Ninguna exige experiencia previa. Para postular, aplica las sugerencias a tu CV y súbelo actualizado. <b>Postula antes del ${limite()}.</b></p></div>
      <div class="x-vacs">${VAC.map(vacCard).join("")}</div>`;
    animateRing($("#res"), r.score);
    $$("[data-vac]").forEach((b) => b.addEventListener("click", () => abrirVacante(b.dataset.vac)));
  }

  function abrirVacante(id) {
    track("vacante_vista", { vacante: id, puntaje: st.audit.porVacante[id].score });
    go("vacante", { vacante: id });
  }

  function viewVacante() {
    const v = vac(st.vacante), r = st.audit.porVacante[v.id], ya = st.postulaciones.includes(v.id);
    view.innerHTML = `
      <button class="btn btn-ghost btn-sm" id="back">← Volver a las vacantes</button>
      <section class="card x-detail">
        <div class="x-detail-cover" style="background:linear-gradient(135deg,${v.color[0]},${v.color[1]})"></div>
        <div class="card-pad">
          <div class="x-vac-head"><span class="x-logo x-logo-lg" style="background:linear-gradient(135deg,${v.color[0]},${v.color[1]})">${esc(v.iniciales)}</span>
            <div><h1 style="font-size:1.5rem">${esc(v.titulo)}</h1><p class="muted">${esc(v.empresa)} · ${esc(v.sector)}</p></div></div>
          <div class="chips" style="margin:14px 0"><span class="chip mint">🌱 No requiere experiencia</span><span class="chip">📍 ${esc(v.ubicacion)}</span><span class="chip">${esc(v.modalidad)}</span><span class="chip">⏱️ ${esc(v.duracion)}</span><span class="chip">💵 ${esc(v.estipendio)}</span></div>
          <p class="muted small">🕐 ${esc(v.horario)} · <b>Postula antes del ${limite()}</b></p>
          <p style="margin-top:14px">${esc(v.descripcion)}</p>
          <div class="x-grid2" style="margin-top:16px">
            <div><h4>Qué harás</h4><ul class="x-list">${v.responsabilidades.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
            <div><h4>Qué buscamos</h4><ul class="x-list">${v.requisitos.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
              <h4 style="margin-top:12px">Beneficios</h4><ul class="x-list">${v.beneficios.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
          </div>
          <div class="chips" style="margin-top:12px">${v.habilidades.map((h) => `<span class="chip blue">${esc(h)}</span>`).join("")}</div>
        </div>
      </section>
      <section class="card card-pad" style="margin-top:18px">
        <div class="x-match" style="margin:0 0 12px"><span><b>Afinidad de tu CV con esta vacante</b></span><b style="color:${scoreColor(r.score)};font-size:1.4rem">${r.score}%</b></div>
        ${r.missing.length ? `<p class="small muted" style="margin-bottom:8px">Palabras clave que faltan en tu CV (agrégalas si tienes esas habilidades):</p><div class="chips" style="margin-bottom:14px">${r.missing.map((k) => `<span class="chip red">✕ ${esc(k)}</span>`).join("")}</div>` : ""}
        <h4 style="margin-bottom:10px">💡 Cambios sugeridos para esta vacante</h4>${sugerencias(r)}
        ${ya ? `<div class="verdict" style="background:#e6fbf5;color:#0c8a69;margin-top:16px">✓ Ya enviaste tu postulación a esta vacante.</div>` : `<button class="btn btn-grad btn-block x-cta" id="postular" style="margin-top:18px">Postularme a esta vacante →</button>`}
      </section>`;
    $("#back").addEventListener("click", () => go("resultado"));
    $("#postular")?.addEventListener("click", () => { track("postulacion_iniciada", { vacante: v.id, puntaje: r.score }); go("postular", { post: { vacante: v.id, nuevo: null } }); });
  }

  /* ================= PASO 4 · CV actualizado + confirmación ================= */
  function viewPostular() {
    const v = vac(st.post.vacante), antes = st.audit.porVacante[v.id];
    const n = st.post.nuevo;
    view.innerHTML = `
      <button class="btn btn-ghost btn-sm" id="back">← Volver a la vacante</button>
      <div class="x-head"><span class="eyebrow">Paso 4 · Postulación</span><h1>${esc(v.titulo)}</h1><p class="muted">${esc(v.empresa)} · ${esc(v.ubicacion)}</p></div>
      <section class="card card-pad form-stack">
        <h2 class="x-h2">1 · Aplica los cambios y sube tu CV actualizado</h2>
        <p class="muted small">Tu puntaje actual para esta vacante es <b style="color:${scoreColor(antes.score)}">${antes.score}%</b>. Usa las sugerencias para mejorarlo:</p>
        <details class="x-details"><summary>Ver sugerencias (${antes.sugg.length})</summary>${sugerencias(antes)}</details>
        <div id="upZone" ${n ? "hidden" : ""}>${uploader("nv", ui.nuevoText)}<button class="btn btn-primary btn-block" id="reaudit" style="margin-top:12px">🔄 Revisar mi CV actualizado</button></div>
        <div id="cmpBox">${n ? comparacion(antes.score, n.score) : ""}</div>
      </section>
      <form class="card card-pad form-stack" id="fPost" style="margin-top:18px" ${n ? "" : "hidden"}>
        <h2 class="x-h2">2 · Confirma tu postulación</h2>
        <label class="x-field"><span class="x-lbl">¿Por qué te interesa esta pasantía? *</span><textarea class="textarea" name="motivo" required minlength="20" maxlength="600" style="min-height:100px" placeholder="2 o 3 líneas bastan"></textarea></label>
        <label class="x-field"><span class="x-lbl">¿Cuándo podrías empezar? *</span><select class="input" name="inicio" required><option value="">Elige…</option><option>De inmediato</option><option>En 2 semanas</option><option>En 1 mes</option><option>Al terminar el semestre</option></select></label>
        <label class="x-check"><input type="checkbox" name="ok" required /><span>Confirmo que quiero postularme a <b>${esc(v.titulo)}</b> en <b>${esc(v.empresa)}</b> y que la información de mi CV es verdadera.</span></label>
        <button class="btn btn-grad btn-block x-cta">🚀 Confirmar postulación</button>
      </form>`;
    $("#back").addEventListener("click", () => go("vacante", { post: null }));
    if (!n) {
      bindUploader("nv", (t, file, typed) => { ui.nuevoText = t; ui.nuevoFile = typed ? null : file; });
      $("#reaudit").addEventListener("click", (e) => {
        e.preventDefault();
        const texto = $("#nvText").value.trim(); ui.nuevoText = texto;
        if (texto.length < 40) return toast("Sube o pega tu CV actualizado", "⚠️");
        const box = $("#cmpBox"); $("#upZone").hidden = true;
        scanning(box, "Revisando tus cambios…", async () => {
          const r = analyzeCV(texto, jobText(v));
          const archivo = await archivoParaCompartir(ui.nuevoFile, texto, "cv-actualizado.txt").catch(() => null);
          track("cv_actualizado", { vacante: v.id, puntaje: r.score, puntaje_anterior: antes.score, archivo, detalle: { mejora: r.score - antes.score, palabras: r.words, origen: ui.nuevoFile ? "archivo" : "texto" } });
          st.post.nuevo = { score: r.score, sugg: r.sugg }; save();
          render();
          if (r.score > antes.score) toast(`¡Subiste de ${antes.score} a ${r.score}!`, "📈");
        });
      });
    } else {
      $("#otraVez")?.addEventListener("click", () => { st.post.nuevo = null; save(); render(); });
    }
    $("#fPost").addEventListener("submit", (e) => {
      e.preventDefault();
      const f = new FormData(e.target), motivo = (f.get("motivo") || "").trim();
      if (motivo.length < 20) return toast("Cuéntanos un poco más por qué te interesa (mín. 20 caracteres)", "⚠️");
      if (!f.get("inicio")) return toast("Indica cuándo podrías empezar", "⚠️");
      if (!f.get("ok")) return toast("Marca la casilla para confirmar tu postulación", "⚠️");
      const mejora = n.score - antes.score;
      track("postulacion_confirmada", { vacante: v.id, puntaje: n.score, puntaje_anterior: antes.score, detalle: { mejora, aplico_cambios: mejora > 0, motivo, inicio: f.get("inicio"), dias_desde_enlace: +((Date.now() - st.abiertoEn) / 864e5).toFixed(2) } });
      st.postulaciones = [...new Set([...st.postulaciones, v.id])];
      go("cierre");
    });
  }

  function comparacion(a, b) {
    const d = b - a;
    const msg = d > 0 ? ["#e6fbf5", "#0c8a69", `¡Excelente! Aplicaste los cambios y tu CV mejoró <b>+${d} puntos</b>. Ya puedes confirmar tu postulación.`]
      : ["#fff5e6", "#b76e00", "Tu puntaje no subió todavía. Puedes intentar aplicar más sugerencias, o confirmar tu postulación con este CV."];
    return `<div class="x-cmp"><div><small>Antes</small><b style="color:${scoreColor(a)}">${a}</b></div><span>→</span><div><small>Ahora</small><b style="color:${scoreColor(b)}">${b}</b></div></div>
      <div class="verdict" style="background:${msg[0]};color:${msg[1]}">${msg[2]}</div>
      <button type="button" class="btn btn-ghost btn-sm" id="otraVez">🔄 Subir otra versión</button>`;
  }

  /* ================= CIERRE · Postulación enviada + explicación ================= */
  function viewCierre() {
    const v = vac(st.post?.vacante) || vac(st.postulaciones[0]);
    if (!st._cierreVisto) { track("cierre_visto", { vacante: v?.id || "" }); st._cierreVisto = true; save(); }
    view.innerHTML = `
      <section class="card card-pad x-done">
        <div class="x-done-ico">🎉</div>
        <h1>¡Postulación enviada, ${esc(first(st.datos.nombre))}!</h1>
        <p class="muted">Registramos tu postulación a <b>${esc(v?.titulo || "")}</b> en <b>${esc(v?.empresa || "")}</b>.</p>
      </section>
      <section class="card card-pad x-debrief">
        <h2 class="x-h2">Gracias por participar 💙 Esto es lo que necesitas saber</h2>
        <p>Esta página es un <b>prototipo</b> creado por estudiantes para la materia de ${esc(C.MATERIA)}. Queríamos comprobar si a estudiantes como tú les sirve una auditoría inmediata del CV junto con vacantes locales sin requisito de experiencia.</p>
        <p><b>Las 3 vacantes de esta prueba fueron creadas para el experimento</b> y las empresas son ficticias, por lo que no recibirás una llamada de ellas. Te pedimos disculpas por no contártelo antes: si lo hacíamos, la prueba no habría medido lo mismo.</p>
        <p>Lo que sí es real: <b>las mejoras que hiciste a tu CV son tuyas</b> y te servirán para tus próximas postulaciones.</p>
        ${st.comparteCV ? "<p>Como aceptaste compartir tu CV, el equipo puede revisarlo y escribirte con comentarios personalizados. Tu archivo no se compartirá con nadie fuera del equipo.</p>" : ""}
        ${C.CONTACTO_EQUIPO ? `<p>Si tienes preguntas o quieres que borremos tus datos, escríbenos a <b>${esc(C.CONTACTO_EQUIPO)}</b>.</p>` : "<p>Si tienes preguntas o quieres que borremos tus datos, responde al mensaje con el que te enviamos este enlace.</p>"}
      </section>`;
  }

  /* ---------------- Render ---------------- */
  function render() {
    drawSteps();
    if (st.paso !== "bienvenida" && !st.datos) st.paso = "bienvenida";
    if (["resultado", "vacante", "postular"].includes(st.paso) && !st.audit) st.paso = "cv";
    if (st.paso === "postular" && !st.post) st.paso = "vacante";
    if (st.paso === "vacante" && !vac(st.vacante)) st.paso = "resultado";
    ({ bienvenida: viewBienvenida, cv: viewCV, resultado: viewResultado, vacante: viewVacante, postular: viewPostular, cierre: viewCierre }[st.paso] || viewBienvenida)();
    drawSteps();
  }

  if (!C.SCRIPT_URL) $("#demoBanner").hidden = false;
  if (!st._abierto) { track("enlace_abierto", { detalle: { con_codigo: !!urlPid, referencia: document.referrer || "" } }); st._abierto = true; save(); }
  else flush();
  render();
})();
