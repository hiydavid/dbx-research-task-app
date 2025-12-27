export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatEvent {
  type: 'token' | 'tool_use' | 'system' | 'done' | 'error'
  data: Record<string, unknown>
}

export interface Session {
  id: string
  title?: string
  modified: number
}

// Task types
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface ResearchTask {
  id: string
  prompt: string
  status: TaskStatus
  progress: number
  progressMessage?: string
  startedAt?: string
  completedAt?: string
  errorMessage?: string
  totalCostUsd?: number
  createdAt: string
}

export interface OutputFile {
  id: string
  filename: string
  filepath: string
  fileType: string
  fileSize: number
  createdAt: string
}
