"use client";

import { Search, X } from "lucide-react";
import { FormEvent, useDeferredValue, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddressSuggestion } from "@/lib/types/domain";

const ADDRESS_AUTOCOMPLETE_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_ADDRESS_AUTOCOMPLETE?.trim().toLowerCase() === "true";

export function AddressSearch({
  onSelect,
  selectedAddress,
  hasActiveSelection = false,
  onClearSelection
}: {
  onSelect: (input: { label: string; address: string; lat?: number; lng?: number }) => void;
  selectedAddress?: string;
  hasActiveSelection?: boolean;
  onClearSelection?: () => void;
}) {
  const [value, setValue] = useState("");
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const deferredValue = useDeferredValue(value);
  const suppressAutocompleteRef = useRef(false);

  useEffect(() => {
    if (selectedAddress == null) return;
    setValue(selectedAddress);
    setSuggestions([]);
    setOpen(false);
  }, [selectedAddress]);

  useEffect(() => {
    let active = true;

    async function loadSuggestions() {
      if (hasActiveSelection) {
        setSuggestions([]);
        setOpen(false);
        return;
      }

      if (!ADDRESS_AUTOCOMPLETE_ENABLED) {
        setSuggestions([]);
        setOpen(false);
        setIsLoading(false);
        return;
      }

      if (suppressAutocompleteRef.current) {
        suppressAutocompleteRef.current = false;
        return;
      }

      if (deferredValue.trim().length < 3) {
        setSuggestions([]);
        setOpen(false);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/geocode/autocomplete?q=${encodeURIComponent(deferredValue)}`
        );
        const payload = (await response.json()) as { suggestions?: AddressSuggestion[] };
        if (!active) return;
        setSuggestions(payload.suggestions ?? []);
        setOpen(true);
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadSuggestions();
    return () => {
      active = false;
    };
  }, [deferredValue, hasActiveSelection]);

  function submitCurrent(event: FormEvent) {
    event.preventDefault();
    if (!value.trim()) return;
    onSelect({
      label: value.trim(),
      address: value.trim()
    });
    setOpen(false);
  }

  return (
    <div className="relative">
      <form
        onSubmit={submitCurrent}
        className="glass flex w-full items-center gap-3 rounded-[28px] border border-white/60 p-4"
      >
        <Search className="h-5 w-5 text-ocean" />
        <Input
          value={value}
          onChange={(event) => {
            suppressAutocompleteRef.current = false;
            setValue(event.target.value);
          }}
          onFocus={() => setOpen(!hasActiveSelection && suggestions.length > 0)}
          placeholder={
            ADDRESS_AUTOCOMPLETE_ENABLED
              ? "Search an address, neighborhood, ZIP, or place"
              : "Type an address and press Analyze"
          }
          className="border-none bg-transparent px-0 py-0 shadow-none focus:shadow-none"
        />
        {hasActiveSelection ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              suppressAutocompleteRef.current = true;
              setValue("");
              setSuggestions([]);
              setOpen(false);
              onClearSelection?.();
            }}
            aria-label="Clear selected location"
            className="h-11 w-11 rounded-full p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        ) : (
          <Button type="submit" size="lg">
            Analyze
          </Button>
        )}
      </form>
      {ADDRESS_AUTOCOMPLETE_ENABLED && open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+10px)] z-20 overflow-hidden rounded-3xl border border-black/10 bg-white shadow-soft">
          {isLoading ? (
            <div className="px-4 py-3 text-sm text-gray-500">Loading suggestions…</div>
          ) : suggestions.length > 0 ? (
            suggestions.map((suggestion) => (
              <button
                key={`${suggestion.canonicalAddress}-${suggestion.lat}-${suggestion.lng}`}
                type="button"
                onClick={() => {
                  suppressAutocompleteRef.current = true;
                  setValue(suggestion.canonicalAddress);
                  setSuggestions([]);
                  setOpen(false);
                  onSelect({
                    label: suggestion.label,
                    address: suggestion.canonicalAddress,
                    lat: suggestion.lat,
                    lng: suggestion.lng
                  });
                }}
                className="block w-full border-b border-black/5 px-4 py-3 text-left last:border-b-0 hover:bg-black/[0.03]"
              >
                <div className="font-medium text-ink">{suggestion.label}</div>
                <div className="mt-1 text-sm text-gray-500">
                  {[suggestion.city, suggestion.state, suggestion.zipCode]
                    .filter(Boolean)
                    .join(", ")}
                </div>
              </button>
            ))
          ) : (
            <div className="px-4 py-3 text-sm text-gray-500">
              Keep typing for address suggestions.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
