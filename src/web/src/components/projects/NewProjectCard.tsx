import { Plus } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface NewProjectCardProps {
  onClick: () => void
}

export function NewProjectCard({ onClick }: NewProjectCardProps) {
  return (
    <Card
      className={cn(
        'cursor-pointer p-5 transition-all duration-200',
        'border-dashed border-2 hover:border-primary/50 hover:bg-accent/50',
        'min-h-[140px] flex flex-col items-center justify-center gap-3',
        'group'
      )}
      onClick={onClick}
    >
      <div
        className={cn(
          'p-3 rounded-full bg-primary/10 text-primary',
          'group-hover:bg-primary group-hover:text-primary-foreground',
          'transition-colors duration-200'
        )}
      >
        <Plus className="h-6 w-6" />
      </div>
      <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
        Start a Research Project
      </span>
    </Card>
  )
}
