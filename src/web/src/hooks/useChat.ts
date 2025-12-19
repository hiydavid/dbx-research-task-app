import { useState, useCallback, useRef } from 'react'
import type { Message } from '@/types'

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [currentToolUse, setCurrentToolUse] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
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

  return {
    messages,
    isStreaming,
    sendMessage,
    stopStreaming,
    clearMessages,
    currentToolUse,
    sessionId
  }
}
