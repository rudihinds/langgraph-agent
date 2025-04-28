import Link from "next/link";
import { Button } from "@/features/ui/components/button";
import { ModeToggle } from "@/features/ui/components/mode-toggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/features/ui/components/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/features/ui/components/avatar";
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
    <header className="fixed top-0 left-0 right-0 z-10 border-b bg-background">
      <div className="container flex items-center justify-between h-16 px-4 mx-auto">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-xl font-bold">
            Proposal Agent
          </Link>
          <nav className="items-center hidden gap-4 md:flex">
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

  // Extract name from user metadata
  const userName =
    user?.user_metadata?.name ||
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "User";

  // Get avatar URL from metadata if available
  const avatarUrl =
    user?.user_metadata?.avatar_url || user?.user_metadata?.picture || null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative w-10 h-10 rounded-full">
          <Avatar className="w-10 h-10">
            <AvatarImage src={avatarUrl} alt={userName} />
            <AvatarFallback>{userInitials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{userName}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
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

function getUserInitials(email: string): string {
  if (!email) return "?";

  // Try to get name parts if available
  const nameParts = email.split("@")[0].split(/[._-]/);
  if (nameParts.length > 1) {
    return (nameParts[0][0] + nameParts[1][0]).toUpperCase();
  }

  // Fallback to first two characters of email
  return email.substring(0, 2).toUpperCase();
}
