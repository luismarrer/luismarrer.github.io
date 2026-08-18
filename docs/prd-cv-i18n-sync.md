# PRD — Sincronización automática de traducciones del CV

Estado: **v1.2 — fases 0–3 implementadas y prerrequisitos configurados; prueba E2E pendiente** · Última actualización: 2026-08-18

> Implementación activa en `main`: `scripts/i18n-sync.mjs`,
> `scripts/i18n-validate.mjs`, `scripts/translation-client.mjs` y los workflows
> `i18n-sync.yml`, `i18n-preview-links.yml` e `i18n-validate.yml`.
> `OPENAI_API_KEY`, `I18N_BOT_TOKEN`, auto-merge y branch protection con checks
> requeridos ya están configurados. Falta ejecutar y documentar la prueba de
> fuego end-to-end: edición unilateral → PR del bot → preview EN/ES → validación
> delegada/merge → producción. Esa prueba también debe confirmar que el merge
> del PR de sincronización no abre otro PR en dirección inversa.

## 1. Problema

El sitio se genera desde dos ficheros JSON Resume: `cv-en.json` y `cv-es.json`.
Antes de este pipeline, cuando se añadía o editaba contenido en un idioma,
había que **traducirlo y pegarlo a mano** en el otro fichero. Era tedioso,
propenso a olvidos y permitía que las dos versiones se desincronizaran. La
automatización ya está implementada; su aceptación operativa completa sigue
pendiente de la prueba E2E.

**No es un problema de "uno vs. dos ficheros".** Es un problema de
*automatizar la traducción del campo que cambió hacia el otro idioma.*

## 2. Objetivo

Editar el contenido **una sola vez, en el idioma que sea**, hacer push, y que
el sistema detecte el desajuste, genere la traducción, la presente para
revisión (con preview visual) y la publique — con la opción de delegar la
revisión por completo cuando el autor no tiene tiempo. El objetivo operativo es
que producción no publique los idiomas descuadrados. En la implementación
actual, la detección de traducciones obsoletas depende de disponer de un
baseline Git resoluble; sin él, el check solo garantiza estructura e invariantes.

### Métricas de éxito

- Un push con cambios en un solo idioma termina, sin editar JSON a mano, en
  producción con ambos idiomas coherentes.
- La revisión puede hacerse **mirando la web** (preview), no el JSON.
- Desde el móvil, un solo tap basta para delegar validación + merge.
- Ninguna traducción automática llega a producción sin pasar por un PR.
- Con un baseline resoluble, una traducción obsoleta no llega a producción; la
  prueba E2E debe demostrar también la terminación del ciclo tras el merge.

## 3. Decisiones

| Tema | Decisión |
|------|----------|
| Nº de ficheros | **Dos**: `cv-en.json` y `cv-es.json`. Cómodos de editar; `loadCv.ts` no cambia. |
| Idiomas | **en↔es fijo.** No se prevén más idiomas. |
| Dirección | **Bidireccional por campo.** Normalmente se escribe primero en inglés, a veces en español. El origen de la verdad es el fichero que se editó. |
| Detección de cambios | **`git diff` del push**, no un cache de hashes. Git ya sabe qué fichero y qué campos cambiaron. |
| Momento | **En CI**, disparado por el push. No local, no en runtime. |
| Puerta de calidad | **PR de por medio.** La traducción automática nunca va directa a `main`: el bot abre un PR y alguien (humano o validador delegado) lo aprueba. |
| Deploy con desajuste | **Bloqueado cuando el check lo detecta.** Estructura e invariantes se validan siempre; detectar texto obsoleto en un solo idioma requiere un baseline resoluble. |
| Preview | **Vercel deploy previews** por PR, con links a `/en/` y `/es/` comentados en el PR. |
| Revisión delegada | Trigger explícito con **ambas formas**: comentario `/delegate` **o** etiqueta `auto-merge`. Dispara el validador, que revisa, corrige si hace falta y mergea — o se abstiene. |
| Candado manual | Innecesario: las ediciones manuales viven en el PR o en pushes normales. Con estructura estable, el bot limita la traducción a los campos obsoletos; una reconstrucción estructural se revisa en el PR. |
| Motor de traducción | **OpenAI**, como pieza *pluggable* (cambiar de proveedor no debe tocar la lógica del pipeline). |
| Hosting | **Producción está en Vercel** (el bloqueo de deploy sale del Ignored Build Step). |
| URL de producción | **`cv.luismarrero.me`** — proyecto Vercel propio + subdominio del dominio ya poseído. |
| URL `luismarrer.github.io` | **Redirect → `cv.luismarrero.me`**, no una propiedad nueva. |

