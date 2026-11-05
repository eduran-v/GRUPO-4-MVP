/* ==========================================================
   Experimento Grupo 4 — Panel de resultados (lee Google Sheets)
   ========================================================== */
(() => {
  "use strict";
  const C = window.EXP_CONFIG, VAC = window.VACANTES_QUITO;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const view = $("#view");
  const KEYSTORE = "exp-g4-clave";
  const CODIGOS = Array.from({ length: C.TOTAL_PARTICIPANTES }, (_, i) => C.PREFIJO_CODIGO + String(i + 1).padStart(2, "0"));
  const vacName = (id) => VAC.find((v) => v.id === id)?.empresa || id || "—";
  const fmt = (iso) => (iso ? new Date(iso).toLocaleString("es-EC", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
  const num = (x) => (x === "" || x === null || x === undefined || isNaN(+x) ? null : +x);
  const store = { get: () => { try { return localStorage.getItem(KEYSTORE) || ""; } catch { return ""; } }, set: (v) => { try { localStorage.setItem(KEYSTORE, v); } catch {} } };
  const baseExp = () => new URL("experimento.html", location.href).href;

  function toast(msg, ico = "✅") {
    const t = document.createElement("div"); t.className = "toast"; t.innerHTML = `<span>${ico}</span><span>${msg}</span>`;
    $("#toasts").appendChild(t); setTimeout(() => { t.style.opacity = "0"; setTimeout(() => t.remove(), 300); }, 2800);
  }
  async function copy(text) { try { await navigator.clipboard.writeText(text); toast("Copiado"); } catch { prompt("Copia el texto:", text); } }

  /* ---------------- Carga de datos ---------------- */
  let eventos = null, esDemo = false;

  async function cargar(clave) {
    view.innerHTML = `<div class="card card-pad r-center">⏳ Cargando datos de Google Sheets…</div>`;
    try {
      const res = await fetch(`${C.SCRIPT_URL}?key=${encodeURIComponent(clave)}&t=${Date.now()}`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Respuesta inválida");
      store.set(clave); eventos = data.eventos; esDemo = false; render();
    } catch (err) {
      pantallaClave(`No se pudieron cargar los datos: ${esc(err.message)}. Revisa la clave y que la Web App esté publicada con acceso “Cualquier persona”.`);
    }
  }

  function pantallaClave(error = "") {
    $("#topActions").innerHTML = "";
    view.innerHTML = `
      <section class="card card-pad form-stack x-narrow">
        <span class="eyebrow">Acceso del equipo</span>
        <h1 style="font-size:1.4rem">Resultados del experimento</h1>
        ${C.SCRIPT_URL ? `<p class="muted">Escribe la clave de lectura que pusiste en <code>CLAVE_LECTURA</code> del Apps Script.</p>
        <form id="fKey" class="row wrap"><input class="input grow" id="key" type="password" placeholder="Clave de lectura" value="${esc(store.get())}" autocomplete="current-password" /><button class="btn btn-primary">Ver resultados</button></form>`
        : `<div class="verdict" style="background:#fff5e6;color:#8a5300">Aún no configuras <code>SCRIPT_URL</code> en <code>experimento/config.js</code>. Sigue la guía en <code>experimento/GUIA.md</code>.</div>`}
        ${error ? `<div class="verdict" style="background:#ffeef0;color:#d63447">${error}</div>` : ""}
        <div class="divider">o</div>
        <button class="btn btn-ghost" id="demo">👀 Ver el panel con datos de ejemplo</button>
      </section>
      ${seccionEnlaces()}`;
    $("#fKey")?.addEventListener("submit", (e) => { e.preventDefault(); const k = $("#key").value.trim(); if (k) cargar(k); });
    $("#demo").addEventListener("click", () => { eventos = datosDemo(); esDemo = true; render(); });
    bindEnlaces();
  }

  /* ---------------- Cálculo de métricas ---------------- */
  function calcular(evs) {
    const vistos = new Set();
    evs = evs.filter((e) => (e.id_evento ? !vistos.has(e.id_evento) && vistos.add(e.id_evento) : true));
    const porP = {};
    evs.forEach((e) => {
      const id = String(e.participante || "").toUpperCase(); if (!id) return;
      (porP[id] ||= { id, evs: [] }).evs.push(e);
    });
    Object.values(porP).forEach((p) => {
      p.evs.sort((a, b) => new Date(a.fecha_servidor || a.fecha_cliente) - new Date(b.fecha_servidor || b.fecha_cliente));
      const de = (t) => p.evs.filter((e) => e.evento === t);
      const t = (e) => new Date(e.fecha_servidor || e.fecha_cliente).getTime();
      const conDatos = [...p.evs].reverse().find((e) => e.nombre);
      Object.assign(p, {
        nombre: conDatos?.nombre || "", carrera: conDatos?.carrera || "", universidad: conDatos?.universidad || "", contacto: conDatos?.contacto || "",
        abrio: de("enlace_abierto")[0] || p.evs[0], acepto: de("consentimiento_aceptado")[0], cv: de("cv_enviado")[0],
        vio: de("vacante_vista"), inicio: de("postulacion_iniciada"), act: de("cv_actualizado"), post: de("postulacion_confirmada"),
        enlacesCv: p.evs.filter((e) => e.enlace_cv).map((e) => ({ url: e.enlace_cv, evento: e.evento })),
      });
      const t0 = t(p.abrio);
      p.postOk = p.post.filter((e) => num(e.puntaje) > num(e.puntaje_anterior) && t(e) - t0 <= C.DIAS_LIMITE * 864e5);
      p.mejora = p.act.length ? Math.max(...p.act.map((e) => num(e.puntaje) - num(e.puntaje_anterior))) : null;
      p.cuenta = !!p.cv && p.postOk.length > 0;
      p.motivo = !p.post.length ? (p.cv ? "No confirmó postulación" : "No envió CV") : !p.cv ? "Sin CV inicial" : !p.postOk.length ? (p.post.some((e) => num(e.puntaje) > num(e.puntaje_anterior)) ? `Postuló después de ${C.DIAS_LIMITE} días` : "Postuló sin mejorar su CV") : "";
    });
    const muestra = CODIGOS.map((c) => porP[c] || { id: c, evs: [], vio: [], inicio: [], act: [], post: [], postOk: [], enlacesCv: [], mejora: null, motivo: "No abrió el enlace" });
    const otros = Object.values(porP).filter((p) => !CODIGOS.includes(p.id));
    const n = (f) => muestra.filter(f).length;
    const embudo = [
      ["Recibieron el enlace", muestra.length],
      ["Abrieron el enlace", n((p) => p.abrio)],
      ["Aceptaron participar", n((p) => p.acepto)],
      ["Enviaron su CV (Métrica 1)", n((p) => p.cv)],
      ["Vieron una vacante", n((p) => p.vio.length)],
      ["Iniciaron una postulación", n((p) => p.inicio.length)],
      ["Subieron un CV mejorado", n((p) => p.mejora > 0)],
      ["Confirmaron postulación", n((p) => p.post.length)],
      ["Cambios + postulación en la semana (Métrica 2)", n((p) => p.cuenta)],
    ];
    const m1 = n((p) => p.cv), m2 = n((p) => p.cuenta);
    const mejoras = muestra.filter((p) => p.mejora != null).map((p) => p.mejora);
    const porVac = VAC.map((v) => [v, muestra.filter((p) => p.post.some((e) => e.vacante === v.id)).length]);
    return { muestra, otros, embudo, m1, m2, mejoraProm: mejoras.length ? mejoras.reduce((a, b) => a + b, 0) / mejoras.length : null, porVac, totalEventos: evs.length };
  }

  /* ---------------- Render ---------------- */
  function kpi(titulo, valor, meta, total, desc) {
    const ok = valor >= meta;
    return `<article class="card card-pad r-kpi">
      <span class="eyebrow">${titulo}</span>
      <div class="r-big"><b>${valor}</b><span>/ ${total}</span></div>
      <p class="muted small">${desc}</p>
      <div class="r-goal"><div class="progress"><span style="width:${Math.min(100, (valor / total) * 100)}%"></span></div><i style="left:${(meta / total) * 100}%" title="Meta: ${meta}"></i></div>
      <div class="row" style="justify-content:space-between"><span class="small muted">Meta: ≥ ${meta} (${Math.round((meta / total) * 100)}%)</span>
        <span class="r-status ${ok ? "ok" : "no"}">${ok ? "✓ Cumplida" : `✕ Faltan ${meta - valor}`}</span></div>
    </article>`;
  }

  function barras(filas, total, id) {
    return `<div class="r-bars" id="${id}">${filas.map(([l, v]) => `
      <div class="r-bar" data-tip="<b>${esc(l)}</b><br>${v} de ${total} (${total ? Math.round((v / total) * 100) : 0}%)" tabindex="0">
        <span class="r-bar-l">${esc(l)}</span>
        <span class="r-bar-t"><span style="width:${total ? (v / total) * 100 : 0}%"></span></span>
        <span class="r-bar-v">${v}</span>
      </div>`).join("")}</div>`;
  }

  function filaTabla(p, enMuestra = true) {
    const ultima = p.post[p.post.length - 1];
    return `<tr>
      <td><b>${esc(p.id)}</b></td>
      <td>${esc(p.nombre || "—")}<small>${esc([p.carrera, p.universidad].filter(Boolean).join(" · "))}</small></td>
      <td>${p.abrio ? fmt(p.abrio.fecha_servidor || p.abrio.fecha_cliente) : "—"}</td>
      <td>${p.cv ? `✓ <b>${esc(p.cv.puntaje)}</b>` : "—"}</td>
      <td>${p.mejora == null ? "—" : p.mejora > 0 ? `<span class="r-pos">+${p.mejora}</span>` : p.mejora}</td>
      <td>${ultima ? `${esc(vacName(ultima.vacante))}<small>${fmt(ultima.fecha_servidor || ultima.fecha_cliente)}</small>` : "—"}</td>
      <td>${enMuestra ? (p.cuenta ? '<span class="r-status ok">✓ Sí</span>' : `<span class="r-status no">✕ No</span><small>${esc(p.motivo)}</small>`) : '<small>No cuenta</small>'}</td>
      <td>${p.enlacesCv.length ? p.enlacesCv.map((c, i) => `<a href="${esc(c.url)}" target="_blank" rel="noopener">CV ${i + 1}</a>`).join(" · ") : '<small class="muted">No compartió</small>'}</td>
    </tr>`;
  }
  const tabla = (filas, enMuestra) => `<div class="r-table-wrap"><table class="r-table"><thead><tr><th>Código</th><th>Estudiante</th><th>Abrió</th><th>CV · puntaje</th><th>Mejora</th><th>Postuló a</th><th>Cuenta p/ Métrica 2</th><th>CV compartido</th></tr></thead><tbody>${filas.map((p) => filaTabla(p, enMuestra)).join("")}</tbody></table></div>`;

  function render() {
    const r = calcular(eventos || []);
    const valida = r.m1 >= C.META_CV && r.m2 >= C.META_POSTULACIONES;
    $("#topActions").innerHTML = `${esDemo ? '<span class="chip amber">Datos de ejemplo</span>' : `<button class="btn btn-ghost btn-sm" id="reload">🔄 Actualizar</button>`}<button class="btn btn-ghost btn-sm" id="csv">⬇️ CSV</button><button class="btn btn-ghost btn-sm" id="salir">Salir</button>`;
    view.innerHTML = `
      <div class="x-head"><span class="eyebrow">Test Card · Criterio de éxito</span>
        <h1>${valida ? "✅ Hipótesis validada" : "⏳ Hipótesis aún no validada"}</h1>
        <p class="muted">Estudiantes universitarios de Quito compartirán su CV y completarán una postulación si reciben una optimización inmediata y acceso a 3 vacantes curadas sin experiencia. Muestra: ${C.TOTAL_PARTICIPANTES} estudiantes (${CODIGOS[0]}–${CODIGOS[CODIGOS.length - 1]}).</p></div>
      <div class="r-kpis">
        ${kpi("Métrica 1 · CV enviados", r.m1, C.META_CV, C.TOTAL_PARTICIPANTES, "Estudiantes que enviaron su CV para auditoría.")}
        ${kpi("Métrica 2 · Postulaciones", r.m2, C.META_POSTULACIONES, C.TOTAL_PARTICIPANTES, `Enviaron CV, mejoraron su puntaje y confirmaron una postulación dentro de ${C.DIAS_LIMITE} días.`)}
        <article class="card card-pad r-kpi"><span class="eyebrow">Mejora promedio del CV</span>
          <div class="r-big"><b>${r.mejoraProm === null ? "—" : (r.mejoraProm > 0 ? "+" : "") + r.mejoraProm.toFixed(1)}</b><span>puntos</span></div>
          <p class="muted small">Entre el CV inicial y el actualizado, entre quienes lo reenviaron.</p>
          <p class="small">Conversión CV → postulación: <b>${r.m1 ? Math.round((r.m2 / r.m1) * 100) : 0}%</b> (${r.m2} de ${r.m1})</p></article>
      </div>
      <section class="card card-pad"><h2 class="x-h2">Embudo del experimento</h2><p class="muted small" style="margin:4px 0 14px">Cantidad de estudiantes de la muestra que llegaron a cada paso (de ${C.TOTAL_PARTICIPANTES}).</p>${barras(r.embudo, C.TOTAL_PARTICIPANTES, "funnel")}</section>
      <section class="card card-pad"><h2 class="x-h2">Postulaciones por vacante</h2><p class="muted small" style="margin:4px 0 14px">Estudiantes que confirmaron postulación a cada vacante (una persona puede postular a más de una).</p>${barras(r.porVac.map(([v, n]) => [`${v.empresa} — ${v.titulo}`, n]), C.TOTAL_PARTICIPANTES, "vacs")}</section>
      <section class="card card-pad"><h2 class="x-h2">Detalle por estudiante</h2><p class="muted small" style="margin:4px 0 14px">${r.totalEventos} eventos registrados.</p>${tabla(r.muestra, true)}</section>
      ${r.otros.length ? `<section class="card card-pad"><h2 class="x-h2">Fuera de la muestra (no cuentan)</h2><p class="muted small" style="margin:4px 0 14px">Visitas sin código de participante o con códigos de prueba (por ejemplo, cuando el equipo prueba la página).</p>${tabla(r.otros, false)}</section>` : ""}
      ${seccionEnlaces()}`;
    $("#reload")?.addEventListener("click", () => cargar(store.get()));
    $("#salir").addEventListener("click", () => { eventos = null; if (!esDemo) store.set(""); pantallaClave(); });
    $("#csv").addEventListener("click", () => exportarCSV(r));
    bindTips(); bindEnlaces();
  }

  /* ---------------- Tooltip ---------------- */
  function bindTips() {
    const tip = $("#tip");
    const show = (el, x, y) => { tip.innerHTML = el.dataset.tip; tip.hidden = false; const w = tip.offsetWidth; tip.style.left = Math.min(window.innerWidth - w - 8, Math.max(8, x - w / 2)) + "px"; tip.style.top = y - tip.offsetHeight - 12 + "px"; };
    $$("[data-tip]").forEach((el) => {
      el.addEventListener("mousemove", (e) => show(el, e.clientX, e.clientY));
      el.addEventListener("focus", () => { const b = el.getBoundingClientRect(); show(el, b.left + b.width / 2, b.top); });
      ["mouseleave", "blur"].forEach((ev) => el.addEventListener(ev, () => (tip.hidden = true)));
    });
  }

  /* ---------------- Enlaces y mensaje para los participantes ---------------- */
  const mensaje = (link) => `¡Hola! 👋 Somos estudiantes del Grupo 4 y estamos probando una herramienta que revisa tu CV gratis en segundos y te da acceso a 3 pasantías en Quito donde no piden experiencia. Toma unos 5 minutos: ${link}`;
  function seccionEnlaces() {
    return `<section class="card card-pad"><h2 class="x-h2">Enlaces para los ${C.TOTAL_PARTICIPANTES} participantes</h2>
      <p class="muted small" style="margin:4px 0 14px">Envía un enlace distinto a cada estudiante y anota en tu lista a quién le diste cada código. Para probar la página tú mismo usa un código como <code>?p=TEST1</code> (no cuenta en las métricas).</p>
      <div class="r-table-wrap"><table class="r-table r-links"><thead><tr><th>Código</th><th>Enlace</th><th></th></tr></thead><tbody>
      ${CODIGOS.map((c) => { const l = `${baseExp()}?p=${c}`; return `<tr><td><b>${c}</b></td><td><code>${esc(l)}</code></td><td class="r-nowrap"><button class="btn btn-ghost btn-sm" data-copy="${esc(l)}">Copiar enlace</button> <button class="btn btn-ghost btn-sm" data-copy="${esc(mensaje(l))}">Copiar mensaje</button></td></tr>`; }).join("")}
      </tbody></table></div>
      <details class="x-details" style="margin-top:12px"><summary>Ver mensaje sugerido de WhatsApp</summary><p class="small">${esc(mensaje("[enlace]"))}</p></details></section>`;
  }
  function bindEnlaces() { $$("[data-copy]").forEach((b) => b.addEventListener("click", () => copy(b.dataset.copy))); }

  /* ---------------- CSV ---------------- */
  function exportarCSV(r) {
    const cols = ["codigo", "nombre", "carrera", "universidad", "contacto", "abrio_enlace", "acepto", "envio_cv", "puntaje_inicial", "mejor_mejora", "confirmo_postulacion", "vacantes", "cuenta_metrica_2", "motivo", "cv_compartido"];
    const rows = [...r.muestra, ...r.otros].map((p) => [p.id, p.nombre, p.carrera, p.universidad, p.contacto, p.abrio ? "sí" : "no", p.acepto ? "sí" : "no", p.cv ? "sí" : "no", p.cv?.puntaje ?? "", p.mejora ?? "", p.post.length ? "sí" : "no", [...new Set(p.post.map((e) => vacName(e.vacante)))].join(" / "), CODIGOS.includes(p.id) ? (p.cuenta ? "sí" : "no") : "fuera de muestra", p.motivo || "", p.enlacesCv.map((c) => c.url).join(" ")]);
    const csv = [cols, ...rows].map((f) => f.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `resultados-experimento-grupo4-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
  }

  /* ---------------- Datos de ejemplo ---------------- */
  function datosDemo() {
    const nombres = ["Ana Paredes", "Luis Andrade", "Sofía Vega", "Mateo Cevallos", "Valeria Yépez", "Diego Salazar", "Camila Benítez", "Joel Tapia", "Daniela Proaño", "Martín Guerrero", "Paula Ortiz", "Nicolás Jaramillo", "Isabel Cruz", "Andrés Viteri", "Gabriela Mena"];
    const carreras = ["Marketing", "Economía", "Ing. de Software", "Administración", "Contabilidad"], unis = ["PUCE", "USFQ", "EPN", "UDLA", "Universidad Central del Ecuador"];
    const out = [], t0 = Date.now() - 6 * 864e5;
    let seq = 0;
    const ev = (p, i, evento, h, extra = {}) => out.push({ id_evento: "d" + seq++, fecha_servidor: new Date(t0 + h * 36e5).toISOString(), participante: p, evento, nombre: nombres[i], carrera: carreras[i % 5], universidad: unis[i % 5], contacto: "09xxxxxxxx", detalle: {}, enlace_cv: "", ...extra });
    CODIGOS.forEach((c, i) => {
      if (i >= 13) return; // 2 no abren
      const h = i * 3; ev(c, i, "enlace_abierto", h);
      if (i >= 12) return; ev(c, i, "consentimiento_aceptado", h + 0.1);
      if (i >= 11) return; const s = 38 + ((i * 7) % 30), v = VAC[i % 3].id;
      ev(c, i, "cv_enviado", h + 0.2, { puntaje: s, vacante: v, enlace_cv: i % 3 === 0 ? "#" : "" });
      if (i >= 10) return; ev(c, i, "vacante_vista", h + 0.3, { vacante: v });
      if (i >= 9) return; ev(c, i, "postulacion_iniciada", h + 0.35, { vacante: v });
      const s2 = i === 7 ? s : s + 8 + (i % 4) * 5; ev(c, i, "cv_actualizado", h + 2, { vacante: v, puntaje: s2, puntaje_anterior: s });
      if (i >= 8) return; ev(c, i, "postulacion_confirmada", h + 2.2, { vacante: v, puntaje: s2, puntaje_anterior: s });
    });
    ev("TEST1", 0, "enlace_abierto", 1);
    return out;
  }

  /* ---------------- Inicio ---------------- */
  if (C.SCRIPT_URL && store.get()) cargar(store.get()); else pantallaClave();
})();
