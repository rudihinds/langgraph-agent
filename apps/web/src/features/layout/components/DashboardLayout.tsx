"use client";

import { ReactNode, useEffect, useState } from "react";
import { useSession } from "@/hooks/useSession";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils/utils";
import { Button } from "@/features/ui/components/button";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/features/ui/components/avatar";
import { ModeToggle } from "@/features/ui/components/mode-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/features/ui/components/dropdown-menu";
import {
  ChevronLeft,
  ChevronRight,
  HomeIcon,
  FileTextIcon,
  PlusIcon,
  SettingsIcon,
  HelpCircleIcon,
  LogOut,
  User as UserIcon,
  Settings,
  MessageSquare,
} from "lucide-react";
import { Separator } from "@/features/ui/components/separator";
import ProposalThreadsList from "@/features/thread/components/ProposalThreadsList";

interface DashboardLayoutProps {
  children: ReactNode;
}

interface NavItemProps {
  href: string;
  icon: ReactNode;
  label: string;
  isActive: boolean;
  isCollapsed?: boolean;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, isLoading, refreshSession, signOut } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [authChecked, setAuthChecked] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Determine if it's a chat page
  const chatPaths = ["/dashboard/chat"]; // Define chat paths
  const isChatPage = chatPaths.some(
    (path) => pathname === path || pathname?.startsWith(`${path}/`)
  );

  // Check if on mobile screen and set initial state
  useEffect(() => {
    const checkScreenSize = () => {
      // Collapse sidebar on mobile OR on chat pages (for better thread history visibility)
      setIsSidebarCollapsed(window.innerWidth < 768 || isChatPage);
    };

    // Set initial state
    checkScreenSize();

    // Add event listener for resize
    window.addEventListener("resize", checkScreenSize);

    // Cleanup
    return () => window.removeEventListener("resize", checkScreenSize);
  }, [isChatPage]);

  // Authentication check
  useEffect(() => {
    const checkAuth = async () => {
      if (hasAuthCookie() && !user && !isLoading) {
        try {
          await refreshSession();
        } catch (err) {
          console.error("[Dashboard Layout] Error refreshing session:", err);
        }
      }

      setAuthChecked(true);
    };

    checkAuth();
  }, [user, isLoading, refreshSession]);

  // Redirect if not authenticated
  useEffect(() => {
    // Temporarily disabled for debugging
    /*
    if (authChecked && !isLoading && !user) {
      if (typeof window !== "undefined") {
        localStorage.setItem("redirectAfterLogin", pathname);
      }
      router.replace("/login?redirected=true");
    }
    */

    // Force auth checked to true
    setAuthChecked(true);
  }, [user, isLoading, router, authChecked, pathname]);

  // Helper function to check for auth cookie
  const hasAuthCookie = () => {
    return document.cookie.includes("auth-session-established=true");
  };

  // Get user initials for avatar
  const getUserInitials = (email: string): string => {
    if (!email) return "?";
    return email.substring(0, 2).toUpperCase();
  };

  // Show loading state while checking auth
  if (isLoading || !authChecked) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-12 h-12 border-t-2 border-b-2 rounded-full animate-spin border-primary"></div>
        <div className="ml-4 text-primary">Checking authentication...</div>
      </div>
    );
  }

  // If not authenticated, the useEffect will handle redirect
  // Temporarily disabled for debugging
  /*
  if (!user) {
    return null;
  }
  */

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside
        data-testid="dashboard-sidebar"
        className={cn(
          "flex flex-col h-full bg-card border-r border-border transition-all duration-300 ease-in-out",
          isSidebarCollapsed ? "w-16" : "w-64"
        )}
      >
        {/* App branding */}
        <div className="flex items-center h-16 px-4 border-b border-border">
          {!isSidebarCollapsed && (
            <Link href="/dashboard" className="text-xl font-bold">
              Proposal Agent
            </Link>
          )}
          {isSidebarCollapsed && (
            <div className="flex justify-center w-full">
              <Link href="/dashboard" aria-label="Proposal Agent">
                <FileTextIcon size={24} className="text-primary" />
              </Link>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 overflow-y-auto">
          {isChatPage ? (
            // On chat pages, show essential nav icons in collapsed state
            isSidebarCollapsed ? (
              <ul className="px-2 space-y-1">
                <NavItem
                  href="/dashboard"
                  icon={<HomeIcon size={20} />}
                  label="Dashboard"
                  isActive={pathname === "/dashboard"}
                  isCollapsed={true}
                />
                <NavItem
                  href="/dashboard/chat"
                  icon={<MessageSquare size={20} />}
                  label="Chat"
                  isActive={pathname.startsWith("/dashboard/chat")}
                  isCollapsed={true}
                />
                <NavItem
                  href="/proposals/new"
                  icon={<PlusIcon size={20} />}
                  label="New Proposal"
                  isActive={pathname === "/proposals/new"}
                  isCollapsed={true}
                />
                <NavItem
                  href="/settings"
                  icon={<SettingsIcon size={20} />}
                  label="Settings"
                  isActive={pathname === "/settings"}
                  isCollapsed={true}
                />
              </ul>
            ) : (
              <ProposalThreadsList />
            )
          ) : (
            <ul className="px-2 space-y-1">
              <NavItem
                href="/dashboard"
                icon={<HomeIcon size={20} />}
                label="Dashboard"
                isActive={pathname === "/dashboard"}
                isCollapsed={isSidebarCollapsed}
              />
              <NavItem
                href="/proposals"
                icon={<FileTextIcon size={20} />}
                label="My Proposals"
                isActive={pathname.startsWith("/proposals")}
                isCollapsed={isSidebarCollapsed}
              />
              <NavItem
                href="/proposals/new"
                icon={<PlusIcon size={20} />}
                label="New Proposal"
                isActive={pathname === "/proposals/new"}
                isCollapsed={isSidebarCollapsed}
              />
              <NavItem
                href="/settings"
                icon={<SettingsIcon size={20} />}
                label="Settings"
                isActive={pathname === "/settings"}
                isCollapsed={isSidebarCollapsed}
              />
            </ul>
          )}
        </nav>

        {/* Sidebar Footer */}
        <div className="flex justify-center px-6 py-4 border-t border-border">
          <Button
            data-testid="sidebar-toggle"
            variant="ghost"
            size="icon"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            aria-label={
              isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
            }
          >
            {isSidebarCollapsed ? (
              <ChevronRight size={16} />
            ) : (
              <ChevronLeft size={16} />
            )}
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* Header */}
        <header className="flex items-center h-16 px-6 border-b border-border">
          <h1 className="text-xl font-semibold">
            {pathname === "/dashboard" && "Dashboard"}
            {pathname === "/proposals" && "My Proposals"}
            {pathname === "/proposals/new" && "New Proposal"}
            {pathname === "/settings" && "Settings"}
            {pathname.startsWith("/dashboard/chat") && "Chat"}
          </h1>
          <div className="flex items-center ml-auto space-x-2">
            <ModeToggle />
            <UserProfileMenu user={user} onSignOut={signOut} />
          </div>
        </header>

        {/* Content area */}
        <main className={cn(
          "relative flex-1",
          isChatPage ? "overflow-hidden" : "overflow-auto"
        )}>
          <div className={cn(
            isChatPage ? "h-full" : "p-6",
            !isChatPage && "mx-auto max-w-7xl"
          )}>{children}</div>
        </main>

        {/* Footer */}
        <footer className="px-6 py-4 border-t border-border">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Proposal Agent v1.0.0
            </p>
            <p className="text-xs text-muted-foreground">
              © 2023 21st.dev. All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}

