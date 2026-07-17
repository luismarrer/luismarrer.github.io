# Plan — Reimplementación nativa de la paleta de comandos

Estado: **v1.0 — listo para implementación** · Última actualización: 2026-07-16

## 1. Decisión

Conservar la experiencia de la paleta de comandos, pero sustituir `ninja-keys`
por una implementación propia, pequeña y accesible, construida con HTML nativo,
CSS y TypeScript sin dependencias de runtime adicionales.

La nueva paleta debe sentirse como una evolución del sitio, no como un widget
distinto incrustado en él. Mantendrá `Cmd/Ctrl + K`, búsqueda, grupos, navegación
por teclado, acciones y el botón móvil, mientras mejora accesibilidad,
consistencia visual y seguridad.

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
  reducción ≥ 80 % frente al chunk actual.
- Sin peticiones de red, fuentes o iconos cargados por la paleta.
- Todas las acciones actuales siguen disponibles.
- Cero errores de consola en `/en/` y `/es/`.
- Navegación completa usando solo teclado.
- `pnpm build` y `pnpm i18n:check` pasan.
- La versión imprimible continúa ocultando todos los controles de la paleta.

## 3. Auditoría del estado actual

### Funcionalidad existente

La paleta expone seis comandos:

| Grupo | Comando | Efecto |
|---|---|---|
| Acciones | Imprimir | Ejecuta `window.print()` |
| Acciones | Cambiar tema | Activa el control de tema existente |
| Acciones | Cambiar idioma | Navega entre `/en/` y `/es/` |
| Redes | GitHub | Abre el perfil en una pestaña nueva |
| Redes | LinkedIn | Abre el perfil en una pestaña nueva |
| Redes | X | Abre el perfil en una pestaña nueva |

También incluye:

- apertura con `Cmd/Ctrl + K`;
- búsqueda por título;
- selección con flechas y `Enter`;
- cierre con `Escape`;
- un recordatorio fijo en escritorio;
- un botón flotante en móvil;
- estilos claro y oscuro.

### Coste medido

El build actual produce para `KeyboardManager.astro` un chunk de **54.41 kB**,
**17.55 kB gzip**. La dependencia incorpora Lit, `hotkeys-js` y Material Web
Components para resolver una lista de seis comandos.

### Problemas que la migración debe corregir

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
- Mantener los grupos **Acciones** y **Redes sociales**.
- Ejecutar impresión, tema, idioma y los tres enlaces sociales.
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
- El recordatorio muestra `⌘ K` o `Ctrl K` según la plataforma; si no puede
  detectarse con seguridad, muestra `⌘/Ctrl K`.

### Atajos que se eliminan deliberadamente

Solo `Cmd/Ctrl + K` será global. No se conservarán `Ctrl/Cmd + T`, los atajos
de redes ni otros atajos de acción. No forman parte esencial de la experiencia,
son difíciles de descubrir y colisionan con funciones del navegador.
`Cmd/Ctrl + P` seguirá funcionando mediante el comportamiento nativo del
navegador, además del comando «Imprimir» dentro de la paleta.

## 5. Dirección visual

### Concepto

Una **consola editorial mínima**: la precisión de una interfaz de comandos con
la sobriedad del CV. No se añadirán colores de marca, gradientes, glassmorphism
ni una estética de «terminal hacker».

La única firma visual será el prompt decorativo `~/cv ›` delante de la
búsqueda. Conecta la paleta con el trabajo de ingeniería y con la tipografía
monoespaciada del sitio sin disfrazar toda la interfaz de terminal.

### Tokens

La paleta heredará los tokens existentes de `Layout.astro`:

| Rol | Token |
|---|---|
| Fondo del panel | `--bg` o `--footer-bg` |
| Texto principal | `--text-heading` |
| Texto secundario | `--text-body` / `--text-muted` |
| Bordes | `--border` / `--border-hover` |
| Selección | `--surface` |
| Texto de etiquetas | `--tag-text` |

