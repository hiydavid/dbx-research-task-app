import { cn } from '@/lib/utils'
import type { Message } from '@/types'
import { User, Bot, Loader2, Search } from 'lucide-react'
import { useMemo } from 'react'

interface MessageBubbleProps {
  message: Message
  isStreaming?: boolean
  isLastMessage?: boolean
}

interface ResearchTaskBlock {
  topic: string
  scope: string
  output: string
}

// Regex to match research task blocks
const RESEARCH_TASK_REGEX = /:::research_task\n([\s\S]*?)\n:::/g

/**
 * Parse content and split into text segments and research task blocks.
 */
function parseContent(content: string): Array<{ type: 'text'; content: string } | { type: 'research_task'; task: ResearchTaskBlock }> {
  const parts: Array<{ type: 'text'; content: string } | { type: 'research_task'; task: ResearchTaskBlock }> = []
  let lastIndex = 0
  let match

  const regex = new RegExp(RESEARCH_TASK_REGEX.source, 'g')
  while ((match = regex.exec(content)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index).trim()
      if (text) {
        parts.push({ type: 'text', content: text })
      }
    }

    // Parse and add the research task
    try {
      const task = JSON.parse(match[1]) as ResearchTaskBlock
      parts.push({ type: 'research_task', task })
    } catch {
      // If parsing fails, treat as text
      parts.push({ type: 'text', content: match[0] })
    }

    lastIndex = match.index + match[0].length
  }

  // Add remaining text
  if (lastIndex < content.length) {
    const text = content.slice(lastIndex).trim()
    if (text) {
      parts.push({ type: 'text', content: text })
    }
  }

  return parts.length > 0 ? parts : [{ type: 'text', content }]
}

/**
 * Render a research task block as a styled card.
 */
function ResearchTaskCard({ task }: { task: ResearchTaskBlock }) {
  return (
    <div className="my-3 p-3 rounded-lg border bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
      <div className="flex items-center gap-2 mb-2">
        <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <Search className="h-4 w-4" />
        </div>
        <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
          Research Started
        </span>
      </div>
      <div className="space-y-1 text-sm">
        <div>
          <span className="font-medium text-blue-800 dark:text-blue-200">Topic:</span>{' '}
          <span className="text-blue-700 dark:text-blue-300">{task.topic}</span>
        </div>
        {task.scope && (
          <div>
            <span className="font-medium text-blue-800 dark:text-blue-200">Scope:</span>{' '}
            <span className="text-blue-700 dark:text-blue-300">{task.scope}</span>
          </div>
        )}
      </div>
      <p className="mt-2 text-xs text-blue-600 dark:text-blue-400">
        Check the sidebar for progress updates
      </p>
    </div>
  )
}

export function MessageBubble({ message, isStreaming = false, isLastMessage = false }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const showTypingIndicator = !isUser && message.content === '' && isStreaming && isLastMessage

  // Parse assistant messages to detect research task blocks
  const parsedContent = useMemo(() => {
    if (isUser) {
      return [{ type: 'text' as const, content: message.content }]
    }
    return parseContent(message.content)
  }, [message.content, isUser])

  return (
    <div className={cn('flex gap-3 mb-4', isUser && 'flex-row-reverse')}>
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div
        className={cn(
          'rounded-lg px-4 py-2 max-w-[80%]',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted'
        )}
      >
        {showTypingIndicator ? (
          <div className="flex items-center gap-1 py-1">
            <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        ) : (
          parsedContent.map((part, index) => (
            part.type === 'text' ? (
              <p key={index} className="text-sm whitespace-pre-wrap">{part.content}</p>
            ) : (
              <ResearchTaskCard key={index} task={part.task} />
            )
          ))
        )}
      </div>
    </div>
  )
}
