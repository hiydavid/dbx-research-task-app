import type { Message } from '@/types'
import { MessageBubble } from './MessageBubble'

interface MessageListProps {
  messages: Message[]
}

export function MessageList({ messages }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <h2 className="text-xl font-semibold mb-2">Research Assistant</h2>
        <p className="text-muted-foreground max-w-md">
          Start a conversation to define your research scope.
          I can search the web, analyze sources, and write structured reports.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {messages.map((message, index) => (
        <MessageBubble key={index} message={message} />
      ))}
    </div>
  )
}
