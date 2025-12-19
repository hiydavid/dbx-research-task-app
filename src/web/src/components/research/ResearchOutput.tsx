import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { FileText, FolderOpen } from 'lucide-react'

interface OutputFile {
  name: string
  path: string
}

interface ResearchOutputProps {
  files?: OutputFile[]
}

export function ResearchOutput({ files = [] }: ResearchOutputProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <FolderOpen className="h-4 w-4" />
          Output Files
        </CardTitle>
      </CardHeader>
      <CardContent>
        {files.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            Research output will appear here...
          </p>
        ) : (
          <ul className="space-y-1">
            {files.map((file, index) => (
              <li key={index} className="flex items-center gap-2 text-sm">
                <FileText className="h-3 w-3 text-muted-foreground" />
                <span className="truncate">{file.name}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
