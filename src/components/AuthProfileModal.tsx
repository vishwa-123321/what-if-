import { LogOut, User, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { NARRATOR_PERSONALITIES } from '../data/catalog.ts';
import type { UserProfile } from '../types/story.ts';

interface AuthProfileModalProps {
  user: UserProfile | null;
  isGuest: boolean;
  onClose: () => void;
  onSignIn: (email: string, password: string) => Promise<void>;
  onSignUp: (
    email: string,
    password: string,
    displayName: string
  ) => Promise<{ notice?: string } | void>;
  onUpdateProfile: (updates: {
    display_name?: string;
    preferred_narrator?: string;
  }) => Promise<void>;
  onSignOut: () => Promise<void>;
}

export function AuthProfileModal({
  user,
  isGuest,
  onClose,
  onSignIn,
  onSignUp,
  onUpdateProfile,
  onSignOut,
}: AuthProfileModalProps) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [preferredNarrator, setPreferredNarrator] = useState(
    user?.preferred_narrator || NARRATOR_PERSONALITIES[0].name
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const handleAuthSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setAuthNotice(null);
    setBusy(true);
    try {
      if (mode === 'signin') {
        await onSignIn(email, password);
        onClose();
      } else {
        const result = await onSignUp(email, password, displayName);
        if (result?.notice) {
          setAuthNotice(result.notice);
        } else {
          onClose();
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleProfileSave = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSavedMsg(null);
    setBusy(true);
    try {
      await onUpdateProfile({
        display_name: displayName,
        preferred_narrator: preferredNarrator,
      });
      setSavedMsg('Profile preferences updated.');
    } catch (err: any) {
      setError(err?.message || 'Could not save profile.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Account and Profile"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/12 bg-[#0F121B]">
        <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-[#E5A93C]" />
            <h2 className="font-editorial text-lg font-semibold text-[#F5F6FA]">
              {isGuest ? 'Sync Your Story Universe' : 'Explorer Profile'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#9BA2B4] hover:text-white cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6">
          {isGuest ? (
            <>
              <p className="text-xs leading-relaxed text-[#A3AABB]">
                Sign in or create an account to synchronize your unfinished stories, discovered clues, and alternate endings across sessions and devices.
              </p>

              <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl border border-white/[0.08] bg-[#0A0C12] p-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode('signin');
                    setError(null);
                    setAuthNotice(null);
                  }}
                  className={`min-h-[38px] rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    mode === 'signin'
                      ? 'bg-[#191E2D] text-[#F5F6FA]'
                      : 'text-[#8E96AA] hover:text-white'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup');
                    setError(null);
                    setAuthNotice(null);
                  }}
                  className={`min-h-[38px] rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    mode === 'signup'
                      ? 'bg-[#191E2D] text-[#F5F6FA]'
                      : 'text-[#8E96AA] hover:text-white'
                  }`}
                >
                  Create Account
                </button>
              </div>

              <form onSubmit={handleAuthSubmit} className="mt-5 space-y-4">
                {mode === 'signup' && (
                  <div>
                    <label
                      htmlFor="auth-name"
                      className="block text-xs font-medium text-[#A3AABB]"
                    >
                      Display Name
                    </label>
                    <input
                      id="auth-name"
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Your storyteller name"
                      className="mt-1.5 w-full min-h-[44px] rounded-xl border border-white/12 bg-[#0A0C12] px-3.5 text-sm text-[#F5F6FA] focus:border-[#E5A93C] focus:outline-none"
                    />
                  </div>
                )}

                <div>
                  <label
                    htmlFor="auth-email"
                    className="block text-xs font-medium text-[#A3AABB]"
                  >
                    Email Address
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="mt-1.5 w-full min-h-[44px] rounded-xl border border-white/12 bg-[#0A0C12] px-3.5 text-sm text-[#F5F6FA] focus:border-[#E5A93C] focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="auth-password"
                    className="block text-xs font-medium text-[#A3AABB]"
                  >
                    Password
                  </label>
                  <input
                    id="auth-password"
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="mt-1.5 w-full min-h-[44px] rounded-xl border border-white/12 bg-[#0A0C12] px-3.5 text-sm text-[#F5F6FA] focus:border-[#E5A93C] focus:outline-none"
                  />
                </div>

                {error && <p className="text-xs text-rose-400">{error}</p>}
                {authNotice && <p className="text-xs text-emerald-400">{authNotice}</p>}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full min-h-[44px] rounded-xl bg-[#E5A93C] px-4 py-2.5 text-sm font-semibold text-[#0B0C10] transition-colors hover:bg-[#F0BC58] disabled:opacity-50 cursor-pointer"
                >
                  {busy
                    ? 'Connecting...'
                    : mode === 'signin'
                      ? 'Sign In'
                      : 'Create Account'}
                </button>
              </form>
            </>
          ) : (
            user && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-3 border-b border-white/[0.08] pb-4">
                  <div>
                    <p className="text-xs text-[#8E96AA]">Decisions Made</p>
                    <p className="mt-0.5 font-mono text-xl font-semibold tabular-nums text-[#F5F6FA]">
                      {user.total_decisions}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-[#8E96AA]">Stories Completed</p>
                    <p className="mt-0.5 font-mono text-xl font-semibold tabular-nums text-[#E5A93C]">
                      {user.stories_completed}
                    </p>
                  </div>
                </div>

                <form onSubmit={handleProfileSave} className="space-y-4">
                  <div>
                    <label
                      htmlFor="profile-email"
                      className="block text-xs text-[#8E96AA]"
                    >
                      Account Email
                    </label>
                    <p id="profile-email" className="mt-1 text-sm text-[#D6DBE8]">
                      {user.email}
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="profile-name"
                      className="block text-xs font-medium text-[#A3AABB]"
                    >
                      Display Name
                    </label>
                    <input
                      id="profile-name"
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="mt-1.5 w-full min-h-[44px] rounded-xl border border-white/12 bg-[#0A0C12] px-3.5 text-sm text-[#F5F6FA] focus:border-[#E5A93C] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="profile-narrator"
                      className="block text-xs font-medium text-[#A3AABB]"
                    >
                      Preferred AI Narrator
                    </label>
                    <select
                      id="profile-narrator"
                      value={preferredNarrator}
                      onChange={(e) => setPreferredNarrator(e.target.value)}
                      className="mt-1.5 w-full min-h-[44px] rounded-xl border border-white/12 bg-[#0A0C12] px-3.5 text-sm text-[#F5F6FA] focus:border-[#E5A93C] focus:outline-none"
                    >
                      {NARRATOR_PERSONALITIES.map((np) => (
                        <option key={np.id} value={np.name}>
                          {np.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {error && <p className="text-xs text-rose-400">{error}</p>}
                  {savedMsg && <p className="text-xs text-emerald-400">{savedMsg}</p>}

                  <div className="flex items-center justify-between gap-3 pt-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await onSignOut();
                        onClose();
                      }}
                      className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-white/12 px-4 text-xs font-medium text-[#CBD0DD] hover:border-rose-400/40 hover:text-rose-300 cursor-pointer"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Sign Out</span>
                    </button>
                    <button
                      type="submit"
                      disabled={busy}
                      className="min-h-[42px] rounded-xl bg-[#E5A93C] px-5 text-xs font-semibold text-[#0B0C10] hover:bg-[#F0BC58] cursor-pointer disabled:opacity-50"
                    >
                      {busy ? 'Saving...' : 'Save Profile'}
                    </button>
                  </div>
                </form>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