## 4. Flujo implementado (aceptación E2E pendiente)

```
push a main (cambió cv-es.json)
        │
        ▼
[i18n-check]  ¿EN y ES coherentes?
        │
   sí ──┼──► build + deploy a producción ✅
        │
   no   ├──► deploy BLOQUEADO (producción se queda
        │    en el último deploy bueno)
        ▼
[i18n-sync]
  traduce los campos cambiados (es → en)
  abre PR "i18n: sync en ← es"
  Vercel publica preview + comentario con /en/ y /es/
        │
        ▼
   ┌────┴─────────────────────────┐
   │ Camino 1: reviso yo          │ Camino 2: no tengo tiempo
   │ miro el preview en el móvil/ │ `/delegate` o etiqueta
   │ desktop, edito si quiero,    │ `auto-merge` (1 tap)
   │ merge                        │        │
   │                              │        ▼
   │                              │ [i18n-validate]
   │                              │ validador (LLM) revisa
   │                              │ equivalencia + reglas codificadas
   │                              │  ├─ ok → merge automático
   │                              │  ├─ arreglable → commit fix,
   │                              │  │   comenta veredicto, merge
   │                              │  └─ dudoso → NO mergea,
   │                              │      explica y espera humano
   └──────────────┬───────────────┘
                  ▼
   merge a main → el workflow reevalúa el push → deploy ✅
                  (solo si no abre un PR inverso)
```

La última línea es el comportamiento esperado, todavía no evidencia de
aceptación. §6.6 documenta el riesgo de que ese merge abra un PR inverso y el
criterio necesario para cerrar R2.

## 5. Qué se traduce y qué no

En JSON Resume conviven datos que **no** se traducen con texto que **sí**. El
bot trabaja con una lista explícita de rutas traducibles, definida una vez en
`scripts/i18n-shared.mjs` (`TRANSLATABLE`) y compartida por `i18n-check`,
`i18n-sync` e `i18n-validate`.

**Nunca se traduce:** `basics.name`, `email`, `phone`, `url`, `image`,
`location.*`, fechas, `profiles[].network/username/url`, `work[].workMode`,
`work[].technologies[]`, `skills[].name`, `projects[].name`,
`projects[].urls.*` y highlights que sean tecnologías (`HTML`, `CSS`, `JS`,
`Django`).

**Sí se traduce:** `basics.label`, `basics.summary`, `work[].position`,
`work[].summary`, `education[].area`, `skills[].level`, `skills[].keywords`
(algunas), `projects[].description`, highlights no técnicos
(`AI`→`IA`, `Full Stack Web Application`→`Full Stack aplicación web`).

**Con matiz:** `highlights` y `keywords` mezclan términos traducibles y no.
El traductor decide por ítem con la instrucción "mantén nombres de
tecnologías/productos en su idioma original". El validador lo verifica.

**Reglas de contenido (del README) que traductor y validador deben acatar:**
títulos de proyecto ≤ 2 palabras · descripciones de proyecto ≤ 90 caracteres,
una frase · ≤ 3 highlights por proyecto · mismo contenido en ambos idiomas.
Estas son las reglas que `CONTENT_RULES` codifica hoy; los demás límites
editoriales del README no se deben presentar como validación automática.

> Nota: `basics.url` apunta a `luismarrero.me` a propósito — es la web
> personal del autor, distinta de este portfolio. No es un bug.

## 6. Componentes

Reparto de responsabilidades:

- **Vercel** = construir y servir (producción + previews), con `i18n-check`
  como portero del deploy.
- **GitHub Actions** = los bots (`i18n-sync`, `i18n-validate`), porque operan
  sobre git/PRs, no sobre hosting.

### 6.1 `i18n-check` (portero del deploy)

Script en el repo (Node, sin LLM ni API) que compara estructura e invariantes.
Cuando dispone de un baseline Git, también detecta campos traducibles cambiados
en un solo idioma y determina la dirección según el diff.
Se ejecuta en dos sitios, mismo código:

