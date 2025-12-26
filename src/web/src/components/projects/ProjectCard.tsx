import { FileText, Clock, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { Session } from '@/types'

interface ProjectCardProps {
  session: Session
  onClick: () => void
  onDelete?: (e: React.MouseEvent) => void
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return 'Today'
  } else if (diffDays === 1) {
    return 'Yesterday'
  } else if (diffDays < 7) {
    return `${diffDays} days ago`
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    })
  }
}

export function ProjectCard({ session, onClick, onDelete }: ProjectCardProps) {
  return (
    <Card
      className={cn(
        'group relative cursor-pointer p-5 transition-all duration-200',
        'hover:shadow-md hover:border-primary/20 hover:bg-accent/50',
        'min-h-[140px] flex flex-col justify-between'
      )}
      onClick={onClick}
    >
      {/* Delete button */}
      {onDelete && (
        <button
          onClick={onDelete}
          className={cn(
            'absolute top-3 right-3 p-1.5 rounded-md',
            'text-muted-foreground hover:text-destructive hover:bg-destructive/10',
            'opacity-0 group-hover:opacity-100 transition-opacity',
            'focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring'
          )}
          aria-label="Delete project"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}

      {/* Icon and title */}
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-lg bg-primary/10 text-primary">
          <FileText className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-foreground truncate pr-6">
            {session.id}
          </h3>
        </div>
      </div>

      {/* Timestamp */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-3">
        <Clock className="h-3 w-3" />
        <span>{formatDate(session.modified)}</span>
      </div>
    </Card>
  )
}
