# R1 — Paleta de comandos nativa

Estado: **v1.3 — completado y en producción** · Última actualización: 2026-08-18

> Implementación activa en `main`: `src/components/CommandPalette.astro`,
> `src/lib/commandPalette.ts` y `src/lib/theme.ts`. La paleta expone siete
> opciones, sin dependencias de runtime, con 31 contratos Playwright en
> `tests/palette/command-palette.spec.ts` y
> `tests/palette/command-palette.webkit.spec.ts`. La QA manual con VoiceOver en
> Brave (Chromium) y el preview de Vercel están completados; R1 está cerrado.
>
> Build de producción medido el 2026-08-18: **5.26 kB min / 2.07 kB gzip**
> para la paleta, más **0.25 kB min / 0.17 kB gzip** del módulo de tema
> compartido. El baseline anterior era 54.41 kB / 17.55 kB gzip.

## 1. Decisión

R1 conservó la experiencia de la paleta de comandos y sustituyó `ninja-keys`
por una implementación propia, pequeña y accesible, construida con HTML nativo,
CSS y TypeScript sin dependencias de runtime adicionales.

La paleta mantiene `Cmd/Ctrl + K`, búsqueda, grupos, navegación por teclado,
acciones y el botón móvil. Se integra como una evolución del sitio, con mejor
accesibilidad, consistencia visual y seguridad.

## 2. Objetivos

- Preservar la interacción que hace especial al portfolio.
- Eliminar `ninja-keys` y sus dependencias transitivas de producción.
- Reducir de forma sustancial el JavaScript enviado al navegador.
- Usar semántica nativa y cumplir el patrón accesible de diálogo + combobox.
- Compartir exactamente el mismo comportamiento en inglés y español.
- Integrarse automáticamente con los temas claro y oscuro mediante los tokens
  existentes.
- Ser robusta en escritorio, móvil, teclado, ratón, touch y lectores de pantalla.
- Dejar pruebas automatizadas que impidan regresiones de interacción.

### Métricas de éxito

- Cero dependencias de runtime para la paleta.
- Chunk de la paleta de **≤ 8 kB minificado y ≤ 3 kB gzip**; objetivo ideal:
  reducción ≥ 80 % frente al baseline anterior.
- Sin peticiones de red, fuentes o iconos cargados por la paleta.
- Las siete opciones siguen disponibles.
- Cero errores de consola en `/en/` y `/es/`.
- Navegación completa usando solo teclado.
- `pnpm build` y `pnpm i18n:check` pasan.
- La versión imprimible continúa ocultando todos los controles de la paleta.

## 3. Baseline anterior (histórico)

Esta sección conserva el estado previo a R1 para explicar las decisiones de la
migración. `KeyboardManager.astro` y `ninja-keys` ya no forman parte de la
arquitectura activa.

### Funcionalidad existente

La implementación anterior exponía siete opciones; seis tenían atajo directo y
el sitio personal no:

| Grupo | Comando | Atajo | Efecto |
|---|---|---|---|
| Acciones | Imprimir | `Ctrl+P` | Ejecuta `window.print()` |
| Acciones | Cambiar tema | `Ctrl+T` | Activa el control de tema existente |
| Acciones | Cambiar idioma | `Ctrl+E` | Navega entre `/en/` y `/es/` |
| Links | Sitio web personal | — | Abre `cv.basics.url` en otra pestaña |
| Links | GitHub | `Ctrl+G` | Abre el perfil en una pestaña nueva |
| Links | LinkedIn | `Ctrl+L` | Abre el perfil en una pestaña nueva |
| Links | X | `Ctrl+X` | Abre el perfil en una pestaña nueva |

También incluye:

- apertura con `Cmd/Ctrl + K`;
- búsqueda por título;
- selección con flechas y `Enter`;
- cierre con `Escape`;
- un recordatorio fijo en escritorio;
- un botón flotante en móvil;
- estilos claro y oscuro.

