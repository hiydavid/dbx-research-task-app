import { useState, useCallback, useRef } from 'react'
import type { Message } from '@/types'

// Regex to detect research task commands from planner agent
const RESEARCH_TASK_REGEX = /:::research_task\n([\s\S]*?)\n:::/g

interface ResearchTaskRequest {
  topic: string
  scope: string
  output: string
}

/**
 * Detect research task commands in assistant message content.
 * Planner agent outputs :::research_task JSON ::: blocks to trigger research.
 */
function detectResearchTasks(content: string): ResearchTaskRequest[] {
  const matches = [...content.matchAll(RESEARCH_TASK_REGEX)]
  return matches.map((match) => {
    try {
      return JSON.parse(match[1]) as ResearchTaskRequest
    } catch {
      console.error('Failed to parse research task:', match[1])
      return null
    }
  }).filter((task): task is ResearchTaskRequest => task !== null)
}

/**
 * Start a research task via the API.
 */
async function startResearchTask(sessionId: string, task: ResearchTaskRequest): Promise<void> {
  const prompt = `Research Topic: ${task.topic}\nScope: ${task.scope}\nOutput Format: ${task.output}`

  try {
    const response = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        prompt,
        mode: 'background',
      }),
    })

    if (!response.ok) {
      console.error('Failed to start research task:', await response.text())
    } else {
      const data = await response.json()
      console.log('Research task started:', data.task_id)
    }
  } catch (error) {
    console.error('Error starting research task:', error)
  }
}

export function useChat(initialSessionId?: string | null) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [isLoadingSession, setIsLoadingSession] = useState(false)
  const [currentToolUse, setCurrentToolUse] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId ?? null)
  const abortRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return

    // Add user message
    setMessages(prev => [...prev, { role: 'user', content }])
    setIsStreaming(true)
    setCurrentToolUse(null)

    // Start assistant message accumulator
    let assistantContent = ''
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])

    try {
      abortRef.current = new AbortController()

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          session_id: sessionId,
        }),
        signal: abortRef.current.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) throw new Error('No reader available')

      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('event:')) {
            // Event type line - we'll use the data line next
            continue
          }

          if (line.startsWith('data:')) {
            try {
              const data = JSON.parse(line.slice(5).trim())

              if (data.text) {
                assistantContent += data.text
                setMessages(prev => [
                  ...prev.slice(0, -1),
                  { role: 'assistant', content: assistantContent }
                ])
              }

              if (data.name) {
                setCurrentToolUse(data.name)
              }

              if (data.session_id) {
                setSessionId(data.session_id)
              }
            } catch {
              // Ignore JSON parse errors for malformed data
            }
          }
        }
      }
      // After streaming completes, check for research task commands
      if (assistantContent && sessionId) {
        const researchTasks = detectResearchTasks(assistantContent)
        for (const task of researchTasks) {
          await startResearchTask(sessionId, task)
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Request was aborted, ignore
        return
      }
      console.error('Chat error:', error)
      // Update last message with error
      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}` }
      ])
    } finally {
      setIsStreaming(false)
      setCurrentToolUse(null)
    }
  }, [sessionId])

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
    setSessionId(null)
  }, [])

  const loadSession = useCallback(async (id: string) => {
    setIsLoadingSession(true)
    try {
      const response = await fetch(`/api/sessions/${id}`)
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`)
      }
      const data = await response.json()
      // Convert conversation history to messages
      const loadedMessages: Message[] = (data.conversation || []).map(
        (msg: { role: string; content: string | { type: string; text?: string }[] }) => ({
          role: msg.role as 'user' | 'assistant',
          content: typeof msg.content === 'string'
            ? msg.content
            : msg.content
                .filter((block: { type: string }) => block.type === 'text')
                .map((block: { text?: string }) => block.text || '')
                .join(''),
        })
      )
      setMessages(loadedMessages)
      setSessionId(id)
    } catch (error) {
      console.error('Failed to load session:', error)
    } finally {
      setIsLoadingSession(false)
    }
  }, [])

  return {
    messages,
    isStreaming,
    isLoadingSession,
    sendMessage,
    stopStreaming,
    clearMessages,
    loadSession,
    currentToolUse,
    sessionId
  }
}
