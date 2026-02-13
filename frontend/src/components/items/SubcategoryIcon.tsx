import {
  BadgeCheck,
  Briefcase,
  Building,
  Building2,
  Car,
  FileBadge,
  FileSpreadsheet,
  FileText,
  Globe,
  HardHat,
  Heart,
  Home,
  IdCard,
  KeyRound,
  Plane,
  Shield,
  ShieldCheck,
  ShieldPlus,
  Truck,
  User,
  Users,
  Wifi,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface IconConfig {
  icon: LucideIcon;
  bgColor: string;
  iconColor: string;
}

const SUBCATEGORY_ICONS: Record<string, IconConfig> = {
  // Insurance
  auto_insurance: { icon: Car, bgColor: "bg-blue-100", iconColor: "text-blue-600" },
  health_insurance: { icon: Heart, bgColor: "bg-red-100", iconColor: "text-red-600" },
  renters_insurance: { icon: Home, bgColor: "bg-orange-100", iconColor: "text-orange-600" },
  life_insurance: { icon: Heart, bgColor: "bg-purple-100", iconColor: "text-purple-600" },
  // IDs
  drivers_license: { icon: IdCard, bgColor: "bg-blue-100", iconColor: "text-blue-600" },
  passport: { icon: Plane, bgColor: "bg-indigo-100", iconColor: "text-indigo-600" },
  visa: { icon: Globe, bgColor: "bg-teal-100", iconColor: "text-teal-600" },
  social_security: { icon: Shield, bgColor: "bg-gray-100", iconColor: "text-gray-600" },
  birth_certificate: { icon: FileText, bgColor: "bg-pink-100", iconColor: "text-pink-600" },
  custom_id: { icon: BadgeCheck, bgColor: "bg-slate-100", iconColor: "text-slate-600" },
  // Business
  llc: { icon: Building, bgColor: "bg-blue-100", iconColor: "text-blue-600" },
  corporation: { icon: Building2, bgColor: "bg-indigo-100", iconColor: "text-indigo-600" },
  partnership: { icon: Users, bgColor: "bg-purple-100", iconColor: "text-purple-600" },
  sole_proprietorship: { icon: User, bgColor: "bg-teal-100", iconColor: "text-teal-600" },
  business_license: { icon: FileBadge, bgColor: "bg-green-100", iconColor: "text-green-600" },
  general_liability: { icon: Shield, bgColor: "bg-amber-100", iconColor: "text-amber-600" },
  professional_liability: { icon: Briefcase, bgColor: "bg-violet-100", iconColor: "text-violet-600" },
  workers_compensation: { icon: HardHat, bgColor: "bg-orange-100", iconColor: "text-orange-600" },
  commercial_property: { icon: Building, bgColor: "bg-cyan-100", iconColor: "text-cyan-600" },
  commercial_auto: { icon: Truck, bgColor: "bg-blue-100", iconColor: "text-blue-600" },
  bop: { icon: ShieldCheck, bgColor: "bg-emerald-100", iconColor: "text-emerald-600" },
  cyber_liability: { icon: Wifi, bgColor: "bg-sky-100", iconColor: "text-sky-600" },
  other_business_insurance: { icon: ShieldPlus, bgColor: "bg-gray-100", iconColor: "text-gray-600" },
  tax_document: { icon: FileSpreadsheet, bgColor: "bg-red-100", iconColor: "text-red-600" },
  // Security Codes
  backup_codes: { icon: KeyRound, bgColor: "bg-amber-100", iconColor: "text-amber-600" },
};

/** Default icons per category when subcategory isn't found */
const CATEGORY_DEFAULTS: Record<string, IconConfig> = {
  insurance: { icon: Shield, bgColor: "bg-green-100", iconColor: "text-green-600" },
  ids: { icon: IdCard, bgColor: "bg-blue-100", iconColor: "text-blue-600" },
  business: { icon: Briefcase, bgColor: "bg-gray-100", iconColor: "text-gray-600" },
  security_codes: { icon: KeyRound, bgColor: "bg-amber-100", iconColor: "text-amber-600" },
};

interface SubcategoryIconProps {
  subcategory: string;
  category?: string;
  size?: "sm" | "md";
}

/**
 * Renders a colored icon badge for a subcategory.
 * Replaces ProviderLogo, IDIcon, and BusinessIcon.
 */
export function SubcategoryIcon({
  subcategory,
  category = "",
  size = "md",
}: SubcategoryIconProps) {
  const config =
    SUBCATEGORY_ICONS[subcategory] ||
    CATEGORY_DEFAULTS[category] ||
    { icon: Shield, bgColor: "bg-gray-100", iconColor: "text-gray-600" };

  const Icon = config.icon;
  const sizeClasses = size === "sm" ? "w-8 h-8" : "w-12 h-12";
  const iconSize = size === "sm" ? "w-4 h-4" : "w-6 h-6";

  return (
    <div
      className={`${sizeClasses} flex-shrink-0 rounded-lg ${config.bgColor} flex items-center justify-center`}
    >
      <div className={config.iconColor}>
        <Icon className={iconSize} />
      </div>
    </div>
  );
}
