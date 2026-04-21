"use client";

import { useState } from "react";

import { SavedPlacesManager } from "@/components/preferences/saved-places-manager";
import { SettingsManager } from "@/components/preferences/settings-manager";
import { cn } from "@/lib/utils";

type PreferencesTab = "personal-places" | "settings";

export function PreferencesTabs() {
  const [activeTab, setActiveTab] = useState<PreferencesTab>("personal-places");

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("personal-places")}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
            activeTab === "personal-places"
              ? "bg-ocean text-white"
              : "border border-black/10 bg-white text-ink hover:bg-black/[0.03]"
          )}
        >
          My Personal Places
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("settings")}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
            activeTab === "settings"
              ? "bg-ocean text-white"
              : "border border-black/10 bg-white text-ink hover:bg-black/[0.03]"
          )}
        >
          Settings
        </button>
      </div>

      {activeTab === "personal-places" ? <SavedPlacesManager /> : <SettingsManager />}
    </div>
  );
}
