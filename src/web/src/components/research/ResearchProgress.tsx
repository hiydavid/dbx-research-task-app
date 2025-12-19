import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Play, Loader2 } from 'lucide-react'

interface ResearchProgressProps {
  isRunning?: boolean
}

export function ResearchProgress({ isRunning = false }: ResearchProgressProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Research Progress</CardTitle>
      </CardHeader>
      <CardContent>
        {isRunning ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Research in progress...</span>
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              No active research. Start a conversation to define your research scope.
            </p>
            <Button variant="outline" size="sm" className="w-full" disabled>
              <Play className="h-4 w-4 mr-2" />
              Start Background Research
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  )
}
