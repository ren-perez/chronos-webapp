export function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (hours > 0) {
    return `${hours}:${pad(minutes)}:${pad(seconds)}`
  }
  return `${pad(minutes)}:${pad(seconds)}`
}

export function formatElapsedCompact(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

export function formatClock(date: Date): string {
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const ampm = hours >= 12 ? "PM" : "AM"
  const h = hours % 12 || 12
  return `${h}:${pad(minutes)} ${ampm}`
}

export function formatClockSmall(date: Date): string {
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const h = hours % 12 || 12
  return `${h}:${pad(minutes)}`
}

function pad(n: number): string {
  return n.toString().padStart(2, "0")
}

export function formatDuration(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours > 0 && minutes > 0) return `${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h`
  if (minutes > 0) return `${minutes}m`
  return "< 1m"
}