Solo se añadirán tokens globales si tienen utilidad fuera del componente. El
backdrop y el anillo de foco pueden permanecer como valores locales derivados
de los tokens existentes.

### Tipografía

- Búsqueda, resultados y atajos: la pila monoespaciada ya usada por el sitio.
- Títulos de grupo: la misma tipografía, tamaño reducido y contraste secundario.
- No se cargarán fuentes nuevas.

### Layout de escritorio

```text
                  backdrop
       ┌──────────────────────────────┐
       │ ~/cv › Buscar comando...  × │
       ├──────────────────────────────┤
       │ ACCIONES                     │
       │ →  Imprimir                  │
       │    Cambiar a tema oscuro     │
       │    Cambiar a inglés          │
       │                              │
       │ REDES SOCIALES               │
       │    GitHub                    │
       │    LinkedIn                  │
       │    X                         │
       ├──────────────────────────────┤
       │ ↑↓ navegar  ↵ abrir  esc salir│
       └──────────────────────────────┘
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
├──────────────────────────────────────┤
│ ~/cv › Buscar comando...          × │
│ ACCIONES                             │
│ → Imprimir                           │
│   Cambiar a tema oscuro              │
│ REDES SOCIALES                       │
│   GitHub · LinkedIn · X              │
└──────────────────────────────────────┘
```

- Se comporta como una hoja inferior compacta.
- Objetivos táctiles mínimos de `44 × 44px`.
- El botón flotante conserva su posición, pero usa un `<button>` semántico,
  `aria-label` traducido y offsets de safe area.

### Movimiento

Un único gesto orquestado:

- backdrop: aparición gradual;
- panel: `opacity` + desplazamiento de 8–12 px;
- entrada: 140–180 ms; salida: 90–120 ms;
- selección: transición breve de fondo, sin mover el layout;
- con `prefers-reduced-motion: reduce`, todo cambio es inmediato.

### Autocrítica de la dirección

El prompt `~/cv ›` podría sentirse decorativo o demasiado literal. Para evitarlo,
se limita al prefijo de búsqueda, se marca `aria-hidden="true"` y no se acompaña
de cursores parpadeantes, ventanas falsas, neón ni animaciones de escritura.
Todo lo demás permanece silencioso y funcional.

## 6. Arquitectura propuesta

### Componente

Crear `src/components/CommandPalette.astro` y retirar
`src/components/KeyboardManager.astro` cuando se confirme la paridad.

Responsabilidades del componente:

- construir la lista tipada de comandos desde `cv.basics.profiles`;
- renderizar todo el HTML de forma estática;
- reutilizar `GitHub.astro`, `LinkedIn.astro` y `X.astro`;
- renderizar iconos locales para imprimir, tema, idioma, buscar y cerrar;
- incluir estilos encapsulados;
- inicializar el controlador una sola vez.

### Controlador

Crear `src/lib/commandPalette.ts` con una API pequeña:

```ts
initCommandPalette(root: HTMLElement): () => void
```

El controlador se ocupará de:

- estado abierto/cerrado;
- consulta y resultados visibles;
- índice activo;
- eventos de teclado, puntero y búsqueda;
- ejecución y cierre de comandos;
- restauración del foco;
- anuncios de resultados;
- limpieza de listeners mediante `AbortController`.

La función de normalización de búsqueda será pura y exportable para probarla
sin DOM. No se creará un custom element ni una abstracción genérica para menús:
solo existe una paleta en este producto.

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

Usar `<dialog>` proporciona top layer, fondo inerte y contención de foco en
navegadores modernos. El controlador seguirá probando y restaurando el foco de
forma explícita para que el comportamiento sea determinista.

### Modelo de comandos

```ts
type CommandGroup = "actions" | "networks"

interface Command {
  id: string
  group: CommandGroup
  label: string
  keywords: string[]
  kind: "print" | "theme" | "language" | "external-link"
  href?: string
}
```