- **Vercel Ignored Build Step**: si detecta un desajuste → no se construye →
  producción se queda en el último deploy bueno. Deploy bloqueado sin ❌ rojos.
- **Workflow `i18n-sync.yml`** en push a `main`: ejecuta el check contra el
  commit anterior y, si hay desajuste, continúa con la traducción.

El baseline de comparación en Vercel es `VERCEL_GIT_PREVIOUS_SHA` — el último
deploy **exitoso**, no el commit anterior. Así, un push posterior no
relacionado (p. ej. solo README) no puede colar un descuadre que un push
anterior dejó bloqueado. Sin baseline resoluble, el check degrada a
estructura + invariantes (fail-open documentado; la estructura sigue
bloqueando). De regalo: si el diff contra el baseline solo toca ficheros que
no afectan al sitio (docs, redirect, workflows), el build se salta.

### 6.2 `i18n-sync` (traductor)

- Recibe la lista de campos cambiados y la dirección desde el diff.
- Traduce con la **API de OpenAI**, pasándole como instrucciones las reglas de
  traducción y los límites editoriales codificados en `CONTENT_RULES`. El cliente
  se aísla en un módulo propio: cambiar de proveedor = cambiar un fichero.
- Escribe el fichero destino, abre rama `i18n/sync-<sha>` y PR.
- En un desajuste de texto con estructura estable, solo toca los campos
  obsoletos que el diff señaló. Ante un cambio estructural o de invariantes en
  un solo idioma, reconstruye el fichero destino desde la fuente y reutiliza
  traducciones existentes por path o valor; esa rama puede reescribir el
  destino completo.

### 6.3 Previews (Vercel)

Cada PR recibe automáticamente su deploy preview. Un paso del bot comenta en
el PR los links directos a `<preview>/en/` y `<preview>/es/` para revisar en
cualquier dispositivo.

### 6.4 `i18n-validate` (revisor delegado)

- Disparado por comentario `/delegate` **o** etiqueta `auto-merge` (ambos),
  **solo si el actor es el dueño del repo** (nadie más puede delegar merges).
- **Rol separado del traductor**: tras el gate estructural, revisa todos los
  pares traducibles actuales del head del PR, incluidas ediciones manuales,
  contra equivalencia semántica EN↔ES + reglas de contenido. Un traductor que
  se auto-aprueba es validación de teatro; la separación es de *roles* (prompt y
  pase independientes), no necesariamente de proveedor.
- Salidas: ✅ merge · 🔧 commit de corrección + veredicto como comentario +
  merge · ⚠️ abstención con explicación (queda esperando al humano).
- Todo veredicto se publica como comentario en el PR → auditoría.
- Trigger **explícito** (1 tap), no timeout: la inacción del autor no debe
  convertirse en publicación. (Timeout opcional como fase futura.)

### 6.5 Detalles técnicos y estado operativo

- Los commits/PRs creados con el `GITHUB_TOKEN` estándar **no disparan otros
  workflows** (previews, checks). Por eso el bot usa `I18N_BOT_TOKEN`.
- Los workflows disparados por comentarios (`issue_comment`) deben verificar
  el actor y correr sobre la rama base, no sobre código del PR sin revisar.

Configuración confirmada el 2026-08-18:

- [x] `OPENAI_API_KEY` configurada.
- [x] `I18N_BOT_TOKEN` configurado para crear ramas/PRs y disparar checks y
      previews.
- [x] Auto-merge habilitado.
- [x] Branch protection con `EN/ES · Letter/A4` como check requerido.
- [ ] Prueba de fuego E2E completada y documentada.

### 6.6 Riesgo abierto que debe resolver la prueba E2E

El workflow se activa en todo push a `main` que toque un CV, incluido el merge
por squash de un PR `i18n/sync-*`. Ese merge puede parecer una edición unilateral
del antiguo destino al compararse con su padre inmediato. La aceptación debe
comprobar que no se genera un PR inverso; si se genera, R2 requiere una guardia
explícita y una nueva ejecución E2E antes de cerrarse.

## 7. Hosting y URLs

**Decisión: portfolio en Vercel y URL histórica como redirect en GitHub
Pages.** El bloqueo nativo del deploy y los previews viven en Vercel;
`luismarrer.github.io` se conserva sin duplicar el hosting del portfolio.

