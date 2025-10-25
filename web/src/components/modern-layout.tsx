import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { ModeToggle } from '@/components/mode-toggle'
import { useAuthStore } from '@/stores/simpleAuthStore'
import {
  FileText,
  Upload,
  History,
  Layout,
  Settings,
  Menu,
  Home,
  Command,
  Files,
  FileSearch,
  BarChart3,
  Bell,
  User,
  Search,
  Plus,
  FilePenLine
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Upload', href: '/upload', icon: Upload },
  { name: 'Fill Form', href: '/fill-form', icon: FilePenLine },
  { name: 'History', href: '/history', icon: History },
  { name: 'Documents', href: '/documents', icon: Files },
  { name: 'Templates', href: '/templates', icon: Layout },
  { name: 'Settings', href: '/settings', icon: Settings },
]

interface ModernLayoutProps {
  children: React.ReactNode
}

export function ModernLayout({ children }: ModernLayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const { user, logout } = useAuthStore()

  const NavContent = () => (
    <>
      <div className="flex h-16 items-center px-4 border-b">
        <FileText className="h-6 w-6 text-primary" />
        <span className="ml-2 text-lg font-semibold">IntelliFill Pro</span>
      </div>
      <ScrollArea className="flex-1 px-3">
        <div className="space-y-1 py-4">
          {navigation.map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
              >
                <Button
                  variant={location.pathname === item.href ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start",
                    location.pathname === item.href && "bg-secondary"
                  )}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {item.name}
                </Button>
              </Link>
            )
          })}
        </div>
        <div className="py-4">
          <h2 className="mb-2 px-2 text-sm font-semibold text-muted-foreground">
            Quick Actions
          </h2>
          <div className="space-y-1">
            <Button variant="ghost" className="w-full justify-start">
              <Plus className="mr-2 h-4 w-4" />
              New Template
            </Button>
            <Button variant="ghost" className="w-full justify-start">
              <FileSearch className="mr-2 h-4 w-4" />
              Find Document
            </Button>
            <Button variant="ghost" className="w-full justify-start">
              <BarChart3 className="mr-2 h-4 w-4" />
              Analytics
            </Button>
          </div>
        </div>
      </ScrollArea>
      <div className="border-t p-4">
        <div className="flex items-center space-x-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src="/avatar.png" />
            <AvatarFallback>{user?.full_name?.charAt(0) || user?.email?.charAt(0) || 'U'}</AvatarFallback>
          </Avatar>
          <div className="flex-1 text-sm">
            <p className="font-medium">{user?.full_name || 'User'}</p>
            <p className="text-muted-foreground">{user?.email || 'user@example.com'}</p>
          </div>
        </div>
      </div>
    </>
  )

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:w-64 md:flex-col">
        <div className="flex flex-1 flex-col border-r bg-card">
          <NavContent />
        </div>
      </div>

      {/* Mobile Sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <NavContent />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle sidebar</span>
          </Button>

          <div className="flex flex-1 items-center gap-4">
            {/* Command Menu Trigger */}
            <Button
              variant="outline"
              className="relative h-9 w-full justify-start text-sm text-muted-foreground sm:pr-12 md:w-64"
            >
              <Search className="mr-2 h-4 w-4" />
              <span className="hidden lg:inline-flex">Search documents...</span>
              <span className="inline-flex lg:hidden">Search...</span>
              <kbd className="pointer-events-none absolute right-1.5 top-2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                <span className="text-xs">⌘</span>K
              </kbd>
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {/* Theme Toggle */}
            <ModeToggle />

            {/* Direct Logout Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await logout()
                navigate('/login')
              }}
            >
              Sign out
            </Button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}