El orden será estable y definido por el servidor. La búsqueda filtra; no aplica
fuzzy ranking que haga saltar resultados mientras se escribe. Los términos de
varias palabras se evaluarán con semántica AND.

### Integración con acciones

- **Imprimir:** cerrar el diálogo y ejecutar `window.print()` en el siguiente
  frame para que el diálogo no participe en la captura de impresión.
- **Tema:** compartir una función pequeña de tema con el botón global, o emitir
  una intención desacoplada. `Layout.astro` no volverá a consultar la paleta.
- **Idioma:** navegar al locale opuesto con un enlace real.
- **Redes:** usar enlaces reales generados desde el CV, no `window.open()`.

El componente debe consumir CSS variables directamente. Se eliminarán
`syncNinjaKeys()` y cualquier clase `.dark` específica de la paleta.

### Búsqueda

Normalización determinista:

1. `String.prototype.normalize("NFD")`;
2. eliminar marcas diacríticas;
3. convertir con `toLocaleLowerCase(locale)`;
4. colapsar espacios;
5. comparar todos los tokens contra título, grupo y palabras clave.

No se incorporará una librería fuzzy: con seis comandos añade coste y hace el
orden menos predecible sin mejorar materialmente la experiencia.

### Inicialización segura

- Marcar cada raíz inicializada para evitar listeners duplicados.
- Ignorar eventos con `event.isComposing` o `event.repeat`.
- No capturar `Cmd/Ctrl + K` dentro de campos editables ajenos a la paleta.
- Llamar `preventDefault()` solo cuando la paleta realmente maneje el evento.
- El botón móvil llamará directamente a `openPalette()`.
- El backdrop cerrará solo si `pointerdown` y `pointerup` comienzan y terminan
  fuera del panel, evitando cierres accidentales al arrastrar.

## 7. i18n y microcopy

Renombrar `keyboardManager` a `commandPalette` y
`useKeyboardManager()` a `useCommandPalette()` para que el dominio ya no haga
referencia a una implementación anterior.

Añadir, como mínimo, estas claves en EN y ES:

- instrucción de apertura;
- etiqueta del botón móvil;
- título accesible del diálogo;
- placeholder de búsqueda;
- cerrar;
- acciones;
- redes sociales;
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

## 8. Plan de implementación

Cada fase termina en un estado comprobable. La paleta vieja permanece disponible
hasta que la nueva haya superado la paridad funcional.

### Fase 0 — Congelar el contrato actual

1. Registrar el tamaño del build actual: 54.41 kB / 17.55 kB gzip.
2. Capturar referencia visual en claro/oscuro y desktop/móvil.
3. Convertir la lista de §4 en checklist de paridad.
4. Confirmar el comportamiento de impresión antes de tocar la integración.

**Salida:** baseline reproducible para comparar, no una impresión subjetiva.

### Fase 1 — Markup y datos

1. Crear `CommandPalette.astro` junto al componente actual.
2. Definir el modelo de comandos y generar las seis acciones.
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
4. Añadir entrada/salida y `prefers-reduced-motion`.
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
3. Revisar manualmente con VoiceOver en Safari.
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

Ejecutar cada caso en `/en/` y `/es/` cuando aplique:

#### Apertura y cierre

- `Meta+K` y `Control+K` abren exactamente un diálogo.
- La búsqueda recibe foco y el primer comando queda activo.
- Repetir el atajo cierra sin duplicar estado.
- `Escape`, botón de cierre y backdrop cierran.
- El foco vuelve al disparador original.
- El botón móvil abre sin sintetizar eventos de teclado.

#### Búsqueda

- Coincidencias por título, grupo y keyword.
- Búsqueda insensible a mayúsculas y diacríticos.
- Varios tokens usan semántica AND.
- Un filtro conserva orden y grupos correctos.
- Cero coincidencias muestra el estado localizado.
- Limpiar el input restaura todos los comandos y la primera selección.