### Coste medido

El build anterior producía para `KeyboardManager.astro` un chunk de **54.41 kB**,
**17.55 kB gzip**. La dependencia incorpora Lit, `hotkeys-js` y Material Web
Components para resolver una lista de siete opciones.

### Problemas corregidos por la migración

- El botón móvil simula un evento de teclado en vez de invocar una API directa.
- Un listener global de `touchend` inserta nodos repetidamente en cada toque.
- El tema necesita sincronizar manualmente una clase dentro del web component.
- Los iconos sociales están duplicados como strings SVG en vez de reutilizar
  los componentes de `src/icons/`.
- El pie solo anuncia `Cmd + K`, aunque Windows y Linux usan `Ctrl + K`.
- Los atajos globales de acciones compiten con el navegador; especialmente
  `Ctrl/Cmd + T` y los atajos de redes.
- Abrir redes mediante `window.open()` requiere gestionar explícitamente
  `noopener`; un enlace nativo es más seguro.
- No hay estado vacío traducido ni anuncio accesible de resultados.
- `Layout.astro` conoce el elemento `ninja-keys`, creando acoplamiento entre el
  tema global y una dependencia concreta.

## 4. Alcance funcional

### Paridad obligatoria

- Abrir y cerrar con `Cmd + K` en macOS y `Ctrl + K` en Windows/Linux.
- Abrir desde el botón flotante móvil.
- Filtrar comandos mientras se escribe.
- Mantener los grupos **Acciones** y **Links**.
- Ejecutar impresión, tema e idioma, y abrir el sitio personal y los tres
  perfiles sociales.
- Derivar el sitio personal de `cv.basics.url`.
- Navegar con `ArrowDown`, `ArrowUp` y `Enter`.
- Cerrar con `Escape`, botón de cierre o clic/tap en el backdrop.
- Funcionar en claro, oscuro, EN y ES.

### Mejoras incluidas

- `Home` y `End` seleccionan el primer y último resultado visible.
- La navegación con flechas continúa de un extremo al otro, como ahora.
- La búsqueda ignora mayúsculas, espacios repetidos y diacríticos.
- La búsqueda considera título, grupo y palabras clave localizadas.
- La acción de tema indica el destino real: «Cambiar a tema oscuro/claro».
- Se muestra un estado vacío localizado cuando no hay coincidencias.
- Un `aria-live` anuncia la cantidad de resultados sin interrumpir cada cambio
  de selección.
- Al cerrar, el foco vuelve al elemento que abrió la paleta.
- En móvil, el panel respeta `safe-area-inset-*` y el teclado virtual.
- El recordatorio muestra `⌘ K` en plataformas Apple y `Ctrl K` en las demás.

### Atajos directos

La paleta usa un atajo global para abrirse y siete atajos internos para sus
opciones:

| Atajo | Comando |
|---|---|
| `Cmd/Ctrl + K` | Abrir o cerrar la paleta |
| `Ctrl + P` | Imprimir |
| `Ctrl + T` | Cambiar tema |
| `Ctrl + E` | Cambiar idioma |
| `Ctrl + S` | Abrir el sitio web personal |
| `Ctrl + G` | Abrir GitHub |
| `Ctrl + L` | Abrir LinkedIn |
| `Ctrl + X` | Abrir X |

Los atajos de acción solo están activos mientras la paleta está abierta y sus
badges muestran `Ctrl` y la letra como dos teclas separadas en toda plataforma.
Nunca usan Command/Meta. Fuera de la paleta no se interceptan, por lo que el
navegador y los campos editables conservan sus atajos nativos.

## 5. Dirección visual

### Concepto

Una **consola editorial mínima**: la precisión de una interfaz de comandos con
la sobriedad del CV. No usa colores de marca, gradientes, glassmorphism ni una
estética de «terminal hacker».

