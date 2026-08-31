"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SearchBox() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (query.trim()) router.push(`/explore?q=${encodeURIComponent(query.trim())}`);
      }}
      className="hidden items-center rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1.5 sm:flex"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="mr-2 shrink-0 text-neutral-500">
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
        <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search tokens…"
        className="w-32 bg-transparent text-sm text-neutral-200 placeholder:text-neutral-500 focus:outline-none lg:w-48"
      />
    </form>
  );
}
