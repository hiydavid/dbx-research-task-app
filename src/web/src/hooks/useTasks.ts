import { useState, useCallback, useEffect, useRef } from 'react'
import type { ResearchTask, TaskStatus } from '@/types'

interface TaskEvent {
  type: 'progress' | 'done' | 'error' | 'ping'
  progress?: number
  message?: string
  status?: TaskStatus
}

export function useTasks(sessionId: string | null) {
  const [tasks, setTasks] = useState<ResearchTask[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  const fetchTasks = useCallback(async () => {
    if (!sessionId) {
      setTasks([])
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/sessions/${sessionId}/tasks`)
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`)
      }
      const data = await response.json()
      setTasks(data.tasks?.map(mapTaskFromApi) || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch tasks')
    } finally {
      setIsLoading(false)
    }
  }, [sessionId])

  const startTask = useCallback(
    async (prompt: string, mode: 'background' | 'live' = 'background') => {
      if (!sessionId) return null

      try {
        const response = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId, prompt, mode }),
        })

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`)
        }

        const data = await response.json()

        // Refresh task list
        await fetchTasks()

        return data.task_id as string
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to start task')
        return null
      }
    },
    [sessionId, fetchTasks]
  )

  const subscribeToTask = useCallback(
    (taskId: string, onUpdate: (event: TaskEvent) => void) => {
      // Close existing connection
      eventSourceRef.current?.close()

      const es = new EventSource(`/api/tasks/${taskId}/stream`)
      eventSourceRef.current = es

      const handleEvent = (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data)
          onUpdate(data)

          // Refresh tasks on completion
          if (data.type === 'done' || data.type === 'error') {
            es.close()
            fetchTasks()
          }
        } catch {
          // Ignore parse errors
        }
      }

      es.addEventListener('progress', handleEvent)
      es.addEventListener('done', handleEvent)
      es.addEventListener('error', handleEvent)
      es.addEventListener('content', handleEvent)

      es.onerror = () => {
        es.close()
      }

      return () => {
        es.close()
      }
    },
    [fetchTasks]
  )

  const cancelTask = useCallback(
    async (taskId: string) => {
      try {
        const response = await fetch(`/api/tasks/${taskId}/cancel`, {
          method: 'POST',
        })

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`)
        }

        await fetchTasks()
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to cancel task')
        return false
      }
    },
    [fetchTasks]
  )

  const getTaskStatus = useCallback(async (taskId: string) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`)
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`)
      }
      const data = await response.json()
      return mapTaskFromApi(data)
    } catch {
      return null
    }
  }, [])

  // Fetch tasks when sessionId changes
  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  // Poll for task updates every 4 seconds when sessionId is set
  useEffect(() => {
    if (!sessionId) return

    const interval = setInterval(() => {
      fetchTasks()
    }, 4000)

    return () => clearInterval(interval)
  }, [sessionId, fetchTasks])

  // Cleanup event source on unmount
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close()
    }
  }, [])

  return {
    tasks,
    isLoading,
    error,
    startTask,
    subscribeToTask,
    cancelTask,
    getTaskStatus,
    refetch: fetchTasks,
  }
}

// Helper to map API response to frontend type
function mapTaskFromApi(task: Record<string, unknown>): ResearchTask {
  return {
    id: task.id as string,
    prompt: task.prompt as string,
    status: task.status as TaskStatus,
    progress: (task.progress as number) || 0,
    progressMessage: task.progress_message as string | undefined,
    startedAt: task.started_at as string | undefined,
    completedAt: task.completed_at as string | undefined,
    errorMessage: task.error_message as string | undefined,
    totalCostUsd: task.total_cost_usd as number | undefined,
    createdAt: task.created_at as string,
  }
}
