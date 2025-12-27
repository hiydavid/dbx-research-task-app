import { useState } from 'react'
import { ResearchProgress } from './ResearchProgress'
import { ResearchOutput } from './ResearchOutput'
import { FilePreviewModal } from './FilePreviewModal'
import { useTasks } from '@/hooks/useTasks'
import { useOutputFiles } from '@/hooks/useOutputFiles'

interface ResearchSidebarProps {
  sessionId: string | null
}

export function ResearchSidebar({ sessionId }: ResearchSidebarProps) {
  const { tasks, startTask, cancelTask, refetch: refetchTasks } = useTasks(sessionId)
  const {
    files,
    selectedFile,
    isLoadingContent,
    viewFile,
    downloadFile,
    closeFile,
    refetch: refetchFiles,
  } = useOutputFiles(sessionId)

  const [isStartingTask, setIsStartingTask] = useState(false)

  // Find active task (running or pending)
  const activeTask = tasks.find((t) => t.status === 'running' || t.status === 'pending')

  const handleStartResearch = async (prompt: string) => {
    if (!sessionId) return

    setIsStartingTask(true)
    try {
      await startTask(prompt, 'background')
      // Refresh files after a delay to catch new outputs
      setTimeout(() => refetchFiles(), 2000)
    } finally {
      setIsStartingTask(false)
    }
  }

  const handleCancelTask = async () => {
    if (activeTask) {
      await cancelTask(activeTask.id)
    }
  }

  const handleTaskComplete = () => {
    refetchTasks()
    refetchFiles()
  }

  return (
    <aside className="w-80 border-l bg-muted/10 p-4 hidden lg:block overflow-auto">
      <div className="space-y-4">
        <ResearchProgress
          task={activeTask}
          recentTasks={tasks.slice(0, 5)}
          onStartResearch={handleStartResearch}
          onCancel={handleCancelTask}
          onTaskComplete={handleTaskComplete}
          isStarting={isStartingTask}
          disabled={!sessionId}
        />
        <ResearchOutput
          files={files}
          onView={viewFile}
          onDownload={downloadFile}
        />
      </div>

      {/* File preview modal */}
      {selectedFile && (
        <FilePreviewModal
          filename={selectedFile.filename}
          content={selectedFile.content}
          fileType={selectedFile.fileType}
          isLoading={isLoadingContent}
          onClose={closeFile}
        />
      )}
    </aside>
  )
}