La única firma visual es el prompt decorativo `~/cv ›` delante de la
búsqueda. Conecta la paleta con el trabajo de ingeniería y con la tipografía
monoespaciada del sitio sin disfrazar toda la interfaz de terminal.

### Tokens

La paleta hereda los tokens existentes de `Layout.astro`:

| Rol | Token |
|---|---|
| Fondo del panel | `--bg` o `--footer-bg` |
| Texto principal | `--text-heading` |
| Texto secundario | `--text-body` / `--text-muted` |
| Bordes | `--border` / `--border-hover` |
| Selección | `--surface` |
| Texto de etiquetas | `--tag-text` |

No añade tokens globales de uso exclusivo. El backdrop y el anillo de foco son
valores locales derivados de los tokens existentes.

### Tipografía

- Búsqueda, resultados y atajos: la pila monoespaciada ya usada por el sitio.
- Títulos de grupo: la misma tipografía, tamaño reducido y contraste secundario.
- No se cargarán fuentes nuevas.

### Layout de escritorio

```text
                  backdrop
       ┌────────────────────────────────────────┐
       │ ~/cv › Buscar comando...             × │
       ├────────────────────────────────────────┤
       │ ACCIONES                               │
       │ → Imprimir                 [Ctrl] [P]  │
       │   Cambiar a tema oscuro    [Ctrl] [T]  │
       │   Cambiar a inglés         [Ctrl] [E]  │
       │                                        │
       │ LINKS                                  │
       │   Sitio web personal       [Ctrl] [S]  │
       │   GitHub                   [Ctrl] [G]  │
       │   LinkedIn                 [Ctrl] [L]  │
       │   X                        [Ctrl] [X]  │
       ├────────────────────────────────────────┤
       │ ↑↓ navegar  ↵ abrir  esc salir         │
       └────────────────────────────────────────┘
```

- Ancho máximo aproximado: `640px`.
- Posición ligeramente por encima del centro óptico.
- Altura limitada por `100dvh`; la lista es la única zona desplazable.

### Layout móvil

```text
┌──────────────────────────────────────┐
│ contenido del CV                     │
│                                      │
│                              [⌘]     │
│   ┌──────────────────────────────┐   │
│   │ ⌕ Buscar comando...       ×  │   │
│   │ ACCIONES                     │   │
│   │ → Imprimir                   │   │
│   │   Cambiar a tema oscuro      │   │
│   │   Cambiar a inglés           │   │
│   │ LINKS                        │   │
│   │   Sitio web personal         │   │
│   │   GitHub                     │   │
│   │   LinkedIn                   │   │
│   │   X                          │   │
│   └──────────────────────────────┘   │
└──────────────────────────────────────┘
```

- Se comporta como una hoja inferior flotante con inset lateral e inferior.
- El prompt `~/cv ›`, los keycaps y el footer se ocultan en touch/móvil.
- Objetivos táctiles mínimos de `44 × 44px`.
- El botón flotante conserva su posición, pero usa un `<button>` semántico,
  `aria-label` traducido y offsets de safe area.

### Movimiento

La implementación usa un único gesto de entrada:

- backdrop: aparición gradual durante `160ms`;
- panel: `opacity` + desplazamiento de `10px` durante `160ms`;
- cierre inmediato, sin animación de salida;
- selección por cambio de fondo, sin transición dedicada ni movimiento;
- con `prefers-reduced-motion: reduce`, se desactivan las animaciones de entrada.

### Autocrítica de la dirección

El prompt `~/cv ›` podría sentirse decorativo o demasiado literal. Para evitarlo,
se limita al prefijo de búsqueda, se marca `aria-hidden="true"` y no se acompaña
de cursores parpadeantes, ventanas falsas, neón ni animaciones de escritura.
Todo lo demás permanece silencioso y funcional.

## 6. Arquitectura implementada

### Componente

`src/components/CommandPalette.astro` es la única implementación activa;
`src/components/KeyboardManager.astro` se retiró al confirmar la paridad.

Responsabilidades del componente:

