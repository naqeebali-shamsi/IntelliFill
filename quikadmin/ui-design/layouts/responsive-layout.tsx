// Responsive Layout System with Navigation
import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { 
  Menu, 
  Search, 
  Bell, 
  Settings, 
  User, 
  LogOut,
  Home,
  FileText,
  Upload,
  BarChart3,
  Users,
  HelpCircle,
  Moon,
  Sun,
  Laptop,
  ChevronDown,
  Command
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavigationItem {
  id: string
  label: string
  icon: React.ReactNode
  href: string
  badge?: string
  children?: NavigationItem[]
}

interface LayoutProps {
  children: React.ReactNode
  className?: string
}

interface SidebarProps {
  isCollapsed?: boolean
  onToggle?: () => void
  className?: string
}

interface HeaderProps {
  onMenuClick?: () => void
  className?: string
}

const navigationItems: NavigationItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: <Home className="h-4 w-4" />,
    href: '/dashboard'
  },
  {
    id: 'files',
    label: 'PDF Files',
    icon: <FileText className="h-4 w-4" />,
    href: '/files',
    badge: '24'
  },
  {
    id: 'upload',
    label: 'Upload',
    icon: <Upload className="h-4 w-4" />,
    href: '/upload'
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: <BarChart3 className="h-4 w-4" />,
    href: '/analytics',
    children: [
      {
        id: 'performance',
        label: 'Performance',
        icon: <BarChart3 className="h-3 w-3" />,
        href: '/analytics/performance'
      },
      {
        id: 'usage',
        label: 'Usage Stats',
        icon: <BarChart3 className="h-3 w-3" />,
        href: '/analytics/usage'
      }
    ]
  },
  {
    id: 'users',
    label: 'User Management',
    icon: <Users className="h-4 w-4" />,
    href: '/users'
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: <Settings className="h-4 w-4" />,
    href: '/settings'
  },
  {
    id: 'help',
    label: 'Help & Support',
    icon: <HelpCircle className="h-4 w-4" />,
    href: '/help'
  }
]

const ThemeToggle: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system')

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme)
    // In a real app, this would update the theme context/localStorage
    console.log('Theme changed to:', newTheme)
  }

  const getThemeIcon = () => {
    switch (theme) {
      case 'light':
        return <Sun className="h-4 w-4" />
      case 'dark':
        return <Moon className="h-4 w-4" />
      default:
        return <Laptop className="h-4 w-4" />
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="w-9 px-0">
          {getThemeIcon()}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleThemeChange('light')}>
          <Sun className="mr-2 h-4 w-4" />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleThemeChange('dark')}>
          <Moon className="mr-2 h-4 w-4" />
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleThemeChange('system')}>
          <Laptop className="mr-2 h-4 w-4" />
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const CommandPalette: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setIsOpen(!isOpen)
      }
    }

    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [isOpen])

  const filteredItems = navigationItems.filter(item =>
    item.label.toLowerCase().includes(searchTerm.toLowerCase())
  )

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="fixed left-[50%] top-[50%] max-h-[85vh] w-full max-w-[450px] translate-x-[-50%] translate-y-[-50%] border bg-background p-6 shadow-lg sm:rounded-lg">
        <div className="flex items-center border-b pb-4">
          <Command className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search commands..."
            className="flex-1 border-0 bg-transparent px-0 py-3 text-sm placeholder:text-muted-foreground focus:outline-none"
            autoFocus
          />
        </div>
        <div className="mt-4 max-h-[300px] overflow-y-auto">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
              onClick={() => {
                setIsOpen(false)
                console.log('Navigate to:', item.href)
              }}
            >
              {item.icon}
              <span className="ml-2">{item.label}</span>
              {item.badge && (
                <Badge variant="secondary" className="ml-auto text-xs">
                  {item.badge}
                </Badge>
              )}
            </div>
          ))}
          {filteredItems.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No results found.
            </p>
          )}
        </div>
        <div className="border-t pt-4 text-xs text-muted-foreground">
          <p>Use ↑↓ to navigate, ↵ to select, ESC to close</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="absolute right-2 top-2"
          onClick={() => setIsOpen(false)}
        >
          ✕
        </Button>
      </div>
    </div>
  )
}

const SidebarNavigation: React.FC<{ 
  items: NavigationItem[]
  isCollapsed?: boolean
  className?: string 
}> = ({ items, isCollapsed = false, className }) => {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  const toggleExpanded = (itemId: string) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId)
    } else {
      newExpanded.add(itemId)
    }
    setExpandedItems(newExpanded)
  }

  return (
    <nav className={cn("space-y-1", className)} role="navigation" aria-label="Main navigation">
      {items.map((item) => (
        <div key={item.id}>
          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start h-10",
              isCollapsed ? "px-2" : "px-3",
              item.children && !isCollapsed && "pr-2"
            )}
            onClick={() => {
              if (item.children) {
                toggleExpanded(item.id)
              } else {
                console.log('Navigate to:', item.href)
              }
            }}
            aria-expanded={item.children ? expandedItems.has(item.id) : undefined}
            aria-haspopup={item.children ? "menu" : undefined}
          >
            <div className="flex items-center flex-1 min-w-0">
              {item.icon}
              {!isCollapsed && (
                <span className="ml-3 truncate">{item.label}</span>
              )}
            </div>
            {!isCollapsed && (
              <>
                {item.badge && (
                  <Badge variant="secondary" className="ml-auto shrink-0">
                    {item.badge}
                  </Badge>
                )}
                {item.children && (
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 ml-2 transition-transform",
                      expandedItems.has(item.id) && "transform rotate-180"
                    )}
                  />
                )}
              </>
            )}
          </Button>

          {/* Submenu */}
          {item.children && !isCollapsed && expandedItems.has(item.id) && (
            <div className="ml-6 mt-1 space-y-1" role="menu">
              {item.children.map((subItem) => (
                <Button
                  key={subItem.id}
                  variant="ghost"
                  className="w-full justify-start h-9 text-sm text-muted-foreground hover:text-foreground"
                  onClick={() => console.log('Navigate to:', subItem.href)}
                  role="menuitem"
                >
                  {subItem.icon}
                  <span className="ml-3">{subItem.label}</span>
                  {subItem.badge && (
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {subItem.badge}
                    </Badge>
                  )}
                </Button>
              ))}
            </div>
          )}
        </div>
      ))}
    </nav>
  )
}

