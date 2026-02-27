"use client"

import { useState, useRef, useEffect } from "react"
import { Palette } from "lucide-react"

export type ColorKey = "amber" | "rose" | "red" | "green" | "cyan" | "blue"
export type FontKey = "default" | "segment" | "orbitron"

interface StyleSelectorProps {
  color: ColorKey
  font: FontKey
  onColorChange: (color: ColorKey) => void
  onFontChange: (font: FontKey) => void
}

export const COLOR_PRESETS: Record<
  ColorKey,
  {
    label: string
    swatch: string
    light: { accent: string; foreground: string; glow: string }
    dark: { accent: string; foreground: string; glow: string }
  }
> = {
  amber: {
    label: "Amber",
    swatch: "#d4a574",
    light: { accent: "#c2884d", foreground: "#ffffff", glow: "rgba(194, 136, 77, 0.15)" },
    dark: { accent: "#d4a574", foreground: "#111113", glow: "rgba(212, 165, 116, 0.1)" },
  },
  rose: {
    label: "Rose",
    swatch: "#d4929e",
    light: { accent: "#c27088", foreground: "#ffffff", glow: "rgba(194, 112, 136, 0.15)" },
    dark: { accent: "#d4929e", foreground: "#111113", glow: "rgba(212, 146, 158, 0.1)" },
  },
  red: {
    label: "Red",
    swatch: "#d47474",
    light: { accent: "#c24d4d", foreground: "#ffffff", glow: "rgba(194, 77, 77, 0.15)" },
    dark: { accent: "#d47474", foreground: "#111113", glow: "rgba(212, 116, 116, 0.1)" },
  },
  green: {
    label: "Green",
    swatch: "#74b874",
    light: { accent: "#4d9a4d", foreground: "#ffffff", glow: "rgba(77, 154, 77, 0.15)" },
    dark: { accent: "#74b874", foreground: "#111113", glow: "rgba(116, 184, 116, 0.1)" },
  },
  cyan: {
    label: "Cyan",
    swatch: "#74c4c4",
    light: { accent: "#4d9a9a", foreground: "#ffffff", glow: "rgba(77, 154, 154, 0.15)" },
    dark: { accent: "#74c4c4", foreground: "#111113", glow: "rgba(116, 196, 196, 0.1)" },
  },
  blue: {
    label: "Blue",
    swatch: "#7498d4",
    light: { accent: "#4d6dc2", foreground: "#ffffff", glow: "rgba(77, 109, 194, 0.15)" },
    dark: { accent: "#7498d4", foreground: "#111113", glow: "rgba(116, 152, 212, 0.1)" },
  },
}

export const FONT_PRESETS: Record<FontKey, { label: string; family: string; preview: string }> = {
  default: { label: "Default", family: "", preview: "font-mono" },
  segment: { label: "Segment", family: "'DSEG14 Classic', monospace", preview: "" },
  orbitron: { label: "Orbitron", family: "var(--font-orbitron), sans-serif", preview: "" },
}

export function StyleSelector({ color, font, onColorChange, onFontChange }: StyleSelectorProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    document.addEventListener("keydown", handleKey)
    return () => {
      document.removeEventListener("mousedown", handleClick)
      document.removeEventListener("keydown", handleKey)
    }
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`p-2 rounded-lg hover:bg-accent transition-colors active:scale-95 ${open ? "bg-accent" : ""}`}
        aria-label="Style settings"
        title="Customize style"
      >
        <Palette className="w-4 h-4 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-60 rounded-xl border border-border bg-card shadow-lg animate-fade-in p-4">
          {/* Colors */}
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block mb-2.5">
            Color
          </span>
          <div className="flex items-center gap-2 mb-4">
            {(Object.keys(COLOR_PRESETS) as ColorKey[]).map((key) => (
              <button
                key={key}
                onClick={() => onColorChange(key)}
                className={`w-7 h-7 rounded-full transition-all active:scale-95 ${
                  color === key
                    ? "ring-2 ring-foreground ring-offset-2 ring-offset-card scale-110"
                    : "hover:scale-110"
                }`}
                style={{ backgroundColor: COLOR_PRESETS[key].swatch }}
                aria-label={COLOR_PRESETS[key].label}
                title={COLOR_PRESETS[key].label}
              />
            ))}
          </div>

          {/* Fonts */}
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground block mb-2.5">
            Font
          </span>
          <div className="flex flex-col gap-1.5">
            {(Object.keys(FONT_PRESETS) as FontKey[]).map((key) => {
              const preset = FONT_PRESETS[key]
              const fontStyle = preset.family ? { fontFamily: preset.family } : undefined
              return (
                <button
                  key={key}
                  onClick={() => onFontChange(key)}
                  className={`flex items-center justify-between text-xs px-3 py-2 rounded-lg border transition-all active:scale-[0.98] ${
                    font === key
                      ? "border-chronos-accent bg-chronos-accent/10 text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                >
                  <span className="font-mono">{preset.label}</span>
                  <span className="tabular-nums text-sm" style={fontStyle}>
                    12:34
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