#### Navegación

- Flechas avanzan, retroceden y envuelven extremos.
- `Home`/`End` saltan a los extremos visibles.
- `Enter` ejecuta solo el comando activo.
- La selección nunca apunta a un elemento filtrado.
- `aria-activedescendant` y `aria-selected` permanecen sincronizados.

#### Acciones

- Imprimir llama una vez a `window.print()` después de cerrar.
- Tema cambia `data-theme`, persiste en `localStorage` y actualiza el label.
- Idioma apunta al locale opuesto.
- Redes conservan sus URLs, pestaña nueva y `noopener noreferrer`.

#### Resiliencia

- Abrir/cerrar repetidamente no duplica listeners ni nodos.
- Un evento `repeat` o de composición IME no dispara acciones.
- No se intercepta `Cmd/Ctrl + K` en un input ajeno.
- La paleta permanece oculta en media `print`.
- No hay overflow horizontal a 320 px.
- Con reduced motion no se esperan animaciones.

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

- VoiceOver anuncia diálogo, búsqueda, grupos, resultado activo y cantidad.
- El fondo no es navegable mientras el modal está abierto.
- El orden de foco es lógico y nunca se pierde.
- El foco visible alcanza al menos el equivalente de WCAG 2.2 AA.
- Contraste de texto, selección y foco cumple AA en ambos temas.
- Zoom al 200 % no pierde acciones ni controles.

### Compatibilidad objetivo

Últimas dos versiones estables de Chrome, Safari y Firefox, más Safari móvil.
No se añadirá un polyfill de `<dialog>`: el sitio prioriza navegadores modernos
y una dependencia para navegadores obsoletos contradiría el objetivo.

## 10. Archivos previstos

### Nuevos

- `src/components/CommandPalette.astro`
- `src/lib/commandPalette.ts`
- iconos Astro que no existan todavía
- `tests/command-palette/command-palette.spec.ts`

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
- `AGENTS.md` y documentación equivalente que describa la integración anterior

### Eliminado

- `src/components/KeyboardManager.astro`

## 11. Definición de terminado

La migración está terminada únicamente cuando:

- [ ] La paleta abre con teclado y botón en todos los breakpoints.
- [ ] Las seis acciones funcionan en EN y ES.
- [ ] Búsqueda, selección, estado vacío y anuncios son correctos.
- [ ] El foco entra, permanece y regresa de forma determinista.
- [ ] Claro, oscuro, reduced motion y print funcionan sin excepciones.
- [ ] No existen atajos globales que colisionen con el navegador.
- [ ] Los perfiles siguen derivados de los JSON del CV.
- [ ] Playwright cubre interacción y las pruebas de impresión siguen pasando.
- [ ] `pnpm i18n:check` pasa.
- [ ] `pnpm build` pasa sin warnings atribuibles a la paleta.
- [ ] El presupuesto de ≤ 8 kB minificado / ≤ 3 kB gzip se cumple.
- [ ] `ninja-keys` no aparece en dependencias, lockfile, código ni documentación.
- [ ] El preview de Vercel fue validado en desktop y móvil antes del merge.

## 12. Fuera de alcance

- Submenús o comandos anidados.
- Acciones remotas o cargadas desde una API.
- Historial, favoritos o comandos recientes.
- Una librería fuzzy-search.
- Analytics de comandos.
- Atajos globales configurables por el visitante.
- Convertir el componente en una librería reutilizable.
- Cambios al contenido del CV o nuevas secciones.

## 13. Rollback

La implementación se desarrollará junto a la actual y el cambio de import será
el último paso funcional. Si el preview detecta una regresión crítica, se
restaura el import de `KeyboardManager.astro` y se conserva temporalmente
`ninja-keys`. La dependencia solo se elimina después de completar QA, por lo
que el rollback previo al merge no requiere reconstruir código perdido.
