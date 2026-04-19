import type React from "react";
import type { Metadata } from "next";

import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { LocationStoreProvider } from "@/components/providers/location-store-provider";
import { PreferencesProvider } from "@/components/providers/preferences-provider";

export const metadata: Metadata = {
  title: "Good Area",
  description: "Analyze any address or point on the map, understand what is nearby, and compare saved locations with explainable proximity scores."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <PreferencesProvider>
          <LocationStoreProvider>
            <AppShell>{children}</AppShell>
          </LocationStoreProvider>
        </PreferencesProvider>
      </body>
    </html>
  );
}
