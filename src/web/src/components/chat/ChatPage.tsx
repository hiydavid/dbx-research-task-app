import { useParams } from 'react-router-dom'
import { ChatContainer } from './ChatContainer'
import { ResearchSidebar } from '@/components/research/ResearchSidebar'

export function ChatPage() {
  const { sessionId } = useParams<{ sessionId?: string }>()

  return (
    <div className="flex h-full">
      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        <ChatContainer sessionId={sessionId} />
      </div>

      {/* Research sidebar (placeholder) */}
      <ResearchSidebar />
    </div>
  )
}
