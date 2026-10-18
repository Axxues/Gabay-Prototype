import React from 'react';
import { useLocation } from 'react-router-dom';

// Shared shell chrome so full-screen loads (e.g. initial token bootstrap before AppShell mounts) show realistic shell
export const ShellChromeSkeleton: React.FC<{ children: React.ReactNode }> = ({ children }) => (
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

      {/* Page content skeleton container */}
      <main className="min-h-0 min-w-0 w-full flex-1 overflow-y-auto custom-scrollbar">
        <div className="mx-auto flex min-h-full w-full max-w-[1600px] flex-col p-5 sm:p-8 lg:p-10">
          {children}
        </div>
      </main>
    </div>
  </div>
);

// Mirrors DashboardPage layout 1:1:
// - Header with "My courses" title, subtitle, "+ Create course" button, and count pill
// - 2-Column Responsive Grid (lg:col-span-2 for Course Cards, lg:col-span-1 for To Grade widget)
export const DashboardSkeleton: React.FC = () => (
  <div className="flex min-h-full w-full flex-1 flex-col space-y-8 animate-pulse" data-testid="dashboard-skeleton">
    {/* Main Grid Section */}
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Left Pane: Enrolled Course Cards */}
      <div className="lg:col-span-2 space-y-4">
        {/* PageHeader Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
          <div className="space-y-1.5">
            <div className="h-7 w-40 rounded-lg bg-muted" />
            <div className="h-4 w-56 rounded-md bg-muted/60" />
          </div>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-32 rounded-xl bg-muted" />
            <div className="h-6 w-20 rounded-full bg-muted/60" />
          </div>
        </div>

        {/* 2-Column Course Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="bg-card text-card-foreground border border-border rounded-2xl overflow-hidden flex flex-col justify-between">
              <div>
                {/* Card Header with section pill and course title */}
                <div className="h-20 p-4 flex flex-col justify-between bg-muted/40 border-b border-border/40">
                  <div className="h-5 w-36 rounded-full bg-muted/70" />
                  <div className="h-5 w-4/5 rounded-md bg-muted" />
                </div>
                {/* Card Body with metadata rows */}
                <div className="p-5 space-y-3">
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <div className="h-3 w-16 rounded bg-muted/50" />
                      <div className="h-3.5 w-28 rounded bg-muted" />
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="h-3 w-16 rounded bg-muted/50" />
                      <div className="h-3.5 w-20 rounded bg-muted" />
                    </div>
                    <div className="flex justify-between items-center pt-1.5 border-t border-border/50">
                      <div className="h-3 w-16 rounded bg-muted/50" />
                      <div className="h-4 w-10 rounded bg-muted/70" />
                    </div>
                  </div>
                </div>
              </div>
              {/* Card Footer with action link and icon buttons */}
              <div className="px-5 py-2.5 bg-muted/30 border-t border-border flex items-center justify-between">
                <div className="h-4 w-24 rounded bg-muted/60" />
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-lg bg-muted/40" />
                  <div className="h-6 w-6 rounded-lg bg-muted/40" />
                  <div className="h-6 w-6 rounded-lg bg-muted/40" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right Pane: To-Grade / System Overview Widget */}
      <div className="space-y-6">
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border/70 pb-3">
            <div className="flex items-center space-x-2">
              <div className="h-4 w-4 rounded-full bg-muted" />
              <div className="h-4 w-28 rounded bg-muted" />
            </div>
            <div className="h-5 w-16 rounded-full bg-muted/60" />
          </div>
          <div className="space-y-3 pt-1">
            <div className="p-3.5 bg-muted/30 border border-border/60 rounded-xl space-y-2">
              <div className="flex justify-between items-center">
                <div className="h-4 w-3/4 rounded bg-muted" />
                <div className="h-3 w-12 rounded bg-muted/60" />
              </div>
              <div className="h-3 w-1/2 rounded bg-muted/50" />
              <div className="h-8 w-full rounded-xl bg-muted/60 mt-2" />
            </div>
            <div className="p-3.5 bg-muted/30 border border-border/60 rounded-xl space-y-2">
              <div className="flex justify-between items-center">
                <div className="h-4 w-2/3 rounded bg-muted" />
                <div className="h-3 w-12 rounded bg-muted/60" />
              </div>
              <div className="h-3 w-1/3 rounded bg-muted/50" />
              <div className="h-8 w-full rounded-xl bg-muted/60 mt-2" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

