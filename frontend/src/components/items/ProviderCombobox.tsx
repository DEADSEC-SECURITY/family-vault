"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { api } from "@/lib/api";

interface ProviderComboboxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function ProviderCombobox({
  value,
  onChange,
  placeholder = "Select provider...",
  className = "",
}: ProviderComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [providers, setProviders] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Sync external value changes
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Fetch providers when query changes
  useEffect(() => {
    if (!open) return;

    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.providers.insurance(query || undefined);
        setProviders(res.providers);
        setHighlightIndex(0);
      } catch {
        setProviders([]);
      } finally {
        setLoading(false);
      }
    }, 150); // debounce

    return () => clearTimeout(timeout);
  }, [query, open]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        // If user typed something custom, accept it
        if (query && query !== value) {
          onChange(query);
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [query, value, onChange]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.children;
    if (items[highlightIndex]) {
      (items[highlightIndex] as HTMLElement).scrollIntoView({ block: "nearest" });
    }
  }, [highlightIndex]);

  function handleSelect(provider: string) {
    setQuery(provider);
    onChange(provider);
    setOpen(false);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    setQuery("");
    onChange("");
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIndex((prev) => Math.min(prev + 1, filteredProviders.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filteredProviders[highlightIndex]) {
          handleSelect(filteredProviders[highlightIndex]);
        } else if (query.trim()) {
          // Accept custom entry
          onChange(query.trim());
          setOpen(false);
        }
        break;
      case "Escape":
        setOpen(false);
        break;
    }
  }

  // Show matching from the local list + add custom entry option
  const filteredProviders = providers;
  const queryInList = providers.some(
    (p) => p.toLowerCase() === query.trim().toLowerCase(),
  );
  const showCustomOption = query.trim().length > 0 && !queryInList;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div
        onClick={() => { setOpen(!open); setTimeout(() => inputRef.current?.focus(), 0); }}
        className={`flex items-center h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs transition-colors cursor-pointer ${
          open ? "border-ring ring-ring/50 ring-[3px]" : "border-input"
        }`}
      >
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 bg-transparent border-none p-0 h-auto text-sm focus:outline-none focus:ring-0 placeholder:text-gray-400 min-w-0"
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="shrink-0 text-gray-300 hover:text-gray-500 mr-1"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </div>

      {open && (
        <ul
          ref={listRef}
          className="absolute top-full left-0 right-0 z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg"
        >
          {loading && (
            <li className="px-3 py-2 text-sm text-gray-400">Loading...</li>
          )}

          {!loading && showCustomOption && (
            <li
              onClick={() => handleSelect(query.trim())}
              className="flex items-center gap-2 px-3 py-2.5 text-sm cursor-pointer hover:bg-gray-50 border-b border-gray-100"
            >
              <span className="text-blue-600 font-medium">
                Use &ldquo;{query.trim()}&rdquo;
              </span>
            </li>
          )}

          {!loading &&
            filteredProviders.map((provider, i) => {
              const isSelected = provider === value;
              const adjustedIndex = showCustomOption ? i + 1 : i;
              const isHighlighted = adjustedIndex === highlightIndex || (!showCustomOption && i === highlightIndex);

              return (
                <li
                  key={provider}
                  onClick={() => handleSelect(provider)}
                  className={`flex items-center gap-2 px-3 py-2.5 text-sm cursor-pointer transition-colors ${
                    isHighlighted ? "bg-blue-50" : "hover:bg-gray-50"
                  } ${isSelected ? "text-blue-700 font-medium" : "text-gray-700"}`}
                >
                  {isSelected && <Check className="h-3.5 w-3.5 text-blue-600 shrink-0" />}
                  <span className={isSelected ? "" : "ml-5"}>{provider}</span>
                </li>
              );
            })}

          {!loading && filteredProviders.length === 0 && !showCustomOption && (
            <li className="px-3 py-2 text-sm text-gray-400">
              No providers found. Type to add a custom one.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
