import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/utils";
import {
  Home,
  FileText,
  Settings,
  Users,
  MessageSquare,
  MessageCircle,
  ExternalLink,
} from "lucide-react";

const navItems = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: Home,
  },
  {
    name: "Proposals",
    href: "/dashboard/proposals",
    icon: FileText,
  },
  {
    name: "Chat",
    href: "/dashboard/chat",
    icon: MessageSquare,
    badge: "New",
  },
  {
    name: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-gray-200 bg-white">
      <div className="flex h-full flex-col justify-between p-4">
        <div>
          <div className="mb-6 flex items-center">
            <span className="text-xl font-bold">ProposalPro</span>
          </div>
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href || pathname?.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 transition-colors",
                    isActive
                      ? "bg-gray-100 text-gray-900"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{item.name}</span>
                  {item.badge && (
                    <span className="ml-auto rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="border-t border-gray-200 pt-4">
          <Link
            href="https://docs.example.com"
            target="_blank"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
          >
            <ExternalLink className="h-5 w-5" />
            <span>Documentation</span>
          </Link>
        </div>
      </div>
    </aside>
  );
}
