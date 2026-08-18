import { toggleTheme } from "./theme"

/**
 * Deterministic search normalization shared by the server-rendered
 * `data-search` indexes and the runtime query: NFD, no diacritics,
 * locale lowercase, collapsed whitespace.
 */
export function normalizeSearchText(value: string, locale = "en"): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase(locale)
    .replace(/\s+/g, " ")
    .trim()
}

export function initCommandPalette(root: HTMLElement): () => void {
  if (root.dataset.paletteReady === "true") return () => {}

  const dialog = root.querySelector<HTMLDialogElement>("dialog")
  const input = root.querySelector<HTMLInputElement>("input[type='search']")
  const listbox = root.querySelector<HTMLElement>("[role='listbox']")
  const emptyState = root.querySelector<HTMLElement>("[data-palette-empty]")
  const liveRegion = root.querySelector<HTMLElement>("[data-palette-count]")
  const closeButton = root.querySelector<HTMLButtonElement>(
    "[data-palette-close]",
  )
  const trigger = root.querySelector<HTMLButtonElement>(
    "[data-palette-trigger]",
  )
  const paletteKeyHint = root.querySelector<HTMLElement>("[data-palette-key]")
  if (!dialog || !input || !listbox) return () => {}

  root.dataset.paletteReady = "true"

  const locale = root.dataset.locale ?? document.documentElement.lang ?? "en"
  const options = Array.from(
    root.querySelectorAll<HTMLElement>("[role='option']"),
  )
  const shortcuts = new Map<string, HTMLElement>()
  for (const option of options) {
    const shortcut = option.dataset.shortcut?.toLocaleLowerCase(locale)
    if (!shortcut) continue
    if (shortcuts.has(shortcut)) {
      console.warn(`Duplicate command-palette shortcut: ${shortcut}`)
      continue
    }
    shortcuts.set(shortcut, option)
  }
  const groups = Array.from(root.querySelectorAll<HTMLElement>("[data-group]"))
  const controller = new AbortController()
  const { signal } = controller

  let visible = options
  let activeIndex = 0
  let opener: HTMLElement | null = null
  let backdropArmed = false
  let viewportSyncFrame: number | null = null

  const visualViewport = window.visualViewport

  const syncVisualViewport = () => {
    viewportSyncFrame = null

    const height = visualViewport?.height ?? window.innerHeight
    const width = visualViewport?.width ?? window.innerWidth
    const offsetTop = visualViewport?.offsetTop ?? 0
    const offsetLeft = visualViewport?.offsetLeft ?? 0
    const coveredBottom = Math.max(
      0,
      window.innerHeight - offsetTop - height,
    )
    const coveredRight = Math.max(
      0,
      window.innerWidth - offsetLeft - width,
    )

    dialog.style.setProperty("--palette-vv-height", `${height}px`)
    dialog.style.setProperty("--palette-vv-bottom", `${coveredBottom}px`)
    dialog.style.setProperty("--palette-vv-left", `${offsetLeft}px`)
    dialog.style.setProperty("--palette-vv-right", `${coveredRight}px`)
  }

  const scheduleVisualViewportSync = () => {
    if (!dialog.open) return
    if (viewportSyncFrame !== null)
      cancelAnimationFrame(viewportSyncFrame)
    viewportSyncFrame = requestAnimationFrame(syncVisualViewport)
  }

  window.addEventListener("resize", scheduleVisualViewportSync, { signal })
  visualViewport?.addEventListener("resize", scheduleVisualViewportSync, {
    signal,
  })
  visualViewport?.addEventListener("scroll", scheduleVisualViewportSync, {
    signal,
  })

  const isApplePlatform = /mac|iphone|ipad|ipod/i.test(
    navigator.platform ?? "",
  )
  if (paletteKeyHint)
    paletteKeyHint.textContent = isApplePlatform ? "⌘ K" : "Ctrl K"

  const setShowActive = (value: boolean) => {
    root.dataset.showActive = value ? "true" : "false"
  }

  const setActive = (index: number, { scroll = true } = {}) => {
    activeIndex = index
    for (const option of options) option.setAttribute("aria-selected", "false")

    const active = visible[index]
    if (!active) {
      input.removeAttribute("aria-activedescendant")
      return
    }

    active.setAttribute("aria-selected", "true")
    input.setAttribute("aria-activedescendant", active.id)
    if (scroll) active.scrollIntoView({ block: "nearest" })
  }

  const announce = (count: number) => {
    if (!liveRegion) return
    const { empty = "", resultsMany = "", resultsOne = "" } = root.dataset
    liveRegion.textContent =
      count === 0
        ? empty
        : count === 1
          ? resultsOne
          : resultsMany.replace("%d", String(count))
  }

  const filter = (query: string) => {
    const tokens = normalizeSearchText(query, locale)
      .split(" ")
      .filter(Boolean)

    visible = options.filter((option) => {
      const haystack = option.dataset.search ?? ""
      const matches = tokens.every((token) => haystack.includes(token))
      option.hidden = !matches
      return matches
    })

    for (const group of groups) {
      group.hidden = !Array.from(
        group.querySelectorAll<HTMLElement>("[role='option']"),
      ).some((option) => !option.hidden)
    }

    if (emptyState) emptyState.hidden = visible.length > 0
    announce(visible.length)
    setActive(0)
  }

  const open = (
    from: HTMLElement | null,
    { focusSearch = true, showActive = true } = {},
  ) => {
    if (dialog.open) return
    opener = from
    setShowActive(showActive)
    syncVisualViewport()

    // `showModal()` focuses the first form control by default. Disabling the
    // search for this synchronous step prevents a touch-triggered open from
    // summoning the virtual keyboard before the user asks to search.
    if (!focusSearch) input.disabled = true
    try {
      dialog.showModal()
    } finally {
      input.disabled = false
    }

    document.documentElement.style.overflow = "hidden"
    input.value = ""
    filter("")
    scheduleVisualViewportSync()

    if (focusSearch) {
      input.focus()
    } else {
      dialog.focus({ preventScroll: true })
    }
  }

  const close = () => {
    if (dialog.open) dialog.close()
  }

  const runCommand = (option: HTMLElement) => {
    const command = option.dataset.command

    if (command === "print") {
      close()
      requestAnimationFrame(() =>
        requestAnimationFrame(() => window.print()),
      )
      return
    }

    if (command === "theme") {
      // The palette stays open: the option label flips via CSS to name the
      // new destination, which doubles as immediate visual feedback.
      toggleTheme()
      return
    }

    // Language switch and external profiles are real anchors; a native
    // click preserves href, target, and rel semantics. The click listener
    // below closes the dialog without cancelling the navigation.
    if (option instanceof HTMLAnchorElement) option.click()
  }

  input.addEventListener(
    "input",
    () => {
      setShowActive(true)
      filter(input.value)
    },
    { signal },
  )

  input.addEventListener("focus", scheduleVisualViewportSync, { signal })

  input.addEventListener(
    "keydown",
    (event) => {
      if (event.isComposing) return

      if (event.key === "Escape") {
        // Without this, a search input with text consumes the first Escape
        // to clear itself and only a second one closes the dialog.
        event.preventDefault()
        close()
        return
      }

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault()
        if (visible.length === 0) return
        setShowActive(true)
        const delta = event.key === "ArrowDown" ? 1 : -1
        setActive((activeIndex + delta + visible.length) % visible.length)
        return
      }

      if (event.key === "Home" || event.key === "End") {
        if (visible.length === 0) return
        event.preventDefault()
        setShowActive(true)
        setActive(event.key === "Home" ? 0 : visible.length - 1)
        return
      }

      if (event.key === "Enter") {
        event.preventDefault()
        if (event.repeat) return
        const active = visible[activeIndex]
        if (active) runCommand(active)
      }
    },
    { signal },
  )

  for (const option of options) {
    option.addEventListener(
      "click",
      (event) => {
        if (option instanceof HTMLAnchorElement) {
          // Let the native anchor behavior run; just dismiss the palette.
          close()
          return
        }
        event.preventDefault()
        runCommand(option)
      },
      { signal },
    )
    option.addEventListener(
      "pointermove",
      () => {
        if (option.hidden) return
        setShowActive(true)
        const index = visible.indexOf(option)
        if (index >= 0 && index !== activeIndex)
          setActive(index, { scroll: false })
      },
      { signal },
    )
  }

  closeButton?.addEventListener("click", close, { signal })
  trigger?.addEventListener(
    "click",
    () => open(trigger, { focusSearch: false, showActive: false }),
    { signal },
  )

  const isOutsidePanel = (event: PointerEvent) => {
    if (event.target !== dialog) return false
    const rect = dialog.getBoundingClientRect()
    return (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    )
  }

  dialog.addEventListener(
    "pointerdown",
    (event) => {
      backdropArmed = isOutsidePanel(event)
    },
    { signal },
  )
  dialog.addEventListener(
    "pointerup",
    (event) => {
      if (backdropArmed && isOutsidePanel(event)) close()
      backdropArmed = false
    },
    { signal },
  )

  dialog.addEventListener(
    "close",
    () => {
      backdropArmed = false
      if (viewportSyncFrame !== null) {
        cancelAnimationFrame(viewportSyncFrame)
        viewportSyncFrame = null
      }
      document.documentElement.style.overflow = ""
      dialog.style.removeProperty("--palette-vv-height")
      dialog.style.removeProperty("--palette-vv-bottom")
      dialog.style.removeProperty("--palette-vv-left")
      dialog.style.removeProperty("--palette-vv-right")
      opener?.focus()
      opener = null
    },
    { signal },
  )

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.defaultPrevented || event.isComposing || event.repeat) return

      const target = event.target
      const inEditable =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement)

      const key = event.key.toLocaleLowerCase(locale)
      const hasOnePaletteModifier = event.metaKey !== event.ctrlKey
      if (
        key === "k" &&
        hasOnePaletteModifier &&
        !event.altKey &&
        !event.shiftKey
      ) {
        if (!dialog.open && inEditable && !root.contains(target)) return
        event.preventDefault()
        if (dialog.open) {
          close()
        } else {
          open(null)
        }
        return
      }

      // Internal shortcuts are deliberately scoped to the open palette. This
      // preserves browser and editing shortcuts everywhere else, while Ctrl
      // (⌃ on Mac) selects the visible commands inside the palette.
      if (!dialog.open) return
      if (!event.ctrlKey || event.metaKey || event.altKey || event.shiftKey)
        return

      const option = shortcuts.get(key)
      if (!option) return

      event.preventDefault()
      runCommand(option)
    },
    { signal },
  )

  return () => {
    if (viewportSyncFrame !== null) cancelAnimationFrame(viewportSyncFrame)
    controller.abort()
    delete root.dataset.paletteReady
  }
}
