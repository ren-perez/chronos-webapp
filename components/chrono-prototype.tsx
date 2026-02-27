"use client"

import { useEffect, useCallback, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useDeviceState } from "@/hooks/use-device-state"
import { DeviceEnclosure } from "./device-enclosure"
import { TrackerDashboard } from "./tracker-dashboard"
import { OledDisplay } from "./oled-display"
import { PopupTimerView } from "./popup-timer-view"
import {
  ChevronUp,
  ChevronDown,
  CircleDot,
  Grip,
  HelpCircle,
  X,
  Monitor,
  Moon,
  Sun,
} from "lucide-react"
import { StyleSelector, COLOR_PRESETS, FONT_PRESETS } from "./style-selector"
import type { ColorKey, FontKey } from "./style-selector"

export function ChronoPrototype() {
  const {
    state,
    rotate,
    click,
    holdStart,
    holdEnd,
    charBackspace,
    addTask,
    renameTask,
    deleteTask,
    toggleTaskMode,
    setTimerDuration,
    restartTask,
    stopTask,
    deleteSession,
    addSplit,
    setActiveSplit,
    renameSplit,
    deleteSplit,
    deleteSplitSession,
    webPlayPause,
    getMenuItems,
  } = useDeviceState()

  const holdKeyRef = useRef(false)
  const [showDevice, setShowDevice] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [theme, setTheme] = useState<"dark" | "light">("dark")
  const [accentColor, setAccentColor] = useState<ColorKey>("amber")
  const [displayFont, setDisplayFont] = useState<FontKey>("default")
  const [mounted, setMounted] = useState(false)
  const [pipWindow, setPipWindow] = useState<Window | null>(null)

  useEffect(() => {
    setMounted(true)
    const savedTheme = localStorage.getItem("chronos-theme") as "dark" | "light" | null
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches
    const initialTheme = savedTheme || (prefersDark ? "dark" : "light")
    setTheme(initialTheme)
    document.documentElement.setAttribute("data-theme", initialTheme)

    const savedColor = localStorage.getItem("chronos-color") as ColorKey | null
    if (savedColor && savedColor in COLOR_PRESETS) setAccentColor(savedColor)

    const savedFont = localStorage.getItem("chronos-font") as FontKey | null
    if (savedFont && savedFont in FONT_PRESETS) setDisplayFont(savedFont)
  }, [])

  // Apply accent color CSS variables when color or theme changes
  useEffect(() => {
    if (!mounted) return
    const preset = COLOR_PRESETS[accentColor]
    const values = theme === "dark" ? preset.dark : preset.light
    const root = document.documentElement
    root.style.setProperty("--chronos-accent", values.accent)
    root.style.setProperty("--chronos-accent-foreground", values.foreground)
    root.style.setProperty("--chronos-glow", values.glow)
    root.style.setProperty("--ring", values.accent)

    // Sync CSS variables to PiP window if open
    if (pipWindow && !pipWindow.closed) {
      const pipRoot = pipWindow.document.documentElement
      pipRoot.style.setProperty("--chronos-accent", values.accent)
      pipRoot.style.setProperty("--chronos-accent-foreground", values.foreground)
      pipRoot.style.setProperty("--chronos-glow", values.glow)
    }
  }, [accentColor, theme, mounted, pipWindow])

  // Apply display font CSS variable when font changes
  useEffect(() => {
    if (!mounted) return
    const preset = FONT_PRESETS[displayFont]
    const root = document.documentElement
    if (preset.family) {
      root.style.setProperty("--font-timer", preset.family)
      if (pipWindow && !pipWindow.closed) {
        pipWindow.document.documentElement.style.setProperty("--font-timer", preset.family)
      }
    } else {
      root.style.removeProperty("--font-timer")
      if (pipWindow && !pipWindow.closed) {
        pipWindow.document.documentElement.style.removeProperty("--font-timer")
      }
    }
  }, [displayFont, mounted, pipWindow])

  const handleColorChange = (color: ColorKey) => {
    setAccentColor(color)
    localStorage.setItem("chronos-color", color)
  }

  const handleFontChange = (font: FontKey) => {
    setDisplayFont(font)
    localStorage.setItem("chronos-font", font)
  }

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark"
    setTheme(newTheme)
    localStorage.setItem("chronos-theme", newTheme)
    document.documentElement.setAttribute("data-theme", newTheme)
    if (pipWindow && !pipWindow.closed) {
      pipWindow.document.documentElement.setAttribute("data-theme", newTheme)
    }
  }

  // Open the timer as a floating popup (Document PiP API, or window.open fallback)
  const openPopout = useCallback(async () => {
    // Close existing PiP window if already open
    if (pipWindow && !pipWindow.closed) {
      pipWindow.close()
      setPipWindow(null)
      return
    }

    const hasPip = "documentPictureInPicture" in window

    if (hasPip) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pip = await (window as any).documentPictureInPicture.requestWindow({
          width: 320,
          height: 200,
          disallowReturnToOpener: false,
        })

        // Copy all stylesheets and style tags into the PiP document
        document.querySelectorAll('link[rel="stylesheet"], style').forEach((el) => {
          pip.document.head.appendChild(el.cloneNode(true))
        })

        // Copy theme data-attribute and class list
        const dataTheme = document.documentElement.getAttribute("data-theme")
        if (dataTheme) pip.document.documentElement.setAttribute("data-theme", dataTheme)
        pip.document.documentElement.className = document.documentElement.className

        // Copy inline CSS variables (theme + accent)
        const rootStyle = document.documentElement.getAttribute("style")
        if (rootStyle) pip.document.documentElement.setAttribute("style", rootStyle)

        setPipWindow(pip)
        pip.addEventListener("pagehide", () => setPipWindow(null))
        return
      } catch {
        // Fall through to window.open
      }
    }

    // Fallback: open a regular small popup window
    window.open(
      "/popup",
      "chronos-popup",
      "width=340,height=220,popup=1,resizable=yes"
    )
  }, [pipWindow])

  const holdKeyRef2 = useRef(false)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return
      if (e.repeat && e.key !== "r") return

      switch (e.key) {
        case "ArrowUp":
        case "ArrowLeft":
          e.preventDefault()
          rotate(-1)
          break
        case "ArrowDown":
        case "ArrowRight":
          e.preventDefault()
          rotate(1)
          break
        case "Enter":
        case " ":
          e.preventDefault()
          click()
          break
        case "Backspace":
          e.preventDefault()
          charBackspace()
          break
        case "r":
        case "R":
          if (!holdKeyRef2.current) {
            holdKeyRef2.current = true
            holdStart()
          }
          break
      }
    },
    [rotate, click, holdStart, charBackspace]
  )

  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "r" || e.key === "R") {
        holdKeyRef2.current = false
        holdEnd()
      }
    },
    [holdEnd]
  )

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("keyup", handleKeyUp)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("keyup", handleKeyUp)
    }
  }, [handleKeyDown, handleKeyUp])

  if (!mounted) return null

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border sticky top-0 z-40 bg-background/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-chronos-accent flex items-center justify-center">
              <CircleDot className="w-3.5 h-3.5 text-chronos-accent-foreground" />
            </div>
            <h1 className="text-sm font-mono font-semibold text-foreground tracking-wide">Chronos</h1>
          </div>
          <div className="flex items-center gap-1.5">
            <StyleSelector
              color={accentColor}
              font={displayFont}
              onColorChange={handleColorChange}
              onFontChange={handleFontChange}
            />
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg hover:bg-accent transition-colors active:scale-95"
              aria-label="Toggle theme"
              title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            >
              {theme === "dark" ? <Sun className="w-4 h-4 text-muted-foreground" /> : <Moon className="w-4 h-4 text-muted-foreground" />}
            </button>
            <button
              onClick={() => setShowDevice(!showDevice)}
              className={`p-2 rounded-lg hover:bg-accent transition-colors active:scale-95 hidden lg:flex items-center gap-1.5 ${showDevice ? "bg-accent" : ""}`}
              aria-label={showDevice ? "Hide device" : "Show device"}
            >
              <Monitor className="w-4 h-4 text-muted-foreground" />
            </button>
            <button
              onClick={() => setShowHelp(!showHelp)}
              className="p-2 rounded-lg hover:bg-accent transition-colors active:scale-95"
              aria-label="Show help"
            >
              <HelpCircle className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Dashboard - Primary view */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <TrackerDashboard
              state={state}
              timerFont={displayFont}
              onWebPlayPause={webPlayPause}
              onAddTask={addTask}
              onRenameTask={renameTask}
              onDeleteTask={deleteTask}
              onToggleMode={toggleTaskMode}
              onSetTimerDuration={setTimerDuration}
              onRestart={restartTask}
              onStop={stopTask}
              onDeleteSession={deleteSession}
              onAddSplit={addSplit}
              onSetActiveSplit={setActiveSplit}
              onRenameSplit={renameSplit}
              onDeleteSplit={deleteSplit}
              onDeleteSplitSession={deleteSplitSession}
              onPopout={openPopout}
              isPopoutOpen={!!pipWindow && !pipWindow.closed}
            />
          </div>
        </div>

        {/* Device preview - Secondary, desktop only */}
        {showDevice && (
          <div className="hidden lg:flex border-l border-border bg-card/30 w-96 flex-col items-center justify-start p-6 overflow-y-auto">
            <div className="flex flex-col gap-6 w-full">
              {/* OLED at 2x scale */}
              <DeviceEnclosure
                state={state}
                onRotate={rotate}
                onClick={click}
                onHoldStart={holdStart}
                onHoldEnd={holdEnd}
                scale={2}
                getMenuItems={getMenuItems}
                label=""
              />

              {/* Device Controls */}
              <div className="rounded-lg border border-border bg-card p-4">
                <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block mb-3">
                  {"Controls"}
                </span>
                <div className="flex flex-col gap-2 text-[11px] font-mono text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 px-2 py-1 rounded-md border border-border bg-background/50">
                      <ChevronUp className="w-3 h-3" />
                      <ChevronDown className="w-3 h-3" />
                    </div>
                    <span>{"Rotate"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-7 h-7 rounded-md border border-border bg-background/50">
                      <CircleDot className="w-3 h-3" />
                    </div>
                    <span>{"Click/Select"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center justify-center w-7 h-7 rounded-md border border-border bg-background/50 text-[10px] font-bold">
                      R
                    </div>
                    <span>{"Hold to reset"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Document PiP portal — renders live timer view inside the floating pip window */}
      {pipWindow && !pipWindow.closed && createPortal(
        <PopupTimerView
          tasks={state.tasks}
          onPlayPause={webPlayPause}
          onStop={stopTask}
        />,
        pipWindow.document.body
      )}

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl max-w-lg w-full max-h-[80vh] overflow-y-auto animate-fade-in">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-mono font-bold text-foreground">Keyboard Shortcuts</h2>
                <button
                  onClick={() => setShowHelp(false)}
                  className="p-1 rounded-md hover:bg-accent transition-colors"
                  aria-label="Close help"
                >
                  <X className="w-4 h-4 text-foreground" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex items-center gap-1 px-2 py-1 rounded-md border border-border text-[10px] font-mono bg-background/50 shrink-0">
                      <span>↑</span>
                      <span>/</span>
                      <span>↓</span>
                    </div>
                    <span className="text-sm text-foreground">Rotate encoder</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex items-center justify-center w-7 h-7 rounded-md border border-border text-[10px] font-mono bg-background/50 shrink-0">
                      ↵
                    </div>
                    <span className="text-sm text-foreground">Click/Select</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex items-center justify-center w-7 h-7 rounded-md border border-border text-[10px] font-mono bg-background/50 shrink-0">
                      R
                    </div>
                    <span className="text-sm text-foreground">Hold to reset</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex items-center justify-center w-7 h-7 rounded-md border border-border text-[10px] font-mono bg-background/50 shrink-0">
                      ⌫
                    </div>
                    <span className="text-sm text-foreground">Backspace in char picker</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  Use the device preview or keyboard shortcuts to navigate the OLED interface. Click "Device" in the header to toggle the device preview.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
