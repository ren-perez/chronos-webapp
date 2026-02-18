"use client"

import { useState, useRef, useEffect } from "react"
import type { DeviceState, Task, TaskMode } from "@/hooks/use-device-state"
import { formatElapsed, formatElapsedCompact, formatDuration } from "@/lib/format-time"
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Timer,
  Clock,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
} from "lucide-react"

interface TrackerDashboardProps {
  state: DeviceState
  onWebPlayPause: (taskId: string) => void
  onAddTask: (name: string) => void
  onRenameTask: (taskId: string, newName: string) => void
  onDeleteTask: (taskId: string) => void
  onToggleMode: (taskId: string) => void
  onSetTimerDuration: (taskId: string, durationMs: number) => void
  onRestart: (taskId: string) => void
  onStop: (taskId: string) => void
  onDeleteSession: (taskId: string, sessionStart: number) => void
}

export function TrackerDashboard({
  state,
  onWebPlayPause,
  onAddTask,
  onRenameTask,
  onDeleteTask,
  onToggleMode,
  onSetTimerDuration,
  onRestart,
  onStop,
  onDeleteSession,
}: TrackerDashboardProps) {
  // Compute active tasks for the hero section
  const activeTasks = state.tasks.filter(
    (t) => t.status === "running" || (t.status === "paused" && t.elapsed > 0)
  )
  if (activeTasks.length === 0 && state.activeTaskId) {
    const task = state.tasks.find((t) => t.id === state.activeTaskId)
    if (task) activeTasks.push(task)
  }

  const [heroIndex, setHeroIndex] = useState(0)
  // Clamp heroIndex when activeTasks changes
  const clampedHeroIndex = Math.min(heroIndex, Math.max(0, activeTasks.length - 1))
  if (clampedHeroIndex !== heroIndex) setHeroIndex(clampedHeroIndex)

  // The task currently shown in the hero card
  const heroTaskId = activeTasks.length > 0 ? activeTasks[clampedHeroIndex]?.id ?? null : null

  return (
    <div className="flex flex-col gap-8 w-full">
      <ActiveTimerSection
        activeTasks={activeTasks}
        heroIndex={clampedHeroIndex}
        onHeroIndexChange={setHeroIndex}
        onPlayPause={onWebPlayPause}
        onRestart={onRestart}
        onStop={onStop}
        onToggleMode={onToggleMode}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <TaskListSection
            tasks={state.tasks}
            activeTaskId={state.activeTaskId}
            heroTaskId={heroTaskId}
            onPlayPause={onWebPlayPause}
            onAdd={onAddTask}
            onRename={onRenameTask}
            onDelete={onDeleteTask}
            onToggleMode={onToggleMode}
            onSetDuration={onSetTimerDuration}
            onRestart={onRestart}
            onStop={onStop}
          />
        </div>

        <div className="lg:col-span-2">
          <ActivityLog tasks={state.tasks} onDeleteSession={onDeleteSession} />
        </div>
      </div>
    </div>
  )
}

// === MODE TOGGLE PILL ===
function ModeToggle({
  isTimer,
  onToggle,
  size = "sm",
}: {
  isTimer: boolean
  onToggle: () => void
  size?: "sm" | "md"
}) {
  const isSm = size === "sm"
  return (
    <div className="inline-flex items-center rounded-full bg-secondary border border-border p-0.5">
      <button
        onClick={isTimer ? onToggle : undefined}
        className={`flex items-center gap-1 font-mono rounded-full transition-all ${isSm ? "text-[11px] px-2.5 py-1" : "text-xs px-3 py-1.5"
          } ${!isTimer
            ? "bg-chronos-accent text-chronos-accent-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
          }`}
        aria-label="Stopwatch mode"
      >
        <Clock className={isSm ? "w-3 h-3" : "w-3.5 h-3.5"} />
        <span className="hidden sm:inline">Stopwatch</span>
      </button>
      <button
        onClick={!isTimer ? onToggle : undefined}
        className={`flex items-center gap-1 font-mono rounded-full transition-all ${isSm ? "text-[11px] px-2.5 py-1" : "text-xs px-3 py-1.5"
          } ${isTimer
            ? "bg-chronos-accent text-chronos-accent-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
          }`}
        aria-label="Timer mode"
      >
        <Timer className={isSm ? "w-3 h-3" : "w-3.5 h-3.5"} />
        <span className="hidden sm:inline">Timer</span>
      </button>
    </div>
  )
}

