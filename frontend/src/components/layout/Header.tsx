"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LogOut, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { api } from "@/lib/api";
import { removeToken, getStoredUser } from "@/lib/auth";
import { keyStore } from "@/lib/key-store";
import { ChangePasswordDialog } from "@/components/auth/ChangePasswordDialog";

export function Header() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const user = getStoredUser();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  }

  async function handleLogout() {
    try {
      await api.auth.logout();
    } catch {
      // ignore
    }
    keyStore.clear();
    removeToken();
    router.push("/login");
  }

  const initials = user?.full_name
    ? user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <>
      <header className="flex h-16 items-center justify-between border-b bg-white px-6">
        <form onSubmit={handleSearch} className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            type="text"
            placeholder="Search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </form>

        <Popover open={userMenuOpen} onOpenChange={setUserMenuOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative h-9 w-9 rounded-full bg-violet-100 text-violet-700 hover:bg-violet-200"
              aria-label="User menu"
            >
              <span className="text-xs font-semibold">{initials}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-1" align="end">
            {user && (
              <div className="px-3 py-2 border-b mb-1">
                <p className="text-sm font-medium truncate">{user.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
            )}
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-gray-100 transition-colors"
              onClick={() => {
                setUserMenuOpen(false);
                setChangePasswordOpen(true);
              }}
            >
              <KeyRound className="h-4 w-4" />
              Change Password
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </PopoverContent>
        </Popover>
      </header>

      <ChangePasswordDialog
        open={changePasswordOpen}
        onOpenChange={setChangePasswordOpen}
      />
    </>
  );
}