**A favor:**

- **El bloqueo del deploy reutiliza el mismo gate**: el Ignored Build Step
  conserva el último deploy bueno cuando detecta un desajuste. La protección
  contra texto obsoleto en un solo idioma depende del baseline descrito en §6.1.
- **Preview y producción idénticos**: mismo pipeline de build. Lo que se
  aprueba en el preview es lo que se despliega.
- **Responsabilidades separadas**: Vercel construye y sirve el portfolio Astro;
  `.github/workflows/deploy.yml` se conserva únicamente para publicar
  `redirect/` en GitHub Pages. Ese workflow no construye ni despliega el sitio
  principal.
- Rollback de un clic, historial de deploys, CDN más rápido.

**Costes (una vez):** alta en Vercel + CNAME en el DNS. Plan Hobby gratis
para uso no comercial — un portfolio encaja. Lock-in casi nulo: sitio
estático; volver a Pages es restaurar un workflow de 30 líneas.

### 7.1 URL de producción: `cv.luismarrero.me`

Proyecto Vercel **separado** de la web personal + subdominio del dominio ya
poseído. Configuración: CNAME `cv` → `cname.vercel-dns.com` en el DNS de
`luismarrero.me`; dominio custom gratis en el plan Hobby.
Por qué no quedarse en `luismarrer.vercel.app`: la URL propia sobrevive a un
cambio de hosting (no repetir la dependencia que hoy existe con `github.io`)
y mantiene la identidad bajo la marca del autor. La URL `.vercel.app` queda
como fallback automático.

### 7.2 `luismarrer.github.io`: redirect

GitHub la regala gratis y a perpetuidad para el repo con ese nombre. No se
convierte en una propiedad nueva: se sirve desde Pages un `index.html`
mínimo que **redirige a `cv.luismarrero.me`**, preservando el valor de la
URL más antigua (CVs viejos, perfil de GitHub, marcadores). Descartado:
hospedar ahí la CV-documento (ya existe el repo `cv_and_cover_letters`).

### Mapa final de propiedades web

```
luismarrero.me        → web personal (intocada)
cv.luismarrero.me     → portfolio (Vercel, este repo)
luismarrer.github.io  → redirect → cv.luismarrero.me
cv_and_cover_letters  → CVs-documento (repo aparte)
```

## 8. Fases de implementación

Cada fase termina con algo **completo y útil por sí solo**: se puede parar
después de cualquiera sin dejar nada a medias.

### Fase 0 — Migración de hosting — completada

1. Crear el proyecto en Vercel conectado a este repo (Astro + pnpm se
   autodetectan).
2. Añadir el dominio `cv.luismarrero.me` al proyecto; CNAME en el DNS de
   `luismarrero.me`.
3. Actualizar `site: 'https://cv.luismarrero.me'` en `astro.config.mjs`.
4. Verificar producción: `/` redirige a `/en/`, `/es/` funciona, assets OK.
5. Mantener `.github/workflows/deploy.yml` limitado a subir `redirect/` a
   GitHub Pages, de modo que `luismarrer.github.io` redirija a
   `cv.luismarrero.me` sin duplicar el deploy de Astro.

**Entregable:** producción en Vercel bajo `cv.luismarrero.me`; la URL vieja
redirige. El flujo de trabajo diario no cambia todavía.

### Fase 1 — `i18n-check` (portero) — completada

1. Script `scripts/i18n-check.mjs`: lista de rutas traducibles (§5) +
   comparación de `cv-en.json`/`cv-es.json` + lectura del diff para
   determinar la dirección. Salida: coherente/incoherente, campos afectados,
   idioma origen.
2. Conectarlo como **Ignored Build Step** del proyecto Vercel.
3. Probar: push con desajuste deliberado → Vercel no publica; push
   arreglado → publica.

**Entregable:** con un baseline resoluble, Vercel no publica un desajuste
detectado. Sin baseline, el modo fail-open conserva los gates de estructura e
invariantes, pero no puede detectar texto obsoleto en un solo idioma.

### Fase 2 — `i18n-sync` (traductor + PR + preview) — implementada

