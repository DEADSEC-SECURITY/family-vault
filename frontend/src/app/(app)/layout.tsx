"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated, isZeroKnowledge, removeToken } from "@/lib/auth";
import { keyStore } from "@/lib/key-store";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { PageTransition } from "@/components/layout/PageTransition";
import { RemindersPanel } from "@/components/layout/RemindersPanel";
import { KeyCeremonyBanner, WaitingForAccessBanner } from "@/components/auth/KeyCeremonyBanner";
import { MigrationPrompt } from "@/components/auth/MigrationPrompt";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [remindersOpen, setRemindersOpen] = useState(false);

  useEffect(() => {
    function checkSession() {
      if (!isAuthenticated()) {
        router.push("/login");
        return false;
      }
      // ZK users need in-memory keys — if lost (tab suspended/discarded), force re-login
      if (isZeroKnowledge() && !keyStore.isInitialized) {
        keyStore.clear();
        removeToken();
        router.push("/login");
        return false;
      }
      return true;
    }

    if (checkSession()) {
      setReady(true);
    }

    // Re-check when user returns to a suspended tab
    function onVisibilityChange() {
      if (document.visibilityState === "visible" && !checkSession()) {
        setReady(false);
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
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
      <MigrationPrompt />
    </div>
  );
}
