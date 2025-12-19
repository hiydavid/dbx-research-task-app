import { AppShell } from './components/layout/AppShell'
import { ChatContainer } from './components/chat/ChatContainer'
import { ResearchSidebar } from './components/research/ResearchSidebar'

function App() {
  return (
    <AppShell>
      <div className="flex h-full">
        {/* Main chat area */}
        <div className="flex-1 flex flex-col">
          <ChatContainer />
        </div>

        {/* Research sidebar (placeholder) */}
        <ResearchSidebar />
      </div>
    </AppShell>
  )
}

export default App
