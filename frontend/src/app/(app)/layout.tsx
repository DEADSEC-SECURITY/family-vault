"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { PageTransition } from "@/components/layout/PageTransition";
import { RemindersPanel } from "@/components/layout/RemindersPanel";
import { KeyCeremonyBanner, WaitingForAccessBanner } from "@/components/auth/KeyCeremonyBanner";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [remindersOpen, setRemindersOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login");
    } else {
      setReady(true);
    }
  }, [router]);

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        collapsed={remindersOpen}
        remindersOpen={remindersOpen}
        onToggleReminders={() => setRemindersOpen((prev) => !prev)}
      />
      <RemindersPanel
        open={remindersOpen}
        onClose={() => setRemindersOpen(false)}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <KeyCeremonyBanner />
        <WaitingForAccessBanner />
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
