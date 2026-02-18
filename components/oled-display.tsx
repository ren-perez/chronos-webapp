"use client"

import { useEffect, useState } from "react"
import type { DeviceState, Task } from "@/hooks/use-device-state"
import { CHAR_SET } from "@/hooks/use-device-state"
import { formatElapsed, formatClock, formatClockSmall } from "@/lib/format-time"

interface OledDisplayProps {
  state: DeviceState
  scale?: number
  getMenuItems?: (task: Task | undefined) => { label: string; action: string }[]
}

function useCurrentTime() {
  const [time, setTime] = useState<Date | null>(null)
  useEffect(() => {
    setTime(new Date())
    const interval = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])
  return time
}

export function OledDisplay({ state, scale = 1, getMenuItems }: OledDisplayProps) {
  const now = useCurrentTime()
  const width = 128 * scale
  const height = 64 * scale

  return (
    <div
      className="oled-screen relative overflow-hidden"
      style={{ width, height, backgroundColor: "#000", borderRadius: 4 * scale }}
    >
      <div
        style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: 128, height: 64 }}
      >
        {!now ? (
          <div className="flex items-center justify-center h-full">
            <span className="font-mono" style={{ fontSize: 8, color: "#333" }}>
              {"BOOTING..."}
            </span>
          </div>
        ) : (
          <>
            {state.screen === "idle-clock" && <IdleClockScreen time={now} />}
            {state.screen === "task-list" && <TaskListScreen state={state} time={now} />}
            {state.screen === "task-active" && <TaskActiveScreen state={state} time={now} />}
            {state.screen === "task-paused" && <TaskPausedScreen state={state} time={now} />}
            {state.screen === "reset-confirm" && <ResetConfirmScreen state={state} />}
            {state.screen === "task-menu" && (
              <TaskMenuScreen state={state} time={now} getMenuItems={getMenuItems} />
            )}
            {state.screen === "char-picker" && <CharPickerScreen state={state} time={now} />}
            {state.screen === "confirm-delete" && <ConfirmDeleteScreen state={state} />}
          </>
        )}
      </div>
    </div>
  )
}

// --- IDLE CLOCK ---
function IdleClockScreen({ time }: { time: Date }) {
  const clockStr = formatClock(time)
  const dateStr = time.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })

  return (
    <div className="flex flex-col items-center justify-center h-full text-[#fff]">
      <span className="font-mono font-bold leading-none" style={{ fontSize: 22, letterSpacing: 1 }}>
        {clockStr}
      </span>
      <span className="font-mono leading-none mt-1" style={{ fontSize: 8, color: "#666" }}>
        {dateStr}
      </span>
      <div className="flex items-center gap-1 mt-2">
        <div className="rounded-full" style={{ width: 3, height: 3, backgroundColor: "#333" }} />
        <span style={{ fontSize: 6, color: "#333" }}>{"ROTATE TO WAKE"}</span>
        <div className="rounded-full" style={{ width: 3, height: 3, backgroundColor: "#333" }} />
      </div>
    </div>
  )
}

