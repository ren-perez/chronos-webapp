"use client"

import type { DeviceState, Task } from "@/hooks/use-device-state"
import { OledDisplay } from "./oled-display"

interface DeviceEnclosureProps {
  state: DeviceState
  scale: number
  onRotate: (dir: 1 | -1) => void
  onClick: () => void
  onHoldStart: () => void
  onHoldEnd: () => void
  label: string
  getMenuItems?: (task: Task | undefined) => { label: string; action: string }[]
}

export function DeviceEnclosure({
  state,
  scale,
  onRotate,
  onClick,
  onHoldStart,
  onHoldEnd,
  label,
  getMenuItems,
}: DeviceEnclosureProps) {
  const screenWidth = 128 * scale
  const screenHeight = 64 * scale
  const paddingX = Math.max(24, 16 * scale)
  const paddingY = Math.max(20, 12 * scale)
  const totalWidth = screenWidth + paddingX * 2
  const totalHeight = screenHeight + paddingY * 2 + 40 * scale

  return (
    <div className="flex flex-col items-center gap-4">
      <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
        {label}
      </span>

      <div
        className="relative flex flex-col items-center justify-start rounded-2xl"
        style={{
          width: totalWidth,
          height: totalHeight,
          background:
            "linear-gradient(145deg, hsl(0 0% 10%), hsl(0 0% 6%))",
          boxShadow: `
            0 1px 0 hsl(0 0% 16%) inset,
            0 -1px 0 hsl(0 0% 4%) inset,
            0 20px 60px -15px rgba(0,0,0,0.7),
            0 0 0 1px hsl(0 0% 12%)
          `,
          paddingTop: paddingY,
        }}
      >
        <div
          className="rounded"
          style={{
            padding: Math.max(2, 1 * scale),
            background: "hsl(0 0% 3%)",
            boxShadow: "inset 0 1px 3px rgba(0,0,0,0.5)",
          }}
        >
          <OledDisplay state={state} scale={scale} getMenuItems={getMenuItems} />
        </div>

        <div
          className="absolute flex items-center justify-center"
          style={{
            bottom: 8 * scale,
            left: "50%",
            transform: "translateX(-50%)",
          }}
        >
          <RotaryEncoder
            size={Math.max(20, 16 * scale)}
            onRotateLeft={() => onRotate(-1)}
            onRotateRight={() => onRotate(1)}
            onClick={onClick}
            onHoldStart={onHoldStart}
            onHoldEnd={onHoldEnd}
          />
        </div>
      </div>
    </div>
  )
}

function RotaryEncoder({
  size,
  onRotateLeft,
  onRotateRight,
  onClick,
  onHoldStart,
  onHoldEnd,
}: {
  size: number
  onRotateLeft: () => void
  onRotateRight: () => void
  onClick: () => void
  onHoldStart: () => void
  onHoldEnd: () => void
}) {
  const holdTimerRef = { current: null as ReturnType<typeof setTimeout> | null }

  const handleMouseDown = () => {
    holdTimerRef.current = setTimeout(() => {
      onHoldStart()
      holdTimerRef.current = null
    }, 400)
  }

  const handleMouseUp = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
      onClick()
    } else {
      onHoldEnd()
    }
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    if (e.deltaY > 0) onRotateRight()
    else onRotateLeft()
  }

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="rounded-full cursor-pointer select-none"
        style={{
          width: size,
          height: size,
          background:
            "radial-gradient(circle at 40% 35%, hsl(0 0% 22%), hsl(0 0% 8%))",
          boxShadow: `
            0 1px 0 hsl(0 0% 25%) inset,
            0 -1px 0 hsl(0 0% 5%) inset,
            0 2px 8px rgba(0,0,0,0.5)
          `,
          border: "1px solid hsl(0 0% 14%)",
        }}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          if (holdTimerRef.current) {
            clearTimeout(holdTimerRef.current)
            holdTimerRef.current = null
          } else {
            onHoldEnd()
          }
        }}
        onTouchStart={handleMouseDown}
        onTouchEnd={(e) => {
          e.preventDefault()
          handleMouseUp()
        }}
        onWheel={handleWheel}
        role="button"
        tabIndex={0}
        aria-label="Rotary encoder. Scroll to rotate, click to select, hold for menu."
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
            e.preventDefault()
            onRotateLeft()
          }
          if (e.key === "ArrowDown" || e.key === "ArrowRight") {
            e.preventDefault()
            onRotateRight()
          }
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            onClick()
          }
        }}
      >
        <div className="w-full h-full flex items-center justify-center">
          <div
            className="rounded-full"
            style={{
              width: size * 0.3,
              height: size * 0.3,
              border: `1px solid hsl(0 0% 18%)`,
            }}
          />
        </div>
      </div>
    </div>
  )
}
