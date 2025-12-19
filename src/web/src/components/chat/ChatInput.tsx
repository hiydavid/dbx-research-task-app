import { useState, useCallback, type KeyboardEvent } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Send, Square } from 'lucide-react'

interface ChatInputProps {
  onSend: (message: string) => void
  onStop?: () => void
  disabled?: boolean
  isStreaming?: boolean
}

export function ChatInput({ onSend, onStop, disabled, isStreaming }: ChatInputProps) {
  const [input, setInput] = useState('')

  const handleSend = useCallback(() => {
    if (input.trim() && !disabled) {
      onSend(input.trim())
      setInput('')
    }
  }, [input, disabled, onSend])

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  return (
    <div className="flex gap-2">
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type your message..."
        disabled={disabled}
        className="flex-1"
      />
      {isStreaming ? (
        <Button onClick={onStop} variant="destructive" size="icon">
          <Square className="h-4 w-4" />
        </Button>
      ) : (
        <Button onClick={handleSend} disabled={disabled || !input.trim()} size="icon">
          <Send className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
