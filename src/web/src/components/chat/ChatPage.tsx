import { useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { ChatContainer } from './ChatContainer'
import { ResearchSidebar } from '@/components/research/ResearchSidebar'

export function ChatPage() {
  const { sessionId: urlSessionId } = useParams<{ sessionId?: string }>()
  const [activeSessionId, setActiveSessionId] = useState<string | null>(urlSessionId || null)

  const handleSessionChange = useCallback((newSessionId: string | null) => {
    setActiveSessionId(newSessionId)
  }, [])

  return (
    <div className="flex h-full">
      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        <ChatContainer
          sessionId={urlSessionId}
          onSessionChange={handleSessionChange}
        />
      </div>

      {/* Research sidebar */}
      <ResearchSidebar sessionId={activeSessionId} />
    </div>
  )
}
