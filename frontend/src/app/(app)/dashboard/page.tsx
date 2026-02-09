"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { IdCard, ShieldCheck, Briefcase, DollarSign, Users, Car, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import type { DashboardStats } from "@/lib/api";

const categories = [
  {
    name: "Family IDs",
    icon: IdCard,
    href: "/ids",
    description: "Driver's licenses, passports, birth certificates, and more",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  {
    name: "Insurance",
    icon: ShieldCheck,
    href: "/insurance",
    description: "Auto, health, home, life, and other insurance policies",
    color: "text-green-600",
    bgColor: "bg-green-50",
  },
  {
    name: "Business",
    icon: Briefcase,
    href: "/business",
    description: "LLCs, corporations, licenses, and business documents",
    color: "text-purple-600",
    bgColor: "bg-purple-50",
  },
];

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await api.dashboard.stats();
        setStats(data);
      } catch (error) {
        console.error("Failed to fetch dashboard stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Stats cards */}
      <div className="grid gap-6 md:grid-cols-4 mb-6">
        {/* Total annual premium - larger card */}
        <Link href="/insurance">
          <Card className="md:col-span-1 transition-shadow hover:shadow-md cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Annual Premiums
              </CardTitle>
              <DollarSign className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-8 w-24 bg-gray-200 animate-pulse rounded" />
              ) : (
                <div className="text-2xl font-bold text-gray-900">
                  ${stats?.total_annual_premium.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) || "0"}
                </div>
              )}
              <p className="text-xs text-gray-500 mt-1">Total per year</p>
            </CardContent>
          </Card>
        </Link>

        {/* People count */}
        <Link href="/people">
          <Card className="transition-shadow hover:shadow-md cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                People
              </CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-8 w-12 bg-gray-200 animate-pulse rounded" />
              ) : (
                <div className="text-2xl font-bold text-gray-900">
                  {stats?.people_count || 0}
                </div>
              )}
              <p className="text-xs text-gray-500 mt-1">Family members</p>
            </CardContent>
          </Card>
        </Link>

        {/* Vehicles count */}
        <Link href="/vehicles">
          <Card className="transition-shadow hover:shadow-md cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Vehicles
              </CardTitle>
              <Car className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-8 w-12 bg-gray-200 animate-pulse rounded" />
              ) : (
                <div className="text-2xl font-bold text-gray-900">
                  {stats?.vehicles_count || 0}
                </div>
              )}
              <p className="text-xs text-gray-500 mt-1">Registered cars</p>
            </CardContent>
          </Card>
        </Link>

        {/* Policies count */}
        <Link href="/insurance">
          <Card className="transition-shadow hover:shadow-md cursor-pointer">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Policies
              </CardTitle>
              <Shield className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-8 w-12 bg-gray-200 animate-pulse rounded" />
              ) : (
                <div className="text-2xl font-bold text-gray-900">
                  {stats?.policies_count || 0}
                </div>
              )}
              <p className="text-xs text-gray-500 mt-1">Active insurance</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Category cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {categories.map((cat) => (
          <a key={cat.name} href={cat.href}>
            <Card className="transition-shadow hover:shadow-md cursor-pointer">
              <CardHeader className="flex flex-row items-center gap-3">
                <div className={`rounded-lg p-2 ${cat.bgColor}`}>
                  <cat.icon className={`h-6 w-6 ${cat.color}`} />
                </div>
                <CardTitle className="text-lg">{cat.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {cat.description}
                </p>
              </CardContent>
            </Card>
          </a>
        ))}
      </div>
    </div>
  );
}
