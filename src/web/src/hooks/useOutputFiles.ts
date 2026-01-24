import { useState, useCallback, useEffect } from 'react'
import type { OutputFile } from '@/types'

interface FileContent {
  id: string
  filename: string
  content: string | null
  fileType: string
}

export function useOutputFiles(sessionId: string | null) {
  const [files, setFiles] = useState<OutputFile[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<FileContent | null>(null)
  const [isLoadingContent, setIsLoadingContent] = useState(false)

  const fetchFiles = useCallback(async () => {
    if (!sessionId) {
      setFiles([])
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/outputs?session_id=${sessionId}`)
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`)
      }
      const data = await response.json()
      setFiles(data.files?.map(mapFileFromApi) || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch files')
    } finally {
      setIsLoading(false)
    }
  }, [sessionId])

  const viewFile = useCallback(async (fileId: string) => {
    setIsLoadingContent(true)
    setError(null)

    try {
      const response = await fetch(`/api/outputs/${fileId}/content`)
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`)
      }
      const data = await response.json()
      setSelectedFile({
        id: data.id,
        filename: data.filename,
        content: data.content,
        fileType: data.file_type,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load file content')
    } finally {
      setIsLoadingContent(false)
    }
  }, [])

  const downloadFile = useCallback((fileId: string) => {
    window.open(`/api/outputs/${fileId}/download`, '_blank')
  }, [])

  const closeFile = useCallback(() => {
    setSelectedFile(null)
  }, [])

  // Fetch files when sessionId changes
  useEffect(() => {
    fetchFiles()
  }, [fetchFiles])

  // Poll for new files every 5 seconds when sessionId is set
  useEffect(() => {
    if (!sessionId) return

    const interval = setInterval(() => {
      fetchFiles()
    }, 5000)

    return () => clearInterval(interval)
  }, [sessionId, fetchFiles])

  return {
    files,
    isLoading,
    error,
    selectedFile,
    isLoadingContent,
    viewFile,
    downloadFile,
    closeFile,
    refetch: fetchFiles,
  }
}

// Helper to map API response to frontend type
function mapFileFromApi(file: Record<string, unknown>): OutputFile {
  return {
    id: file.id as string,
    filename: file.filename as string,
    filepath: file.filepath as string,
    fileType: file.file_type as string,
    fileSize: (file.file_size as number) || 0,
    createdAt: file.created_at as string,
  }
}
