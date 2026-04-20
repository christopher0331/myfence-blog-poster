"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useSite } from "@/lib/site-context";
import {
  FileText,
  Lightbulb,
  Calendar,
  MessageSquare,
  Settings,
  LogOut,
  X,
  Target,
  Activity,
  ChevronsUpDown,
  Check,
  Globe,
} from "lucide-react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavSection = {
  label: string;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    label: "Content",
    items: [
      { href: "/", label: "Schedule", icon: Calendar },
      { href: "/posts", label: "Posts", icon: FileText },
      { href: "/topics", label: "Topics", icon: Lightbulb },
    ],
  },
  {
    label: "Growth",
    items: [
      { href: "/competitor-analysis", label: "Competitors", icon: Target },
      { href: "/lighthouse", label: "Lighthouse", icon: Activity },
    ],
  },
  {
    label: "Workspace",
    items: [
      { href: "/feedback", label: "Feedback", icon: MessageSquare },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

type SidebarProps = {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

export default function Sidebar({ mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname();
  const { sites, siteId, setSiteId, currentSite } = useSite();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const prevPathname = useRef(pathname);
  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      if (mobileOpen && onMobileClose) onMobileClose();
    }
  }, [pathname, mobileOpen, onMobileClose]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-site-switcher]")) setSwitcherOpen(false);
    }
    if (switcherOpen) document.addEventListener("click", onClickOutside);
    return () => document.removeEventListener("click", onClickOutside);
  }, [switcherOpen]);

  const content = (
    <>
      {/* Brand */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <Link
          href="/"
          className="flex items-center gap-2 min-w-0"
          onClick={onMobileClose}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-[13px] font-bold text-primary-foreground">
            {currentSite?.abbreviation?.slice(0, 2) || "CM"}
          </span>
          <span className="text-sm font-semibold tracking-tight truncate">
            Studio
          </span>
        </Link>
        {onMobileClose && (
          <button
            type="button"
            onClick={onMobileClose}
            className="md:hidden flex items-center justify-center w-9 h-9 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Site switcher */}
      <div
        className="relative z-40 px-3 pb-3"
        data-site-switcher
      >
        <button
          type="button"
          onClick={() => setSwitcherOpen((v) => !v)}
          className="group flex w-full items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted/70"
          aria-haspopup="listbox"
          aria-expanded={switcherOpen}
        >
          <Globe className="h-4 w-4 text-muted-foreground" />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Site
            </div>
            <div className="truncate font-medium">
              {currentSite?.name || "Select site"}
            </div>
          </div>
          <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
        </button>
        {switcherOpen && (
          <div className="absolute left-3 right-3 top-full z-[100] mt-1 rounded-md border border-border bg-popover shadow-xl animate-fade-in">
            <div className="p-1">
              {sites.map((site) => {
                const active = site.id === siteId;
                return (
                  <button
                    key={site.id}
                    type="button"
                    onClick={() => {
                      setSiteId(site.id);
                      setSwitcherOpen(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm hover:bg-accent"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted text-[10px] font-bold text-muted-foreground">
                      {site.abbreviation?.slice(0, 2) || "—"}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block truncate font-medium">{site.name}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {site.domain}
                      </span>
                    </span>
                    {active && <Check className="h-4 w-4 text-primary" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2">
        {navSections.map((section) => (
          <div key={section.label} className="mb-4">
            <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">
              {section.label}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
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
                      "group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                      isActive
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                    )}
                  >
                    <item.icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                      )}
                    />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-border px-2 py-3">
        <form
          action={async () => {
            window.location.href = "/api/auth/signout";
          }}
        >
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sign out
          </button>
        </form>
        <div className="mt-2 flex items-center gap-2 px-2 text-[11px] text-muted-foreground">
          <span className="status-dot bg-primary animate-pulse-soft" />
          <span className="truncate">{currentSite?.domain || "—"}</span>
        </div>
      </div>
    </>
  );

  return (
    <>
      <aside className="hidden md:flex relative z-40 w-60 flex-shrink-0 border-r border-border bg-card/50 min-h-screen flex-col">
        {content}
      </aside>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 max-w-[85vw] border-r border-border bg-card flex flex-col shadow-2xl transition-transform duration-200 ease-out md:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
        aria-hidden={!mobileOpen}
      >
        {content}
      </aside>
    </>
  );
}
