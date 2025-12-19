import { useRef, useEffect } from 'react'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { ToolIndicator } from './ToolIndicator'
import { useChat } from '@/hooks/useChat'
import { ScrollArea } from '@/components/ui/scroll-area'

export function ChatContainer() {
  const { messages, isStreaming, sendMessage, stopStreaming, currentToolUse } = useChat()
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll on new messages
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, currentToolUse])

  return (
    <div className="flex flex-col h-full">
      <ScrollArea className="flex-1 p-4">
        <div className="max-w-3xl mx-auto">
          <MessageList messages={messages} />
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
