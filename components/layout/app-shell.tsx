import Link from "next/link";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-black/5 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:gap-4 sm:px-6 sm:py-4 lg:px-8">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-ocean text-sm font-bold text-white">
                MG
              </div>
              <div>
                <div className="font-display text-xl text-ink sm:text-2xl">MoveGood</div>
                <div className="hidden text-xs text-gray-500 sm:block">
                  Personal location intelligence
                </div>
              </div>
            </Link>
          </div>
          <nav className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 text-sm font-medium text-gray-600 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible sm:pb-0">
            <Link href="/" className="whitespace-nowrap rounded-full bg-white/80 px-4 py-2.5">
              Map
            </Link>
            <Link href="/compare" className="whitespace-nowrap rounded-full bg-white/80 px-4 py-2.5">
              Compare
            </Link>
            <Link href="/my-places" className="whitespace-nowrap rounded-full bg-white/80 px-4 py-2.5">
              My Preferences
            </Link>
            <Link href="/settings" className="whitespace-nowrap rounded-full bg-white/80 px-4 py-2.5">
              Settings
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
