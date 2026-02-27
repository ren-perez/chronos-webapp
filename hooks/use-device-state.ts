"use client"

import { useState, useCallback, useRef, useEffect } from "react"

export type TaskStatus = "idle" | "running" | "paused"
export type TaskMode = "stopwatch" | "timer"

export interface Split {
  id: string
  name: string
  elapsed: number
  sessions: { start: number; end: number | null }[]
}

export interface Task {
  id: string
  name: string
  elapsed: number // ms accumulated
  status: TaskStatus
  mode: TaskMode
  timerDuration: number // ms, only used in timer mode
  sessions: { start: number; end: number | null }[]
  splits: Split[]
  activeSplitId: string | null
}

export type DeviceScreen =
  | "idle-clock"
  | "task-list"
  | "task-active"
  | "task-paused"
  | "reset-confirm"
  | "task-menu"
  | "char-picker"
  | "confirm-delete"

const CHAR_SET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ".split("")
export { CHAR_SET }

export interface CharPickerState {
  chars: string[]
  charIndex: number
  mode: "new" | "rename"
  targetTaskId?: string
}

export interface DeviceState {
  screen: DeviceScreen
  tasks: Task[]
  selectedIndex: number
  activeTaskId: string | null
  resetProgress: number // 0-1 for visual fill
  lastInteraction: number
  menuIndex: number
  charPicker: CharPickerState | null
  deleteTargetId: string | null
}

const RESET_DURATION = 600 // ms to hold for reset
const MIN_SESSION_MS = 300 // ignore sessions shorter than this to prevent false positives
const STORAGE_KEY = "chronos-state-v1"

const DEFAULT_TASKS: Omit<Task, "id">[] = [
  { name: "Work", elapsed: 0, status: "idle", mode: "stopwatch", timerDuration: 25 * 60 * 1000, sessions: [], splits: [], activeSplitId: null },
  { name: "Study", elapsed: 0, status: "idle", mode: "stopwatch", timerDuration: 25 * 60 * 1000, sessions: [], splits: [], activeSplitId: null },
  { name: "Break", elapsed: 0, status: "idle", mode: "timer", timerDuration: 5 * 60 * 1000, sessions: [], splits: [], activeSplitId: null },
]

function createId() {
  return Math.random().toString(36).slice(2, 9)
}

function normalizeSplits(splits: unknown): Split[] {
  if (!Array.isArray(splits)) return []
  return splits.map((sp) => ({
    id: sp.id ?? createId(),
    name: sp.name ?? "Split",
    elapsed: sp.elapsed ?? 0,
    sessions: Array.isArray(sp.sessions) ? sp.sessions : [],
  }))
}

function normalizeTask(raw: Partial<Task> & { id: string; name: string }): Task {
  return {
    id: raw.id,
    name: raw.name,
    elapsed: raw.elapsed ?? 0,
    status: (raw.status ?? "idle") as TaskStatus,
    mode: (raw.mode ?? "stopwatch") as TaskMode,
    timerDuration: raw.timerDuration ?? 25 * 60 * 1000,
    sessions: Array.isArray(raw.sessions) ? raw.sessions : [],
    splits: normalizeSplits(raw.splits),
    activeSplitId: raw.activeSplitId ?? null,
  }
}

/** For running tasks, recalculate elapsed from session timestamps so restores are accurate. */
function recalculateRunning(task: Task): Task {
  if (task.status !== "running") return task
  const now = Date.now()
  let elapsed = 0
  for (const s of task.sessions) {
    elapsed += s.end !== null ? s.end - s.start : now - s.start
  }

  // Recalculate split elapsed too
  const splits = task.splits.map((sp) => {
    let splitElapsed = 0
    for (const s of sp.sessions) {
      splitElapsed += s.end !== null ? s.end - s.start : now - s.start
    }
    return { ...sp, elapsed: splitElapsed }
  })

  if (task.mode === "timer" && elapsed >= task.timerDuration) {
    return {
      ...task,
      elapsed: task.timerDuration,
      status: "paused" as TaskStatus,
      sessions: task.sessions.map((s) => (s.end === null ? { ...s, end: now } : s)),
      splits: splits.map((sp) => ({
        ...sp,
        sessions: sp.sessions.map((s) => (s.end === null ? { ...s, end: now } : s)),
      })),
    }
  }
  return { ...task, elapsed, splits }
}