// === MULTI-TASK HERO SECTION ===
function ActiveTimerSection({
  activeTasks,
  heroIndex,
  onHeroIndexChange,
  onPlayPause,
  onRestart,
  onStop,
  onToggleMode,
}: {
  activeTasks: Task[]
  heroIndex: number
  onHeroIndexChange: (idx: number) => void
  onPlayPause: (id: string) => void
  onRestart: (id: string) => void
  onStop: (id: string) => void
  onToggleMode: (id: string) => void
}) {
  if (activeTasks.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 flex flex-col items-center justify-center min-h-60">
        <div className="w-12 h-12 rounded-full border-2 border-border flex items-center justify-center mb-4">
          <Clock className="w-6 h-6 text-muted-foreground" />
        </div>
        <span className="text-sm text-muted-foreground">Select a task to start tracking</span>
      </div>
    )
  }

  if (activeTasks.length === 1) {
    return (
      <ActiveTimerCard
        task={activeTasks[0]}
        onPlayPause={onPlayPause}
        onRestart={onRestart}
        onStop={onStop}
        onToggleMode={onToggleMode}
      />
    )
  }

  const task = activeTasks[heroIndex]

  return (
    <div className="flex flex-col gap-3">
      {/* Navigation header */}
      <div className="flex items-center justify-between px-1">
        <button
          onClick={() => onHeroIndexChange((heroIndex - 1 + activeTasks.length) % activeTasks.length)}
          className="flex items-center justify-center w-8 h-8 rounded-lg border border-border hover:bg-accent transition-colors active:scale-95"
          aria-label="Previous task"
        >
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <div className="flex items-center gap-1.5">
          {activeTasks.map((t, i) => (
            <button
              key={t.id}
              onClick={() => onHeroIndexChange(i)}
              className={`rounded-full transition-all ${i === heroIndex
                ? "w-5 h-1.5 bg-chronos-accent"
                : "w-1.5 h-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                }`}
              aria-label={`View ${t.name}`}
            />
          ))}
        </div>
        <button
          onClick={() => onHeroIndexChange((heroIndex + 1) % activeTasks.length)}
          className="flex items-center justify-center w-8 h-8 rounded-lg border border-border hover:bg-accent transition-colors active:scale-95"
          aria-label="Next task"
        >
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
      <ActiveTimerCard
        task={task}
        onPlayPause={onPlayPause}
        onRestart={onRestart}
        onStop={onStop}
        onToggleMode={onToggleMode}
      />
    </div>
  )
}

