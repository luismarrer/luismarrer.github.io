# Roadmap — Portfolio/CV

Estado: **v1.0 — propuesto para ejecución** · Última actualización: 2026-07-16

## Objetivo

Mantener una sola experiencia que funcione como portfolio web y como CV
imprimible, ejecutar los PRDs ya definidos y enriquecer la experiencia laboral
sin perder el carácter minimalista del sitio.

## Principios

- Web e impresión son dos presentaciones deliberadas del mismo contenido.
- Ningún cambio puede romper la paridad entre inglés y español.
- La impresión se mantiene en dos páginas mientras el contenido actual lo
  permita; una tercera página exige una decisión editorial explícita.
- Los metadatos deben ayudar a escanear el CV, no convertirlo en una colección
  de badges.
- La UI laboral tomará ideas de la
  [CV de Bartosz Jarocki](https://cv.jarocki.me/), pero tendrá una jerarquía y
  un lenguaje visual propios.
- Cada milestone termina con pruebas, QA visual y documentación actualizada.

## Estado actual

| Área | Estado | Pendiente real |
|---|---|---|
| Print/PDF | Base implementada: dos páginas, enlaces y regresión EN/ES + Letter/A4 | Igualar las seis tarjetas de proyectos y fijarlo con una prueba geométrica |
| PRD i18n | Hosting, redirect e `i18n-check` completados | Traductor con PR/preview y validador delegado |
| Paleta nativa | PRD listo; `ninja-keys` sigue activo | Implementación, pruebas, migración y limpieza |
| Experiencia laboral | Nombre, puesto, fechas y resumen en UI | Modelo de modalidad/tecnologías, exploración visual e implementación |

## Orden de ejecución

1. **R0 — Estabilizar las tarjetas de proyectos al imprimir.**
2. **R1 — Implementar la paleta de comandos nativa.**
3. **R2 — Completar la automatización i18n.**
4. **R3 — Diseñar e implementar los metadatos de experiencia laboral.**

R0 es un arreglo pequeño y bloquea la calidad visual de print. R1 se ejecuta
antes que R2 porque es autocontenido y no depende de secretos ni configuración
externa. R3 ocurre después de los PRDs para incorporar su nuevo esquema de datos
directamente al pipeline i18n definitivo.

---

## R0 — Proyectos impresos con altura consistente

### Resultado

Las seis tarjetas ocupan exactamente la misma altura en la cuadrícula impresa,
sin alterar la versión web ni forzar una tercera página.

### Implementación

- En print, hacer que las filas implícitas del grid compartan altura
  (`grid-auto-rows: 1fr`) y que cada `article` llene su celda (`height: 100%`).
- Confirmar que descripciones y tags siguen alineados y que ninguna tarjeta se
  corta entre páginas.
- Evitar una altura fija en puntos: el contenido EN/ES debe determinar la
  altura mínima segura.
- Añadir al contrato Playwright una medición de las seis cajas en Letter y A4:
  la diferencia entre la mayor y la menor debe ser como máximo 1 px.

### Definición de terminado

- [ ] Las seis tarjetas tienen la misma altura en EN y ES.
- [ ] Letter y A4 continúan generando exactamente dos páginas.
- [ ] Ningún texto, tag, borde o enlace queda recortado.
- [ ] `pnpm check` pasa localmente y en CI.
- [ ] Los cuatro PDFs renderizados fueron revisados visualmente.

---

## R1 — PRD: paleta de comandos nativa

Documento fuente:
[plan-command-palette-native.md](./plan-command-palette-native.md).

### Resultado

Sustituir `ninja-keys` por una paleta propia, accesible y pequeña, conservando
las acciones actuales y la identidad de consola editorial mínima.

### Fases

1. Congelar baseline funcional, visual y de tamaño del bundle.
2. Crear `CommandPalette.astro`, el modelo de comandos y la microcopy EN/ES.
3. Implementar búsqueda, navegación, foco, teclado, ratón y touch.
4. Aplicar desktop modal, bottom sheet móvil, temas y reduced motion.
5. Integrar impresión, tema, idioma y enlaces; retirar el acoplamiento a
   `ninja-keys`.
6. Añadir la matriz Playwright, QA de accesibilidad y QA visual.
7. Eliminar componente, dependencia, código y documentación obsoletos.

### Definición de terminado

- [ ] Las acciones de imprimir, tema, idioma y enlaces funcionan en EN/ES.
- [ ] Teclado, foco, estado vacío y lectores de pantalla cumplen el PRD.
- [ ] Desktop, móvil, claro, oscuro y reduced motion fueron validados.
- [ ] La paleta permanece fuera de la impresión.
- [ ] El chunk cumple ≤ 8 kB minificado y ≤ 3 kB gzip.
- [ ] `ninja-keys` no aparece en dependencias, código ni documentación.
- [ ] Las pruebas de paleta y `pnpm check` pasan juntas.

---

## R2 — PRD: sincronización automática EN/ES

Documento fuente: [prd-cv-i18n-sync.md](./prd-cv-i18n-sync.md).

### Ya completado

- Producción en Vercel bajo `cv.luismarrero.me`.
- Redirect de `luismarrer.github.io` mediante GitHub Pages.
- `scripts/i18n-check.mjs` como contrato estructural y de invariantes.
- `vercel.json` usando el check como Ignored Build Step.

### R2.1 — Traductor y PR

- Crear el cliente de traducción desacoplado del proveedor.
- Detectar dirección y campos modificados desde el diff.
- Traducir solo esos campos respetando las reglas de contenido.
- Crear rama `i18n/sync-<sha>` y PR mediante GitHub App o PAT.
- Publicar en el PR los previews directos de `/en/` y `/es/`.
- Probar tagline y summary reales en ambas direcciones.

### R2.2 — Validación delegada

- Implementar `/delegate` y la etiqueta `auto-merge`.
- Autorizar la delegación únicamente cuando el actor sea el dueño del repo.
- Separar el rol/prompt del traductor y el del revisor.
- Permitir tres salidas auditables: merge, corrección + merge o abstención.
- Ejecutar una prueba completa desde una edición en un idioma hasta producción.

### Prerrequisitos externos

- [ ] `OPENAI_API_KEY` en GitHub Secrets.
- [ ] GitHub App o fine-grained PAT para crear PRs que disparen workflows.
- [ ] Auto-merge habilitado en el repositorio.
- [ ] Branch protection y checks requeridos definidos antes de automatizar merge.

### Definición de terminado

- [ ] Un cambio en un solo idioma produce un PR de traducción, no un deploy roto.
- [ ] El preview permite revisar ambas versiones sin leer JSON.
- [ ] `/delegate` o `auto-merge` cierran el flujo con un veredicto visible.
- [ ] Ninguna traducción automática entra a `main` sin PR y validación.
- [ ] Producción nunca publica EN/ES desincronizados.

---

## R3 — Metadatos de experiencia laboral

### Intención

Hacer que cada empleo comunique rápidamente **cómo se trabajó** y **con qué se
trabajó**, sin competir con el puesto, el resumen o las fechas.

La referencia de Bartosz coloca modalidad y tecnologías como badges junto a la
empresa. Conservaremos su capacidad de escaneo, pero no la composición exacta.
La hipótesis inicial será una línea de metadatos silenciosa debajo del puesto:

```text
SAC                                             jun 2026 — Actual
Interno de desarrollo de software
Híbrido  ·  TypeScript / Next.js / Git / GitHub
Resumen del trabajo…
```

- **Modalidad** será una señal corta y diferenciada con borde sutil.
- **Tecnologías** serán texto técnico separado por puntos o barras, no una fila
  completa de pills.
- Las fechas conservarán su columna visual actual.
- En print se priorizará densidad y legibilidad; en móvil los metadatos podrán
  envolver sin desalinear el encabezado.

### Contrato de datos propuesto

```json
{
  "workMode": "hybrid",
  "technologies": ["TypeScript", "Next.js", "Git", "GitHub"]
}
```

- `workMode`: enum canónico `remote | hybrid | on-site`; idéntico en ambos JSON
  y traducido en la UI mediante `ui.ts`.
- `technologies`: nombres canónicos e invariantes, mismo orden en EN/ES.
- `employmentType` y ubicación específica quedan fuera de v1 salvo que los
  prototipos demuestren que aportan información real.
- Los `highlights` existentes no se mostrarán automáticamente en v1: primero se
  protegerá la jerarquía y el límite de dos páginas.

### R3.1 — Exploración y decisión de diseño

Crear tres prototipos con los cuatro trabajos reales, no datos ficticios:

1. **Línea técnica** — modalidad destacada + tecnologías como texto; hipótesis
   recomendada para empezar.
2. **Rail de metadatos** — una columna estrecha de modalidad/stack alineada con
   fechas en desktop y reubicada bajo el puesto en móvil.
3. **Chips contenidos** — versión cercana a la referencia, limitada a una sola
   línea y con modalidad visualmente distinta de tecnologías.

Comparar cada variante en EN/ES, desktop, móvil, tema oscuro y print. La fase
termina con una decisión del autor; no se implementa una dirección final sin
esa aprobación.

### R3.2 — Implementación

- Añadir los campos aprobados a `cv-en.json` y `cv-es.json`.
- Actualizar el tipo de `WorkExperience` y el componente `Experience.astro`.
- Añadir labels EN/ES para las modalidades.
- Confirmar el contrato de `i18n-check`: modalidad y tecnologías deben seguir
  como invariantes y no entrar en `TRANSLATABLE`; cualquier texto descriptivo
  nuevo sí debe declararse traducible.
- Diseñar wrapping, jerarquía, foco de enlaces y comportamiento print.
- Mantener los artículos completos con `break-inside: avoid-page`.

### Definición de terminado

- [ ] Los cuatro trabajos tienen modalidad y stack reales, no inferidos.
- [ ] La jerarquía empresa → puesto → metadatos → resumen es clara.
- [ ] La UI no se percibe como una copia de la referencia.
- [ ] EN/ES, desktop, móvil, claro, oscuro, Letter y A4 fueron revisados.
- [ ] El CV continúa en dos páginas y ninguna experiencia se divide.
- [ ] `pnpm i18n:check`, pruebas de UI y `pnpm check` pasan.

---

## Gate común para cada milestone

Un milestone solo puede cerrarse cuando:

- el diff se limita al alcance acordado y preserva cambios no relacionados;
- contenido y microcopy existen en EN y ES;
- build, i18n y pruebas específicas pasan;
- no hay regresiones de impresión ni accesibilidad;
- existe evidencia visual en los breakpoints relevantes;
- README, AGENTS y el documento fuente reflejan el estado real.

## Próxima acción

Ejecutar **R0** como un cambio aislado: igualar las tarjetas impresas, añadir la
aserción geométrica y volver a renderizar los cuatro PDFs antes de comenzar la
paleta nativa.
