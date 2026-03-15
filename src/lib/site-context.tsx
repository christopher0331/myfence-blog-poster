"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { SiteConfig } from "@/lib/types";

const STORAGE_KEY = "selected-site-id";
const DEFAULT_SITE_ID = "11111111-1111-1111-1111-111111111111";

interface SiteContextValue {
  loading: boolean;
  sites: SiteConfig[];
  currentSite: SiteConfig | null;
  siteId: string;
  setSiteId: (siteId: string) => void;
}

const SiteContext = createContext<SiteContextValue | undefined>(undefined);

export function SiteProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [sites, setSites] = useState<SiteConfig[]>([]);
  const [siteId, setSiteIdState] = useState(DEFAULT_SITE_ID);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) setSiteIdState(stored);
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/sites")
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        const nextSites: SiteConfig[] = data?.sites || [];
        setSites(nextSites);
        if (nextSites.length > 0 && !nextSites.some((s) => s.id === siteId)) {
          const fallback = nextSites[0].id;
          setSiteIdState(fallback);
          window.localStorage.setItem(STORAGE_KEY, fallback);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [siteId]);

  const setSiteId = useCallback((next: string) => {
    setSiteIdState(next);
    window.localStorage.setItem(STORAGE_KEY, next);
  }, []);

  const currentSite = useMemo(
    () => sites.find((s) => s.id === siteId) || sites[0] || null,
    [sites, siteId],
  );

  const value = useMemo(
    () => ({
      loading,
      sites,
      currentSite,
      siteId: currentSite?.id || siteId,
      setSiteId,
    }),
    [loading, sites, currentSite, siteId, setSiteId],
  );

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSite() {
  const context = useContext(SiteContext);
  if (!context) throw new Error("useSite must be used within SiteProvider");
  return context;
}
