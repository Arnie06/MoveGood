"use client";

import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SearchBar({
  defaultValue = "",
  compact = false
}: {
  defaultValue?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(defaultValue);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const next = new URLSearchParams(params.toString());
    if (value) next.set("q", value);
    else next.delete("q");
    router.push(`/search?${next.toString()}`);
  }

  return (
    <form
      onSubmit={onSubmit}
      className={`glass flex w-full flex-wrap items-center gap-3 rounded-[28px] border border-white/60 ${
        compact ? "p-3" : "p-4"
      }`}
    >
      <Search className="h-5 w-5 text-ocean" />
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search by address, place, neighborhood, or ZIP"
        className="min-w-0 flex-1 border-none bg-transparent px-0 py-0 shadow-none focus:shadow-none"
      />
      <Button type="submit" size={compact ? "sm" : "lg"} className="w-full sm:w-auto">
        Analyze
      </Button>
    </form>
  );
}
