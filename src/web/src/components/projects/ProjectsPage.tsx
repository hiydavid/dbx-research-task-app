import { useNavigate } from 'react-router-dom'
import { Loader2, Search } from 'lucide-react'
import { useSessions } from '@/hooks/useSessions'
import { ProjectCard } from './ProjectCard'
import { NewProjectCard } from './NewProjectCard'

export function ProjectsPage() {
  const navigate = useNavigate()
  const { sessions, isLoading, error, deleteSession } = useSessions()

  const handleNewProject = () => {
    navigate('/chat')
  }

  const handleOpenProject = (sessionId: string) => {
    navigate(`/chat/${sessionId}`)
  }

  const handleDeleteProject = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation()
    if (window.confirm('Are you sure you want to delete this project?')) {
      await deleteSession(sessionId)
    }
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground mb-2">
            Research Projects
          </h1>
          <p className="text-muted-foreground">
            Start a new research project or continue an existing one
          </p>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="text-center py-12">
            <p className="text-destructive mb-2">Failed to load projects</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        )}

        {/* Projects grid */}
        {!isLoading && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* New project card - always first */}
            <NewProjectCard onClick={handleNewProject} />

            {/* Existing projects */}
            {sessions.map((session) => (
              <ProjectCard
                key={session.id}
                session={session}
                onClick={() => handleOpenProject(session.id)}
                onDelete={(e) => handleDeleteProject(e, session.id)}
              />
            ))}
          </div>
        )}

        {/* Empty state (when no sessions) */}
        {!isLoading && !error && sessions.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No research projects yet</p>
            <p className="text-sm mt-1">
              Click "Start a Research Project" to begin
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