- construir el sitio personal desde `cv.basics.url` y las redes desde
  `cv.basics.profiles`;
- renderizar todo el HTML de forma estática;
- reutilizar `GitHub.astro`, `LinkedIn.astro` y `X.astro`;
- renderizar iconos locales para imprimir, tema, idioma, buscar y cerrar;
- incluir estilos encapsulados;
- inicializar el controlador una sola vez.

### Controlador

`src/lib/commandPalette.ts` expone una API pequeña:

```ts
initCommandPalette(root: HTMLElement): () => void
```

El controlador se ocupa de:

- estado abierto/cerrado;
- consulta y resultados visibles;
- índice activo;
- eventos de teclado, puntero y búsqueda;
- ejecución y cierre de comandos;
- restauración del foco;
- anuncios de resultados;
- limpieza de listeners mediante `AbortController`.

La función de normalización de búsqueda es pura y exportable para probarla
sin DOM. No existe un custom element ni una abstracción genérica para menús:
el producto solo necesita una paleta.

### HTML y ARIA

- Contenedor: `<dialog>` abierto con `showModal()`.
- Nombre accesible: `aria-labelledby` apuntando a un título solo para lectores
  de pantalla.
- Entrada: `<input type="search" role="combobox">` con `aria-controls`,
  `aria-expanded="true"`, `aria-autocomplete="list"` y
  `aria-activedescendant`.
- Resultados: contenedor `role="listbox"` dividido en grupos accesibles.
- Cada comando visible: `role="option"`, ID estable y `aria-selected`.
- Conteo: región `aria-live="polite"` visualmente oculta.
- Cierre visible: `<button type="button">` con etiqueta localizada.
- Enlaces externos: URL nativa, `target="_blank"` y
  `rel="noopener noreferrer"`.

`<dialog>` proporciona top layer, fondo inerte y contención de foco en
navegadores modernos. El controlador prueba y restaura el foco de forma
explícita para que el comportamiento sea determinista.

### Modelo de comandos

Cada opción expone un ID estable, `role="option"`, `data-search`,
`data-shortcut` y uno de estos valores de `data-command`:

| Valor | Uso |
|---|---|
| `print` | Cerrar y ejecutar `window.print()` |
| `theme` | Compartir la acción de tema de `src/lib/theme.ts` |
| `language` | Navegar al locale opuesto |
| `external-link` | Abrir sitio personal o perfil social con un enlace real |

El orden es estable y queda definido por el servidor. La búsqueda filtra; no aplica
fuzzy ranking que haga saltar resultados mientras se escribe. Los términos de
varias palabras se evalúan con semántica AND.

### Integración con acciones

- **Imprimir:** cerrar el diálogo y ejecutar `window.print()` después de dos
  frames para que el diálogo no participe en la captura de impresión.
- **Tema:** usar `toggleTheme()` de `src/lib/theme.ts`, compartida con el botón
  global. `Layout.astro` no consulta la paleta.
- **Idioma:** navegar al locale opuesto con un enlace real.
- **Enlaces:** usar enlaces reales para el sitio personal y los perfiles,
  generados desde el CV y sin `window.open()`.

El componente consume CSS variables directamente. `syncNinjaKeys()` y las
clases `.dark` específicas de la integración anterior fueron eliminadas.

### Búsqueda

Normalización determinista:

1. `String.prototype.normalize("NFD")`;
2. eliminar marcas diacríticas;
3. convertir con `toLocaleLowerCase(locale)`;
4. colapsar espacios;
5. comparar todos los tokens contra título, grupo y palabras clave.

No se incorpora una librería fuzzy: con siete opciones añade coste y hace el
orden menos predecible sin mejorar materialmente la experiencia.

### Inicialización segura

