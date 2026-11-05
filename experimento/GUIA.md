# Guía del experimento · Grupo 4

**Hipótesis:** los estudiantes universitarios de Quito que buscan pasantías compartirán su CV y completarán una postulación si reciben una optimización inmediata de su perfil y acceso a 3 vacantes locales curadas sin requisito de experiencia.

| Página | Para quién | Qué hace |
|---|---|---|
| `experimento.html?p=E01` | Estudiantes | Consentimiento → auditoría del CV → 3 vacantes de Quito → CV mejorado → postulación → cierre |
| `resultados.html` | Tu equipo | Métricas, embudo, detalle por estudiante, CSV y los 15 enlaces |

La app original (`index.html`) no cambia.

---

## 1. Conectar Google Sheets (unos 5 minutos)

1. Crea una hoja nueva en Google Sheets, por ejemplo "Experimento Grupo 4".
2. Abre el menú **Extensiones › Apps Script**.
3. Borra el código que aparece y pega todo el contenido de `experimento/apps-script/Code.gs`.
4. En la línea `const CLAVE_LECTURA = "cambia-esta-clave";` escribe una clave propia. Es la que pedirá el panel de resultados.
5. Guarda con el ícono 💾.
6. Pulsa **Implementar › Nueva implementación**. En el engranaje elige **Aplicación web** y configura:
   - *Ejecutar como:* **Yo**
   - *Quién tiene acceso:* **Cualquier persona**
7. Pulsa **Implementar** y autoriza los permisos. Google mostrará "app no verificada": entra en *Configuración avanzada › Ir a (no seguro)*. Es tu propio script.
   En la pantalla **"Selecciona a qué puede acceder"**, marca **Seleccionar todo**, con las dos casillas (Google Drive y Google Sheets), y pulsa **Continuar** al final de la página. Sheets sirve para guardar los eventos y Drive para guardar los CV que los estudiantes acepten compartir. Si dejas alguna sin marcar, el script fallará.
8. Copia la **URL de la aplicación web**, que termina en `/exec`.
9. Abre `experimento/config.js` y pégala en `SCRIPT_URL: "https://script.google.com/macros/s/.../exec"`.
10. Sube el cambio a GitHub.

**Para comprobarlo:**
- En el editor de Apps Script, elige la función **`probar`** en el menú de arriba y pulsa **▶ Ejecutar**. En el *Registro de ejecución* aparecerá el enlace a tu hoja de resultados.
- Abre la URL `/exec` en el navegador. Debe decir *"El receptor del experimento está funcionando ✅"*.

> **¿Dónde está la hoja?** Si creaste el script desde una hoja (*Extensiones › Apps Script*), los datos llegan a esa misma hoja. Si lo creaste desde script.google.com, el script crea solo una hoja llamada **"Experimento Grupo 4 - Resultados"** en tu Google Drive. Puedes buscarla ahí o usar el enlace que muestra `probar`.

> Si después editas `Code.gs`, entra en **Implementar › Administrar implementaciones › ✏️ › Versión: Nueva**. Si no lo haces, se sigue ejecutando la versión anterior.

Los eventos llegan a la pestaña **Eventos**, que se crea sola. Los CV que los estudiantes acepten compartir se guardan en tu Google Drive, en la carpeta **"CVs compartidos - Experimento Grupo 4"**. Esos archivos son privados: solo los ve tu cuenta.

## 2. Publicar en GitHub Pages

En el repositorio entra a **Settings › Pages**, elige *Deploy from a branch*, la rama `main` y la carpeta `/ (root)`. Las páginas quedarán en:
- `https://eduran-v.github.io/GRUPO-4-MVP/experimento.html`
- `https://eduran-v.github.io/GRUPO-4-MVP/resultados.html`

## 3. Probar antes de enviar

- Abre `experimento.html?p=TEST1` y completa todo el flujo. Los códigos que no son E01–E15 aparecen como "Fuera de la muestra" y no cuentan.
- Para repetir la prueba en el mismo navegador, cambia el código (`?p=TEST2`). El progreso se guarda por dispositivo.
- Si después quieres borrar las filas de prueba, elimínalas de la hoja.

## 4. Enviar a los 15 estudiantes

En `resultados.html` hay una tabla con los 15 enlaces (E01–E15) y botones para copiar el enlace o un mensaje de WhatsApp listo. **Anota a quién le das cada código.**

## 5. Cómo se calculan las métricas

| Métrica | Se cuenta cuando… | Meta |
|---|---|---|
| **1 · CV enviados** | el estudiante sube o pega su CV y recibe la auditoría (evento `cv_enviado`) | ≥ 10 de 15 |
| **2 · Postulaciones** | envió su CV, **subió un CV actualizado con mejor puntaje** (aplicó los cambios) y **confirmó su postulación** a una vacante dentro de los 7 días desde que abrió el enlace | ≥ 7 |

Eventos que se registran: `enlace_abierto`, `consentimiento_aceptado`, `cv_enviado`, `vacante_vista`, `postulacion_iniciada`, `cv_actualizado`, `postulacion_confirmada`, `cierre_visto`.

Puedes cambiar las metas, el número de participantes o los días en `experimento/config.js`, y los textos de las vacantes en `experimento/vacantes.js`.

## 6. Ética y privacidad

- Al inicio el estudiante da su consentimiento para participar en una prueba académica.
- Compartir el archivo del CV es **opcional**. Si no lo acepta, su CV se analiza solo en su navegador y únicamente se guarda el puntaje.
- Al confirmar la postulación, la página le explica que **las vacantes y las empresas son ficticias** y que sus mejoras al CV son reales.
- En `CONTACTO_EQUIPO` (dentro de `config.js`) pueden poner un correo para dudas o para pedir que se borren los datos.