// === ACTIVE TIMER CARD ===
function ActiveTimerCard({
  task,
  onPlayPause,
  onRestart,
  onStop,
  onToggleMode,
}: {
  task: Task
  onPlayPause: (id: string) => void
  onRestart: (id: string) => void
  onStop: (id: string) => void
  onToggleMode: (id: string) => void
}) {
  const isRunning = task.status === "running"
  const isTimer = task.mode === "timer"
  const display = isTimer ? Math.max(0, task.timerDuration - task.elapsed) : task.elapsed
  const isDone = isTimer && task.elapsed >= task.timerDuration
  const timerProgress = isTimer ? Math.min(1, task.elapsed / task.timerDuration) : 0

  return (
    <div className={`rounded-2xl border bg-card p-6 sm:p-8 transition-all ${isRunning ? "border-chronos-accent/40 shadow-[0_0_30px_var(--chronos-glow)]" : "border-border"
      }`}>
      {/* Status line */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          {isRunning ? (
            <div className="w-2.5 h-2.5 rounded-full bg-chronos-accent animate-pulse-dot" />
          ) : (
            <div className="w-2.5 h-2.5 rounded-full border-2 border-muted-foreground" />
          )}
          <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            {isDone ? "Complete" : isRunning ? "Running" : "Paused"}
          </span>
        </div>
        <ModeToggle isTimer={isTimer} onToggle={() => onToggleMode(task.id)} size="md" />
      </div>

      {/* Task name */}
      <h2 className="text-base sm:text-lg font-mono font-semibold text-foreground/80 mb-4 tracking-wide uppercase line-clamp-1">
        {task.name}
      </h2>

      {/* Large timer display */}
      <div className="mb-6 overflow-hidden">
        <span className={`font-mono text-5xl sm:text-6xl lg:text-7xl font-bold tabular-nums leading-none ${isRunning ? "text-foreground" : "text-foreground/70"
          }`}>
          {isDone ? formatElapsedCompact(task.timerDuration) : formatElapsedCompact(display)}
        </span>
      </div>

      {/* Timer progress bar */}
      {isTimer && (
        <div className="mb-6">
          <div className="h-1 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full rounded-full bg-chronos-accent transition-all duration-100"
              style={{ width: `${timerProgress * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={() => onPlayPause(task.id)}
          className="flex items-center justify-center w-14 h-14 rounded-full bg-chronos-accent text-chronos-accent-foreground hover:opacity-90 transition-opacity active:scale-95"
          aria-label={isRunning ? "Pause" : isDone ? "Resume" : "Play"}
        >
          {isRunning ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
        </button>
        {task.elapsed > 0 && (
          <button
            onClick={() => onStop(task.id)}
            className="flex items-center justify-center w-11 h-11 rounded-full border border-border hover:bg-accent transition-colors active:scale-95"
            aria-label="Stop and reset"
            title="Stop and reset"
          >
            <Square className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
        <button
          onClick={() => onRestart(task.id)}
          className="flex items-center justify-center w-11 h-11 rounded-full border border-border hover:bg-accent transition-colors active:scale-95"
          aria-label="Restart"
          title="Restart (reset + start)"
        >
          <RotateCcw className="w-4 h-4 text-muted-foreground" />
        </button>
        <div className="flex-1" />
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
            Sessions
          </span>
          <span className="text-sm font-mono font-semibold text-foreground tabular-nums">
            {task.sessions.length}
          </span>
        </div>
      </div>
    </div>
  )
}

// === OVERFLOW MENU ===
function OverflowMenu({
  onRename,
  onDelete,
  canDelete,
}: {
  onRename: () => void
  onDelete: () => void
  canDelete: boolean
}) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
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
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors active:scale-95"
        aria-label="More actions"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-30 rounded-lg border border-border bg-card shadow-lg animate-fade-in py-1">
          <button
            onClick={() => { onRename(); setOpen(false) }}
            className="flex items-center gap-2 w-full px-3 py-2 text-xs font-mono text-foreground hover:bg-accent transition-colors"
          >
            <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
            Rename
          </button>
          {canDelete && (
            <button
              onClick={() => { onDelete(); setOpen(false) }}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs font-mono text-destructive hover:bg-destructive/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// === TASK LIST ===
function TaskListSection({
  tasks,
  activeTaskId,
  heroTaskId,
  onPlayPause,
  onAdd,
  onRename,
  onDelete,
  onToggleMode,
  onSetDuration,
  onRestart,
  onStop,
}: {
  tasks: Task[]
  activeTaskId: string | null
  heroTaskId: string | null
  onPlayPause: (id: string) => void
  onAdd: (name: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onToggleMode: (id: string) => void
  onSetDuration: (id: string, ms: number) => void
  onRestart: (id: string) => void
  onStop: (id: string) => void
}) {
  const [isAdding, setIsAdding] = useState(false)
  const [addName, setAddName] = useState("")
  const addRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isAdding && addRef.current) addRef.current.focus()
  }, [isAdding])

  const handleAdd = () => {
    const name = addName.trim()
    if (name) {
      onAdd(name)
      setAddName("")
      setIsAdding(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1 mb-1">
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Tasks
        </span>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-accent transition-colors active:scale-95"
          aria-label="Add new task"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New</span>
        </button>
      </div>

      {isAdding && (
        <div className="flex items-center gap-2 p-3 rounded-xl border border-chronos-accent/50 bg-card animate-fade-in">
          <input
            ref={addRef}
            type="text"
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd()
              if (e.key === "Escape") { setIsAdding(false); setAddName("") }
            }}
            placeholder="Task name..."
            className="flex-1 bg-transparent font-mono text-sm text-foreground placeholder:text-muted-foreground outline-none min-w-0"
            maxLength={20}
            autoComplete="off"
          />
          <button
            onClick={handleAdd}
            disabled={!addName.trim()}
            className="flex items-center justify-center w-7 h-7 rounded-md bg-chronos-accent text-chronos-accent-foreground hover:opacity-90 disabled:opacity-30 active:scale-95"
            aria-label="Confirm"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { setIsAdding(false); setAddName("") }}
            className="flex items-center justify-center w-7 h-7 rounded-md border border-border hover:bg-accent active:scale-95"
            aria-label="Cancel"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      )}

      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          isActive={task.id === (heroTaskId ?? activeTaskId)}
          onPlayPause={() => onPlayPause(task.id)}
          onRename={(name) => onRename(task.id, name)}
          onDelete={() => onDelete(task.id)}
          onToggleMode={() => onToggleMode(task.id)}
          onSetDuration={(ms) => onSetDuration(task.id, ms)}
          onRestart={() => onRestart(task.id)}
          onStop={() => onStop(task.id)}
          canDelete={tasks.length > 1}
        />
      ))}
    </div>
  )
}

function TaskRow({
  task,
  isActive,
  onPlayPause,
  onRename,
  onDelete,
  onToggleMode,
  onSetDuration,
  onRestart,
  onStop,
  canDelete,
}: {
  task: Task
  isActive: boolean
  onPlayPause: () => void
  onRename: (name: string) => void
  onDelete: () => void
  onToggleMode: () => void
  onSetDuration: (ms: number) => void
  onRestart: () => void
  onStop: () => void
  canDelete: boolean
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(task.name)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) { inputRef.current.focus(); inputRef.current.select() }
  }, [isEditing])

  const handleRename = () => {
    const name = editName.trim()
    if (name && name !== task.name) onRename(name)
    setIsEditing(false)
  }

  const isRunning = task.status === "running"
  const isTimer = task.mode === "timer"
  const displayVal = isTimer ? Math.max(0, task.timerDuration - task.elapsed) : task.elapsed

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-xl border border-chronos-accent/50 bg-card animate-fade-in">
        <input
          ref={inputRef}
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleRename()
            if (e.key === "Escape") { setIsEditing(false); setEditName(task.name) }
          }}
          className="flex-1 bg-transparent font-mono text-sm text-foreground outline-none min-w-0"
          maxLength={20}
          autoComplete="off"
        />
        <button
          onClick={handleRename}
          className="flex items-center justify-center w-7 h-7 rounded-md bg-chronos-accent text-chronos-accent-foreground hover:opacity-90 active:scale-95"
          aria-label="Confirm rename"
        >
          <Check className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => { setIsEditing(false); setEditName(task.name) }}
          className="flex items-center justify-center w-7 h-7 rounded-md border border-border hover:bg-accent active:scale-95"
          aria-label="Cancel"
        >
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>
    )
  }

  return (
    <div
      className={`rounded-xl border transition-all group ${isActive
        ? "border-chronos-accent/30 bg-card shadow-sm"
        : "border-border hover:border-foreground/15 hover:bg-card/80"
        }`}
    >
      {/* Main row */}
      <div className="flex items-center px-3.5 py-3.5 gap-3">
        <button
          onClick={onPlayPause}
          className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all active:scale-95 shrink-0 ${isRunning
            ? "bg-chronos-accent/15 text-chronos-accent border border-chronos-accent/30"
            : "border border-border hover:border-foreground/30 hover:bg-accent text-muted-foreground hover:text-foreground"
            }`}
          aria-label={isRunning ? "Pause" : "Start"}
        >
          {isRunning ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4 ml-0.5" />
          )}
        </button>

        <div className="flex flex-col min-w-0 flex-1">
          <span className={`font-mono text-sm truncate ${isActive ? "text-foreground font-semibold" : "text-foreground"}`}>
            {task.name}
          </span>
          <span className="text-[11px] font-mono text-muted-foreground">
            {isTimer ? "Timer" : "Stopwatch"}
            {task.sessions.length > 0 ? ` \u00b7 ${task.sessions.length}` : ""}
          </span>
        </div>

        <span className="font-mono text-sm tabular-nums text-muted-foreground shrink-0">
          {task.elapsed > 0 ? formatElapsed(displayVal) : "--:--"}
        </span>

        <OverflowMenu
          onRename={() => { setEditName(task.name); setIsEditing(true) }}
          onDelete={onDelete}
          canDelete={canDelete}
        />
      </div>

      {/* Actions row: mode toggle + stop + restart */}
      <div className={`px-3 flex justify-between items-center gap-2 transition-all
      ${isActive ? "pt-3 pb-2.5 border-t border-border/30 opacity-100" : "opacity-0 group-hover:opacity-100 group-hover:pt-3 group-hover:pb-2.5 group-hover:border-t group-hover:border-border/30 h-0 group-hover:h-auto overflow-hidden group-hover:overflow-visible pt-0 pb-0"
        }`}>
        <ModeToggle isTimer={isTimer} onToggle={onToggleMode} size="sm" />
        <div className="flex items-center gap-3">
          {task.elapsed > 0 && (
            <button
              onClick={onStop}
              className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-foreground px-2 py-2 rounded-md border border-border hover:bg-accent transition-colors active:scale-95"
              title="Stop and reset"
            >
              <Square className="w-4 h-4" />
              <span className="hidden xl:inline">Stop</span>
            </button>
          )}
          <button
            onClick={onRestart}
            disabled={task.elapsed === 0}
            className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-foreground px-2 py-2 rounded-md border border-border hover:bg-accent disabled:opacity-30 disabled:pointer-events-none transition-colors active:scale-95"
            title="Restart (reset + start)"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="hidden xl:inline">Restart</span>
          </button>
        </div>
      </div>


      {/* Timer duration picker */}
      {isTimer && (
        <div className="px-3 pt-1.5 pb-2.5 flex items-center gap-2">
          <div className="flex items-center gap-1 flex-wrap">
            {[5, 15, 25, 30, 45, 60].map((min) => (
              <button
                key={min}
                onClick={() => onSetDuration(min * 60 * 1000)}
                className={`text-[11px] font-mono px-2 py-0.5 rounded-md border transition-colors active:scale-95 ${task.timerDuration === min * 60 * 1000
                  ? "border-chronos-accent bg-chronos-accent text-chronos-accent-foreground"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
              >
                {`${min}m`}
              </button>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

// === ACTIVITY LOG ===
function ActivityLog({
  tasks,
  onDeleteSession,
}: {
  tasks: Task[]
  onDeleteSession: (taskId: string, sessionStart: number) => void
}) {
  const [dayOffset, setDayOffset] = useState(0)

  const targetDate = new Date()
  targetDate.setDate(targetDate.getDate() - dayOffset)
  const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).getTime()
  const dayEnd = dayStart + 86400000

  const dayLabel =
    dayOffset === 0
      ? "Today"
      : dayOffset === 1
        ? "Yesterday"
        : targetDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })

  type LogEntry = {
    taskName: string
    taskId: string
    taskMode: TaskMode
    start: number
    end: number | null
    elapsed: number
  }

  const log: LogEntry[] = []
  for (const task of tasks) {
    const completedSessionsTotal = task.sessions
      .filter((s) => s.end !== null && s.start >= dayStart && s.start < dayEnd)
      .reduce((sum, s) => sum + (s.end! - s.start), 0)

    for (const session of task.sessions) {
      if (session.start >= dayStart && session.start < dayEnd) {
        let elapsed: number
        if (session.end !== null) {
          elapsed = session.end - session.start
        } else {
          elapsed = Math.max(0, task.elapsed - completedSessionsTotal)
        }
        log.push({
          taskName: task.name,
          taskId: task.id,
          taskMode: task.mode,
          start: session.start,
          end: session.end,
          elapsed,
        })
      }
    }
  }
  log.sort((a, b) => b.start - a.start)

  const taskTotals: Record<string, number> = {}
  for (const entry of log) {
    taskTotals[entry.taskName] = (taskTotals[entry.taskName] ?? 0) + entry.elapsed
  }
  const dayTotal = Object.values(taskTotals).reduce((a, b) => a + b, 0)

  return (
    <div className="rounded-xl border border-border bg-card/50 p-5 h-fit">
      {/* Header with day navigation */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setDayOffset((d) => d + 1)}
            className="flex items-center justify-center w-7 h-7 rounded-md border border-border hover:bg-accent transition-colors active:scale-95"
            aria-label="Previous day"
          >
            <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
          <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground min-w-20 text-center font-semibold">
            {dayLabel}
          </span>
          <button
            onClick={() => setDayOffset((d) => Math.max(0, d - 1))}
            disabled={dayOffset === 0}
            className="flex items-center justify-center w-7 h-7 rounded-md border border-border hover:bg-accent disabled:opacity-30 disabled:pointer-events-none transition-colors active:scale-95"
            aria-label="Next day"
          >
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
        <span className="text-sm font-mono text-foreground/70 tabular-nums font-semibold">
          {dayTotal > 0 ? formatDuration(dayTotal) : "\u2014"}
        </span>
      </div>

      {/* Distribution bars */}
      {Object.entries(taskTotals).length > 0 && (
        <div className="flex flex-col gap-2.5 mb-5">
          {Object.entries(taskTotals)
            .sort(([, a], [, b]) => b - a)
            .map(([name, ms]) => {
              const pct = dayTotal > 0 ? (ms / dayTotal) * 100 : 0
              return (
                <div key={name} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-mono text-foreground">{name}</span>
                    <span className="text-xs font-mono text-muted-foreground tabular-nums">
                      {formatDuration(ms)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full bg-chronos-accent/70 transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
        </div>
      )}

      {/* Session log */}
      <div className="flex flex-col">
        {log.length > 0 ? (
          <>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground font-semibold">
                Sessions
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                {`${log.length} total`}
              </span>
            </div>
            {log.map((entry, i) => {
              const startTime = new Date(entry.start).toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })
              const endTime = entry.end
                ? new Date(entry.end).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })
                : "now"

              return (
                <div
                  key={`${entry.taskId}-${entry.start}`}
                  className={`flex items-center justify-between py-2 text-sm group/session ${i < log.length - 1 ? "border-b border-border/30" : ""
                    }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${entry.end === null ? "bg-chronos-accent animate-pulse-dot" : "bg-muted-foreground/30"
                        }`}
                    />
                    <span className="font-mono text-sm text-foreground truncate">
                      {entry.taskName}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-[11px] font-mono text-muted-foreground tabular-nums whitespace-nowrap">
                      {`${startTime} \u2192 ${endTime}`}
                    </span>
                    <span className="text-sm font-mono text-foreground tabular-nums min-w-12.5 text-right">
                      {formatElapsed(entry.elapsed)}
                    </span>
                    <button
                      onClick={() => onDeleteSession(entry.taskId, entry.start)}
                      className="flex items-center justify-center w-5 h-5 rounded text-muted-foreground/0 group-hover/session:text-muted-foreground hover:text-destructive! transition-colors active:scale-95"
                      aria-label="Delete session"
                      title="Delete session"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )
            })}
          </>
        ) : (
          <span className="text-sm text-muted-foreground py-4">
            {dayOffset === 0 ? "No sessions yet. Start a task to begin tracking." : "No sessions recorded."}
          </span>
        )}
      </div>
    </div>
  )
}