- Marcar cada raíz inicializada para evitar listeners duplicados.
- Ignorar eventos con `event.isComposing` o `event.repeat`.
- No capturar `Cmd/Ctrl + K` dentro de campos editables ajenos a la paleta.
- Llamar `preventDefault()` solo cuando la paleta realmente maneje el evento.
- El botón móvil llama directamente a la rutina local de apertura.
- El backdrop cierra solo si `pointerdown` y `pointerup` comienzan y terminan
  fuera del panel, evitando cierres accidentales al arrastrar.

## 7. i18n y microcopy

El dominio se renombró de `keyboardManager` a `commandPalette` y de
`useKeyboardManager()` a `useCommandPalette()`, por lo que ya no hace referencia
a la implementación anterior.

La microcopy EN/ES incluye:

- instrucción de apertura;
- etiqueta del botón móvil;
- título accesible del diálogo;
- placeholder de búsqueda;
- cerrar;
- acciones;
- links y sitio web personal;
- imprimir;
- cambiar a tema claro;
- cambiar a tema oscuro;
- cambiar al idioma opuesto;
- cero resultados;
- un resultado;
- varios resultados;
- ayudas para navegar, ejecutar y salir.

La UI debe decir lo que ocurrirá. Evitar «Toggle theme» cuando puede decir
«Cambiar a tema oscuro» o «Switch to light theme».

## 8. Historial de implementación

Las fases 0–6 se completaron antes del cierre de R1. Se conservan como registro
de ejecución; la implementación anterior ya no permanece disponible.

### Fase 0 — Congelar el contrato actual

1. Registrar el tamaño del baseline anterior: 54.41 kB / 17.55 kB gzip.
2. Capturar referencia visual en claro/oscuro y desktop/móvil.
3. Convertir la lista de §4 en checklist de paridad.
4. Confirmar el comportamiento de impresión antes de tocar la integración.

**Salida:** baseline reproducible para comparar, no una impresión subjetiva.

### Fase 1 — Markup y datos

1. Crear `CommandPalette.astro` junto al componente actual.
2. Definir el modelo de comandos y generar las siete opciones.
3. Reutilizar los iconos Astro existentes y añadir solo los que falten.
4. Renderizar `<dialog>`, búsqueda, grupos, resultados, estado vacío y footer.
5. Añadir toda la microcopy EN/ES.

**Salida:** estructura estática completa y auditable, aún sin sustituir producción.

### Fase 2 — Motor de interacción

1. Implementar apertura/cierre y restauración del foco.
2. Implementar filtrado normalizado.
3. Implementar índice activo y `aria-activedescendant`.
4. Añadir flechas, `Home`, `End`, `Enter` y `Escape`.
5. Añadir ratón, touch, botón móvil y backdrop.
6. Añadir anuncios accesibles y estado vacío.
7. Implementar las cuatro clases de acción.

**Salida:** paridad funcional sin depender del acabado visual.

### Fase 3 — Diseño y movimiento

1. Aplicar los tokens existentes para ambos temas.
2. Construir layout desktop y bottom sheet móvil.
3. Añadir prompt `~/cv ›`, estados hover/active/focus y ayudas de teclado.
4. Añadir animación de entrada y `prefers-reduced-motion`.
5. Verificar scroll, `100dvh`, safe areas y teclado virtual.

**Salida:** experiencia visual terminada, coherente con el portfolio.

### Fase 4 — Integración y desacoplamiento

1. Sustituir el componente en las páginas EN/ES.
2. Compartir la acción de tema con el control visible.
3. Eliminar `syncNinjaKeys()` de `Layout.astro`.
4. Sustituir selectores de impresión `ninja-keys` por selectores semánticos o
   por `.no-print`.
5. Verificar que los perfiles siguen procediendo únicamente del CV JSON.

**Salida:** la nueva paleta es la única implementación activa.

### Fase 5 — Pruebas y QA

1. Añadir pruebas Playwright de la paleta sin debilitar las pruebas de impresión.
2. Ejecutar la matriz funcional de §9.
3. Revisar manualmente con VoiceOver en Brave (Chromium).
4. Comparar screenshots EN/ES, claro/oscuro y desktop/móvil.
5. Medir el build y ajustar hasta cumplir el presupuesto.

