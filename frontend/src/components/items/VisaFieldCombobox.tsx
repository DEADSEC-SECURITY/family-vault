"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { api } from "@/lib/api";

interface CountryComboboxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function CountryCombobox({ value, onChange, placeholder = "Select country..." }: CountryComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [countries, setCountries] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Sync external value changes
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Fetch countries on mount
  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const data = await api.visas.countries();
        setCountries(data.countries);
      } catch (error) {
        console.error("Failed to fetch countries:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchCountries();
  }, []);

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

  function handleSelect(country: string) {
    setQuery(country);
    onChange(country);
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
        setHighlightIndex((prev) => Math.min(prev + 1, filteredCountries.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filteredCountries[highlightIndex]) {
          handleSelect(filteredCountries[highlightIndex]);
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

  // Filter countries based on query
  const filteredCountries = countries.filter((c) =>
    c.toLowerCase().includes(query.toLowerCase())
  );
  const queryInList = countries.some(
    (c) => c.toLowerCase() === query.trim().toLowerCase()
  );
  const showCustomOption = query.trim().length > 0 && !queryInList;

  return (
    <div ref={containerRef} className="relative">
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
            <li className="px-3 py-2 text-sm text-gray-400">Loading countries...</li>
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
            filteredCountries.map((country, i) => {
              const isSelected = country === value;
              const adjustedIndex = showCustomOption ? i + 1 : i;
              const isHighlighted = adjustedIndex === highlightIndex || (!showCustomOption && i === highlightIndex);

              return (
                <li
                  key={country}
                  onClick={() => handleSelect(country)}
                  className={`flex items-center gap-2 px-3 py-2.5 text-sm cursor-pointer transition-colors ${
                    isHighlighted ? "bg-blue-50" : "hover:bg-gray-50"
                  } ${isSelected ? "text-blue-700 font-medium" : "text-gray-700"}`}
                >
                  {isSelected && <Check className="h-3.5 w-3.5 text-blue-600 shrink-0" />}
                  <span className={isSelected ? "" : "ml-5"}>{country}</span>
                </li>
              );
            })}

          {!loading && filteredCountries.length === 0 && !showCustomOption && (
            <li className="px-3 py-2 text-sm text-gray-400">
              No countries found. Type to add a custom one.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

interface VisaTypeComboboxProps {
  value: string;
  onChange: (value: string) => void;
  country: string;
  placeholder?: string;
}

export function VisaTypeCombobox({ value, onChange, country, placeholder = "Select visa type..." }: VisaTypeComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [visaTypes, setVisaTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Sync external value changes
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Fetch visa types when country changes
  useEffect(() => {
    if (!country) {
      setVisaTypes([]);
      return;
    }

    const fetchVisaTypes = async () => {
      setLoading(true);
      try {
        const data = await api.visas.types(country);
        setVisaTypes(data.visa_types);
      } catch (error) {
        console.error("Failed to fetch visa types:", error);
        setVisaTypes([]);
      } finally {
        setLoading(false);
      }
    };
    fetchVisaTypes();
  }, [country]);

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

  function handleSelect(type: string) {
    setQuery(type);
    onChange(type);
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
        if (country) setOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIndex((prev) => Math.min(prev + 1, filteredTypes.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filteredTypes[highlightIndex]) {
          handleSelect(filteredTypes[highlightIndex]);
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

  // Filter visa types based on query
  const filteredTypes = visaTypes.filter((t) =>
    t.toLowerCase().includes(query.toLowerCase())
  );
  const queryInList = visaTypes.some(
    (t) => t.toLowerCase() === query.trim().toLowerCase()
  );
  const showCustomOption = query.trim().length > 0 && !queryInList && country;

  if (!country) {
    return (
      <div className="h-9 flex items-center text-sm text-gray-400 px-3 border border-gray-200 rounded-md bg-gray-50">
        Select a country first
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
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
            if (!open && country) setOpen(true);
          }}
          onFocus={() => { if (country) setOpen(true); }}
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
            <li className="px-3 py-2 text-sm text-gray-400">Loading visa types...</li>
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
            filteredTypes.map((type, i) => {
              const isSelected = type === value;
              const adjustedIndex = showCustomOption ? i + 1 : i;
              const isHighlighted = adjustedIndex === highlightIndex || (!showCustomOption && i === highlightIndex);

              return (
                <li
                  key={type}
                  onClick={() => handleSelect(type)}
                  className={`flex items-center gap-2 px-3 py-2.5 text-sm cursor-pointer transition-colors ${
                    isHighlighted ? "bg-blue-50" : "hover:bg-gray-50"
                  } ${isSelected ? "text-blue-700 font-medium" : "text-gray-700"}`}
                >
                  {isSelected && <Check className="h-3.5 w-3.5 text-blue-600 shrink-0" />}
                  <span className={isSelected ? "" : "ml-5"}>{type}</span>
                </li>
              );
            })}

          {!loading && filteredTypes.length === 0 && !showCustomOption && (
            <li className="px-3 py-2 text-sm text-gray-400">
              No visa types found. Type to add a custom one.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