// Mirrors CoursesPage layout: header banner + tab navigation pills + module/content rows
export const CoursesSkeleton: React.FC = () => (
  <div className="flex min-h-full w-full flex-1 flex-col space-y-6 animate-pulse" data-testid="courses-skeleton">
    {/* Course Header Banner */}
    <div className="p-6 bg-card border border-border rounded-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-5 w-20 rounded-full bg-muted/70" />
            <div className="h-5 w-32 rounded-full bg-muted/50" />
          </div>
          <div className="h-7 w-72 rounded-lg bg-muted" />
        </div>
        <div className="h-9 w-28 rounded-xl bg-muted" />
      </div>
    </div>

    {/* Subtab Navigation Pills */}
    <div className="flex items-center gap-2 overflow-x-auto pb-1">
      {['Modules', 'Syllabus', 'Activities', 'Quizzes', 'Exams', 'Grades', 'People', 'Files'].map(tab => (
        <div key={tab} className="h-9 w-24 rounded-xl bg-muted/50 shrink-0" />
      ))}
    </div>

    {/* Content Area */}
    <div className="space-y-4">
      {[0, 1, 2].map(i => (
        <div key={i} className="bg-card border border-border rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border/50">
            <div className="h-5 w-48 rounded bg-muted" />
            <div className="h-4 w-16 rounded bg-muted/60" />
          </div>
          <div className="space-y-2 pt-1">
            <div className="h-4 w-5/6 rounded bg-muted/60" />
            <div className="h-3.5 w-2/3 rounded bg-muted/40" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Mirrors CalendarPage layout: toolbar + 7-column calendar grid
export const CalendarSkeleton: React.FC = () => (
  <div className="flex min-h-full w-full flex-1 flex-col space-y-6 animate-pulse" data-testid="calendar-skeleton">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
      <div className="space-y-1.5">
        <div className="h-7 w-48 rounded-lg bg-muted" />
        <div className="h-4 w-72 rounded bg-muted/60" />
      </div>
      <div className="flex items-center gap-2">
        <div className="h-9 w-32 rounded-xl bg-muted" />
        <div className="h-9 w-24 rounded-xl bg-muted/60" />
      </div>
    </div>

    <div className="flex items-center justify-between p-3.5 bg-card border border-border rounded-2xl">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-muted" />
        <div className="h-5 w-32 rounded bg-muted" />
        <div className="h-8 w-8 rounded-lg bg-muted" />
      </div>
      <div className="flex items-center gap-1.5">
        <div className="h-8 w-16 rounded-xl bg-muted/70" />
        <div className="h-8 w-16 rounded-xl bg-muted/50" />
        <div className="h-8 w-16 rounded-xl bg-muted/50" />
      </div>
    </div>

    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border bg-muted/30 text-center py-2.5">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} className="h-4 w-10 mx-auto rounded bg-muted/60" />
        ))}
      </div>
      <div className="grid grid-cols-7 grid-rows-5 divide-x divide-y divide-border min-h-[480px]">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="p-2 space-y-1.5 min-h-[96px] bg-card/60">
            <div className="h-3 w-4 rounded bg-muted/70" />
            {i % 4 === 0 && <div className="h-4 w-full rounded bg-primary/20" />}
            {i % 6 === 0 && <div className="h-4 w-4/5 rounded bg-amber-500/20" />}
          </div>
        ))}
      </div>
    </div>
  </div>
);

// Mirrors InboxPage layout: left thread list + right message viewer
export const InboxSkeleton: React.FC = () => (
  <div className="flex h-[calc(100vh-8rem)] w-full flex-1 gap-6 animate-pulse" data-testid="inbox-skeleton">
    <div className="w-full md:w-80 lg:w-96 flex flex-col bg-card border border-border rounded-2xl overflow-hidden shrink-0">
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <div className="h-6 w-24 rounded bg-muted" />
          <div className="h-8 w-24 rounded-xl bg-muted" />
        </div>
        <div className="h-9 w-full rounded-xl bg-muted/60" />
      </div>
      <div className="p-2 space-y-2 flex-1 overflow-hidden">
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="p-3 rounded-xl bg-muted/30 space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-muted" />
              <div className="flex-1 space-y-1">
                <div className="h-3.5 w-24 rounded bg-muted" />
                <div className="h-3 w-16 rounded bg-muted/60" />
              </div>
            </div>
            <div className="h-3.5 w-5/6 rounded bg-muted/70" />
          </div>
        ))}
      </div>
    </div>

    <div className="hidden md:flex flex-1 flex-col bg-card border border-border rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between pb-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-muted" />
          <div className="space-y-1.5">
            <div className="h-4 w-36 rounded bg-muted" />
            <div className="h-3 w-28 rounded bg-muted/60" />
          </div>
        </div>
        <div className="h-8 w-20 rounded-xl bg-muted" />
      </div>
      <div className="space-y-3 flex-1 pt-4">
        <div className="h-6 w-2/3 rounded bg-muted" />
        <div className="h-4 w-full rounded bg-muted/60" />
        <div className="h-4 w-5/6 rounded bg-muted/60" />
        <div className="h-4 w-3/4 rounded bg-muted/60" />
      </div>
    </div>
  </div>
);