**Salida:** evidencia de paridad, accesibilidad y mejora de rendimiento.

### Fase 6 — Limpieza

1. Eliminar `KeyboardManager.astro`.
2. Ejecutar `pnpm remove ninja-keys` para actualizar `package.json` y lockfile.
3. Retirar referencias a Ninja Keys de README, AGENTS y documentación técnica.
4. Buscar residuos con `rg "ninja-keys|KeyboardManager|useKeyboardManager"`.
5. Ejecutar todas las verificaciones finales.

**Salida:** implementación nativa sin código muerto ni documentación obsoleta.

## 9. Estrategia de pruebas

### Automatizadas con Playwright

La suite actual define 31 casos: 22 localizados (11 en EN y 11 en ES), cuatro
de resiliencia, cuatro de touch/viewport en Chromium y uno de hoja touch en
WebKit.

#### Apertura y cierre

- `Meta+K` y `Control+K` abren exactamente un diálogo.
- La búsqueda recibe foco y el primer comando queda activo.
- Repetir el atajo cierra sin duplicar estado.
- `Escape`, botón de cierre y backdrop cierran.
- En touch, abrir no enfoca la búsqueda y cerrar devuelve el foco al trigger.

#### Búsqueda

- Coincidencias por label y keywords localizadas.
- Búsqueda insensible a diacríticos.
- Varios tokens usan semántica AND.
- Cero coincidencias muestra el estado localizado.
- Limpiar el input restaura todos los comandos y la primera selección.

#### Navegación

- Flechas avanzan, retroceden y envuelven extremos.
- `Home`/`End` saltan a los extremos visibles.
- `Enter` ejecuta solo el comando activo.
- `aria-activedescendant` y `aria-selected` permanecen sincronizados.

#### Acciones

- Imprimir llama una vez a `window.print()` después de cerrar.
- Tema cambia `data-theme`, persiste en `localStorage` y actualiza el label.
- Idioma apunta al locale opuesto.
- El sitio personal responde a `Ctrl+S` y usa `cv.basics.url`.
- Los enlaces conservan sus URLs, pestaña nueva y `noopener noreferrer`.

#### Resiliencia

- Abrir/cerrar repetidamente no duplica listeners ni nodos.
- Los atajos de acción solo operan con la paleta abierta y no secuestran un
  input externo.
- La paleta permanece oculta en media `print`.
- No hay overflow horizontal a 320 px.

#### Touch y viewport

- Portrait verifica márgenes, objetivos de 44 px, scroll útil, fuente de 16 px,
  foco inicial y affordances de teclado ocultos.
- Landscape verifica controles alcanzables a `667×375` y `844×390`.
- Un viewport visual simulado mantiene búsqueda, resultados y cierre visibles.
- WebKit/iPhone protege el área desplazable y la primera opción visible.

### Guardas implementadas sin aserción Playwright directa

- El controlador ignora eventos `repeat` y de composición IME.
- `Cmd/Ctrl+K` no abre la paleta desde un campo editable externo.
- `prefers-reduced-motion: reduce` elimina las animaciones de entrada.

### QA visual

| Variante | Desktop | Móvil |
|---|---:|---:|
| EN claro | ✓ | ✓ |
| EN oscuro | ✓ | ✓ |
| ES claro | ✓ | ✓ |
| ES oscuro | ✓ | ✓ |
| Sin resultados | ✓ | ✓ |
| Lista con selección final | ✓ | ✓ |

Revisar especialmente textos españoles más largos, contraste, truncado, scroll,
safe areas y que el panel no tape su propia selección al abrirse el teclado.

### QA de accesibilidad manual

La evidencia registrada el 2026-07-18 con VoiceOver en Brave (Chromium)
confirmó diálogo, grupos, resultado activo, conteo en vivo, estado vacío y
retorno de foco. Chromium anunció las opciones como «menu item»; se registró como
un matiz del mapeo de plataforma, no como defecto funcional. El contrato manual
también contempla:

