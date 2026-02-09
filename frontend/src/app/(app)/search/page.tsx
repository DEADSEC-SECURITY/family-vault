"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ItemCard } from "@/components/items/ItemCard";
import { api } from "@/lib/api";
import type { Item } from "@/lib/api";

export default function SearchPage() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") || "";
  const [results, setResults] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (!query) {
      setResults([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    api.search
      .query(query)
      .then((res) => {
        setResults(res.items);
        setSearched(true);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [query]);

  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">
        Search Results
      </h1>

      {!query && (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">
              Use the search bar above to find items
            </p>
          </CardContent>
        </Card>
      )}

      {loading && <div className="text-gray-400">Searching...</div>}

      {searched && !loading && (
        <>
          <p className="mb-4 text-sm text-gray-500">
            {results.length} result{results.length !== 1 ? "s" : ""} for &ldquo;{query}&rdquo;
          </p>

          {results.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-gray-500">No items match your search</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {results.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  categorySlug={item.category}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
