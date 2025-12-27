import { useEffect, useRef } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Play, Loader2, Square, CheckCircle, XCircle, Clock } from 'lucide-react'
import type { ResearchTask } from '@/types'

interface ResearchProgressProps {
  task?: ResearchTask | null
  recentTasks?: ResearchTask[]
  onStartResearch?: (prompt: string) => void
  onCancel?: () => void
  onTaskComplete?: () => void
  isStarting?: boolean
  disabled?: boolean
}

export function ResearchProgress({
  task,
  recentTasks = [],
  onStartResearch,
  onCancel,
  onTaskComplete,
  isStarting = false,
  disabled = false,
}: ResearchProgressProps) {
  const isRunning = task?.status === 'running'
  const isPending = task?.status === 'pending'
  const isActive = isRunning || isPending
  const prevStatusRef = useRef<string | null>(null)

  // Detect task completion
  useEffect(() => {
    if (task && prevStatusRef.current === 'running' && task.status === 'completed') {
      onTaskComplete?.()
    }
    prevStatusRef.current = task?.status || null
  }, [task?.status, onTaskComplete])

  const handleStartClick = () => {
    onStartResearch?.('Continue researching based on our conversation and create a comprehensive report')
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Research Progress</CardTitle>
      </CardHeader>
      <CardContent>
        {isActive ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-muted-foreground">
                {task?.progressMessage || 'Research in progress...'}
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${(task?.progress || 0) * 100}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{Math.round((task?.progress || 0) * 100)}% complete</span>
              {onCancel && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={onCancel}
                >
                  <Square className="h-3 w-3 mr-1" />
                  Cancel
                </Button>
              )}
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              {disabled
                ? 'Start a conversation to enable background research.'
                : 'No active research. Click below to start background research.'}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleStartClick}
              disabled={disabled || isStarting}
            >
              {isStarting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              {isStarting ? 'Starting...' : 'Start Background Research'}
            </Button>
          </>
        )}

        {/* Recent tasks */}
        {recentTasks.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs font-medium text-muted-foreground mb-2">Recent Tasks</p>
            <ul className="space-y-2">
              {recentTasks.map((t) => (
                <li key={t.id} className="flex items-start gap-2 text-xs">
                  <span className="mt-0.5">
                    {t.status === 'completed' && (
                      <CheckCircle className="h-3 w-3 text-green-500" />
                    )}
                    {t.status === 'failed' && (
                      <XCircle className="h-3 w-3 text-red-500" />
                    )}
                    {t.status === 'running' && (
                      <Loader2 className="h-3 w-3 animate-spin text-primary" />
                    )}
                    {t.status === 'pending' && (
                      <Clock className="h-3 w-3 text-muted-foreground" />
                    )}
                    {t.status === 'cancelled' && (
                      <Square className="h-3 w-3 text-muted-foreground" />
                    )}
                  </span>
                  <span className="truncate text-muted-foreground flex-1">
                    {t.prompt.length > 40 ? t.prompt.slice(0, 40) + '...' : t.prompt}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