// --- TASK LIST ---
function TaskListScreen({ state, time }: { state: DeviceState; time: Date }) {
  const totalItems = state.tasks.length + 1
  const visibleCount = 4
  const startIdx = Math.max(0, Math.min(state.selectedIndex - 1, totalItems - visibleCount))
  const endIdx = Math.min(startIdx + visibleCount, totalItems)

  return (
    <div className="flex flex-col h-full text-[#fff]">
      <div
        className="flex items-center justify-between px-2"
        style={{ height: 11, borderBottom: "1px solid #222" }}
      >
        <span style={{ fontSize: 7, color: "#888" }}>{"TASKS"}</span>
        <span className="font-mono" style={{ fontSize: 7, color: "#555" }}>
          {formatClockSmall(time)}
        </span>
      </div>

      <div className="flex-1 flex flex-col" style={{ padding: "2px 0" }}>
        {Array.from({ length: endIdx - startIdx }, (_, i) => {
          const realIndex = startIdx + i
          const isNewTaskRow = realIndex >= state.tasks.length
          const isSelected = realIndex === state.selectedIndex

          if (isNewTaskRow) {
            return (
              <div
                key="new-task"
                className="flex items-center px-2"
                style={{
                  height: 12,
                  backgroundColor: isSelected ? "#fff" : "transparent",
                  color: isSelected ? "#000" : "#555",
                }}
              >
                <span className="font-mono" style={{ fontSize: 8 }}>
                  {"+ NEW TASK"}
                </span>
              </div>
            )
          }

          const task = state.tasks[realIndex]
          const isRunning = task.status === "running"
          const isPaused = task.status === "paused" && task.elapsed > 0
          const isTimer = task.mode === "timer"

          return (
            <div
              key={task.id}
              className="flex items-center justify-between px-2"
              style={{
                height: 12,
                backgroundColor: isSelected ? "#fff" : "transparent",
                color: isSelected ? "#000" : "#fff",
              }}
            >
              <div className="flex items-center gap-1">
                {isRunning && (
                  <div
                    className="animate-pulse-dot rounded-full"
                    style={{ width: 3, height: 3, backgroundColor: isSelected ? "#000" : "#fff" }}
                  />
                )}
                {isPaused && !isRunning && (
                  <div
                    style={{
                      width: 3,
                      height: 3,
                      border: `1px solid ${isSelected ? "#000" : "#666"}`,
                      borderRadius: "50%",
                    }}
                  />
                )}
                <span className="font-mono" style={{ fontSize: 8, fontWeight: isRunning ? 700 : 400 }}>
                  {task.name}
                </span>
                {isTimer && (
                  <span style={{ fontSize: 5, color: isSelected ? "#555" : "#444" }}>{"T"}</span>
                )}
              </div>
              {task.elapsed > 0 && (
                <span
                  className="font-mono"
                  style={{ fontSize: 7, color: isSelected ? "#333" : isRunning ? "#fff" : "#555" }}
                >
                  {formatElapsed(task.elapsed)}
                </span>
              )}
            </div>
          )
        })}
      </div>

      <div
        className="flex items-center justify-between px-2"
        style={{ height: 8, borderTop: "1px solid #222" }}
      >
        <span style={{ fontSize: 5, color: "#333" }}>{"CLK:START  HOLD:MENU"}</span>
        {totalItems > visibleCount && (
          <div className="flex gap-0.5">
            {Array.from({ length: totalItems }, (_, i) => (
              <div
                key={i}
                className="rounded-full"
                style={{ width: 2, height: 2, backgroundColor: i === state.selectedIndex ? "#fff" : "#333" }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// --- TASK ACTIVE ---
function TaskActiveScreen({ state, time }: { state: DeviceState; time: Date }) {
  const task = state.tasks[state.selectedIndex]
  if (!task) return null

  const isTimer = task.mode === "timer"
  const displayElapsed = isTimer ? Math.max(0, task.timerDuration - task.elapsed) : task.elapsed
  const sessionCount = task.sessions.length

  return (
    <div className="flex flex-col h-full text-[#fff]">
      <div
        className="flex items-center justify-between px-2"
        style={{ height: 11, borderBottom: "1px solid #222" }}
      >
        <div className="flex items-center gap-1">
          <div
            className="animate-pulse-dot rounded-full"
            style={{ width: 3, height: 3, backgroundColor: "#fff" }}
          />
          <span className="font-mono" style={{ fontSize: 7 }}>
            {task.name.toUpperCase()}
          </span>
        </div>
        <span className="font-mono" style={{ fontSize: 7, color: "#555" }}>
          {formatClockSmall(time)}
        </span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        <span className="font-mono font-bold leading-none" style={{ fontSize: 24, letterSpacing: 1 }}>
          {formatElapsed(displayElapsed)}
        </span>
        {isTimer && (
          <div className="mt-2" style={{ width: 80, height: 2, backgroundColor: "#222", borderRadius: 1 }}>
            <div
              style={{
                height: "100%",
                width: `${Math.min(100, (task.elapsed / task.timerDuration) * 100)}%`,
                backgroundColor: "#fff",
                borderRadius: 1,
              }}
            />
          </div>
        )}
      </div>

      <div
        className="flex items-center justify-between px-2"
        style={{ height: 10, borderTop: "1px solid #222" }}
      >
        <span style={{ fontSize: 6, color: "#444" }}>
          {isTimer ? "TIMER" : "STOPWATCH"}
        </span>
        <span style={{ fontSize: 6, color: "#333" }}>
          {`#${sessionCount}`}
        </span>
      </div>
    </div>
  )
}

// --- TASK PAUSED ---
function TaskPausedScreen({ state, time }: { state: DeviceState; time: Date }) {
  const task = state.tasks[state.selectedIndex]
  if (!task) return null

  const isTimer = task.mode === "timer"
  const displayElapsed = isTimer ? Math.max(0, task.timerDuration - task.elapsed) : task.elapsed
  const isDone = isTimer && task.elapsed >= task.timerDuration

  return (
    <div className="flex flex-col h-full text-[#fff]">
      <div
        className="flex items-center justify-between px-2"
        style={{ height: 11, borderBottom: "1px solid #333" }}
      >
        <div className="flex items-center gap-1">
          <PauseIcon />
          <span className="font-mono" style={{ fontSize: 7, color: "#888" }}>
            {task.name.toUpperCase()}
          </span>
        </div>
        <span className="font-mono" style={{ fontSize: 7, color: "#555" }}>
          {formatClockSmall(time)}
        </span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        {isDone ? (
          <>
            <span className="font-mono font-bold" style={{ fontSize: 10, letterSpacing: 2 }}>
              {"COMPLETE"}
            </span>
            <span className="font-mono" style={{ fontSize: 7, color: "#555", marginTop: 4 }}>
              {formatElapsed(task.timerDuration)}
            </span>
          </>
        ) : (
          <span
            className="font-mono font-bold leading-none"
            style={{ fontSize: 24, letterSpacing: 1, color: "#888" }}
          >
            {formatElapsed(displayElapsed)}
          </span>
        )}
      </div>

      <div
        className="flex items-center justify-between px-2"
        style={{ height: 10, borderTop: "1px solid #222" }}
      >
        <span style={{ fontSize: 6, color: "#444" }}>{"CLK:RESUME"}</span>
        <span style={{ fontSize: 6, color: "#444" }}>{"HOLD:RESET"}</span>
      </div>
    </div>
  )
}

// --- RESET CONFIRM (visual ring fill) ---
function ResetConfirmScreen({ state }: { state: DeviceState }) {
  const task = state.tasks[state.selectedIndex]
  if (!task) return null
  const progress = state.resetProgress

  // Draw a circular progress ring
  const cx = 64
  const cy = 28
  const r = 14
  const circumference = 2 * Math.PI * r
  const dashOffset = circumference * (1 - progress)

  return (
    <div className="flex flex-col h-full text-[#fff]">
      <div className="flex-1 flex flex-col items-center justify-center">
        <svg width={128} height={48} viewBox="0 0 128 48">
          {/* Background ring */}
          <circle cx={cx} cy={24} r={r} fill="none" stroke="#222" strokeWidth={2} />
          {/* Progress ring */}
          <circle
            cx={cx}
            cy={24}
            r={r}
            fill="none"
            stroke="#fff"
            strokeWidth={2}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} 24)`}
          />
          {/* Center dot that grows */}
          <circle
            cx={cx}
            cy={24}
            r={Math.max(1, progress * 6)}
            fill="#fff"
            opacity={progress}
          />
        </svg>
      </div>

      <div
        className="flex items-center justify-center px-2"
        style={{ height: 10, borderTop: "1px solid #222" }}
      >
        <span style={{ fontSize: 6, color: "#555" }}>
          {"RESETTING..."}
        </span>
      </div>
    </div>
  )
}

// --- TASK MENU ---
function TaskMenuScreen({
  state,
  time,
  getMenuItems,
}: {
  state: DeviceState
  time: Date
  getMenuItems?: OledDisplayProps["getMenuItems"]
}) {
  const task = state.tasks[state.selectedIndex]
  const items = getMenuItems?.(task) ?? []

  return (
    <div className="flex flex-col h-full text-[#fff]">
      <div
        className="flex items-center justify-between px-2"
        style={{ height: 11, borderBottom: "1px solid #222" }}
      >
        <span style={{ fontSize: 7, color: "#888" }}>
          {task ? task.name.toUpperCase() : "MENU"}
        </span>
        <span className="font-mono" style={{ fontSize: 7, color: "#555" }}>
          {formatClockSmall(time)}
        </span>
      </div>

      <div className="flex-1 flex flex-col" style={{ padding: "2px 0" }}>
        {items.map((item, i) => {
          const isSelected = i === state.menuIndex
          return (
            <div
              key={item.action}
              className="flex items-center px-2"
              style={{
                height: 11,
                backgroundColor: isSelected ? "#fff" : "transparent",
                color: isSelected ? "#000" : "#fff",
              }}
            >
              <span className="font-mono" style={{ fontSize: 7 }}>
                {isSelected ? "> " : "  "}
                {item.label}
              </span>
            </div>
          )
        })}
      </div>

      <div
        className="flex items-center justify-center px-2"
        style={{ height: 8, borderTop: "1px solid #222" }}
      >
        <span style={{ fontSize: 5, color: "#333" }}>{"ROT:SELECT  CLK:CONFIRM"}</span>
      </div>
    </div>
  )
}

// --- CHAR PICKER ---
function CharPickerScreen({ state, time }: { state: DeviceState; time: Date }) {
  const cp = state.charPicker
  if (!cp) return null

  const currentChar = CHAR_SET[cp.charIndex]
  const prevChar = CHAR_SET[(cp.charIndex - 1 + CHAR_SET.length) % CHAR_SET.length]
  const nextChar = CHAR_SET[(cp.charIndex + 1) % CHAR_SET.length]
  const enteredText = cp.chars.join("")
  const isNew = cp.mode === "new"

  return (
    <div className="flex flex-col h-full text-[#fff]">
      <div
        className="flex items-center justify-between px-2"
        style={{ height: 11, borderBottom: "1px solid #222" }}
      >
        <span style={{ fontSize: 7, color: "#888" }}>{isNew ? "NEW TASK" : "RENAME"}</span>
        <span className="font-mono" style={{ fontSize: 7, color: "#555" }}>
          {formatClockSmall(time)}
        </span>
      </div>

      <div
        className="flex items-center px-2"
        style={{ height: 13, borderBottom: "1px solid #181818" }}
      >
        <span className="font-mono font-bold" style={{ fontSize: 9 }}>
          {enteredText}
          <span className="animate-pulse-dot" style={{ color: "#fff" }}>
            {"_"}
          </span>
        </span>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-1">
          <span
            className="font-mono"
            style={{ fontSize: 10, color: "#333", width: 14, textAlign: "center" }}
          >
            {prevChar === " " ? "_" : prevChar}
          </span>
          <div style={{ width: 1, height: 16, backgroundColor: "#222" }} />
          <div
            className="flex items-center justify-center"
            style={{ width: 22, height: 22, backgroundColor: "#fff", color: "#000", borderRadius: 2 }}
          >
            <span className="font-mono font-bold" style={{ fontSize: 16 }}>
              {currentChar === " " ? "_" : currentChar}
            </span>
          </div>
          <div style={{ width: 1, height: 16, backgroundColor: "#222" }} />
          <span
            className="font-mono"
            style={{ fontSize: 10, color: "#333", width: 14, textAlign: "center" }}
          >
            {nextChar === " " ? "_" : nextChar}
          </span>
        </div>
      </div>

      <div
        className="flex items-center justify-center px-1"
        style={{ height: 9, borderTop: "1px solid #222" }}
      >
        <span style={{ fontSize: 5, color: "#333" }}>{"ROT:CHAR  CLK:ADD  HOLD:DONE"}</span>
      </div>
    </div>
  )
}

// --- CONFIRM DELETE ---
function ConfirmDeleteScreen({ state }: { state: DeviceState }) {
  const task = state.tasks.find((t) => t.id === state.deleteTargetId)

  return (
    <div className="flex flex-col h-full text-[#fff]">
      <div
        className="flex items-center px-2"
        style={{ height: 11, borderBottom: "1px solid #222" }}
      >
        <span style={{ fontSize: 7, color: "#888" }}>{"DELETE?"}</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center">
        <span className="font-mono" style={{ fontSize: 8, color: "#555" }}>
          {task?.name.toUpperCase() ?? "TASK"}
        </span>
        {task && task.elapsed > 0 && (
          <span className="font-mono" style={{ fontSize: 7, color: "#333", marginTop: 2 }}>
            {formatElapsed(task.elapsed)}
          </span>
        )}
        <div className="flex items-center gap-3 mt-3">
          {["Yes", "No"].map((option, i) => {
            const isSelected = i === state.menuIndex
            return (
              <div
                key={option}
                className="flex items-center justify-center"
                style={{
                  width: 28,
                  height: 12,
                  backgroundColor: isSelected ? "#fff" : "transparent",
                  color: isSelected ? "#000" : "#555",
                  borderRadius: 2,
                  border: isSelected ? "none" : "1px solid #333",
                }}
              >
                <span className="font-mono" style={{ fontSize: 8 }}>
                  {option}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div
        className="flex items-center justify-center px-2"
        style={{ height: 8, borderTop: "1px solid #222" }}
      >
        <span style={{ fontSize: 5, color: "#333" }}>{"ROT:SELECT  CLK:CONFIRM"}</span>
      </div>
    </div>
  )
}

// --- Tiny Pause icon ---
function PauseIcon() {
  return (
    <svg width={5} height={6} viewBox="0 0 5 6" fill="none">
      <rect x={0} y={0} width={1.5} height={6} fill="#888" />
      <rect x={3} y={0} width={1.5} height={6} fill="#888" />
    </svg>
  )
}
