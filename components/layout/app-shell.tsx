import Link from "next/link";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-black/5 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ocean text-sm font-bold text-white">
              MG
            </div>
            <div>
              <div className="font-display text-2xl text-ink">MoveGood</div>
              <div className="text-xs text-gray-500">
                Personal location intelligence
              </div>
            </div>
          </Link>
          </div>
          <nav className="flex flex-wrap items-center gap-3 text-sm font-medium text-gray-600">
            <Link href="/" className="rounded-full bg-white/80 px-4 py-2">
              Map
            </Link>
            <Link href="/compare" className="rounded-full bg-white/80 px-4 py-2">
              Compare
            </Link>
            <Link href="/my-places" className="rounded-full bg-white/80 px-4 py-2">
              My Preferences
            </Link>
            <Link href="/settings" className="rounded-full bg-white/80 px-4 py-2">
              Settings
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
