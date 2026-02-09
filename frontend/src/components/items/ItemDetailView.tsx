"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Edit, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { api } from "@/lib/api";
import type { CategoryDetail, Item, SubcategoryInfo } from "@/lib/api";
import { ItemFormDialog } from "./ItemFormDialog";
import { FileUploader } from "./FileUploader";
import { FileList } from "./FileList";

interface ItemDetailViewProps {
  categorySlug: string;
  itemId: string;
}

export function ItemDetailView({ categorySlug, itemId }: ItemDetailViewProps) {
  const router = useRouter();
  const [item, setItem] = useState<Item | null>(null);
  const [category, setCategory] = useState<CategoryDetail | null>(null);
  const [subcategory, setSubcategory] = useState<SubcategoryInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [showUploader, setShowUploader] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [itemData, catData] = await Promise.all([
        api.items.get(itemId),
        api.categories.get(categorySlug),
      ]);
      setItem(itemData);
      setCategory(catData);
      const sub = catData.subcategories.find(
        (s) => s.key === itemData.subcategory,
      );
      setSubcategory(sub || null);
    } catch (err) {
      console.error("Failed to load item:", err);
    } finally {
      setLoading(false);
    }
  }, [itemId, categorySlug]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleDelete() {
    try {
      await api.items.delete(itemId);
      router.push(`/${categorySlug}`);
    } catch (err) {
      console.error("Failed to delete item:", err);
    }
  }

  function handleSaved() {
    fetchData();
  }

  if (loading) {
    return <div className="text-gray-400">Loading...</div>;
  }

  if (!item || !category) {
    return <div className="text-red-500">Item not found</div>;
  }

  const fieldMap = new Map(
    (subcategory?.fields || []).map((f) => [f.key, f]),
  );

  return (
    <div className="max-w-3xl">
      <button
        onClick={() => router.push(`/${categorySlug}`)}
        className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {category.label}
      </button>

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{item.name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {subcategory?.label || item.subcategory}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Edit className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {item.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will archive the item. You can contact an admin to restore it later.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Fields */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Details</CardTitle>
        </CardHeader>
        <CardContent>
          {item.fields.length === 0 ? (
            <p className="text-sm text-gray-400">No fields filled in yet.</p>
          ) : (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {item.fields.map((fv) => {
                const def = fieldMap.get(fv.field_key);
                return (
                  <div key={fv.field_key}>
                    <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {def?.label || fv.field_key}
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {fv.field_value || "—"}
                    </dd>
                  </div>
                );
              })}
            </dl>
          )}
          {item.notes && (
            <>
              <Separator className="my-4" />
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Notes
                </dt>
                <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">
                  {item.notes}
                </dd>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Files */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Files</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowUploader(!showUploader)}
          >
            <Upload className="h-4 w-4 mr-1" />
            Upload
          </Button>
        </CardHeader>
        <CardContent>
          {showUploader && (
            <div className="mb-4">
              <FileUploader
                itemId={item.id}
                fileSlots={subcategory?.file_slots || []}
                onUploaded={fetchData}
              />
            </div>
          )}
          <FileList files={item.files} onDeleted={fetchData} />
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {subcategory && editOpen && (
        <ItemFormDialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onSaved={handleSaved}
          categorySlug={categorySlug}
          subcategoryKey={subcategory.key}
          subcategoryLabel={subcategory.label}
          fields={subcategory.fields}
          editItem={item}
        />
      )}
    </div>
  );
}
