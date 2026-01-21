import { useToggle } from 'usehooks-ts';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { ModeToggle } from '@/components/mode-toggle';
import { NotificationBell } from '@/components/notifications';
import { useTheme } from '@/components/theme-provider';
import { useAuthStore } from '@/stores/auth';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Sparkles,
  Users,
  Files,
  History,
  LayoutTemplate,
  BookOpen,
  Settings,
  BarChart3,
  Shield,
  Menu,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

// Base navigation for all users
const baseNavigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Smart Profile', href: '/smart-profile', icon: Sparkles },
  { name: 'Clients', href: '/clients', icon: Users },
  { name: 'Documents', href: '/documents', icon: Files },
  { name: 'History', href: '/history', icon: History },
  { name: 'Templates', href: '/templates', icon: LayoutTemplate },
  { name: 'Knowledge Base', href: '/knowledge', icon: BookOpen },
  { name: 'Settings', href: '/settings', icon: Settings },
];

// Admin-only navigation items
const adminNavigation = [
  { name: 'Form Analytics', href: '/analytics/forms', icon: BarChart3 },
  { name: 'Accuracy', href: '/admin/accuracy', icon: Shield },
];

interface AppLayoutProps {
  children: React.ReactNode;
}

interface SidebarContentProps {
  collapsed: boolean;
  setSidebarOpen?: (open: boolean) => void;
  location: { pathname: string };
  user: any;
  logout: () => Promise<void>;
  navigate: (path: string) => void;
  theme: string;
}

const SidebarContent = ({
  collapsed,
  setSidebarOpen,
  location,
  user,
  logout,
  navigate,
  theme,
}: SidebarContentProps) => {
  // Use light logo variant for dark theme, dark variant for light theme
  const logoIcon = theme === 'dark' ? '/logo-light.svg' : '/logo-dark.svg';
  const logoFull = theme === 'dark' ? '/logo-full-light.svg' : '/logo-full-dark.svg';

  // Build navigation based on user role
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'admin';
  const navigation = isAdmin ? [...baseNavigation, ...adminNavigation] : baseNavigation;

  return (
    <div className="flex flex-col h-full bg-background/40 backdrop-blur-xl border-r border-white/5">
      {/* Brand */}
      <div
        className={cn(
          'flex items-center h-16 border-b border-white/5',
          collapsed ? 'justify-center px-2' : 'px-4'
        )}
      >
        {collapsed ? (
          <img src={logoIcon} alt="IntelliFill" className="h-7 w-auto" />
        ) : (
          <img src={logoFull} alt="IntelliFill" className="h-8 w-auto" />
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-6">
        <div className="space-y-1 px-3">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            return (
              <Link key={item.name} to={item.href} onClick={() => setSidebarOpen?.(false)}>
                <Button
                  variant="ghost"
                  className={cn(
                    'w-full justify-start transition-all duration-200 group relative overflow-hidden',
                    isActive
                      ? 'bg-primary/10 text-primary hover:bg-primary/15'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/5',
                    collapsed && 'px-0 justify-center h-10 w-10 mx-auto'
                  )}
                  title={collapsed ? item.name : undefined}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 border-l-2 border-primary bg-gradient-to-r from-primary/10 to-transparent opacity-50"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    />
                  )}
                  <Icon
                    className={cn(
                      'h-5 w-5 z-10 transition-colors',
                      isActive ? 'text-primary' : 'group-hover:text-foreground',
                      !collapsed && 'mr-3'
                    )}
                  />
                  {!collapsed && <span className="z-10 font-medium">{item.name}</span>}
                </Button>
              </Link>
            );
          })}
        </div>

        {!collapsed && (
          <div className="mt-8 px-6">
            <h3 className="text-xs font-semibold text-muted-foreground/50 uppercase tracking-wider mb-4">
              Quick Actions
            </h3>
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start border-dashed border-white/10 hover:border-primary/50 hover:bg-primary/5 hover:text-primary transition-all"
                onClick={() => {
                  navigate('/smart-profile');
                  setSidebarOpen?.(false);
                }}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                New Profile
              </Button>
            </div>
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      <div className={cn('p-4 border-t border-white/5 bg-white/2', collapsed && 'px-2')}>
        <div className={cn('flex items-center', collapsed ? 'justify-center' : 'gap-3')}>
          <Avatar className="h-9 w-9 ring-2 ring-primary/10 ring-offset-2 ring-offset-background/50 cursor-pointer hover:ring-primary/30 transition-all">
            <AvatarImage src="/avatar.png" />
            <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-white font-medium">
              {user?.firstName?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-foreground">
                {user?.firstName || 'User'}
              </p>
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={async () => {
              await logout();
              navigate('/login');
            }}
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            data-testid="logout-button"
            aria-label="Logout"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, , setSidebarOpen] = useToggle(false);
  const [sidebarCollapsed, toggleSidebarCollapsed] = useToggle(false);
  const { user, logout } = useAuthStore();
  const { theme } = useTheme();

  return (
    <div className="flex min-h-screen bg-background font-sans selection:bg-primary/20">
      {/* Desktop Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarCollapsed ? 80 : 280 }}
        className="hidden md:block relative z-30 flex-shrink-0"
      >
        <SidebarContent
          collapsed={sidebarCollapsed}
          location={location}
          user={user}
          logout={logout}
          navigate={navigate}
          theme={theme}
        />

        {/* Toggle Button */}
        <Button
          variant="outline"
          size="icon"
          onClick={toggleSidebarCollapsed}
          className="absolute -right-3 top-20 h-6 w-6 rounded-full border-border bg-background shadow-md hover:bg-accent z-40 hidden md:flex"
          data-testid="sidebar-toggle"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!sidebarCollapsed}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-3 w-3" />
          ) : (
            <ChevronLeft className="h-3 w-3" />
          )}
        </Button>
      </motion.aside>

      {/* Mobile Sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent
          side="left"
          className="p-0 border-r border-white/10 w-80 bg-background/95 backdrop-blur-xl"
        >
          <SidebarContent
            collapsed={false}
            setSidebarOpen={setSidebarOpen}
            location={location}
            user={user}
            logout={logout}
            navigate={navigate}
            theme={theme}
          />
        </SheetContent>
      </Sheet>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-background/50 relative overflow-hidden">
        {/* Top Header */}
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-background/40 backdrop-blur-lg sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <ModeToggle />
          </div>
        </header>

        {/* Page Content with Transitions */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-6 pb-20 relative">
          {/* Subtle background glow effect using CSS or absolute div */}
          <div className="absolute top-0 left-0 w-full h-96 bg-primary/5 blur-3xl -z-10 pointer-events-none rounded-full translate-y-[-50%]" />

          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className="h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
