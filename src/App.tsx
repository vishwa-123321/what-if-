import { useCallback, useEffect, useState } from 'react';
import { AuthProfileModal } from './components/AuthProfileModal.tsx';
import { HomePage } from './components/HomePage.tsx';
import { Navbar, type AppView } from './components/Navbar.tsx';
import { StoryCreator } from './components/StoryCreator.tsx';
import { StoryLibrary } from './components/StoryLibrary.tsx';
import { StoryPlayer } from './components/StoryPlayer.tsx';
import { UserDashboard } from './components/UserDashboard.tsx';
import { api, setAuthToken } from './lib/api.ts';
import { isSupabaseClientConfigured, supabaseClient } from './lib/supabase.ts';
import type {
  CreateStoryInput,
  FullStoryState,
  StorySummaryItem,
  StoryTemplate,
  UserProfile,
} from './types/story.ts';

const GUEST_HINT_KEY = 'whatif_explorer_uid';

function readStoryIdFromHash(): string | null {
  const match = window.location.hash.match(/^#\/story\/([a-zA-Z0-9-]+)$/);
  return match ? match[1] : null;
}

export default function App() {
  const [view, setView] = useState<AppView>('home');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isGuest, setIsGuest] = useState(true);
  const [booting, setBooting] = useState(true);

  const [userStories, setUserStories] = useState<StorySummaryItem[]>([]);
  const [favouriteIds, setFavouriteIds] = useState<string[]>([]);
  const [activeStory, setActiveStory] = useState<FullStoryState | null>(null);

  const [libraryQuery, setLibraryQuery] = useState('');
  const [libraryGenre, setLibraryGenre] = useState('All');
  const [creatorTemplate, setCreatorTemplate] = useState<StoryTemplate | null>(null);
  const [creatorGenre, setCreatorGenre] = useState<string | null>(null);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isContinuing, setIsContinuing] = useState(false);
  const [isLoadingStories, setIsLoadingStories] = useState(false);
  const [openingStoryId, setOpeningStoryId] = useState<string | null>(null);
  const [deletingStoryId, setDeletingStoryId] = useState<string | null>(null);
  const [globalBannerError, setGlobalBannerError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);

  const showSuccess = useCallback((message: string) => {
    setSuccessNotice(message);
  }, []);

  useEffect(() => {
    if (!successNotice) return;
    const timer = window.setTimeout(() => setSuccessNotice(null), 4500);
    return () => window.clearTimeout(timer);
  }, [successNotice]);

  const refreshLibrary = useCallback(async () => {
    setIsLoadingStories(true);
    try {
      const data = await api.listStories();
      setUserStories(data.stories);
      setFavouriteIds(data.favourite_ids);
    } catch (err: any) {
      setGlobalBannerError(err?.message || 'Unable to load your stories.');
    } finally {
      setIsLoadingStories(false);
    }
  }, []);

  const openStoryById = useCallback(async (storyId: string) => {
    setGlobalBannerError(null);
    setPlayError(null);
    setOpeningStoryId(storyId);
    try {
      const full = await api.getStory(storyId);
      if (!full?.story || !Array.isArray(full.scenes)) {
        throw new Error('This story returned incomplete scene data.');
      }
      setActiveStory(full);
      setView('play');
      window.history.replaceState(null, '', `#/story/${storyId}`);
    } catch (err: any) {
      setGlobalBannerError(err?.message || 'Unable to load that story.');
      window.history.replaceState(null, '', '#/');
    } finally {
      setOpeningStoryId(null);
    }
  }, []);

  // Bootstrap session (Supabase session if configured, otherwise persistent guest profile)
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        let resolvedUser = false;

        if (isSupabaseClientConfigured && supabaseClient) {
          const { data } = await supabaseClient.auth.getSession();
          if (data.session?.access_token) {
            setAuthToken(data.session.access_token);
            const me = await api.getMe();
            if (!cancelled) {
              setUser(me.user);
              setIsGuest(false);
              resolvedUser = true;
            }
          }
        }

        // Fall back to persistent Explorer session so users can play immediately
        if (!cancelled && !resolvedUser) {
          const savedGuestId = window.localStorage.getItem(GUEST_HINT_KEY) || undefined;
          const guestRes = await api.ensureGuest(savedGuestId);
          if (!cancelled) {
            setAuthToken(guestRes.token);
            setUser(guestRes.user);
            setIsGuest(guestRes.user.email.endsWith('@whatif.universe'));
            window.localStorage.setItem(GUEST_HINT_KEY, guestRes.user.id);
          }
        }

        if (!cancelled) {
          await refreshLibrary();
          const hashStoryId = readStoryIdFromHash();
          if (hashStoryId) {
            await openStoryById(hashStoryId);
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          setGlobalBannerError(err?.message || 'Unable to connect to story server.');
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    }

    init();

    // Keep in-memory JWT synced whenever Supabase refreshes the active session token
    const subscription =
      isSupabaseClientConfigured && supabaseClient
        ? supabaseClient.auth.onAuthStateChange((event, session) => {
            if (cancelled) return;
            if (event === 'TOKEN_REFRESHED' && session?.access_token) {
              setAuthToken(session.access_token);
            } else if (event === 'SIGNED_IN' && session?.access_token) {
              setAuthToken(session.access_token);
            }
          }).data.subscription
        : null;

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, [openStoryById, refreshLibrary]);

  const navigateTo = (next: AppView) => {
    setGlobalBannerError(null);
    setPlayError(null);
    setView(next);
    if (next !== 'play') {
      window.history.replaceState(null, '', '#/');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSignIn = async (email: string, password: string) => {
    setGlobalBannerError(null);
    if (isSupabaseClientConfigured && supabaseClient) {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });
      if (error || !data.session) {
        throw new Error(error?.message || 'Sign in failed.');
      }
      setAuthToken(data.session.access_token);
      const me = await api.getMe();
      setUser(me.user);
      setIsGuest(false);
    } else {
      const res = await api.login(email, password);
      setAuthToken(res.token);
      setUser(res.user);
      setIsGuest(false);
    }
    await refreshLibrary();
    showSuccess('Signed in and synced your stories.');
  };

  const handleSignUp = async (
    email: string,
    password: string,
    displayName: string
  ): Promise<{ notice?: string } | void> => {
    setGlobalBannerError(null);
    if (isSupabaseClientConfigured && supabaseClient) {
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } },
      });
      if (error) throw new Error(error.message);
      if (data.session) {
        setAuthToken(data.session.access_token);
        const me = await api.getMe();
        setUser(me.user);
        setIsGuest(false);
        await refreshLibrary();
        showSuccess('Account created and ready.');
      } else {
        return {
          notice:
            'Account created! Please check your inbox and confirm your email before signing in.',
        };
      }
    } else {
      const res = await api.register(email, password, displayName);
      setAuthToken(res.token);
      setUser(res.user);
      setIsGuest(false);
      await refreshLibrary();
      showSuccess('Account created and ready.');
    }
  };

  const handleSignOut = async () => {
    setGlobalBannerError(null);
    try {
      if (isSupabaseClientConfigured && supabaseClient) {
        await supabaseClient.auth.signOut();
      }
      const savedGuestId = window.localStorage.getItem(GUEST_HINT_KEY) || undefined;
      const guestRes = await api.ensureGuest(savedGuestId);
      setAuthToken(guestRes.token);
      setUser(guestRes.user);
      setIsGuest(true);
      setActiveStory(null);
      await refreshLibrary();
      navigateTo('home');
      showSuccess('Signed out successfully.');
    } catch (err: any) {
      setGlobalBannerError(err?.message || 'Sign out failed.');
    }
  };

  const handleUpdateProfile = async (updates: {
    display_name?: string;
    preferred_narrator?: string;
  }) => {
    const res = await api.updateProfile(updates);
    setUser(res.user);
    showSuccess('Profile preferences saved.');
  };

  const handleCreateStory = async (input: CreateStoryInput) => {
    setIsCreating(true);
    setGlobalBannerError(null);
    setPlayError(null);
    try {
      const created = await api.createStory(input);
      if (!created?.story || !Array.isArray(created.scenes)) {
        throw new Error('The story was created with incomplete scene data. Please try again.');
      }
      setActiveStory(created);
      setView('play');
      window.history.replaceState(null, '', `#/story/${created.story.id}`);
      await refreshLibrary();
      showSuccess(`“${created.story.title}” created and saved.`);
    } catch (err: any) {
      setGlobalBannerError(
        err?.message || 'Could not start the story. Please try again.'
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handlePlayTemplate = async (tpl: StoryTemplate) => {
    await handleCreateStory({
      template_id: tpl.id,
      title: tpl.title,
      genre: tpl.genre,
      custom_topic: tpl.premise,
      protagonist_name: tpl.defaultProtagonist,
      protagonist_personality: tpl.defaultPersonality,
      protagonist_background: tpl.defaultBackground,
      narrator_personality: user?.preferred_narrator || tpl.defaultNarrator,
      difficulty: 'Balanced',
      story_length: 'Medium',
      perspective: 'Second-Person',
      atmosphere: tpl.atmosphere,
      setting_mode: tpl.settingMode,
      cover_image: tpl.coverImage,
    });
  };

  const handleContinueStory = async (payload: {
    from_scene_id: string;
    decision_id?: string | null;
    decision_text: string;
    is_custom_action: boolean;
    finish_story?: boolean;
  }) => {
    if (!activeStory || isContinuing) return;
    setIsContinuing(true);
    setPlayError(null);
    try {
      const updated = await api.continueStory(activeStory.story.id, payload);
      setActiveStory(updated);
      await refreshLibrary();
    } catch (err: any) {
      setPlayError(
        err?.message ||
          'Scene generation was interrupted. Your previous scene is safely preserved.'
      );
    } finally {
      setIsContinuing(false);
    }
  };

  const handleJumpToScene = async (sceneId: string) => {
    if (!activeStory) return;
    setPlayError(null);
    try {
      const updated = await api.switchScene(activeStory.story.id, sceneId);
      setActiveStory(updated);
    } catch (err: any) {
      setPlayError(err?.message || 'Could not switch scenes.');
    }
  };

  const handleToggleSaveActive = async () => {
    if (!activeStory) return;
    try {
      const res = await api.toggleSaveStory(activeStory.story.id);
      setActiveStory((prev) => (prev ? { ...prev, is_saved: res.is_saved } : null));
      await refreshLibrary();
      showSuccess(res.is_saved ? 'Story saved to your archive.' : 'Removed from saved stories.');
    } catch (err: any) {
      setPlayError(err?.message || 'Unable to update saved status.');
    }
  };

  const handleToggleFavourite = async (id: string) => {
    try {
      const res = await api.toggleFavourite(id);
      setFavouriteIds((prev) =>
        res.is_favourite ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)
      );
      if (activeStory && activeStory.story.id === id) {
        setActiveStory((prev) =>
          prev ? { ...prev, is_favourite: res.is_favourite } : null
        );
      }
      await refreshLibrary();
    } catch (err: any) {
      setGlobalBannerError(err?.message || 'Unable to update favourite status.');
    }
  };

  const handleTogglePauseActive = async () => {
    if (!activeStory) return;
    try {
      const nextStatus =
        activeStory.story.status === 'paused' ? 'in_progress' : 'paused';
      const res = await api.updateStoryStatus(activeStory.story.id, nextStatus);
      setActiveStory((prev) => (prev ? { ...prev, story: res.story } : null));
      await refreshLibrary();
      showSuccess(nextStatus === 'paused' ? 'Story paused.' : 'Story resumed.');
    } catch (err: any) {
      setPlayError(err?.message || 'Unable to update story status.');
    }
  };

  const handleRestartActive = async () => {
    if (!activeStory) return;
    const s = activeStory.story;
    await handleCreateStory({
      template_id: s.template_id,
      title: s.title,
      genre: s.genre,
      custom_topic: s.custom_topic,
      protagonist_name: s.protagonist_name,
      protagonist_personality: s.protagonist_personality,
      protagonist_background: s.protagonist_background,
      character_style_image: s.character_style_image,
      narrator_personality: s.narrator_personality,
      difficulty: s.difficulty,
      story_length: s.story_length,
      perspective: s.perspective,
      atmosphere: s.atmosphere,
      setting_mode: s.setting_mode,
      cover_image: s.cover_image,
    });
  };

  const handleReplayFromDashboard = async (item: StorySummaryItem) => {
    const s = item.story;
    await handleCreateStory({
      template_id: s.template_id,
      title: s.title,
      genre: s.genre,
      custom_topic: s.custom_topic,
      protagonist_name: s.protagonist_name,
      protagonist_personality: s.protagonist_personality,
      protagonist_background: s.protagonist_background,
      character_style_image: s.character_style_image,
      narrator_personality: s.narrator_personality,
      difficulty: s.difficulty,
      story_length: s.story_length,
      perspective: s.perspective,
      atmosphere: s.atmosphere,
      setting_mode: s.setting_mode,
      cover_image: s.cover_image,
    });
  };

  const handleDeleteStory = async (storyId: string) => {
    setDeletingStoryId(storyId);
    setGlobalBannerError(null);
    try {
      await api.deleteStory(storyId);
      if (activeStory?.story.id === storyId) {
        setActiveStory(null);
      }
      await refreshLibrary();
      showSuccess('Story permanently deleted.');
    } catch (err: any) {
      setGlobalBannerError(err?.message || 'Unable to delete that story.');
    } finally {
      setDeletingStoryId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#090A0F] text-[#ECEEF4] flex flex-col">
      <Navbar
        currentView={view}
        onNavigate={navigateTo}
        user={user}
        isGuest={isGuest}
        onOpenAuth={() => setAuthModalOpen(true)}
      />

      {/* Global Generating Overlay when launching a template directly */}
      {isCreating && view !== 'creator' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#090A0F]/85 backdrop-blur-md p-6">
          <div className="max-w-sm text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[#E5A93C]/25 border-t-[#E5A93C]" />
            <h2 className="mt-4 font-editorial text-2xl font-semibold text-[#F7F8FC]">
              Opening Your World
            </h2>
            <p className="mt-2 text-sm text-[#A3AABB]">
              Setting the stage, introducing characters, and crafting your opening choices...
            </p>
          </div>
        </div>
      )}

      {/* Global Success Notification */}
      {successNotice && (
        <div className="mx-auto mt-4 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div
            role="status"
            className="flex items-center justify-between gap-4 rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-100"
          >
            <span>{successNotice}</span>
            <button
              type="button"
              onClick={() => setSuccessNotice(null)}
              className="text-xs font-medium text-emerald-200 hover:text-white cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Global Error Alert */}
      {globalBannerError && view !== 'creator' && (
        <div className="mx-auto mt-4 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div
            role="alert"
            className="flex items-center justify-between gap-4 rounded-xl border border-rose-500/35 bg-rose-950/30 px-4 py-3 text-sm text-rose-100"
          >
            <span>{globalBannerError}</span>
            <button
              type="button"
              onClick={() => setGlobalBannerError(null)}
              className="text-xs font-medium text-rose-200 hover:text-white cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <main className="flex-1">
        {booting ? (
          <div className="flex min-h-[60vh] items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#E5A93C]/25 border-t-[#E5A93C]" />
          </div>
        ) : (
          <>
            {view === 'home' && (
              <HomePage
                userStories={userStories}
                favouriteIds={favouriteIds}
                onStartCreator={(genre) => {
                  setCreatorTemplate(null);
                  setCreatorGenre(genre || null);
                  navigateTo('creator');
                }}
                onExploreLibrary={(q, g) => {
                  setLibraryQuery(q || '');
                  setLibraryGenre(g || 'All');
                  navigateTo('library');
                }}
                onPlayTemplate={handlePlayTemplate}
                onCustomizeTemplate={(tpl) => {
                  setCreatorTemplate(tpl);
                  setCreatorGenre(tpl.genre);
                  navigateTo('creator');
                }}
                onResumeStory={openStoryById}
                onToggleFavourite={handleToggleFavourite}
              />
            )}

            {view === 'library' && (
              <StoryLibrary
                initialQuery={libraryQuery}
                initialGenre={libraryGenre}
                favouriteIds={favouriteIds}
                onPlayTemplate={handlePlayTemplate}
                onCustomizeTemplate={(tpl) => {
                  setCreatorTemplate(tpl);
                  setCreatorGenre(tpl.genre);
                  navigateTo('creator');
                }}
                onCreateCustom={(genre) => {
                  setCreatorTemplate(null);
                  setCreatorGenre(genre || null);
                  navigateTo('creator');
                }}
                onToggleFavourite={handleToggleFavourite}
              />
            )}

            {view === 'creator' && (
              <StoryCreator
                initialTemplate={creatorTemplate}
                initialGenre={creatorGenre}
                isCreating={isCreating}
                errorMessage={globalBannerError}
                onCreate={handleCreateStory}
                onCancel={() => navigateTo('home')}
              />
            )}

            {view === 'dashboard' && (
              <UserDashboard
                user={user}
                isGuest={isGuest}
                stories={userStories}
                isLoading={isLoadingStories}
                openingStoryId={openingStoryId}
                deletingStoryId={deletingStoryId}
                onRefresh={refreshLibrary}
                onResumeStory={openStoryById}
                onReplayStory={handleReplayFromDashboard}
                onDeleteStory={handleDeleteStory}
                onCreateNew={() => {
                  setCreatorTemplate(null);
                  setCreatorGenre(null);
                  navigateTo('creator');
                }}
                onOpenAuth={() => setAuthModalOpen(true)}
              />
            )}

            {view === 'play' && activeStory && (
              <StoryPlayer
                state={activeStory}
                isGenerating={isContinuing}
                errorMessage={playError}
                onContinue={handleContinueStory}
                onJumpToScene={handleJumpToScene}
                onToggleSave={handleToggleSaveActive}
                onToggleFavourite={() => handleToggleFavourite(activeStory.story.id)}
                onTogglePause={handleTogglePauseActive}
                onRestartStory={handleRestartActive}
                onBack={() => navigateTo('dashboard')}
                onNewStory={() => {
                  setCreatorTemplate(null);
                  setCreatorGenre(null);
                  navigateTo('creator');
                }}
              />
            )}
          </>
        )}
      </main>

      {/* Clean Minimal Footer */}
      {view !== 'play' && (
        <footer className="border-t border-white/[0.07] bg-[#07080D] py-8">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 text-xs text-[#7E869A] sm:px-6 lg:px-8">
            <span className="font-editorial text-sm text-[#C8CDD9]">WHAT IF 3.0</span>
            <div className="flex items-center gap-6">
              <button
                type="button"
                onClick={() => navigateTo('library')}
                className="hover:text-[#ECEEF4] cursor-pointer"
              >
                Explore 20 Genres
              </button>
              <button
                type="button"
                onClick={() => navigateTo('creator')}
                className="hover:text-[#ECEEF4] cursor-pointer"
              >
                Story Studio
              </button>
              <button
                type="button"
                onClick={() => navigateTo('dashboard')}
                className="hover:text-[#ECEEF4] cursor-pointer"
              >
                My Archive
              </button>
            </div>
          </div>
        </footer>
      )}

      {authModalOpen && (
        <AuthProfileModal
          user={user}
          isGuest={isGuest}
          onClose={() => setAuthModalOpen(false)}
          onSignIn={handleSignIn}
          onSignUp={handleSignUp}
          onUpdateProfile={handleUpdateProfile}
          onSignOut={handleSignOut}
        />
      )}
    </div>
  );
}
