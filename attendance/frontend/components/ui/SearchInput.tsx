"use client";
import { Search } from "lucide-react";

export default function SearchInput({
  value, onChange, placeholder = "Search…",
}: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Search"
        className="w-full rounded-md border border-gray-300 pl-9 pr-3 py-2 text-sm
                   focus:outline-none focus:ring-2 focus:ring-green-600"
      />
    </div>
  );
}