1. Workflow `i18n-sync.yml` en push a `main`: corre `i18n-check`; si hay
   desajuste, traduce los campos cambiados con OpenAI (`CONTENT_RULES` en el
   prompt; cliente aislado en su módulo), escribe el fichero destino,
   abre rama `i18n/sync-<sha>` y PR usando el PAT/App (para que dispare el
   preview de Vercel).
2. Paso que comenta en el PR los links `<preview>/en/` y `<preview>/es/`.
3. Como primer paso de la aceptación E2E de §11, ejecutar el **smoke test del
   motor**: traducir el tagline y el summary reales en ambas direcciones y
   revisar la calidad.

**Entregable:** push en un idioma → PR listo con traducción y preview
navegable. Revisión y merge aún manuales (Camino 1 del flujo).

### Fase 3 — `i18n-validate` (revisor delegado) — implementada

1. Workflow `i18n-validate.yml` disparado por comentario `/delegate` o
   etiqueta `auto-merge`, con verificación de que el actor es el dueño.
2. Pase validador (rol crítico, prompt propio): equivalencia semántica +
   reglas de contenido sobre todos los pares traducibles actuales del head del
   PR. Tres salidas: merge / fix + merge / abstención explicada. Veredicto
   siempre como comentario.
3. Habilitar auto-merge en el repo. **Completado.**
4. Prueba de fuego del escenario real: editar `cv-es.json`, push, y cerrar
   el ciclo entero desde el móvil con un tap.

**Estado del entregable:** código y prerrequisitos completos; aceptación
operativa pendiente de la prueba de fuego.

### Fuera de alcance (futuro, si algún día apetece)

- Timeout de auto-merge (hoy descartado: la inacción no debe publicar).
- Generar la CV-documento desde estos mismos JSON (vive en
  `cv_and_cover_letters`).
- Editar el CV desde fuera del repo (Notion/formulario + n8n — ver §9).

## 9. Evaluación de n8n

**Veredicto: no para este caso.** La orquestación (trigger → traducir → PR →
validar → merge) la cubre GitHub Actions de forma nativa, versionada y
gratis. La lógica difícil sería código a medida igual, pero viviendo en
Function nodes de una UI en vez de en el repo, y exige un servicio siempre
encendido para lo que es un pipeline de publicación.

**Cuándo sí tendría sentido:** si un día se quiere editar el CV *fuera del
repo* (Notion, Airtable, un formulario) y que algo vigile, traduzca y
commitee. Ese es otro producto; se reevaluaría entonces.

## 10. Alternativas descartadas

- **Fusionar en un `cv.json` con `{en,es}` por campo:** el autor prefiere dos
  ficheros; no resuelve por sí solo la traducción.
- **Script local `pnpm i18n` + cache de hashes (v1 del diseño):** sustituido
  por CI — el diff de git hace de cache y el PR hace de candado. Menos estado.
- **Traducción en runtime:** nunca. El sitio es estático.
- **Auto-merge por timeout:** convierte la inacción en publicación. Trigger
  explícito de 1 tap en su lugar; reevaluable después.
- **DeepL/Google como motor:** no acatan reglas de contenido (límites de
  caracteres, términos intactos, tono). Un LLM con instrucciones sí.
- **Quedarse en `luismarrer.vercel.app`:** URL atada a la plataforma;
  repetiría la dependencia actual con `github.io`. Subdominio propio en su
  lugar.
- **Dar contenido nuevo a `luismarrer.github.io`:** sería una cuarta
  propiedad que mantener; redirect en su lugar.
- **n8n como orquestador:** ver §9.

## 11. Estado de aceptación

- [x] Producción en Vercel y redirect en GitHub Pages.
- [x] Gate `i18n-check` conectado mediante `vercel.json`.
- [x] Traductor, comentario de previews y validador delegable implementados.
- [x] Secretos, auto-merge y branch protection configurados.

La única aceptación pendiente es una prueba E2E completa, compuesta por estos
pasos:

- [ ] `node scripts/i18n-sync.mjs --smoke` ejecutado con el proveedor real.
- [ ] Un cambio real en un solo idioma abrió el PR de sincronización.
- [ ] El preview EN/ES fue revisado dentro de ese flujo.
- [ ] `/delegate` o `auto-merge` cerró el ciclo y el resultado llegó a
      producción.
- [ ] El merge no abrió un PR inverso; si lo hizo, se añadió una guardia y se
      repitió la prueba E2E completa.
