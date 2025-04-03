import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/ui/mode-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User } from "@supabase/supabase-js";
import { LogOut, Settings, User as UserIcon } from "lucide-react";
import { useSession } from "@/hooks/useSession";

interface HeaderProps {
  user?: User | null;
}

export default function Header({ user }: HeaderProps) {
  const { signOut } = useSession();
  const isAuthenticated = !!user;

  return (
    <header className="fixed top-0 left-0 right-0 border-b bg-background z-10">
      <div className="container mx-auto h-16 px-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-bold text-xl">
            Proposal Agent
          </Link>
          <nav className="hidden md:flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <Link
                  href="/dashboard"
                  className="text-sm font-medium hover:text-primary"
                >
                  Dashboard
                </Link>
                <Link
                  href="/templates"
                  className="text-sm font-medium hover:text-primary"
                >
                  Templates
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/features"
                  className="text-sm font-medium hover:text-primary"
                >
                  Features
                </Link>
                <Link
                  href="/pricing"
                  className="text-sm font-medium hover:text-primary"
                >
                  Pricing
                </Link>
              </>
            )}
            <Link
              href="/help"
              className="text-sm font-medium hover:text-primary"
            >
              Help
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <ModeToggle />
          {isAuthenticated ? (
            <UserMenu
              user={user}
              userInitials={getUserInitials(user?.email || "")}
              onSignOut={signOut}
            />
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="outline" asChild>
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild>
                <Link href="/login">Sign up</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function UserMenu({
  user,
  userInitials,
  onSignOut,
}: {
  user: User;
  userInitials: string;
  onSignOut: () => Promise<void>;
}) {
  const handleSignOut = async () => {
    await onSignOut();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10">
            <AvatarImage
              src={user.user_metadata?.avatar_url}
              alt={user.email || ""}
            />
            <AvatarFallback>{userInitials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.email}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.user_metadata?.name || user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link
            href="/profile"
            className="cursor-pointer w-full flex items-center"
          >
            <UserIcon className="mr-2 h-4 w-4" />
            <span>Profile</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link
            href="/settings"
            className="cursor-pointer w-full flex items-center"
          >
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleSignOut}
          className="cursor-pointer focus:bg-destructive/10"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function getUserInitials(email: string): string {
  if (!email) return "?";

  // Use first two characters of email if no name
  return email.substring(0, 2).toUpperCase();
}
