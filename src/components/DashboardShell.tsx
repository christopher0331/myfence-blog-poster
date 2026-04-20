"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import AgentDrawer from "@/components/AgentDrawer";
import { useSite } from "@/lib/site-context";
import { Menu } from "lucide-react";

const PAGE_TITLES: Record<string, string> = {
  "/": "Schedule",
  "/posts": "Posts",
  "/topics": "Topics",
  "/competitor-analysis": "Competitors",
  "/lighthouse": "Lighthouse",
  "/feedback": "Feedback",
  "/settings": "Settings",
  "/schedule": "Schedule",
  "/publish": "Publish",
};

function titleFromPath(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  const seg = pathname.split("/").filter(Boolean);
  if (seg[0] === "posts" && seg[1]) return "Edit post";
  return PAGE_TITLES[`/${seg[0]}`] || "Studio";
}

export default function DashboardShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { currentSite } = useSite();
  const pathname = usePathname();
  const pageTitle = titleFromPath(pathname);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = () => setMobileMenuOpen(false);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <div className="flex min-h-screen bg-background">
      {mobileMenuOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
        />
      )}

      <Sidebar
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      <main className="flex-1 flex flex-col min-w-0 overflow-auto">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-3 h-12 border-b border-border bg-background/80 backdrop-blur-md px-4 shrink-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="md:hidden flex items-center justify-center w-8 h-8 -ml-1 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            aria-label="Open menu"
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2 text-sm min-w-0">
            <span className="text-muted-foreground truncate max-w-[120px]">
              {currentSite?.name || "Studio"}
            </span>
            <span className="text-muted-foreground/50">/</span>
            <span className="font-medium text-foreground truncate">{pageTitle}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {currentSite?.domain && (
              <a
                href={`https://${currentSite.domain}`}
                target="_blank"
                rel="noreferrer"
                className="hidden sm:inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:border-muted-foreground/40 transition-colors"
              >
                {currentSite.domain}
                <svg
                  className="h-3 w-3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            )}
          </div>
        </header>

        <div className="page-container">{children}</div>
      </main>

      <AgentDrawer />
    </div>
  );
}
