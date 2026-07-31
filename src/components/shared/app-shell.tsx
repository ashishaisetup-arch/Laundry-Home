
import { useState, useRef, useEffect, type ReactNode } from "react";
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
  MessageSquare,
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
import { AiAssistant } from "@/components/ai/ai-assistant";
import { Icon } from "./icon";
import { SearchResults } from "./search-results";

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

export function AppShell({
  groups,
  activeView,
  onNavigate,
  children,
  pageTitle,
  pageSubtitle,
  actions,
}: AppShellProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
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
    theme,
    toggleTheme,
    logout,
    toggleAi,
    setPendingSearchQuery,
  } = useAppStore();

  const isSearching = searchQuery.trim().length > 0;

  const jumpToSearchPage = () => {
    const q = searchQuery.trim();
    if (!q) return;
    setPendingSearchQuery(q);
    setSearchQuery("");
    setMobileSearchOpen(false);
    if (role === "customer") onNavigate("discover");
    else if (role === "vendor") onNavigate("orders");
    else if (role === "admin") onNavigate("orders");
    else if (role === "delivery") onNavigate("pickups");
    else onNavigate("dashboard");
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setMobileSearchOpen(false);
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
      if (e.key === "Escape") {
        setSearchQuery("");
        setMobileSearchOpen(false);
        (document.activeElement as HTMLElement | null)?.blur();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex h-16 items-center justify-between px-6">
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
      <ScrollArea className="flex-1 px-4 py-4">
        <nav className="space-y-7">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="px-3 mb-2.5 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground/80">
                {group.label}
              </p>
              <div className="space-y-0.5">
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
                        "group relative w-full flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200",
                        active
                          ? "bg-tonal-accent text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-tonal"
                      )}
                    >
                      <Icon name={item.icon} className={cn("h-[15px] w-[15px] shrink-0 transition-colors", active ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground")} />
                      <span className="flex-1 text-left">{item.label}</span>
                      {item.badge !== undefined && (
                        <Badge
                          variant={active ? "secondary" : "outline"}
                          className={cn(
                            "h-4.5 min-w-[18px] px-1 text-[10px] font-semibold rounded-md",
                            active && "bg-primary/10 text-primary border-0"
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
      <div className="p-4">
        <button
          onClick={toggleAi}
          className="group w-full flex items-center gap-3 rounded-xl bg-tonal hover:bg-tonal-accent transition-colors px-4 py-3"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-surface">
            <Sparkles className="h-3.5 w-3.5 text-white" />
          </div>
          <div className="flex-1 text-left">
            <p className="text-[13px] font-semibold">AI Assistant</p>
            <p className="text-[10px] text-muted-foreground">Ask anything</p>
          </div>
          <ChevronDown className="h-3.5 w-3.5 -rotate-90 text-muted-foreground" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0">
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
        <header className="sticky top-0 z-30 flex min-h-16 flex-wrap items-center gap-3 bg-background/70 backdrop-blur-xl px-5 lg:px-8 py-2">
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
          <div className="hidden md:flex items-center h-9 w-64 rounded-lg bg-tonal px-3 text-sm text-muted-foreground focus-within:bg-tonal-accent focus-within:ring-2 focus-within:ring-primary/25 transition-colors">
            <Search className="h-3.5 w-3.5 mr-2 opacity-70" />
            <input
              ref={searchInputRef}
              placeholder="Search orders, vendors…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") jumpToSearchPage();
              }}
              className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground/70 text-[13px]"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} aria-label="Clear search" className="shrink-0">
                <X className="h-3.5 w-3.5 opacity-60 hover:opacity-100" />
              </button>
            )}
            <kbd className="ml-2 hidden lg:inline rounded bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground/60">⌘K</kbd>
          </div>

          {/* Mobile search toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileSearchOpen((o) => !o)}
            aria-label="Search"
          >
            <Search className="h-[18px] w-[18px]" />
          </Button>

          {/* AI button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleAi}
            className="gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">AI</span>
          </Button>

          {/* Notifications */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-[18px] w-[18px]" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
                    {unreadCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0 shadow-float" align="end">
              <div className="flex items-center justify-between p-4">
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
                      "w-full text-left px-4 py-3 hover:bg-tonal transition-colors",
                      !n.read && "bg-tonal-accent/50"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "mt-1.5 h-1.5 w-1.5 rounded-full shrink-0",
                        n.read ? "bg-transparent" : "bg-primary"
                      )} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium truncate">{n.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.body}</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1">{n.time} · {n.channel}</p>
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
                  <AvatarFallback className="bg-primary-surface text-primary-foreground text-xs font-semibold">
                    {userAvatar || userName?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?"}
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
              <DropdownMenuItem onClick={() => onNavigate("profile")}>
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onNavigate("settings")}>
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={toggleTheme}>
                {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                {theme === "dark" ? "Light Mode" : "Dark Mode"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-rose-600 focus:text-rose-700">
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile search row */}
          {mobileSearchOpen && (
            <div className="md:hidden flex w-full items-center h-9 rounded-lg bg-tonal px-3 focus-within:bg-tonal-accent focus-within:ring-2 focus-within:ring-primary/25 transition-colors">
              <Search className="h-3.5 w-3.5 mr-2 opacity-70" />
              <input
                autoFocus
                placeholder="Search orders, vendors…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") jumpToSearchPage();
                }}
                className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground/70 text-[13px]"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} aria-label="Clear search" className="shrink-0">
                  <X className="h-3.5 w-3.5 opacity-60 hover:opacity-100" />
                </button>
              )}
            </div>
          )}
        </header>

        {/* Page header */}
        {!isSearching && (
          <div className="flex flex-col gap-4 px-5 lg:px-8 pt-8 pb-3">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
              <div>
                <h1 className="text-[26px] md:text-[32px] font-semibold tracking-tight leading-tight" style={{ fontFamily: "var(--font-display)", fontWeight: 500 }}>
                  {pageTitle}
                </h1>
                {pageSubtitle && (
                  <p className="text-[13px] text-muted-foreground mt-1.5 tracking-tight">{pageSubtitle}</p>
                )}
              </div>
              {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
            </div>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 px-5 lg:px-8 py-4 pb-16">
          <div className={cn(isSearching && "hidden")}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeView}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>
          {isSearching && <SearchResults query={searchQuery.trim()} onNavigate={onNavigate} />}
        </main>
      </div>

      {/* AI Assistant overlay */}
      <AiAssistant />

      {/* Mobile AI FAB */}
      <button
        onClick={toggleAi}
        className="lg:hidden fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-float hover:bg-primary/90 active:scale-95 transition-all duration-200"
        aria-label="Open AI Assistant"
      >
        <MessageSquare className="h-6 w-6" />
      </button>
    </div>
  );
}
