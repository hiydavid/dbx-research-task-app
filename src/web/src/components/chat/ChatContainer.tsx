import { useRef, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { ToolIndicator } from './ToolIndicator'
import { useChat } from '@/hooks/useChat'
import { ScrollArea } from '@/components/ui/scroll-area'

interface ChatContainerProps {
  sessionId?: string
  onSessionChange?: (sessionId: string | null) => void
}

export function ChatContainer({ sessionId, onSessionChange }: ChatContainerProps) {
  const {
    messages,
    isStreaming,
    isLoadingSession,
    sendMessage,
    stopStreaming,
    loadSession,
    currentToolUse,
    sessionId: activeSessionId,
  } = useChat(sessionId)
  const scrollRef = useRef<HTMLDivElement>(null)
  const hasLoadedSession = useRef(false)

  // Load session on mount if sessionId is provided
  useEffect(() => {
    if (sessionId && !hasLoadedSession.current) {
      hasLoadedSession.current = true
      loadSession(sessionId)
    }
  }, [sessionId, loadSession])

  // Notify parent when session ID changes
  useEffect(() => {
    if (activeSessionId && onSessionChange) {
      onSessionChange(activeSessionId)
    }
  }, [activeSessionId, onSessionChange])

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, currentToolUse])

  if (isLoadingSession) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="mt-2 text-muted-foreground">Loading conversation...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-4">
        <div className="max-w-3xl mx-auto">
          <MessageList messages={messages} isStreaming={isStreaming} />
          {currentToolUse && <ToolIndicator toolName={currentToolUse} />}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      <div className="border-t p-4">
        <div className="max-w-3xl mx-auto">
          <ChatInput
            onSend={sendMessage}
            onStop={stopStreaming}
            disabled={isStreaming}
            isStreaming={isStreaming}
          />
        </div>
      </div>
    </div>
  )
}
