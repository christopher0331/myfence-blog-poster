"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  FileText,
  Lightbulb,
  Calendar,
  MessageSquare,
  Settings,
  LogOut,
  X,
} from "lucide-react";

const navItems = [
  { href: "/topics", label: "Research Topics", icon: Lightbulb },
  { href: "/", label: "Scheduled Posts", icon: Calendar },
  { href: "/posts", label: "All Posts", icon: FileText },
  { href: "/feedback", label: "Feedback", icon: MessageSquare },
  { href: "/settings", label: "Settings", icon: Settings },
];

type SidebarProps = {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  onMobileMenuClick?: () => void;
};

export default function Sidebar({
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const pathname = usePathname();

  // Close mobile drawer when route changes (not when mobileOpen toggles)
  const prevPathname = useRef(pathname);
  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      if (mobileOpen && onMobileClose) onMobileClose();
    }
  }, [pathname, mobileOpen, onMobileClose]);

  const content = (
    <>
      {/* Logo row: close button on mobile, logo */}
      <div className="p-4 md:p-6 border-b flex items-center justify-between gap-2">
        <Link
          href="/"
          className="flex items-center gap-2 min-w-0"
          onClick={onMobileClose}
        >
          <span className="text-2xl font-bold text-primary shrink-0">MF</span>
          <span className="text-lg font-semibold truncate">Studio</span>
        </Link>
        {onMobileClose && (
          <button
            type="button"
            onClick={onMobileClose}
            className="md:hidden flex items-center justify-center w-10 h-10 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground touch-manipulation shrink-0"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onMobileClose}
              className={cn(
                "flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium transition-colors min-h-[44px] touch-manipulation",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t">
        <form
          action={async () => {
            window.location.href = "/api/auth/signout";
          }}
        >
          <button
            type="submit"
            className="flex items-center gap-3 px-3 py-3 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors w-full min-h-[44px] touch-manipulation"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sign Out
          </button>
        </form>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop: static aside */}
      <aside className="hidden md:flex w-64 flex-shrink-0 border-r bg-card min-h-screen flex-col">
        {content}
      </aside>

      {/* Mobile: fixed drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 max-w-[85vw] border-r bg-card flex flex-col shadow-xl transition-transform duration-200 ease-out md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
        aria-hidden={!mobileOpen}
      >
        {content}
      </aside>
    </>
  );
}