export function useDeviceState() {
  const [state, setState] = useState<DeviceState>({
    screen: "idle-clock",
    tasks: DEFAULT_TASKS.map((t) => ({ ...t, id: createId() })),
    selectedIndex: 0,
    activeTaskId: null,
    resetProgress: 0,
    lastInteraction: Date.now(),
    menuIndex: 0,
    charPicker: null,
    deleteTargetId: null,
  })

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const holdStartTimeRef = useRef<number | null>(null)
  const holdRafRef = useRef<number | null>(null)
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state

  // Load persisted state on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const saved = JSON.parse(raw)
        if (Array.isArray(saved.tasks) && saved.tasks.length > 0) {
          const tasks = (saved.tasks as Partial<Task>[])
            .filter((t) => t.id && t.name)
            .map((t) => normalizeTask(t as Partial<Task> & { id: string; name: string }))
            .map(recalculateRunning)
          setState((prev) => ({
            ...prev,
            tasks,
            activeTaskId: saved.activeTaskId ?? null,
          }))
        }
      }
    } catch { /* ignore corrupt data */ }
  }, [])

  // Save to localStorage every 5 s and on page unload
  useEffect(() => {
    const save = () => {
      try {
        const { tasks, activeTaskId } = stateRef.current
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks, activeTaskId }))
      } catch { /* ignore quota errors */ }
    }
    const interval = setInterval(save, 5000)
    window.addEventListener("beforeunload", save)
    return () => {
      clearInterval(interval)
      window.removeEventListener("beforeunload", save)
      save() // flush on unmount too
    }
  }, [])

  // Cross-window sync: reload state when another window (e.g. popup) modifies localStorage
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return
      try {
        const saved = JSON.parse(e.newValue)
        if (Array.isArray(saved.tasks) && saved.tasks.length > 0) {
          const tasks = (saved.tasks as Partial<Task>[])
            .filter((t) => t.id && t.name)
            .map((t) => normalizeTask(t as Partial<Task> & { id: string; name: string }))
            .map(recalculateRunning)
          setState((prev) => ({
            ...prev,
            tasks,
            activeTaskId: saved.activeTaskId ?? null,
          }))
        }
      } catch { /* ignore */ }
    }
    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [])

  // Tick ALL running tasks every 100ms using timestamp-based elapsed
  // (accurate even when the tab is in the background and the interval is throttled)
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setState((prev) => {
        let tasks = prev.tasks
        let screenUpdate = prev.screen
        let anyChanged = false
        const now = Date.now()

        for (const task of tasks) {
          if (task.status !== "running") continue

          anyChanged = true
          // Compute elapsed from session timestamps — correct regardless of interval throttling
          let newElapsed = 0
          for (const s of task.sessions) {
            newElapsed += s.end !== null ? s.end - s.start : now - s.start
          }

          // Also update active split elapsed
          const updatedSplits = task.splits.map((sp) => {
            if (!sp.sessions.some((s) => s.end === null)) return sp
            let splitElapsed = 0
            for (const s of sp.sessions) {
              splitElapsed += s.end !== null ? s.end - s.start : now - s.start
            }
            return { ...sp, elapsed: splitElapsed }
          })

          // Timer mode: stop when elapsed >= duration
          if (task.mode === "timer" && newElapsed >= task.timerDuration) {
            tasks = tasks.map((t) =>
              t.id === task.id
                ? {
                    ...t,
                    elapsed: t.timerDuration,
                    status: "paused" as TaskStatus,
                    sessions: t.sessions.map((s, i) =>
                      i === t.sessions.length - 1 && s.end === null
                        ? { ...s, end: now }
                        : s
                    ),
                    // Close active split session too
                    splits: updatedSplits.map((sp) => ({
                      ...sp,
                      sessions: sp.sessions.map((s, i) =>
                        i === sp.sessions.length - 1 && s.end === null
                          ? { ...s, end: now }
                          : s
                      ),
                    })),
                  }
                : t
            )
            if (prev.activeTaskId === task.id && prev.screen === "task-active") {
              screenUpdate = "task-paused"
            }
          } else {
            tasks = tasks.map((t) =>
              t.id === task.id ? { ...t, elapsed: newElapsed, splits: updatedSplits } : t
            )
          }
        }

        if (!anyChanged) return prev
        return { ...prev, tasks, screen: screenUpdate }
      })
    }, 100)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  // Idle timeout
  useEffect(() => {
    if (state.screen === "idle-clock" || state.screen === "char-picker") return
    if (state.activeTaskId) {
      const active = state.tasks.find((t) => t.id === state.activeTaskId)
      if (active?.status === "running") return
    }
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(() => {
      setState((prev) => ({
        ...prev,
        screen: "idle-clock",
        resetProgress: 0,
        charPicker: null,
        deleteTargetId: null,
      }))
    }, 20000)
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
  }, [state.lastInteraction, state.screen, state.activeTaskId, state.tasks])

  const touch = useCallback(() => {
    setState((prev) => ({ ...prev, lastInteraction: Date.now() }))
  }, [])

  // Menu items for device context menu
  const getMenuItems = useCallback((task: Task | undefined) => {
    if (!task) return []
    const items: { label: string; action: string }[] = []
    if (task.status === "running") {
      items.push({ label: "Pause", action: "pause" })
    } else {
      items.push({ label: task.elapsed > 0 ? "Resume" : "Start", action: "start" })
    }
    if (task.elapsed > 0) {
      items.push({ label: "Restart", action: "restart" })
    }
    items.push({ label: task.mode === "stopwatch" ? "Switch to Timer" : "Switch to Stopwatch", action: "toggle-mode" })
    items.push({ label: "Rename", action: "rename" })
    items.push({ label: "Delete", action: "delete" })
    items.push({ label: "Back", action: "back" })
    return items
  }, [])

  // Helper: close active split session for a given task
  function closeSplitSession(task: Task, now: number): Split[] {
    if (!task.activeSplitId) return task.splits
    return task.splits.map((sp) =>
      sp.id === task.activeSplitId
        ? {
            ...sp,
            sessions: sp.sessions.map((s, i) =>
              i === sp.sessions.length - 1 && s.end === null ? { ...s, end: now } : s
            ),
          }
        : sp
    )
  }

  // Helper: open a session for the active split
  function openSplitSession(task: Task, now: number): Split[] {
    if (!task.activeSplitId) return task.splits
    return task.splits.map((sp) =>
      sp.id === task.activeSplitId
        ? { ...sp, sessions: [...sp.sessions, { start: now, end: null }] }
        : sp
    )
  }

  // Helpers to start/pause a task (timer mode allows background running)
  const startTask = useCallback((prev: DeviceState, taskId: string): DeviceState => {
    const task = prev.tasks.find((t) => t.id === taskId)
    if (!task) return prev

    const now = Date.now()

    // Only pause other tasks if the new task is NOT in timer mode
    let tasks = prev.tasks
    if (task.mode !== "timer") {
      tasks = tasks.map((t) => {
        if (t.id === taskId || t.status !== "running") return t
        return {
          ...t,
          status: "paused" as TaskStatus,
          sessions: t.sessions.map((s, i) =>
            i === t.sessions.length - 1 && s.end === null ? { ...s, end: now } : s
          ),
          splits: closeSplitSession(t, now),
        }
      })
    }

    tasks = tasks.map((t) =>
      t.id === taskId
        ? {
            ...t,
            status: "running" as TaskStatus,
            sessions: [...t.sessions, { start: now, end: null }],
            splits: openSplitSession(t, now),
          }
        : t
    )
    return { ...prev, screen: "task-active", tasks, activeTaskId: taskId, menuIndex: 0 }
  }, [])

  const pauseTask = useCallback((prev: DeviceState, taskId: string): DeviceState => {
    const now = Date.now()
    return {
      ...prev,
      screen: "task-paused",
      menuIndex: 0,
      tasks: prev.tasks.map((t) => {
        if (t.id !== taskId) return t
        // Close the current session
        const closedSessions = t.sessions.map((s, i) =>
          i === t.sessions.length - 1 && s.end === null ? { ...s, end: now } : s
        )
        // Filter out sessions shorter than MIN_SESSION_MS (false positives from rapid clicking)
        const lastSession = closedSessions[closedSessions.length - 1]
        const wasTooShort = lastSession && lastSession.end !== null &&
          (lastSession.end - lastSession.start) < MIN_SESSION_MS
        const filteredSessions = wasTooShort ? closedSessions.slice(0, -1) : closedSessions
        const elapsedAdjust = wasTooShort && lastSession.end !== null
          ? lastSession.end - lastSession.start
          : 0
        return {
          ...t,
          status: "paused" as TaskStatus,
          elapsed: Math.max(0, t.elapsed - elapsedAdjust),
          sessions: filteredSessions,
          splits: closeSplitSession(t, now),
        }
      }),
    }
  }, [])

  // ROTATE
  const rotate = useCallback(
    (direction: 1 | -1) => {
      touch()
      setState((prev) => {
        if (prev.screen === "idle-clock") {
          return { ...prev, screen: "task-list", selectedIndex: 0 }
        }

        if (prev.screen === "char-picker" && prev.charPicker) {
          const newIdx = (prev.charPicker.charIndex + direction + CHAR_SET.length) % CHAR_SET.length
          return { ...prev, charPicker: { ...prev.charPicker, charIndex: newIdx } }
        }

        if (prev.screen === "task-menu") {
          const items = getMenuItems(prev.tasks[prev.selectedIndex])
          const newIdx = (prev.menuIndex + direction + items.length) % items.length
          return { ...prev, menuIndex: newIdx }
        }

        if (prev.screen === "confirm-delete") {
          return { ...prev, menuIndex: prev.menuIndex === 0 ? 1 : 0 }
        }

        if (
          prev.screen === "task-list" ||
          prev.screen === "task-active" ||
          prev.screen === "task-paused"
        ) {
          const total = prev.tasks.length + 1
          const newIndex = (prev.selectedIndex + direction + total) % total

          let screen: DeviceScreen = "task-list"
          if (newIndex < prev.tasks.length) {
            const task = prev.tasks[newIndex]
            if (task && task.id === prev.activeTaskId) {
              screen = task.status === "running" ? "task-active" : task.status === "paused" ? "task-paused" : "task-list"
            }
          }

          return { ...prev, selectedIndex: newIndex, screen }
        }

        return prev
      })
    },
    [touch, getMenuItems]
  )

  // CLICK
  const click = useCallback(() => {
    touch()
    setState((prev) => {
      if (prev.screen === "idle-clock") {
        return { ...prev, screen: "task-list", selectedIndex: 0 }
      }

      if (prev.screen === "char-picker" && prev.charPicker) {
        const currentChar = CHAR_SET[prev.charPicker.charIndex]
        return {
          ...prev,
          charPicker: { ...prev.charPicker, chars: [...prev.charPicker.chars, currentChar], charIndex: 0 },
        }
      }

      if (prev.screen === "confirm-delete" && prev.deleteTargetId) {
        if (prev.menuIndex === 0) {
          const newTasks = prev.tasks.filter((t) => t.id !== prev.deleteTargetId)
          return {
            ...prev,
            screen: "task-list",
            tasks: newTasks,
            selectedIndex: Math.min(prev.selectedIndex, newTasks.length - 1),
            activeTaskId: prev.activeTaskId === prev.deleteTargetId ? null : prev.activeTaskId,
            deleteTargetId: null,
            menuIndex: 0,
          }
        }
        return { ...prev, screen: "task-menu", deleteTargetId: null, menuIndex: 0 }
      }

      if (prev.screen === "task-menu") {
        const task = prev.tasks[prev.selectedIndex]
        if (!task) return prev
        const items = getMenuItems(task)
        const action = items[prev.menuIndex]?.action

        if (action === "start") return startTask(prev, task.id)
        if (action === "pause") return pauseTask(prev, task.id)
        if (action === "restart") {
          // Reset elapsed + splits sessions, then immediately start
          const newPrev = {
            ...prev,
            tasks: prev.tasks.map((t) =>
              t.id === task.id
                ? {
                    ...t,
                    elapsed: 0,
                    status: "idle" as TaskStatus,
                    sessions: [],
                    splits: t.splits.map((sp) => ({ ...sp, elapsed: 0, sessions: [] })),
                  }
                : t
            ),
          }
          return startTask(newPrev, task.id)
        }
        if (action === "toggle-mode") {
          return {
            ...prev,
            tasks: prev.tasks.map((t) =>
              t.id === task.id
                ? { ...t, mode: (t.mode === "stopwatch" ? "timer" : "stopwatch") as TaskMode }
                : t
            ),
          }
        }
        if (action === "rename") {
          return {
            ...prev,
            screen: "char-picker",
            menuIndex: 0,
            charPicker: { chars: [], charIndex: 0, mode: "rename", targetTaskId: task.id },
          }
        }
        if (action === "delete") {
          if (prev.tasks.length <= 1) return { ...prev, screen: "task-list", menuIndex: 0 }
          return { ...prev, screen: "confirm-delete", deleteTargetId: task.id, menuIndex: 1 }
        }
        if (action === "back") return { ...prev, screen: "task-list", menuIndex: 0 }
        return prev
      }

      // "+ NEW TASK" row
      if (prev.selectedIndex >= prev.tasks.length) {
        return { ...prev, screen: "char-picker", charPicker: { chars: [], charIndex: 0, mode: "new" } }
      }

      const task = prev.tasks[prev.selectedIndex]
      if (!task || prev.screen === "reset-confirm") return prev

      if (task.status === "running") return pauseTask(prev, task.id)
      return startTask(prev, task.id)
    })
  }, [touch, getMenuItems, startTask, pauseTask])

  // HOLD START — context menu on task-list, finish char-picker, or start reset on active/paused
  const holdStart = useCallback(() => {
    touch()

    // Check for char-picker finish or task-menu open first (instant)
    setState((prev) => {
      if (prev.screen === "task-list" && prev.selectedIndex < prev.tasks.length) {
        return { ...prev, screen: "task-menu", menuIndex: 0 }
      }

      if (prev.screen === "char-picker" && prev.charPicker) {
        const name = prev.charPicker.chars.join("").trim()
        if (!name) return { ...prev, screen: "task-list", charPicker: null }

        if (prev.charPicker.mode === "new") {
          const newTask: Task = {
            id: createId(),
            name,
            elapsed: 0,
            status: "idle",
            mode: "stopwatch",
            timerDuration: 25 * 60 * 1000,
            sessions: [],
            splits: [],
            activeSplitId: null,
          }
          const newTasks = [...prev.tasks, newTask]
          return { ...prev, screen: "task-list", tasks: newTasks, selectedIndex: newTasks.length - 1, charPicker: null }
        }

        if (prev.charPicker.mode === "rename" && prev.charPicker.targetTaskId) {
          return {
            ...prev,
            screen: "task-list",
            tasks: prev.tasks.map((t) => (t.id === prev.charPicker!.targetTaskId ? { ...t, name } : t)),
            charPicker: null,
          }
        }
        return prev
      }

      return prev
    })

    // Start the fast visual reset (600ms) for active/paused screens
    holdStartTimeRef.current = Date.now()

    const animate = () => {
      const elapsed = Date.now() - (holdStartTimeRef.current ?? Date.now())
      const progress = Math.min(elapsed / RESET_DURATION, 1)

      setState((prev) => {
        if (prev.screen !== "task-active" && prev.screen !== "task-paused" && prev.screen !== "reset-confirm") {
          holdStartTimeRef.current = null
          return prev
        }

        if (progress < 1) {
          return { ...prev, screen: "reset-confirm", resetProgress: progress }
        }

        // Reset complete
        const task = prev.tasks[prev.selectedIndex]
        if (!task) return prev
        holdStartTimeRef.current = null
        return {
          ...prev,
          screen: "task-list",
          resetProgress: 0,
          activeTaskId: prev.activeTaskId === task.id ? null : prev.activeTaskId,
          tasks: prev.tasks.map((t) =>
            t.id === task.id
              ? {
                  ...t,
                  elapsed: 0,
                  status: "idle" as TaskStatus,
                  sessions: [],
                  splits: t.splits.map((sp) => ({ ...sp, elapsed: 0, sessions: [] })),
                }
              : t
          ),
        }
      })

      if (progress < 1 && holdStartTimeRef.current !== null) {
        holdRafRef.current = requestAnimationFrame(animate)
      }
    }

    // Only start RAF loop if we're on an active/paused screen
    setState((prev) => {
      if (prev.screen === "task-active" || prev.screen === "task-paused") {
        holdRafRef.current = requestAnimationFrame(animate)
      }
      return prev
    })
  }, [touch])

  const holdEnd = useCallback(() => {
    holdStartTimeRef.current = null
    if (holdRafRef.current) {
      cancelAnimationFrame(holdRafRef.current)
      holdRafRef.current = null
    }
    setState((prev) => {
      if (prev.resetProgress > 0 && prev.resetProgress < 1) {
        // Cancelled before completion — go back
        const task = prev.tasks[prev.selectedIndex]
        const screen = task
          ? task.status === "running"
            ? "task-active"
            : task.status === "paused"
            ? "task-paused"
            : "task-list"
          : "task-list"
        return { ...prev, resetProgress: 0, screen: screen as DeviceScreen }
      }
      return { ...prev, resetProgress: 0 }
    })
  }, [])

  // CHAR BACKSPACE
  const charBackspace = useCallback(() => {
    touch()
    setState((prev) => {
      if (prev.screen !== "char-picker" || !prev.charPicker) return prev
      if (prev.charPicker.chars.length === 0) return { ...prev, screen: "task-list", charPicker: null }
      return { ...prev, charPicker: { ...prev.charPicker, chars: prev.charPicker.chars.slice(0, -1) } }
    })
  }, [touch])

  // === WEB-ONLY actions ===
  const addTask = useCallback(
    (name: string) => {
      touch()
      setState((prev) => ({
        ...prev,
        tasks: [
          ...prev.tasks,
          {
            id: createId(),
            name,
            elapsed: 0,
            status: "idle" as TaskStatus,
            mode: "stopwatch" as TaskMode,
            timerDuration: 25 * 60 * 1000,
            sessions: [],
            splits: [],
            activeSplitId: null,
          },
        ],
      }))
    },
    [touch]
  )

  const renameTask = useCallback(
    (taskId: string, newName: string) => {
      touch()
      setState((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, name: newName } : t)),
      }))
    },
    [touch]
  )

  const deleteTask = useCallback(
    (taskId: string) => {
      touch()
      setState((prev) => {
        if (prev.tasks.length <= 1) return prev
        const newTasks = prev.tasks.filter((t) => t.id !== taskId)
        return {
          ...prev,
          tasks: newTasks,
          selectedIndex: Math.min(prev.selectedIndex, newTasks.length - 1),
          activeTaskId: prev.activeTaskId === taskId ? null : prev.activeTaskId,
        }
      })
    },
    [touch]
  )

  const toggleTaskMode = useCallback(
    (taskId: string) => {
      touch()
      setState((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) =>
          t.id === taskId ? { ...t, mode: (t.mode === "stopwatch" ? "timer" : "stopwatch") as TaskMode } : t
        ),
      }))
    },
    [touch]
  )

  const setTimerDuration = useCallback(
    (taskId: string, durationMs: number) => {
      touch()
      setState((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, timerDuration: durationMs } : t)),
      }))
    },
    [touch]
  )

  const restartTask = useCallback(
    (taskId: string) => {
      touch()
      setState((prev) => {
        // Reset then start — keep split names but clear their elapsed and sessions
        let updated = {
          ...prev,
          tasks: prev.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  elapsed: 0,
                  status: "idle" as TaskStatus,
                  sessions: [],
                  splits: t.splits.map((sp) => ({ ...sp, elapsed: 0, sessions: [] })),
                }
              : t
          ),
        }
        // Pause any other running task
        updated = {
          ...updated,
          tasks: updated.tasks.map((t) => {
            if (t.id === taskId || t.status !== "running") return t
            return {
              ...t,
              status: "paused" as TaskStatus,
              sessions: t.sessions.map((s, i) =>
                i === t.sessions.length - 1 && s.end === null ? { ...s, end: Date.now() } : s
              ),
              splits: closeSplitSession(t, Date.now()),
            }
          }),
        }
        // Start the task (opens split session if activeSplitId is set)
        const targetTask = updated.tasks.find((t) => t.id === taskId)
        if (!targetTask) return prev
        const now = Date.now()
        updated = {
          ...updated,
          tasks: updated.tasks.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  status: "running" as TaskStatus,
                  sessions: [{ start: now, end: null }],
                  splits: openSplitSession(t, now),
                }
              : t
          ),
          activeTaskId: taskId,
          screen: "task-active" as DeviceScreen,
        }
        setTimeout(() => {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks: updated.tasks, activeTaskId: updated.activeTaskId }))
          } catch { /* ignore */ }
        }, 0)
        return updated
      })
    },
    [touch]
  )

  const stopTask = useCallback(
    (taskId: string) => {
      touch()
      setState((prev) => {
        const now = Date.now()
        const newState = {
          ...prev,
          activeTaskId: prev.activeTaskId === taskId ? null : prev.activeTaskId,
          screen: prev.activeTaskId === taskId ? "task-list" as DeviceScreen : prev.screen,
          tasks: prev.tasks.map((t) => {
            if (t.id !== taskId) return t
            const closedSessions = t.sessions.map((s, i) =>
              i === t.sessions.length - 1 && s.end === null ? { ...s, end: now } : s
            )
            return {
              ...t,
              elapsed: 0,
              status: "idle" as TaskStatus,
              sessions: closedSessions,
              splits: closeSplitSession(t, now),
            }
          }),
        }
        setTimeout(() => {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks: newState.tasks, activeTaskId: newState.activeTaskId }))
          } catch { /* ignore */ }
        }, 0)
        return newState
      })
    },
    [touch]
  )

  const deleteSession = useCallback(
    (taskId: string, sessionStart: number) => {
      touch()
      setState((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) => {
          if (t.id !== taskId) return t
          const sessionIdx = t.sessions.findIndex((s) => s.start === sessionStart)
          if (sessionIdx === -1) return t
          const session = t.sessions[sessionIdx]
          const duration = session.end !== null
            ? session.end - session.start
            : Date.now() - session.start
          const wasRunning = session.end === null
          const newSessions = t.sessions.filter((_, i) => i !== sessionIdx)
          return {
            ...t,
            elapsed: Math.max(0, t.elapsed - duration),
            status: wasRunning ? "paused" as TaskStatus : t.status,
            sessions: newSessions,
          }
        }),
      }))
    },
    [touch]
  )

  // === SPLIT actions ===

  const addSplit = useCallback(
    (taskId: string, name: string) => {
      touch()
      setState((prev) => {
        const task = prev.tasks.find((t) => t.id === taskId)
        if (!task) return prev

        const now = Date.now()
        const newSplitId = createId()

        // Close current active split session if task is running
        let splits = task.activeSplitId && task.status === "running"
          ? closeSplitSession(task, now)
          : task.splits

        // Create new split — open its session immediately if task is running
        const newSplit: Split = {
          id: newSplitId,
          name,
          elapsed: 0,
          sessions: task.status === "running" ? [{ start: now, end: null }] : [],
        }

        splits = [...splits, newSplit]

        return {
          ...prev,
          tasks: prev.tasks.map((t) =>
            t.id === taskId ? { ...t, splits, activeSplitId: newSplitId } : t
          ),
        }
      })
    },
    [touch]
  )

  const setActiveSplit = useCallback(
    (taskId: string, splitId: string | null) => {
      touch()
      setState((prev) => {
        const task = prev.tasks.find((t) => t.id === taskId)
        if (!task) return prev

        const now = Date.now()
        let splits = task.splits

        // Close current active split session if task is running
        if (task.status === "running" && task.activeSplitId) {
          splits = closeSplitSession({ ...task, splits }, now)
        }

        // Open new split session if task is running and a split is selected
        if (task.status === "running" && splitId) {
          splits = openSplitSession({ ...task, splits, activeSplitId: splitId }, now)
        }

        return {
          ...prev,
          tasks: prev.tasks.map((t) =>
            t.id === taskId ? { ...t, splits, activeSplitId: splitId } : t
          ),
        }
      })
    },
    [touch]
  )

  const renameSplit = useCallback(
    (taskId: string, splitId: string, name: string) => {
      touch()
      setState((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) =>
          t.id === taskId
            ? { ...t, splits: t.splits.map((sp) => (sp.id === splitId ? { ...sp, name } : sp)) }
            : t
        ),
      }))
    },
    [touch]
  )

  const deleteSplit = useCallback(
    (taskId: string, splitId: string) => {
      touch()
      setState((prev) => {
        const task = prev.tasks.find((t) => t.id === taskId)
        if (!task) return prev

        const now = Date.now()
        // Close session first if we're deleting the active running split
        let splits = task.status === "running" && task.activeSplitId === splitId
          ? closeSplitSession(task, now)
          : task.splits

        splits = splits.filter((sp) => sp.id !== splitId)
        const newActiveSplitId = task.activeSplitId === splitId ? null : task.activeSplitId

        return {
          ...prev,
          tasks: prev.tasks.map((t) =>
            t.id === taskId ? { ...t, splits, activeSplitId: newActiveSplitId } : t
          ),
        }
      })
    },
    [touch]
  )

  const deleteSplitSession = useCallback(
    (taskId: string, splitId: string, sessionStart: number) => {
      touch()
      setState((prev) => ({
        ...prev,
        tasks: prev.tasks.map((t) => {
          if (t.id !== taskId) return t
          return {
            ...t,
            splits: t.splits.map((sp) => {
              if (sp.id !== splitId) return sp
              const sessionIdx = sp.sessions.findIndex((s) => s.start === sessionStart)
              if (sessionIdx === -1) return sp
              const session = sp.sessions[sessionIdx]
              const duration = session.end !== null
                ? session.end - session.start
                : Date.now() - session.start
              return {
                ...sp,
                elapsed: Math.max(0, sp.elapsed - duration),
                sessions: sp.sessions.filter((_, i) => i !== sessionIdx),
              }
            }),
          }
        }),
      }))
    },
    [touch]
  )

  const webPlayPause = useCallback(
    (taskId: string) => {
      touch()
      setState((prev) => {
        const task = prev.tasks.find((t) => t.id === taskId)
        if (!task) return prev
        const newState = task.status === "running" ? pauseTask(prev, taskId) : startTask(prev, taskId)
        // Immediately persist so other windows (popup) get the storage event
        setTimeout(() => {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ tasks: newState.tasks, activeTaskId: newState.activeTaskId }))
          } catch { /* ignore */ }
        }, 0)
        return newState
      })
    },
    [touch, startTask, pauseTask]
  )

  const goTo = useCallback(
    (screen: DeviceScreen) => {
      touch()
      setState((prev) => ({ ...prev, screen }))
    },
    [touch]
  )

  const totalToday = state.tasks.reduce((sum, t) => sum + t.elapsed, 0)

  return {
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
    goTo,
    totalToday,
    getMenuItems,
  }
}
