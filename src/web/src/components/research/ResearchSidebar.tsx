import { ResearchProgress } from './ResearchProgress'
import { ResearchOutput } from './ResearchOutput'

export function ResearchSidebar() {
  return (
    <aside className="w-80 border-l bg-muted/10 p-4 hidden lg:block overflow-auto">
      <div className="space-y-4">
        <ResearchProgress />
        <ResearchOutput />
      </div>
    </aside>
  )
}
