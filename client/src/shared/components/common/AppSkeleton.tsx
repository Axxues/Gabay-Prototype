import React from 'react';

// ponytail: shared shell chrome so route skeletons differ only in main content.
const ShellChromeSkeleton: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="h-screen flex flex-col overflow-hidden bg-muted font-sans dark:bg-background" role="status" aria-label="Loading workspace">
    {/* Topbar placeholder */}
    <div className="h-16 shrink-0 border-b border-border/70 bg-background/80 px-4 sm:px-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-muted animate-pulse" />
        <div className="space-y-1.5">
          <div className="h-3 w-28 rounded-md bg-muted animate-pulse" />
          <div className="h-2 w-20 rounded-md bg-muted/70 animate-pulse" />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="hidden sm:block h-8 w-56 rounded-xl bg-muted animate-pulse" />
        <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
        <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
      </div>
    </div>

    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden pt-0">
      {/* AppRail placeholder */}
      <div className="hidden sm:flex w-[68px] flex-shrink-0 flex-col items-center border-r border-border/70 bg-background py-3 gap-1">
        <div className="mb-3 h-9 w-9 rounded-xl bg-muted animate-pulse" />
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="h-11 w-11 rounded-xl bg-muted/70 animate-pulse" />
        ))}
      </div>

      {/* Context panel placeholder */}
      <div className="hidden lg:flex w-[240px] flex-shrink-0 flex-col border-r border-border/60 bg-card/50 p-3 gap-2">
        <div className="h-3 w-32 rounded-md bg-muted animate-pulse mx-2" />
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="h-10 rounded-xl bg-muted/60 animate-pulse" />
        ))}
        <div className="mx-1 my-2 border-t border-border" />
        <div className="h-3 w-32 rounded-md bg-muted animate-pulse mx-2" />
        <div className="h-16 rounded-xl bg-muted/60 animate-pulse" />
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="h-10 rounded-xl bg-muted/60 animate-pulse" />
        ))}
      </div>

      {/* Page content skeleton */}
      <main className="min-h-0 min-w-0 w-full flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  </div>
);

export const AppSkeleton: React.FC = () => (
  <ShellChromeSkeleton>
    <div className="mx-auto flex min-h-full w-full max-w-[1600px] flex-col p-5 sm:p-8 lg:p-10 gap-4">
      <div className="space-y-2">
        <div className="h-6 w-64 rounded-lg bg-muted animate-pulse" />
        <div className="h-3 w-96 max-w-full rounded-md bg-muted/70 animate-pulse" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map(i => (
          <div key={i} className="h-28 rounded-2xl border border-border bg-card p-4 space-y-2">
            <div className="h-3 w-2/3 rounded-md bg-muted animate-pulse" />
            <div className="h-3 w-1/2 rounded-md bg-muted/70 animate-pulse" />
            <div className="h-8 w-full rounded-xl bg-muted/60 animate-pulse mt-2" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="h-10 rounded-xl bg-muted/60 animate-pulse" />
        ))}
      </div>
    </div>
  </ShellChromeSkeleton>
);

// Mirrors ProfilePage layout (hero card + identity grid) so reloading on
// /profile no longer flashes the dashboard-shaped skeleton.
export const ProfileSkeleton: React.FC = () => (
  <ShellChromeSkeleton>
    <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col p-6 gap-6">
      <div className="flex items-start gap-3">
        <div className="h-9 w-36 rounded-xl bg-muted animate-pulse shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-7 w-32 rounded-lg bg-muted animate-pulse" />
          <div className="h-3 w-64 max-w-full rounded-md bg-muted/70 animate-pulse" />
        </div>
      </div>
      <div className="rounded-3xl border border-border bg-card overflow-hidden">
        <div className="h-40 bg-muted/60 animate-pulse" />
        <div className="px-6 pb-5">
          <div className="flex gap-4 -mt-12">
            <div className="h-24 w-24 rounded-2xl bg-muted animate-pulse border-4 border-card shrink-0" />
            <div className="flex-1 space-y-2 self-end pb-1">
              <div className="h-5 w-48 rounded-md bg-muted animate-pulse" />
              <div className="h-3 w-64 max-w-full rounded-md bg-muted/70 animate-pulse" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4 p-2">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-14 rounded-2xl bg-muted/60 animate-pulse" />
            ))}
          </div>
          <div className="mt-4 h-11 rounded-2xl bg-muted/60 animate-pulse" />
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <div className="h-3 w-48 rounded-md bg-muted animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="h-16 rounded-xl bg-muted/60 animate-pulse" />
          <div className="h-16 rounded-xl bg-muted/60 animate-pulse" />
        </div>
      </div>
    </div>
  </ShellChromeSkeleton>
);

export default AppSkeleton;
