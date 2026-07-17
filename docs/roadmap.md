# Roadmap — Portfolio/CV

Estado: **v1.4 — propuesto para ejecución** · Última actualización: 2026-07-17

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
| Print/PDF | Base implementada: dos páginas, enlaces y regresión EN/ES + Letter/A4 | Igualar tarjetas, corregir separadores de links, rebalancear páginas y simplificar Skills |
| Hero responsive | La composición móvil ya apila retrato y contenido | Evitar que el separador `|` quede aislado cuando el título profesional se divide |
| Education responsive | Institución y fechas comparten fila hasta 420 px | Cambiar de layout antes de que un nombre largo comprima o desplace las fechas |
| PRD i18n | Hosting, redirect e `i18n-check` completados | Traductor con PR/preview y validador delegado |
| Paleta nativa | PRD listo; `ninja-keys` sigue activo | Implementación, revisión del layout touch, pruebas, migración y limpieza |
| Experiencia laboral | Nombre, puesto, fechas y resumen en UI | Modelo de modalidad/tecnologías, exploración visual e implementación |

## Orden de ejecución

1. **R0 — Estabilizar print y responsive.**
2. **R1 — Implementar la paleta de comandos nativa.**
3. **R2 — Completar la automatización i18n.**
4. **R3 — Diseñar e implementar los metadatos de experiencia laboral.**

R0 agrupa correcciones visuales pequeñas que deben quedar protegidas antes de
trabajar en features mayores. R1 se ejecuta antes que R2 porque es autocontenido
y no depende de secretos ni configuración externa. R3 ocurre después de los
PRDs para incorporar su nuevo esquema de datos directamente al pipeline i18n
definitivo.

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

- [ ] Las seis tarjetas tienen la misma altura en EN y ES.
- [ ] Letter y A4 continúan generando exactamente dos páginas.
- [ ] Ningún texto, tag, borde o enlace queda recortado.
- [ ] `pnpm check` pasa localmente y en CI.
- [ ] Los cuatro PDFs renderizados fueron revisados visualmente.

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
- Mantener el separador visible solo en la composición horizontal.
- Cuando el hero cambia a columna, ocultar el separador y apilar las dos partes
  con un gap tipográfico pequeño y deliberado.
- No insertar un `<br>` dentro del contenido ni duplicar labels por breakpoint.
- El separador será decorativo para tecnologías de asistencia; la lectura debe
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

- [ ] El separador nunca queda huérfano en ningún ancho soportado.
- [ ] EN y ES comparten el mismo comportamiento sin copy especial para móvil.
- [ ] La lectura accesible no anuncia puntuación decorativa innecesaria.
- [ ] Desktop, móvil y print conservan una jerarquía visual coherente.
- [ ] Las pruebas responsive y `pnpm check` pasan.

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
  no en una categoría genérica de dispositivo; el punto de partida a validar
  será aproximadamente `560px`.
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

- [ ] El layout cambia de dos a una columna antes de producir compresión.
- [ ] No se pierde ni se oculta ninguna parte del nombre oficial.
- [ ] Las fechas conservan legibilidad y jerarquía en todos los anchos.
- [ ] EN/ES, desktop, móvil y print fueron revisados visualmente.
- [ ] Las pruebas responsive y `pnpm check` pasan.

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

- [ ] Solo el texto de cada link aparece subrayado; ningún `•` lo está.
- [ ] Email, teléfono, web y LinkedIn siguen siendo clicables en los cuatro PDFs.
- [ ] La primera página no termina prematuramente por un salto fijo antes de Projects.
- [ ] Ningún heading, proyecto, Education o Skills queda dividido de forma incoherente.
- [ ] Skills se presenta como lista con comas en print y conserva sus pills en web.
- [ ] EN/ES y Letter/A4 generan exactamente dos páginas y pasan revisión visual.
- [ ] `pnpm check` pasa localmente y en CI.

---

## R1 — PRD: paleta de comandos nativa

Documento fuente:
[plan-command-palette-native.md](./plan-command-palette-native.md).

### Resultado

Sustituir `ninja-keys` por una paleta propia, accesible y pequeña, conservando
las acciones actuales y la identidad de consola editorial mínima.

### Revisión responsive: paleta flotante para touch

La implementación actual traslada demasiadas convenciones de escritorio a
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
- El prompt `~/cv ›` puede mantenerse en desktop; en móvil se evaluará contra
  un placeholder directo para evitar ruido dentro del espacio reducido.

### Fases

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

- [ ] Las acciones de imprimir, tema, idioma y enlaces funcionan en EN/ES.
- [ ] Teclado, foco, estado vacío y lectores de pantalla cumplen el PRD.
- [ ] Desktop, móvil, claro, oscuro y reduced motion fueron validados.
- [ ] La paleta móvil conserva margen lateral e inferior en portrait y landscape.
- [ ] La interfaz touch conserva el botón `⌘`, pero no muestra badges de atajos
      secundarios dentro del menú.
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

Ejecutar **R0** como un cambio aislado: igualar las tarjetas impresas, corregir
los links y Skills en print, prototipar el nuevo reparto de páginas, corregir el
label del hero y el header de Education, añadir sus contratos de regresión y
volver a revisar desktop, móvil y los cuatro PDFs antes de comenzar la paleta
nativa.
