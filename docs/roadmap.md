# Roadmap — Portfolio/CV

Estado: **v2.0 — R0, R1, R3 y R4 cerrados; R2 implementado y pendiente de validación E2E** · Última actualización: 2026-08-18

> Único pendiente operativo: ejecutar y documentar la prueba de fuego de R2,
> desde una edición real en un solo idioma hasta el PR de sincronización,
> preview EN/ES, validación delegada, merge y deploy.
>
> La configuración externa de R2 ya está lista: `OPENAI_API_KEY`,
> `I18N_BOT_TOKEN`, auto-merge, branch protection y checks requeridos. R1 está
> cerrado, incluida la pasada manual con VoiceOver en Brave (Chromium) del
> 2026-07-18.

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
- La UI laboral toma ideas de la
  [CV de Bartosz Jarocki](https://cv.jarocki.me/), pero conserva una jerarquía y
  un lenguaje visual propios.
- Cada milestone termina con pruebas, QA visual y documentación actualizada.

## Estado actual

| Área | Estado | Pendiente real |
|---|---|---|
| Print/PDF | R0 cerrado: dos páginas, proyectos con flujo natural, entradas indivisibles, tarjetas igualadas y Skills tipográfico | — |
| Hero y Education | Contratos responsive protegidos por Playwright | — |
| Paleta nativa | R1 cerrado: `<dialog>` + combobox ARIA, siete opciones, experiencia touch y QA manual con VoiceOver | — |
| Sincronización i18n | R2 implementado y configuración externa lista | Prueba E2E completa: smoke, ciclo real y ausencia de PR inverso |
| Experiencia laboral | R3 cerrado: valores canónicos EN/ES y línea técnica en desktop/print | — |
| Pulido responsive y atajos | R4 ejecutado: metadatos móviles, atajos internos, Visual Viewport y contrato WebKit/iOS | — |

## Orden de ejecución

1. **R0 — Estabilizar print y responsive.**
2. **R1 — Implementar la paleta de comandos nativa.**
3. **R2 — Implementar la automatización i18n.**
4. **R3 — Incorporar los metadatos de experiencia laboral.**
5. **R4 — Pulir el layout laboral y los accesos directos de la paleta.**

R4 no añadió un nuevo esquema de datos: consolidó el comportamiento responsive
de R3 y endureció la interacción de R1 en teclado, touch, teclado virtual e iOS.
R2 es el único milestone que todavía no puede cerrarse porque falta evidencia
de su recorrido real de extremo a extremo.

---

## R0 — Estabilización visual

### R0.1 — Proyectos impresos con altura consistente

#### Resultado

Las seis tarjetas ocupan exactamente la misma altura en la cuadrícula impresa,
sin alterar la versión web ni forzar una tercera página.

#### Implementación

- En print, hacer que las filas implícitas del grid compartan altura
  (`grid-auto-rows: 1fr`) y que cada `article` llene su celda (`height: 100%`).
- Confirmar que descripciones y tags siguen alineados y que ninguna tarjeta se
  corta entre páginas.
- Evitar una altura fija en puntos: el contenido EN/ES debe determinar la
  altura mínima segura.
- Añadir al contrato Playwright una medición de las seis cajas en Letter y A4:
  la diferencia entre la mayor y la menor debe ser como máximo 1 px.

#### Definición de terminado

- [x] Las seis tarjetas tienen la misma altura en EN y ES.
- [x] Letter y A4 continúan generando exactamente dos páginas.
- [x] Ningún texto, tag, borde o enlace queda recortado.
- [x] `pnpm check` pasa localmente y en CI.
- [x] Los cuatro PDFs renderizados fueron revisados visualmente.

### R0.2 — Título profesional responsive sin separador huérfano

#### Problema

El contenido `Software Developer | Data & Automation` funciona en una sola
línea, pero en móvil el wrap actual puede producir:

```text
Software Developer
| Data & Automation
```

El `|` deja de separar elementos en paralelo y se convierte en un carácter
aislado al comienzo de la segunda línea.

#### Dirección

Mantener el valor canónico de `basics.label` en los JSON, pero tratar sus dos
partes como unidades visuales dentro de `Hero.astro`:

```text
Desktop / print:  Software Developer | Data & Automation

Móvil:            Software Developer
                  Data & Automation
```

- Separar el label por el delimitador ` | ` al renderizarlo en spans.
- Renderizar las partes apiladas y el separador oculto por defecto.
- Con la query del contenedor `.info` a `min-width: 54ch`, mostrar las partes y
  el separador en línea. La decisión depende del ancho real del bloque de texto,
  no de la dirección flex del hero ni de un breakpoint de viewport.
- No insertar un `<br>` dentro del contenido ni duplicar labels por breakpoint.
- El separador es decorativo para tecnologías de asistencia; la lectura debe
  conservar una pausa natural entre ambas especialidades.
- Mantener la misma tipografía, color y jerarquía: este cambio corrige
  estructura, no añade decoración.

#### Pruebas y QA

- Añadir un marcador estable al label para probar su layout sin depender del
  texto traducido.
- Verificar EN y ES a 320, 360, 390/393, 480 y 768 px.
- Asegurar que ninguna línea empiece o termine con un `|` aislado.
- Confirmar que no aparece overflow horizontal y que ambas líneas permanecen
  centradas en la composición móvil.
- Confirmar que desktop y los PDFs conservan el separador horizontal.

#### Definición de terminado

- [x] El separador nunca queda huérfano en ningún ancho soportado.
- [x] EN y ES comparten el mismo comportamiento sin copy especial para móvil.
- [x] La lectura accesible no anuncia puntuación decorativa innecesaria.
- [x] Desktop, móvil y print conservan una jerarquía visual coherente.
- [x] Las pruebas responsive y `pnpm check` pasan.

### R0.3 — Education responsive sin competencia entre título y fechas

#### Problema

El encabezado de Education mantiene institución y fechas en la misma fila hasta
`420px`. En anchos intermedios, `University of Puerto Rico, Río Piedras` ya
necesita dos líneas mientras el periodo continúa ocupando una columna rígida:

```text
University of Puerto Rico, Río  Jan 2026 — Present
Piedras
```

No es principalmente un problema de longitud del contenido: el layout de dos
columnas permanece activo después de dejar de tener espacio suficiente.

#### Política de longitud de contenido

- Mantener límites editoriales estrictos para copy controlable, como títulos y
  descripciones de proyectos.
- No truncar con ellipsis ni imponer un máximo arbitrario a nombres oficiales
  de instituciones, organizaciones o certificaciones.
- Permitir que nombres oficiales ocupen hasta dos líneas cuando sea necesario.
- Si un nombre futuro sigue excediendo dos líneas a 320 px después de adaptar
  el layout, evaluar un campo explícito `shortName`; el nombre completo debe
  conservarse en los datos, el enlace y su nombre accesible.

#### Dirección

- Reemplazar el `flex` del header por un grid de dos columnas:
  `minmax(0, 1fr) auto`, con separación explícita entre institución y fechas.
- Dar `min-width: 0` al bloque del título para que pueda envolver sin empujar el
  periodo fuera del viewport.
- Adelantar el cambio a una sola columna basándose en el punto real de colisión,
  no en una categoría genérica de dispositivo; el breakpoint implementado es
  `560px`.
- En una columna, preservar esta jerarquía:

```text
University of Puerto Rico, Río Piedras
Jan 2026 — Present
Bachelor of Science in Computer Science
```

- Usar wrapping tipográfico balanceado para evitar que una sola palabra quede
  aislada cuando exista una división más natural.
- Mantener desktop y print en dos columnas mientras dispongan de espacio real.

#### Pruebas y QA

- Probar las dos entradas reales de Education en EN y ES.
- Cubrir 320, 360, 390/393, 420, 480, 560 y 700 px.
- Comprobar que institución y periodo nunca se solapan ni quedan visualmente
  pegados.
- Comprobar que el periodo nunca sale del viewport y permanece en una línea.
- Comprobar que el título actual ocupa como máximo dos líneas.
- Confirmar que Letter y A4 conservan la composición compacta y dos páginas.

#### Definición de terminado

- [x] El layout cambia de dos a una columna antes de producir compresión.
- [x] No se pierde ni se oculta ninguna parte del nombre oficial.
- [x] Las fechas conservan legibilidad y jerarquía en todos los anchos.
- [x] EN/ES, desktop, móvil y print fueron revisados visualmente.
- [x] Las pruebas responsive y `pnpm check` pasan.

### R0.4 — Pulido editorial del PDF

La revisión visual de los PDFs actuales en EN/ES confirma que los tres cambios
propuestos valen la pena. El subrayado de los separadores es un defecto; la
lista de Skills puede simplificarse sin perder información; y el espacio entre
Work Experience y Projects requiere un prototipo porque afecta la distribución
completa de las dos páginas.

#### R0.4.1 — Links con separadores independientes

El punto `•` se genera actualmente dentro del siguiente enlace. Aunque el
pseudoelemento declare `text-decoration: none`, el subrayado del elemento
inline se propaga visualmente y alcanza también al separador.

- Renderizar cada `•` como un sibling decorativo fuera de los anchors, o
  subrayar exclusivamente un span que envuelva el texto del enlace.
- Preferir el separador sibling: refleja la estructura real y evita depender de
  particularidades del motor de impresión.
- Marcar los separadores como `aria-hidden="true"` y mantener Email, teléfono,
  web y LinkedIn como cuatro enlaces independientes.
- Confirmar que las anotaciones PDF `mailto:`, `tel:` y `https:` continúan
  presentes y que sus áreas clicables no incluyen los puntos.

#### R0.4.2 — Balance entre Work Experience y Projects

El vacío no procede del gap entre secciones: Projects tiene un
`break-before: page` forzado. Reducir márgenes o comprimir Work Experience no
resolvería la causa.

- Prototipar la eliminación del salto forzado para permitir que Projects
  comience en el espacio disponible de la primera página.
- Mantener el heading junto a la primera fila completa; ningún título, tarjeta
  ni fila de proyectos puede quedar huérfano o dividirse entre páginas.
- Conservar exactamente dos páginas y aceptar que el espacio libre al final de
  la segunda es menos disruptivo que un vacío prematuro entre dos secciones.
- Comparar la distribución completa en EN/ES y Letter/A4 antes de aprobar el
  cambio. No fijar el reparto basándose únicamente en el PDF inglés Letter.
- Sustituir en Playwright la regla rígida “Projects empieza en página 2” por
  invariantes editoriales: orden correcto, heading acompañado, bloques
  indivisibles y dos páginas.
- Si el grid no pagina de forma consistente entre los cuatro documentos, usar
  como fallback un salto controlado después de una fila completa. La futura
  información laboral de R3 también deberá volver a validar este balance.

#### R0.4.3 — Skills como lista tipográfica en print

- Mantener los pills con iconos en web; el cambio se limita a `@media print`.
- Conservar el `<ul>` semántico, pero mostrar sus elementos sin borde, fondo,
  icono ni padding y separarlos visualmente con coma y espacio.
- Permitir wrapping natural entre skills sin cortar nombres individuales ni
  dejar una coma aislada al inicio de línea.
- Mantener el bloque completo unido siempre que quepa y verificar que cada
  skill aparece exactamente una vez en el texto extraído del PDF.

Ejemplo esperado:

```text
TypeScript, Astro, React, Next.js, Python, SQL, Excel, Power BI, Git, C, Bash
```

#### Definición de terminado

- [x] Solo el texto de cada link aparece subrayado; ningún `•` lo está.
- [x] Email, teléfono, web y LinkedIn siguen siendo clicables en los cuatro PDFs.
- [x] La primera página no termina prematuramente por un salto fijo antes de Projects.
- [x] Ningún heading, proyecto, Education o Skills queda dividido de forma incoherente.
- [x] Skills se presenta como lista con comas en print y conserva sus pills en web.
- [x] EN/ES y Letter/A4 generan exactamente dos páginas y pasan revisión visual.
- [x] `pnpm check` pasa localmente y en CI.

---

## R1 — PRD: paleta de comandos nativa

Documento fuente:
[plan-command-palette-native.md](./plan-command-palette-native.md).

### Resultado

R1 sustituyó `ninja-keys` por una paleta propia, accesible y pequeña, conservando
las acciones y la identidad de consola editorial mínima.

### Revisión responsive: paleta flotante para touch

La implementación reemplazada trasladaba demasiadas convenciones de escritorio a
móvil: el panel toca ambos extremos horizontales, la lista puede ocupar gran
parte del viewport y los badges `Home`, `Ctrl P`, `Ctrl T`, etc. compiten con el
nombre de cada acción.

Esta dirección reemplaza el sketch móvil de borde a borde del PRD:

```text
┌──────────────────────────────────────┐
│ contenido atenuado                   │
│                                      │
│   ┌──────────────────────────────┐   │
│   │ Buscar acciones…          ×  │   │
│   ├──────────────────────────────┤   │
│   │ ACCIONES                     │   │
│   │ Imprimir                     │   │
│   │ Cambiar a tema oscuro        │   │
│   │ Cambiar a español            │   │
│   │ LINKS                        │   │
│   │ Sitio personal · GitHub…     │   │
│   └──────────────────────────────┘   │
│                               [⌘]    │
└──────────────────────────────────────┘
```

- Usar una **hoja inferior flotante**, no edge-to-edge: inset lateral de
  `12–16px`, separación inferior más `env(safe-area-inset-bottom)` y esquinas
  coherentes con las tarjetas del portfolio.
- Limitar la altura con `dvh`; header/búsqueda permanecen visibles y solo la
  lista de resultados puede desplazarse.
- En dispositivos `pointer: coarse` / `hover: none`, ocultar los badges y el
  footer de ayudas de teclado. Los atajos pueden seguir funcionando si existe
  un teclado conectado, pero no dominan la presentación táctil.
- No mostrar una selección de teclado persistente al abrir desde touch; el
  estado activo aparece al navegar con teclado o interactuar con una fila.
- Conservar el botón móvil `⌘` como firma visual y disparador reconocible del
  portfolio, usando un `<button>` semántico con `aria-label` localizado. Su
  presencia no obliga a mostrar todos los atajos dentro de la lista.
- Mantener objetivos táctiles de al menos `44 × 44px`, backdrop claro y cierre
  por botón o tap fuera del panel.
- El prompt `~/cv ›` se mantiene en desktop y se oculta en touch/móvil; allí
  una lupa y el placeholder directo evitan ruido dentro del espacio reducido.

### Fases ejecutadas

1. Incorporar esta revisión touch al PRD y congelar baseline funcional, visual
   y de tamaño del bundle.
2. Crear `CommandPalette.astro`, el modelo de comandos y la microcopy EN/ES.
3. Implementar búsqueda, navegación, foco, teclado, ratón y touch.
4. Aplicar desktop modal, hoja flotante móvil, temas y reduced motion.
5. Integrar impresión, tema, idioma y enlaces; retirar el acoplamiento a
   `ninja-keys`.
6. Añadir la matriz Playwright, QA de accesibilidad y QA visual.
7. Eliminar componente, dependencia, código y documentación obsoletos.

### QA responsive de la paleta

- Probar portrait a 320, 360, 390/393 y 430 px de ancho.
- Probar landscape a 667 × 375 y 844 × 390.
- Verificar que el panel nunca toca los extremos del viewport y respeta safe
  areas.
- Abrir el teclado virtual y confirmar que búsqueda, selección y cierre siguen
  alcanzables.
- Verificar que la lista desplaza internamente sin mover el documento de fondo.
- Confirmar que los atajos son visibles en desktop y están ocultos en touch.
- Comparar EN/ES, claro/oscuro, lista completa, búsqueda y cero resultados.

### Definición de terminado

- [x] Las siete opciones —imprimir, tema, idioma, sitio personal, GitHub,
      LinkedIn y X— funcionan en EN y ES.
- [x] Teclado, foco, búsqueda, estado vacío y anuncios ARIA cumplen el PRD.
- [x] La pasada manual con VoiceOver en Brave (Chromium) del 2026-07-18 verificó
      diálogo, grupos, comando activo, conteo en vivo, estado vacío y retorno de
      foco.
- [x] Desktop, móvil, claro, oscuro, reduced motion y print fueron validados.
- [x] La hoja touch conserva márgenes y oculta keycaps y ayudas de teclado.
- [x] La paleta permanece fuera de la impresión.
- [x] El chunk cumple ≤ 8 kB minificado y ≤ 3 kB gzip: 5.26 kB / 2.07 kB gzip
      en el build del 2026-08-18, más 0.25 kB / 0.17 kB gzip del tema.
- [x] `ninja-keys` no aparece en dependencias ni código de producción; sus
      menciones restantes documentan la migración histórica.
- [x] Las pruebas de paleta y `pnpm check` pasan juntas.

---

## R2 — PRD: sincronización automática EN/ES

Documento fuente: [prd-cv-i18n-sync.md](./prd-cv-i18n-sync.md).

### Ya completado

- Producción en Vercel bajo `cv.luismarrero.me`.
- Redirect de `luismarrer.github.io` mediante GitHub Pages.
- `scripts/i18n-check.mjs` como contrato estructural y de invariantes.
- Detección de texto obsoleto cuando existe un baseline Git resoluble; sin
  baseline, el modo fail-open solo cubre estructura e invariantes.
- `vercel.json` usando el check como Ignored Build Step.

### R2.1 — Traductor y PR — implementado

- [x] Cliente de traducción desacoplado del proveedor
      (`scripts/translation-client.mjs`: OpenAI vía fetch + proveedor `mock`
      para probar la fontanería sin clave).
- [x] Detección de dirección y campos modificados desde el diff
      (`scripts/i18n-sync.mjs` sobre el reporte `--json` de `i18n-check`;
      soporta hojas desincronizadas y cambios estructurales de un solo lado,
      preservando traducciones existentes por matching de valor).
- [x] Con estructura estable, traducción limitada a los campos obsoletos
      señalados y reglas `CONTENT_RULES` en el prompt; ante estructura o
      invariantes divergentes en un solo idioma, reconstrucción del destino con
      reutilización de traducciones existentes.
- [x] Workflow `i18n-sync.yml`: rama `i18n/sync-<sha>` y PR con
      `I18N_BOT_TOKEN` (PAT/App) y fallback documentado a `GITHUB_TOKEN`.
- [x] Workflow `i18n-preview-links.yml`: comenta `<preview>/en/` y
      `<preview>/es/` cuando Vercel reporta el deployment del PR.

El smoke del motor con la clave real forma parte de la única prueba E2E
pendiente descrita más abajo; no es un milestone separado.

### R2.2 — Validación delegada — implementado

- [x] Workflow `i18n-validate.yml` disparado por comentario `/delegate` o
      etiqueta `auto-merge`.
- [x] Delegación autorizada solo cuando el actor es el dueño del repo; el
      job ejecuta únicamente código de `main` y toma del PR solo los dos
      ficheros de datos.
- [x] Rol/prompt del revisor separado del traductor
      (`scripts/i18n-validate.mjs`, con gate estructural previo vía
      `i18n-check --dir`).
- [x] Tres salidas auditables como comentario en el PR: merge, corrección +
      merge o abstención explicada.

La aceptación operativa de este flujo forma parte del único cierre E2E descrito
más abajo.

### Configuración externa — completada

- [x] `OPENAI_API_KEY` configurada en GitHub Secrets.
- [x] `I18N_BOT_TOKEN` configurado con capacidad de crear ramas y PRs que
      disparen previews y checks.
- [x] Auto-merge habilitado.
- [x] Branch protection con `EN/ES · Letter/A4` como check requerido.

### Cierre pendiente

La implementación y su configuración están listas. Falta una sola validación
operativa, con evidencia visible. Existe un riesgo concreto que esa prueba debe
resolver: el merge por squash del PR cambia solo el antiguo idioma destino
frente a su padre inmediato, por lo que el workflow puede interpretarlo como
una nueva fuente y abrir un PR inverso.

- [ ] Ejecutar `node scripts/i18n-sync.mjs --smoke` con el proveedor real.
- [ ] Editar un campo traducible en un solo idioma y hacer push a `main`.
- [ ] Confirmar que `i18n-sync` crea el PR y que el preview ofrece `/en/` y
      `/es/`.
- [ ] Delegar con `/delegate` o `auto-merge` y registrar el veredicto.
- [ ] Confirmar el merge y el deploy final con EN/ES coherentes.
- [ ] Confirmar que el merge no abre un PR inverso; si lo abre, añadir una
      guardia y repetir el recorrido completo.

R2 se cierra únicamente cuando ese recorrido completo haya ocurrido y terminado
sin bucles en el repositorio real; no quedan prerrequisitos de configuración.

---

## R3 — Metadatos de experiencia laboral

### Intención

Hacer que cada empleo comunique rápidamente **cómo se trabajó** y **con qué se
trabajó**, sin competir con el puesto, el resumen o las fechas.

La referencia de Bartosz coloca modalidad y tecnologías como badges junto a la
empresa. Se conservó su capacidad de escaneo, pero no la composición exacta.
La dirección final es una línea de metadatos silenciosa debajo del puesto:

```text
SAC                                             jun 2026 — Actual
Interno de desarrollo de software
Remoto  ·  Next.js / Vercel Workflows / Vercel AI SDK / Amazon S3
Resumen del trabajo…
```

- **Modalidad** es una señal corta y diferenciada con borde sutil.
- **Tecnologías** son texto técnico separado por puntos o barras, no una fila
  completa de pills.
- Las fechas conservan su columna visual actual.
- En print se prioriza densidad y legibilidad; en móvil los metadatos aparecen
  después del resumen para no comprimir el encabezado.

### Contrato de datos implementado

| Organización | `workMode` | `technologies` |
|---|---|---|
| SAC | `remote` | Next.js · Vercel Workflows · Vercel AI SDK · Amazon S3 |
| Universal Group | `on-site` | Excel · Power BI |
| Holberton School | `hybrid` | C · Python · Linux |
| University of Puerto Rico | `on-site` | Excel |

`workMode` y `technologies` son invariantes: conservan exactamente el mismo
valor y orden en `cv-en.json` y `cv-es.json`; solo la etiqueta visible de la
modalidad se localiza mediante `ui.ts`. El enum canónico es
`remote | hybrid | on-site`.

- `employmentType` y ubicación específica quedan fuera de v1 salvo que los
  prototipos demuestren que aportan información real.
- Los `highlights` existentes no se muestran automáticamente en v1: se priorizan
  la jerarquía y el límite de dos páginas.

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

**Resultado de la exploración (2026-07-17):** se prototiparon las tres
variantes con los cuatro trabajos reales. El rail (2) desalinea la columna de
fechas y parte el stack en líneas alineadas a la derecha; los chips (3)
compiten visualmente con el resumen, duplican el lenguaje de los tags de
proyectos y se acercan demasiado a la referencia. La **línea técnica (1)** es
la implementada, tal como recomendaba la hipótesis inicial. La línea técnica
quedó ratificada como dirección final. R4 conservó esta decisión y solo cambió
su colocación responsive: desktop y print la muestran debajo del puesto; a
≤700 px aparece después del resumen. Solo una copia es visible en cada
breakpoint.

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

- [x] Los cuatro trabajos tienen modalidad y stack confirmados.
- [x] Los valores canónicos son idénticos y mantienen el mismo orden en EN/ES.
- [x] En desktop y print la jerarquía es empresa → puesto → metadatos → resumen.
- [x] A ≤700 px la jerarquía es empresa → puesto → resumen → metadatos; a
      ≤420 px el header también apila las fechas.
- [x] Ningún stack produce overflow y solo una línea de metadatos es visible.
- [x] La UI no se percibe como una copia de la referencia.
- [x] EN/ES, desktop, móvil, claro, oscuro, Letter y A4 fueron revisados.
- [x] El CV continúa en dos páginas y ninguna experiencia se divide.
- [x] La cantidad exacta de filas de proyectos por página no forma parte del
      contrato: el flujo se adapta al contenido sin salto forzado.
- [x] Los contratos i18n, responsive, print y paleta pasan juntos.

---

## R4 — Pulido responsive y atajos directos

Estado: **ejecutado el 2026-08-18**.

### Resultado

R4 consolidó los metadatos laborales en pantallas estrechas y convirtió la
paleta en una superficie de acciones rápidas sin secuestrar los atajos del
navegador ni degradar touch, teclado virtual o Safari móvil.

### R4.1 — Metadatos laborales responsive

- En desktop y print, modalidad y tecnologías permanecen debajo del puesto.
- A ≤700 px, los metadatos se mueven debajo del resumen para liberar el header.
- A ≤420 px, empresa, puesto y fechas se apilan sin perder su jerarquía.
- Solo una copia de los metadatos es visible en cada breakpoint.
- El contrato se valida en EN/ES entre 320 y 768 px.

### R4.2 — Atajos directos de la paleta

- `Cmd/Ctrl + K` abre o cierra la paleta.
- Con la paleta abierta, `Ctrl + P/T/E/S/G/L/X` ejecuta imprimir, tema, idioma,
  sitio personal, GitHub, LinkedIn y X.
- Los atajos de acción nunca usan Command/Meta y no se interceptan fuera del
  diálogo, por lo que el navegador y los campos editables conservan sus teclas.
- Cada badge se renderiza como dos keycaps: `Ctrl` y la letra.
- Los keycaps permanecen ocultos en la experiencia touch.

### R4.3 — Touch, teclado virtual e iOS

- La hoja flotante sincroniza su geometría con `window.visualViewport`.
- Abrir desde touch no enfoca automáticamente la búsqueda ni invoca el teclado.
- Búsqueda, resultados y cierre permanecen dentro del viewport visual cuando
  aparece el teclado virtual.
- La lista conserva un área desplazable real en WebKit/iOS.
- Un contrato WebKit con emulación de iPhone verifica las siete opciones, un
  objetivo táctil mínimo de 44 px y la altura útil de resultados; Chromium
  comprueba todos los objetivos táctiles.

### Definición de terminado

- [x] El layout laboral no produce overflow entre 320 y 768 px.
- [x] Los siete atajos de acción son únicos y solo actúan dentro de la paleta
      abierta.
- [x] Los atajos del navegador y de inputs externos no se interceptan.
- [x] Touch no muestra affordances de teclado.
- [x] Chromium cubre interacción, responsive y teclado virtual.
- [x] WebKit cubre la hoja touch y el área visible de resultados.
- [x] Print continúa en dos páginas y no muestra la paleta.

---

## Gate común para cada milestone

Un milestone solo puede cerrarse cuando:

- el diff se limita al alcance acordado y preserva cambios no relacionados;
- contenido y microcopy existen en EN y ES;
- build, i18n y pruebas específicas pasan;
- no hay regresiones de impresión ni accesibilidad;
- existe evidencia visual en los breakpoints relevantes;
- README, AGENTS y el documento fuente reflejan el estado real.

## Estado consolidado y próxima acción

R0, R1, R3 y R4 están cerrados. El contrato de impresión es mantener dos
páginas intactas, no una cantidad fija de filas de proyectos por página:
Projects comienza cuando existe espacio editorial suficiente y continúa de
forma natural sin dividir headings, tarjetas ni experiencias.

La QA manual con VoiceOver en Brave (Chromium) de R1 está completada y ya no
figura como pendiente. Los refinamientos posteriores de R4 están protegidos por
contratos Chromium y WebKit. El build de producción mantiene la paleta dentro de
su presupuesto.

R2 tiene código, workflows y configuración externa listos. La próxima acción
es ejecutar su prueba de fuego E2E y adjuntar como evidencia el PR automático,
los previews EN/ES, el veredicto delegado, el merge, la ausencia de un PR
inverso y el deploy coherente. Si aparece el falso positivo inverso, hay que
añadir una guardia y repetir el ciclo antes de cerrar R2 y este roadmap.