const Sidebar: React.FC<SidebarProps> = ({ 
  isCollapsed = false, 
  onToggle, 
  className 
}) => {
  return (
    <div 
      className={cn(
        "flex flex-col h-full bg-background border-r",
        isCollapsed ? "w-16" : "w-64",
        "transition-all duration-300 ease-in-out",
        className
      )}
    >
      {/* Logo/Brand */}
      <div className="p-4 border-b">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
            <FileText className="h-4 w-4 text-primary-foreground" />
          </div>
          {!isCollapsed && (
            <div className="ml-3">
              <h1 className="text-lg font-semibold">PDF Filler</h1>
              <p className="text-xs text-muted-foreground">Form Processing</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto p-4">
        <SidebarNavigation items={navigationItems} isCollapsed={isCollapsed} />
      </div>

      {/* Footer */}
      <div className="p-4 border-t">
        <div className="flex items-center">
          <Avatar className="h-8 w-8">
            <AvatarImage src="/avatars/user.jpg" alt="User" />
            <AvatarFallback>JD</AvatarFallback>
          </Avatar>
          {!isCollapsed && (
            <div className="ml-3 flex-1 min-w-0">
              <p className="text-sm font-medium truncate">John Doe</p>
              <p className="text-xs text-muted-foreground truncate">john@example.com</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const Header: React.FC<HeaderProps> = ({ onMenuClick, className }) => {
  const [notifications] = useState(3) // Mock notification count

  return (
    <header className={cn("border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60", className)}>
      <div className="flex h-14 items-center px-4">
        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="sm"
          className="mr-2 px-0 text-base hover:bg-transparent focus:bg-transparent md:hidden"
          onClick={onMenuClick}
        >
          <Menu className="h-6 w-6" />
          <span className="sr-only">Toggle Menu</span>
        </Button>

        {/* Search */}
        <div className="flex flex-1 items-center space-x-2">
          <div className="w-full flex-1 md:w-auto md:flex-none">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search files..."
                className="w-full bg-background pl-8 sm:w-[300px] md:w-[200px] lg:w-[300px]"
                onClick={() => {/* Open command palette */}}
                readOnly
              />
              <kbd className="absolute right-2.5 top-2.5 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-xs text-muted-foreground sm:flex">
                ⌘K
              </kbd>
            </div>
          </div>
        </div>

        {/* Right side actions */}
        <div className="flex items-center space-x-2">
          <ThemeToggle />

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="relative">
                <Bell className="h-4 w-4" />
                {notifications > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-xs"
                  >
                    {notifications}
                  </Badge>
                )}
                <span className="sr-only">Notifications</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Notifications</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="space-y-2 p-2">
                <div className="p-2 text-sm">
                  <p className="font-medium">PDF Processing Complete</p>
                  <p className="text-muted-foreground">employee_handbook.pdf has been processed successfully</p>
                </div>
                <div className="p-2 text-sm">
                  <p className="font-medium">New User Registered</p>
                  <p className="text-muted-foreground">Sarah Johnson joined your organization</p>
                </div>
                <div className="p-2 text-sm">
                  <p className="font-medium">System Update</p>
                  <p className="text-muted-foreground">New features are available in the dashboard</p>
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src="/avatars/user.jpg" alt="User" />
                  <AvatarFallback>JD</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">John Doe</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    john@example.com
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}

const MobileSidebar: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="mr-2 px-0 text-base hover:bg-transparent focus:bg-transparent md:hidden"
        >
          <Menu className="h-6 w-6" />
          <span className="sr-only">Toggle Menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="p-0">
        <div className="h-full">
          <Sidebar />
        </div>
      </SheetContent>
    </Sheet>
  )
}

export const ResponsiveLayout: React.FC<LayoutProps> = ({ 
  children, 
  className 
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)

    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  return (
    <div className={cn("h-screen flex flex-col", className)}>
      <CommandPalette />
      
      {/* Header */}
      <Header />
      
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop Sidebar */}
        {!isMobile && (
          <Sidebar
            isCollapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-muted/50">
          <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

// Utility components for responsive grids
export const ResponsiveGrid: React.FC<{
  children: React.ReactNode
  className?: string
}> = ({ children, className }) => (
  <div className={cn(
    "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4",
    className
  )}>
    {children}
  </div>
)

export const ResponsiveContainer: React.FC<{
  children: React.ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
}> = ({ children, className, size = 'lg' }) => {
  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-2xl',
    lg: 'max-w-4xl',
    xl: 'max-w-6xl',
    full: 'max-w-full'
  }

  return (
    <div className={cn(
      "mx-auto px-4 sm:px-6 lg:px-8",
      sizeClasses[size],
      className
    )}>
      {children}
    </div>
  )
}

export default ResponsiveLayout