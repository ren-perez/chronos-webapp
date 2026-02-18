"use client"

import { useState, useCallback, useRef, useEffect } from "react"

export type TaskStatus = "idle" | "running" | "paused"
export type TaskMode = "stopwatch" | "timer"

export interface Task {
  id: string
  name: string
  elapsed: number // ms accumulated
  status: TaskStatus
  mode: TaskMode
  timerDuration: number // ms, only used in timer mode
  sessions: { start: number; end: number | null }[]
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

const DEFAULT_TASKS: Omit<Task, "id">[] = [
  { name: "Work", elapsed: 0, status: "idle", mode: "stopwatch", timerDuration: 25 * 60 * 1000, sessions: [] },
  { name: "Study", elapsed: 0, status: "idle", mode: "stopwatch", timerDuration: 25 * 60 * 1000, sessions: [] },
  { name: "Break", elapsed: 0, status: "idle", mode: "timer", timerDuration: 5 * 60 * 1000, sessions: [] },
]

function createId() {
  return Math.random().toString(36).slice(2, 9)
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

  // Tick ALL running tasks every 100ms (supports background timers)
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setState((prev) => {
        let tasks = prev.tasks
        let screenUpdate = prev.screen
        let anyChanged = false

        for (const task of tasks) {
          if (task.status !== "running") continue

          anyChanged = true
          const newElapsed = task.elapsed + 100

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
                        ? { ...s, end: Date.now() }
                        : s
                    ),
                  }
                : t
            )
            if (prev.activeTaskId === task.id && prev.screen === "task-active") {
              screenUpdate = "task-paused"
            }
          } else {
            tasks = tasks.map((t) =>
              t.id === task.id ? { ...t, elapsed: newElapsed } : t
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

  // Helpers to start/pause a task (timer mode allows background running)
  const startTask = useCallback((prev: DeviceState, taskId: string): DeviceState => {
    const task = prev.tasks.find((t) => t.id === taskId)
    if (!task) return prev

    // Only pause other tasks if the new task is NOT in timer mode
    let tasks = prev.tasks
    if (task.mode !== "timer") {
      tasks = tasks.map((t) =>
        t.id !== taskId && t.status === "running"
          ? {
              ...t,
              status: "paused" as TaskStatus,
              sessions: t.sessions.map((s, i) =>
                i === t.sessions.length - 1 && s.end === null ? { ...s, end: Date.now() } : s
              ),
            }
          : t
      )
    }

    tasks = tasks.map((t) =>
      t.id === taskId
        ? { 
            ...t, 
            status: "running" as TaskStatus, 
            sessions: [...t.sessions, { start: Date.now(), end: null }] 
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
        }
      }),
    }
  }, [])

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
          // Reset elapsed and immediately start
          let newPrev = {
            ...prev,
            tasks: prev.tasks.map((t) =>
              t.id === task.id ? { ...t, elapsed: 0, status: "idle" as TaskStatus, sessions: [] } : t
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
            t.id === task.id ? { ...t, elapsed: 0, status: "idle" as TaskStatus, sessions: [] } : t
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
          { id: createId(), name, elapsed: 0, status: "idle", mode: "stopwatch" as TaskMode, timerDuration: 25 * 60 * 1000, sessions: [] },
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
        // Reset then start
        let updated = {
          ...prev,
          tasks: prev.tasks.map((t) =>
            t.id === taskId ? { ...t, elapsed: 0, status: "idle" as TaskStatus, sessions: [] } : t
          ),
        }
        // Pause any other running task
        updated = {
          ...updated,
          tasks: updated.tasks.map((t) =>
            t.id !== taskId && t.status === "running"
              ? {
                  ...t,
                  status: "paused" as TaskStatus,
                  sessions: t.sessions.map((s, i) =>
                    i === t.sessions.length - 1 && s.end === null ? { ...s, end: Date.now() } : s
                  ),
                }
              : t
          ),
        }
        // Start the task
        updated = {
          ...updated,
          tasks: updated.tasks.map((t) =>
            t.id === taskId
              ? { ...t, status: "running" as TaskStatus, sessions: [{ start: Date.now(), end: null }] }
              : t
          ),
          activeTaskId: taskId,
          screen: "task-active" as DeviceScreen,
        }
        return updated
      })
    },
    [touch]
  )

  const stopTask = useCallback(
    (taskId: string) => {
      touch()
      setState((prev) => ({
        ...prev,
        activeTaskId: prev.activeTaskId === taskId ? null : prev.activeTaskId,
        screen: prev.activeTaskId === taskId ? "task-list" as DeviceScreen : prev.screen,
        tasks: prev.tasks.map((t) => {
          if (t.id !== taskId) return t
          // Close any open session, then reset elapsed/status but keep sessions for the activity log
          const closedSessions = t.sessions.map((s, i) =>
            i === t.sessions.length - 1 && s.end === null ? { ...s, end: Date.now() } : s
          )
          return { ...t, elapsed: 0, status: "idle" as TaskStatus, sessions: closedSessions }
        }),
      }))
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

  const webPlayPause = useCallback(
    (taskId: string) => {
      touch()
      setState((prev) => {
        const task = prev.tasks.find((t) => t.id === taskId)
        if (!task) return prev
        if (task.status === "running") return pauseTask(prev, taskId)
        return startTask(prev, taskId)
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
    webPlayPause,
    goTo,
    totalToday,
    getMenuItems,
  }
}