// Mirrors ProfilePage layout: hero banner card + identity grid
export const ProfilePageSkeleton: React.FC = () => (
  <div className="flex min-h-full w-full flex-col gap-6 animate-pulse" data-testid="profile-skeleton">
    <div className="flex items-start gap-3">
      <div className="h-9 w-36 rounded-xl bg-muted shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-7 w-32 rounded-lg bg-muted" />
        <div className="h-3 w-64 max-w-full rounded-md bg-muted/70" />
      </div>
    </div>
    <div className="rounded-3xl border border-border bg-card overflow-hidden">
      <div className="h-40 bg-muted/60" />
      <div className="px-6 pb-5">
        <div className="flex gap-4 -mt-12">
          <div className="h-24 w-24 rounded-2xl bg-muted border-4 border-card shrink-0" />
          <div className="flex-1 space-y-2 self-end pb-1">
            <div className="h-5 w-48 rounded-md bg-muted" />
            <div className="h-3 w-64 max-w-full rounded-md bg-muted/70" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-4 p-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-14 rounded-2xl bg-muted/60" />
          ))}
        </div>
        <div className="mt-4 h-11 rounded-2xl bg-muted/60" />
      </div>
    </div>
    <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
      <div className="h-3 w-48 rounded-md bg-muted" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="h-16 rounded-xl bg-muted/60" />
        <div className="h-16 rounded-xl bg-muted/60" />
      </div>
    </div>
  </div>
);

// Mirrors ManageAccountsPage layout: header + search toolbar + account cards grid
export const AccountsSkeleton: React.FC = () => (
  <div className="flex min-h-full w-full flex-1 flex-col space-y-6 animate-pulse" data-testid="accounts-skeleton">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
      <div className="space-y-1.5">
        <div className="h-7 w-44 rounded-lg bg-muted" />
        <div className="h-4 w-64 rounded bg-muted/60" />
      </div>
      <div className="h-9 w-36 rounded-xl bg-muted" />
    </div>
    <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-2xl">
      <div className="h-9 flex-1 rounded-xl bg-muted/60" />
      <div className="h-9 w-32 rounded-xl bg-muted/60" />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {[0, 1, 2, 3, 4, 5].map(i => (
        <div key={i} className="p-5 bg-card border border-border rounded-2xl space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-muted" />
            <div className="space-y-1.5 flex-1">
              <div className="h-4 w-32 rounded bg-muted" />
              <div className="h-3 w-24 rounded bg-muted/60" />
            </div>
            <div className="h-5 w-16 rounded-full bg-muted/60" />
          </div>
        </div>
      ))}
    </div>
  </div>
);

// Router-aware page content skeleton (used inside AppShell's React.Suspense fallback)
// Prevents duplicate inner rails and renders the exact skeleton matching the target page!
export const PageSkeleton: React.FC = () => {
  const location = useLocation();
  const path = location?.pathname || '/dashboard';

  if (path === '/dashboard' || path === '/') {
    return <DashboardSkeleton />;
  }
  if (path.startsWith('/courses')) {
    return <CoursesSkeleton />;
  }
  if (path === '/calendar') {
    return <CalendarSkeleton />;
  }
  if (path === '/inbox') {
    return <InboxSkeleton />;
  }
  if (path.startsWith('/profile')) {
    return <ProfilePageSkeleton />;
  }
  if (path === '/accounts') {
    return <AccountsSkeleton />;
  }
  if (path === '/login' || path === '/register' || path === '/activate') {
    return <AuthCardSkeleton />;
  }
  return <DashboardSkeleton />;
};

// Standalone auth card skeleton used during auth loading (/login, /register, /activate)
export const AuthCardSkeleton: React.FC = () => (
  <div className="min-h-screen bg-muted flex items-center justify-center p-4 sm:p-6 relative overflow-hidden text-foreground select-none font-sans" data-testid="auth-card-skeleton">
    <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 space-y-6 animate-pulse">
      <div className="w-16 h-16 mx-auto rounded-2xl bg-muted" />
      <div className="space-y-2 text-center">
        <div className="h-6 w-32 rounded-lg bg-muted mx-auto" />
        <div className="h-3.5 w-48 rounded bg-muted/60 mx-auto" />
      </div>
      <div className="space-y-4 pt-2">
        <div className="space-y-1.5">
          <div className="h-3 w-20 rounded bg-muted/70" />
          <div className="h-10 w-full rounded-xl bg-muted/50" />
        </div>
        <div className="space-y-1.5">
          <div className="h-3 w-20 rounded bg-muted/70" />
          <div className="h-10 w-full rounded-xl bg-muted/50" />
        </div>
        <div className="h-10 w-full rounded-xl bg-primary/20 mt-4" />
      </div>
    </div>
  </div>
);

// Full application shell skeleton used before user authentication / authReady completes
export const AppSkeleton: React.FC = () => (
  <ShellChromeSkeleton>
    <PageSkeleton />
  </ShellChromeSkeleton>
);

// Full profile shell skeleton used before user authentication / authReady completes on /profile
export const ProfileSkeleton: React.FC = () => (
  <ShellChromeSkeleton>
    <ProfilePageSkeleton />
  </ShellChromeSkeleton>
);

export default PageSkeleton;
