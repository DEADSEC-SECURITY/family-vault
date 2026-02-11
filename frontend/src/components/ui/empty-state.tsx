import React from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  loading?: boolean;
  icon: React.ReactNode;
  spinnerClass?: string;
  hasResults: boolean;
  searchActive?: boolean;
  entityName: string;
  onAdd?: () => void;
  children: React.ReactNode;
}

/**
 * Shared loading / empty / content wrapper used by list pages.
 *
 * - loading=true: centered spinner
 * - hasResults=false: empty state (icon, message, optional add button)
 * - otherwise: renders children
 */
export function EmptyState({
  loading,
  icon,
  spinnerClass = "text-gray-500",
  hasResults,
  searchActive,
  entityName,
  onAdd,
  children,
}: EmptyStateProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className={`h-8 w-8 animate-spin ${spinnerClass}`} />
      </div>
    );
  }

  if (!hasResults) {
    const singular = entityName.endsWith("eople")
      ? "person"
      : entityName.replace(/s$/, "");
    return (
      <div className="text-center py-12">
        {icon}
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {searchActive ? `No ${entityName} found` : `No ${entityName} yet`}
        </h3>
        <p className="text-gray-600 mb-4">
          {searchActive
            ? "Try adjusting your search"
            : `Add your first ${singular} to get started`}
        </p>
        {!searchActive && onAdd && (
          <Button onClick={onAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Add {singular.charAt(0).toUpperCase() + singular.slice(1)}
          </Button>
        )}
      </div>
    );
  }

  return <>{children}</>;
}
