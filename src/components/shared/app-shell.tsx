"use client";

import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  Menu,
  Moon,
  Search,
  Sun,
  ChevronDown,
  LogOut,
  Settings,
  User,
  Sparkles,
  X,
  CheckCheck,
  Bike,
  Store,
  Users,
  Shield,
  LayoutDashboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppStore } from "@/lib/store";
import { BrandLockup, LogoMark } from "./brand";
import { cn } from "@/lib/utils";
import { RoleSwitcher } from "./role-switcher";
import { AiAssistant } from "@/components/ai/ai-assistant";

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  badge?: number | string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

interface AppShellProps {
  groups: NavGroup[];
  activeView: string;
  onNavigate: (view: string) => void;
  children: ReactNode;
  pageTitle: string;
  pageSubtitle?: string;
  actions?: ReactNode;
}

// Icon resolver
const ICONS: Record<string, React.ComponentType<{ className?: string; size?: number }>> = {
  LayoutDashboard,
  Store,
  Users,
  Bike,
  Shield,
  Bell,
  Search,
  Sparkles,
  Settings,
  User,
  LogOut,
  // customer
  Package: ({ className, size }: { className?: string; size?: number }) => (
    <svg className={className} width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16.5 9.4 7.5 4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
  ),
  MapPin: ({ className, size }: { className?: string; size?: number }) => (
    <svg className={className} width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>
  ),
  Wallet: ({ className, size }: { className?: string; size?: number }) => (
    <svg className={className} width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/></svg>
  ),
  Ticket: ({ className, size }: { className?: string; size?: number }) => (
    <svg className={className} width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2"/><path d="M13 17v2"/><path d="M13 11v2"/></svg>
  ),
  Gift: ({ className, size }: { className?: string; size?: number }) => (
    <svg className={className} width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/></svg>
  ),
  Heart: ({ className, size }: { className?: string; size?: number }) => (
    <svg className={className} width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
  ),
  ClipboardList: ({ className, size }: { className?: string; size?: number }) => (
    <svg className={className} width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>
  ),
  Truck: ({ className, size }: { className?: string; size?: number }) => (
    <svg className={className} width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.653a1 1 0 0 0-.224-.625l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>
  ),
  BarChart3: ({ className, size }: { className?: string; size?: number }) => (
    <svg className={className} width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
  ),
  IndianRupee: ({ className, size }: { className?: string; size?: number }) => (
    <svg className={className} width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 3h12"/><path d="M6 8h12"/><path d="m6 21 9-9"/><path d="M6 13h9"/></svg>
  ),
  Headphones: ({ className, size }: { className?: string; size?: number }) => (
    <svg className={className} width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H4a1 1 0 0 1-1-1z"/><path d="M21 14h-3a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h1a1 1 0 0 0 1-1z"/><path d="M3 14a9 9 0 0 1 18 0"/></svg>
  ),
  Megaphone: ({ className, size }: { className?: string; size?: number }) => (
    <svg className={className} width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>
  ),
  FileText: ({ className, size }: { className?: string; size?: number }) => (
    <svg className={className} width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>
  ),
  Boxes: ({ className, size }: { className?: string; size?: number }) => (
    <svg className={className} width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41L13.71 2.71a2.41 2.41 0 0 0-3.41 0z"/></svg>
  ),
  Tag: ({ className, size }: { className?: string; size?: number }) => (
    <svg className={className} width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></svg>
  ),
  Settings2: ({ className, size }: { className?: string; size?: number }) => (
    <svg className={className} width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 7h-9"/><path d="M14 17H5"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/></svg>
  ),
  Calendar: ({ className, size }: { className?: string; size?: number }) => (
    <svg className={className} width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>
  ),
  Navigation: ({ className, size }: { className?: string; size?: number }) => (
    <svg className={className} width={size || 16} height={size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
  ),
  // default fallback
};

function Icon({ name, className, size }: { name: string; className?: string; size?: number }) {
  const C = ICONS[name] || LayoutDashboard;
  return <C className={className} size={size} />;
}

export function AppShell({
  groups,
  activeView,
  onNavigate,
  children,
  pageTitle,
  pageSubtitle,
  actions,
}: AppShellProps) {
  const {
    sidebarOpen,
    setSidebar,
    toggleSidebar,
    notifications,
    unreadCount,
    markAllRead,
    markNotificationRead,
    userName,
    userEmail,
    userAvatar,
    role,
    logout,
    toggleAi,
  } = useAppStore();

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex h-16 items-center justify-between px-5 border-b border-sidebar-border">
        <BrandLockup size="sm" />
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden h-8 w-8"
          onClick={() => setSidebar(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-6">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const active = activeView === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onNavigate(item.id);
                        setSidebar(false);
                      }}
                      className={cn(
                        "group relative w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                        active
                          ? "bg-primary text-primary-foreground shadow-soft"
                          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <Icon name={item.icon} className="h-4 w-4 shrink-0" />
                      <span className="flex-1 text-left">{item.label}</span>
                      {item.badge !== undefined && (
                        <Badge
                          variant={active ? "secondary" : "outline"}
                          className={cn(
                            "h-5 px-1.5 text-[10px] font-semibold",
                            active && "bg-primary-foreground/20 text-primary-foreground border-0"
                          )}
                        >
                          {item.badge}
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </ScrollArea>
      <div className="border-t border-sidebar-border p-3">
        <button
          onClick={toggleAi}
          className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-teal-500 via-emerald-500 to-cyan-500 p-[1px] transition-all hover:shadow-glow"
        >
          <div className="flex items-center gap-3 rounded-[11px] bg-card px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold">AI Assistant</p>
              <p className="text-[11px] text-muted-foreground">Ask anything</p>
            </div>
            <ChevronDown className="h-4 w-4 -rotate-90 text-muted-foreground" />
          </div>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 border-r border-border">
        {sidebar}
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebar}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          {sidebar}
        </SheetContent>
      </Sheet>

      {/* Main */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 backdrop-blur-xl px-4 lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={toggleSidebar}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
            <span className="capitalize">{role}</span>
            <span>/</span>
            <span className="text-foreground font-medium">{pageTitle}</span>
          </div>

          <div className="flex-1" />

          {/* Search */}
          <div className="hidden md:flex items-center h-9 w-64 rounded-lg bg-muted/60 px-3 text-sm text-muted-foreground">
            <Search className="h-4 w-4 mr-2" />
            <input
              placeholder="Search orders, vendors…"
              className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
            />
            <kbd className="ml-2 hidden lg:inline rounded bg-background px-1.5 py-0.5 text-[10px] font-mono border">⌘K</kbd>
          </div>

          {/* AI button */}
          <Button
            variant="outline"
            size="sm"
            onClick={toggleAi}
            className="gap-2 bg-gradient-to-r from-teal-50 to-cyan-50 border-teal-200 text-teal-700 hover:bg-teal-100 dark:from-teal-950/40 dark:to-cyan-950/40 dark:border-teal-800 dark:text-teal-300"
          >
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">AI</span>
          </Button>

          {/* Notifications */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <div className="flex items-center justify-between p-3 border-b">
                <p className="font-semibold text-sm">Notifications</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={markAllRead}
                  disabled={unreadCount === 0}
                >
                  <CheckCheck className="h-3.5 w-3.5 mr-1" />
                  Mark all read
                </Button>
              </div>
              <ScrollArea className="h-80">
                {notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => markNotificationRead(n.id)}
                    className={cn(
                      "w-full text-left p-3 border-b last:border-0 hover:bg-muted/50 transition-colors",
                      !n.read && "bg-teal-50/50 dark:bg-teal-950/20"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "mt-1.5 h-2 w-2 rounded-full shrink-0",
                        n.read ? "bg-transparent" : "bg-primary"
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{n.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</p>
                        <p className="text-[10px] text-muted-foreground/70 mt-1">{n.time} · {n.channel}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </ScrollArea>
            </PopoverContent>
          </Popover>

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2 px-2">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-gradient-to-br from-teal-500 to-cyan-600 text-white text-xs font-semibold">
                    {userAvatar}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium leading-tight">{userName}</p>
                  <p className="text-[11px] text-muted-foreground capitalize">{role}</p>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{userName}</span>
                  <span className="text-xs text-muted-foreground font-normal">{userEmail}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <div className="px-2 py-1.5">
                <RoleSwitcher />
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-rose-600 focus:text-rose-700">
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page header */}
        <div className="flex flex-col gap-4 px-4 lg:px-6 pt-6 pb-2">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
                {pageTitle}
              </h1>
              {pageSubtitle && (
                <p className="text-sm text-muted-foreground mt-1">{pageSubtitle}</p>
              )}
            </div>
            {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
          </div>
        </div>

        {/* Main content */}
        <main className="flex-1 px-4 lg:px-6 py-4 pb-12">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* AI Assistant overlay */}
      <AiAssistant />
    </div>
  );
}
