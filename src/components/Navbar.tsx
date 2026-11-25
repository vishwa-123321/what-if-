import { Menu, User, X } from 'lucide-react';
import { useState } from 'react';
import type { UserProfile } from '../types/story.ts';

export type AppView = 'home' | 'library' | 'creator' | 'dashboard' | 'play';

interface NavbarProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  user: UserProfile | null;
  isGuest: boolean;
  onOpenAuth: () => void;
}

const NAV_ITEMS: Array<{ id: AppView; label: string }> = [
  { id: 'home', label: 'Home' },
  { id: 'library', label: 'Explore' },
  { id: 'creator', label: 'Create' },
  { id: 'dashboard', label: 'My Stories' },
];

export function Navbar({
  currentView,
  onNavigate,
  user,
  isGuest,
  onOpenAuth,
}: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-[#090A0F]/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="font-editorial text-lg font-semibold tracking-tight text-[#F5F6FA] transition-colors hover:text-[#E5A93C] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E5A93C]"
        >
          WHAT IF 3.0
        </button>

        {/* Zone 2: Clean single-line navigation links */}
        <nav
          aria-label="Primary Navigation"
          className="hidden md:flex items-center gap-8"
        >
          {NAV_ITEMS.map((item) => {
            const active = currentView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`relative py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#E5A93C] ${
                  active
                    ? 'text-[#F5F6FA]'
                    : 'text-[#9BA2B4] hover:text-[#ECEEF4]'
                }`}
              >
                {item.label}
                {active && (
                  <span className="absolute inset-x-0 -bottom-[21px] h-[2px] bg-[#E5A93C]" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onOpenAuth}
            className="hidden sm:inline-flex items-center gap-2 rounded-lg border border-white/12 bg-[#141824] px-4 py-2 text-sm font-medium text-[#ECEEF4] transition-colors hover:border-[#E5A93C]/50 hover:text-[#F5F6FA] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E5A93C]"
          >
            <User className="h-4 w-4 text-[#E5A93C]" aria-hidden="true" />
            <span className="max-w-[130px] truncate">
              {isGuest || !user ? 'Sign In' : user.display_name}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-[#ECEEF4] md:hidden cursor-pointer"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="border-t border-white/[0.08] bg-[#0D0F17] px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const active = currentView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onNavigate(item.id);
                    setMobileOpen(false);
                  }}
                  className={`flex min-h-[44px] items-center rounded-lg px-3 text-left text-sm font-medium transition-colors ${
                    active
                      ? 'bg-[#181C29] text-[#E5A93C]'
                      : 'text-[#C2C7D6] hover:bg-white/[0.04]'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                onOpenAuth();
              }}
              className="mt-2 flex min-h-[44px] items-center gap-2 rounded-lg border border-white/12 bg-[#141824] px-3 text-sm font-medium text-[#ECEEF4]"
            >
              <User className="h-4 w-4 text-[#E5A93C]" />
              <span>{isGuest || !user ? 'Sign In or Sync Account' : `Profile · ${user.display_name}`}</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
