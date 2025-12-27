import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileText, FolderOpen, Download, Eye } from 'lucide-react'
import type { OutputFile } from '@/types'

interface ResearchOutputProps {
  files?: OutputFile[]
  onView?: (fileId: string) => void
  onDownload?: (fileId: string) => void
}

export function ResearchOutput({
  files = [],
  onView,
  onDownload,
}: ResearchOutputProps) {
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <FolderOpen className="h-4 w-4" />
          Output Files ({files.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {files.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            Research output will appear here...
          </p>
        ) : (
          <ul className="space-y-2">
            {files.map((file) => (
              <li
                key={file.id}
                className="flex items-center justify-between text-sm group rounded-md hover:bg-muted/50 p-1 -mx-1"
              >
                <div className="flex items-center gap-2 truncate flex-1 min-w-0">
                  <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="truncate">
                    <span className="truncate block">{file.filename}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatFileSize(file.fileSize)}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {onView && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onView(file.id)}
                      title="Preview file"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {onDownload && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => onDownload(file.id)}
                      title="Download file"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
