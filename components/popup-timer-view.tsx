"use client"

import { Play, Pause, Square } from "lucide-react"
import { formatElapsedCompact } from "@/lib/format-time"
import type { Task } from "@/hooks/use-device-state"

interface PopupTimerViewProps {
  tasks: Task[]
  onPlayPause: (id: string) => void
  onStop?: (id: string) => void
}

export function PopupTimerView({ tasks, onPlayPause, onStop }: PopupTimerViewProps) {
  const activeTasks = tasks.filter(
    (t) => t.status === "running" || (t.status === "paused" && t.elapsed > 0)
  )

  if (activeTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-background gap-2">
        <div className="w-8 h-8 rounded-full border-2 border-border flex items-center justify-center">
          <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <circle cx="12" cy="12" r="10" strokeWidth="2" />
            <path strokeLinecap="round" d="M12 6v6l4 2" strokeWidth="2" />
          </svg>
        </div>
        <span className="text-xs font-mono text-muted-foreground">No active timers</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2 p-3 bg-background h-full overflow-auto">
      {activeTasks.map((task) => {
        const isRunning = task.status === "running"
        const isTimer = task.mode === "timer"
        const display = isTimer ? Math.max(0, task.timerDuration - task.elapsed) : task.elapsed
        const isDone = isTimer && task.elapsed >= task.timerDuration
        const timerProgress = isTimer ? Math.min(1, task.elapsed / task.timerDuration) : 0

        return (
          <div
            key={task.id}
            className={`rounded-xl border p-3 transition-all ${
              isRunning
                ? "border-chronos-accent/40 shadow-[0_0_20px_var(--chronos-glow)]"
                : "border-border"
            }`}
          >
            {/* Status + name */}
            <div className="flex items-center gap-1.5 mb-2">
              {isRunning ? (
                <div className="w-1.5 h-1.5 rounded-full bg-chronos-accent animate-pulse-dot shrink-0" />
              ) : (
                <div className="w-1.5 h-1.5 rounded-full border border-muted-foreground shrink-0" />
              )}
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground truncate">
                {isDone ? "Complete" : isRunning ? "Running" : "Paused"} · {task.name}
              </span>
            </div>

            {/* Time + controls */}
            <div className="flex items-center justify-between gap-2">
              <span
                className={`font-timer text-3xl font-bold tabular-nums leading-none ${
                  isRunning ? "text-foreground" : "text-foreground/60"
                }`}
              >
                {formatElapsedCompact(isDone ? task.timerDuration : display)}
              </span>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => onPlayPause(task.id)}
                  className="flex items-center justify-center w-9 h-9 rounded-full bg-chronos-accent text-chronos-accent-foreground hover:opacity-90 active:scale-95 transition-all"
                  aria-label={isRunning ? "Pause" : "Play"}
                >
                  {isRunning ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4 ml-0.5" />
                  )}
                </button>
                {task.elapsed > 0 && onStop && (
                  <button
                    onClick={() => onStop(task.id)}
                    className="flex items-center justify-center w-7 h-7 rounded-full border border-border hover:bg-accent active:scale-95 transition-all"
                    aria-label="Stop"
                  >
                    <Square className="w-3 h-3 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>

            {/* Timer progress bar */}
            {isTimer && (
              <div className="mt-2.5 h-1 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full bg-chronos-accent transition-all duration-100"
                  style={{ width: `${timerProgress * 100}%` }}
                />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
