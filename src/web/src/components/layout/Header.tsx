import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'

export function Header() {
  return (
    <header className="border-b bg-background">
      <div className="flex h-14 items-center px-4 gap-4">
        <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <Search className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Research Assistant</h1>
        </Link>
        <div className="flex-1" />
        <div className="text-sm text-muted-foreground">
          Powered by Claude
        </div>
      </div>
    </header>
  )
}
