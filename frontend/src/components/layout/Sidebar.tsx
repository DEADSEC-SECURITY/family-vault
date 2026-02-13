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
  BookUser,
  LogOut,
  FileText,
  FileCheck,
} from "lucide-react";
import { removeToken, getStoredUser } from "@/lib/auth";
import { keyStore } from "@/lib/key-store";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const personalItems: NavItem[] = [
  { href: "/ids", label: "Family IDs", icon: IdCard },
  { href: "/insurance", label: "Insurance", icon: ShieldCheck },
  { href: "/personal-taxes", label: "Taxes", icon: FileText },
];

const businessItems: NavItem[] = [
  { href: "/business", label: "Businesses", icon: Briefcase },
  { href: "/licenses", label: "Licenses", icon: FileCheck },
  { href: "/business-insurance", label: "Insurance", icon: ShieldCheck },
  { href: "/taxes", label: "Taxes", icon: FileText },
];

function NavLink({ href, label, icon: Icon, pathname: pn, collapsed: col, exact }: {
  href: string; label: string; icon: React.ComponentType<{ className?: string }>;
  pathname: string; collapsed: boolean; exact?: boolean;
}) {
  const isActive = exact ? pn === href : (pn === href || pn.startsWith(href + "/"));
  return (
    <Link
      href={href}
      title={col ? label : undefined}
      className={cn(
        "flex items-center rounded-lg text-[13px] font-medium transition-colors",
        col ? "justify-center p-2" : "gap-3 px-3 py-1.5",
        isActive
          ? "bg-blue-50 text-blue-700"
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {!col && label}
    </Link>
  );
}

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
    keyStore.clear();
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
      <div className={cn("flex items-center", collapsed ? "justify-center p-3" : "px-6 py-4")}>
        <Link href="/dashboard" className="text-xl font-bold text-gray-900">
          {collapsed ? "F" : "FamilyVault"}
        </Link>
      </div>

      {/* Nav items */}
      <nav className={cn("flex-1 space-y-1", collapsed ? "px-2" : "px-3")}>
        {/* Dashboard */}
        <NavLink href="/dashboard" label="Dashboard" icon={LayoutDashboard} pathname={pathname} collapsed={collapsed} exact />

        {/* Reminders */}
        <button
          onClick={onToggleReminders}
          title={collapsed ? "Reminders" : undefined}
          className={cn(
            "flex items-center rounded-lg text-[13px] font-medium transition-colors w-full",
            collapsed ? "justify-center p-2" : "gap-3 px-3 py-1.5",
            remindersOpen
              ? "bg-blue-50 text-blue-700"
              : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
          )}
        >
          <Bell className="h-4 w-4 shrink-0" />
          {!collapsed && "Reminders"}
        </button>

        <Separator className="my-2" />

        {/* Shared items */}
        <NavLink href="/vehicles" label="Vehicles" icon={Car} pathname={pathname} collapsed={collapsed} />
        <NavLink href="/people" label="People" icon={Users} pathname={pathname} collapsed={collapsed} />
        <NavLink href="/contacts" label="Contacts" icon={BookUser} pathname={pathname} collapsed={collapsed} />

        {/* Personal section */}
        {collapsed ? <Separator className="my-2" /> : (
          <div className="px-3 pt-3 pb-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Personal</span>
          </div>
        )}
        {personalItems.map((item) => (
          <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} pathname={pathname} collapsed={collapsed} />
        ))}

        {/* Business section */}
        {collapsed ? <Separator className="my-2" /> : (
          <div className="px-3 pt-3 pb-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Business</span>
          </div>
        )}
        {businessItems.map((item) => (
          <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} pathname={pathname} collapsed={collapsed} />
        ))}
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
