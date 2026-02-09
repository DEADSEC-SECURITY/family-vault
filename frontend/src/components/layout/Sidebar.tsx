"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  IdCard,
  ShieldCheck,
  Briefcase,
  Bell,
  Car,
  Users,
  LogOut,
} from "lucide-react";
import { removeToken, getStoredUser } from "@/lib/auth";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const navItemsTop = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
];

const navItemsBottom = [
  { href: "/ids", label: "Family IDs", icon: IdCard },
  { href: "/insurance", label: "Insurance", icon: ShieldCheck },
  { href: "/business", label: "Business", icon: Briefcase },
];

interface SidebarProps {
  collapsed: boolean;
  remindersOpen: boolean;
  onToggleReminders: () => void;
}

export function Sidebar({ collapsed, remindersOpen, onToggleReminders }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const user = getStoredUser();

  async function handleLogout() {
    try {
      await api.auth.logout();
    } catch {
      // ignore errors on logout
    }
    removeToken();
    router.push("/login");
  }

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r bg-white transition-all duration-300 shrink-0",
        collapsed ? "w-16" : "w-64",
      )}
    >
      {/* Logo */}
      <div className={cn("flex items-center", collapsed ? "justify-center p-4" : "p-6")}>
        <Link href="/dashboard" className="text-xl font-bold text-gray-900">
          {collapsed ? "F" : "FamilyVault"}
        </Link>
      </div>

      {/* Nav items */}
      <nav className={cn("flex-1 space-y-1", collapsed ? "px-2" : "px-3")}>
        {navItemsTop.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center rounded-lg text-sm font-medium transition-colors",
                collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5",
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && item.label}
            </Link>
          );
        })}

        {/* Reminders — right under Dashboard */}
        <button
          onClick={onToggleReminders}
          title={collapsed ? "Reminders" : undefined}
          className={cn(
            "flex items-center rounded-lg text-sm font-medium transition-colors w-full",
            collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5",
            remindersOpen
              ? "bg-blue-50 text-blue-700"
              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
          )}
        >
          <Bell className="h-5 w-5 shrink-0" />
          {!collapsed && "Reminders"}
        </button>

        <Separator className="my-2" />

        {/* Vehicles */}
        <Link
          href="/vehicles"
          title={collapsed ? "Vehicles" : undefined}
          className={cn(
            "flex items-center rounded-lg text-sm font-medium transition-colors",
            collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5",
            pathname.startsWith("/vehicles")
              ? "bg-blue-50 text-blue-700"
              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
          )}
        >
          <Car className="h-5 w-5 shrink-0" />
          {!collapsed && "Vehicles"}
        </Link>

        {/* People */}
        <Link
          href="/people"
          title={collapsed ? "People" : undefined}
          className={cn(
            "flex items-center rounded-lg text-sm font-medium transition-colors",
            collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5",
            pathname.startsWith("/people")
              ? "bg-blue-50 text-blue-700"
              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
          )}
        >
          <Users className="h-5 w-5 shrink-0" />
          {!collapsed && "People"}
        </Link>

        <Separator className="my-2" />

        {navItemsBottom.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "flex items-center rounded-lg text-sm font-medium transition-colors",
                collapsed ? "justify-center p-2.5" : "gap-3 px-3 py-2.5",
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>

      <Separator />

      {/* User info + logout */}
      <div className={cn(collapsed ? "p-2" : "p-4")}>
        {user && !collapsed && (
          <p className="mb-2 truncate text-sm font-medium text-gray-700">
            {user.full_name}
          </p>
        )}
        <Button
          variant="ghost"
          size="sm"
          title={collapsed ? "Sign out" : undefined}
          className={cn(
            "text-gray-500",
            collapsed
              ? "w-full justify-center p-2"
              : "w-full justify-start gap-2",
          )}
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && "Sign out"}
        </Button>
      </div>
    </aside>
  );
}