- El fondo no es navegable mientras el modal está abierto.
- El orden de foco es lógico y nunca se pierde.
- El foco visible alcanza al menos el equivalente de WCAG 2.2 AA.
- Contraste de texto, selección y foco cumple AA en ambos temas.
- Zoom al 200 % no pierde acciones ni controles.

### Compatibilidad objetivo

Últimas dos versiones estables de Chrome, Safari y Firefox, más Safari móvil.
No se usa ni se prevé un polyfill de `<dialog>`: el sitio prioriza navegadores
modernos y una dependencia para navegadores obsoletos contradiría el objetivo.

## 10. Archivos resultantes

### Nuevos

- `src/components/CommandPalette.astro`
- `src/lib/commandPalette.ts`
- `src/lib/theme.ts`
- `src/icons/Close.astro`
- `src/icons/Languages.astro`
- `src/icons/Printer.astro`
- `src/icons/Search.astro`
- `src/icons/ThemeToggle.astro`
- `tests/palette/command-palette.spec.ts`
- `tests/palette/command-palette.webkit.spec.ts`

### Modificados

- `src/pages/en/index.astro`
- `src/pages/es/index.astro`
- `src/layouts/Layout.astro`
- `src/i18n/ui.ts`
- `src/i18n/utils.ts`
- `package.json`
- `pnpm-lock.yaml`
- `playwright.config.ts`
- `README.md`
- `AGENTS.md`
- `CLAUDE.md`
- `docs/roadmap.md`

### Eliminado

- `src/components/KeyboardManager.astro`

## 11. Definición de terminado

La migración quedó terminada con estos criterios:

- [x] La paleta abre con teclado y botón en todos los breakpoints.
- [x] Las siete opciones funcionan en EN y ES.
- [x] Búsqueda, selección, estado vacío y anuncios son correctos.
- [x] El foco entra, permanece y regresa de forma determinista.
- [x] Claro, oscuro, reduced motion y print funcionan sin excepciones.
- [x] `Cmd/Ctrl+K` es el único atajo global; las acciones Control solo operan
      dentro de la paleta abierta.
- [x] El sitio personal y los perfiles siguen derivados de los JSON del CV.
- [x] Playwright cubre interacción, touch, WebKit y la impresión sigue pasando.
- [x] La pasada manual con VoiceOver en Brave (Chromium) del 2026-07-18 verificó
      diálogo, grupos, comando activo, conteo en vivo, estado vacío y retorno de
      foco.
- [x] `pnpm i18n:check` pasa.
- [x] `pnpm build` pasa sin warnings atribuibles a la paleta.
- [x] El presupuesto de ≤ 8 kB minificado / ≤ 3 kB gzip se cumple.
- [x] `ninja-keys` no aparece en dependencias, lockfile ni arquitectura activa;
      sus menciones en este documento son únicamente históricas.
- [x] El preview de Vercel fue validado en desktop y móvil antes del merge.

## 12. Fuera de alcance

- Submenús o comandos anidados.
- Acciones remotas o cargadas desde una API.
- Historial, favoritos o comandos recientes.
- Una librería fuzzy-search.
- Analytics de comandos.
- Atajos globales configurables por el visitante.
- Convertir el componente en una librería reutilizable.
- Cambios al contenido del CV o nuevas secciones.

## 13. Rollback actual

La estrategia de mantener `KeyboardManager.astro` en paralelo solo aplicó antes
del merge y queda documentada como contexto histórico. Hoy la paleta nativa es
la única implementación: no existe una copia operativa de
`KeyboardManager.astro` ni la dependencia `ninja-keys`. Un rollback de release
se haría mediante el historial de Git de R1 y sus commits de endurecimiento; no
se debe reintroducir manualmente código o dependencias obsoletas.
