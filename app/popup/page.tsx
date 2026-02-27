"use client"

import { useEffect, useState } from "react"
import { useDeviceState } from "@/hooks/use-device-state"
import { PopupTimerView } from "@/components/popup-timer-view"
import { COLOR_PRESETS, FONT_PRESETS } from "@/components/style-selector"
import type { ColorKey, FontKey } from "@/components/style-selector"

export default function PopupPage() {
  const { state, webPlayPause, stopTask } = useDeviceState()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    document.title = "Chronos — Timer"

    // Apply theme from main window's localStorage
    const savedTheme = (localStorage.getItem("chronos-theme") as "dark" | "light") ?? "dark"
    document.documentElement.setAttribute("data-theme", savedTheme)

    const savedColor = (localStorage.getItem("chronos-color") as ColorKey) ?? "amber"
    const preset = COLOR_PRESETS[savedColor] ?? COLOR_PRESETS.amber
    const values = savedTheme === "dark" ? preset.dark : preset.light
    const root = document.documentElement
    root.style.setProperty("--chronos-accent", values.accent)
    root.style.setProperty("--chronos-accent-foreground", values.foreground)
    root.style.setProperty("--chronos-glow", values.glow)
    root.style.setProperty("--ring", values.accent)

    const savedFont = (localStorage.getItem("chronos-font") as FontKey) ?? "default"
    const fontPreset = FONT_PRESETS[savedFont]
    if (fontPreset?.family) {
      root.style.setProperty("--font-timer", fontPreset.family)
    }
  }, [])

  if (!mounted) return null

  return (
    <div className="h-screen w-screen overflow-hidden bg-background">
      <PopupTimerView
        tasks={state.tasks}
        onPlayPause={webPlayPause}
        onStop={stopTask}
      />
    </div>
  )
}