// Navigation item component
export function NavItem({
  href,
  icon,
  label,
  isActive,
  isCollapsed = false,
}: NavItemProps) {
  return (
    <li>
      <Link
        href={href}
        className={cn(
          "flex items-center px-3 py-2 rounded-md transition-colors",
          "hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/20",
          isActive ? "bg-primary/10 text-primary" : "text-foreground"
        )}
      >
        <span className="flex-shrink-0">{icon}</span>
        <span className={cn("ml-3 flex-1", isCollapsed && "sr-only")}>
          {label}
        </span>
      </Link>
    </li>
  );
}

// User Profile Menu Component
function UserProfileMenu({
  user,
  onSignOut,
}: {
  user: any;
  onSignOut: () => Promise<void>;
}) {
  // Add null checks to avoid errors when user is null during logout
  const userInitials = user
    ? user.user_metadata?.name?.charAt(0) || user.email?.charAt(0) || "?"
    : "?";

  const handleSignOut = async () => {
    await onSignOut();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative w-10 h-10 rounded-full">
          <Avatar className="w-10 h-10">
            <AvatarImage
              src={user?.user_metadata?.avatar_url}
              alt={user?.email || ""}
            />
            <AvatarFallback>{userInitials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {user?.email || "User"}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {user?.user_metadata?.name || user?.email || "User"}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link
            href="/profile"
            className="flex items-center w-full cursor-pointer"
          >
            <UserIcon className="w-4 h-4 mr-2" />
            <span>Profile</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link
            href="/settings"
            className="flex items-center w-full cursor-pointer"
          >
            <Settings className="w-4 h-4 mr-2" />
            <span>Settings</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleSignOut}
          className="cursor-pointer focus:bg-destructive/10"
        >
          <LogOut className="w-4 h-4 mr-2" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
