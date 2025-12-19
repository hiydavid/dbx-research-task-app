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
  modified: number
}
