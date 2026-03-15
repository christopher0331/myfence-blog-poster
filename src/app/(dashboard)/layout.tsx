import DashboardShell from "@/components/DashboardShell";
import { SiteProvider } from "@/lib/site-context";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SiteProvider>
      <DashboardShell>{children}</DashboardShell>
    </SiteProvider>
  );
}
