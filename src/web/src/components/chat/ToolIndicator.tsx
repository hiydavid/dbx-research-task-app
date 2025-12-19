import { Loader2 } from 'lucide-react'

interface ToolIndicatorProps {
  toolName: string
}

export function ToolIndicator({ toolName }: ToolIndicatorProps) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse px-4 py-2">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>Using {toolName}...</span>
    </div>
  )
}
