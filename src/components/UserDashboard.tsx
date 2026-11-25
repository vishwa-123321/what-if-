import {
  Bookmark,
  GitBranch,
  Heart,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { StorySummaryItem, UserProfile } from '../types/story.ts';

interface UserDashboardProps {
  user: UserProfile | null;
  isGuest: boolean;
  stories: StorySummaryItem[];
  isLoading: boolean;
  openingStoryId: string | null;
  deletingStoryId: string | null;
  onRefresh: () => Promise<void>;
  onResumeStory: (storyId: string) => void;
  onReplayStory: (item: StorySummaryItem) => void;
  onDeleteStory: (storyId: string) => Promise<void>;
  onCreateNew: () => void;
  onOpenAuth: () => void;
}

type DashboardFilter = 'all' | 'in_progress' | 'completed' | 'saved' | 'favourites';

export function UserDashboard({
  user,
  isGuest,
  stories,
  isLoading,
  openingStoryId,
  deletingStoryId,
  onRefresh,
  onResumeStory,
  onReplayStory,
  onDeleteStory,
  onCreateNew,
  onOpenAuth,
}: UserDashboardProps) {
  const [filter, setFilter] = useState<DashboardFilter>('all');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    switch (filter) {
      case 'in_progress':
        return stories.filter((s) => s.story.status !== 'completed');
      case 'completed':
        return stories.filter((s) => s.story.status === 'completed');
      case 'saved':
        return stories.filter((s) => s.is_saved);
      case 'favourites':
        return stories.filter((s) => s.is_favourite);
      default:
        return stories;
    }
  }, [stories, filter]);

  const totalBranches = stories.reduce((sum, s) => sum + s.branches_count, 0);
  const completedCount = stories.filter((s) => s.story.status === 'completed').length;
  const totalDecisions = stories.reduce(
    (sum, s) => sum + (s.progress?.decisions_count || 0),
    0
  );

  const filters: Array<{ id: DashboardFilter; label: string }> = [
    { id: 'all', label: `All (${stories.length})` },
    {
      id: 'in_progress',
      label: `In Progress (${stories.filter((s) => s.story.status !== 'completed').length})`,
    },
    { id: 'completed', label: `Completed (${completedCount})` },
    { id: 'saved', label: `Saved (${stories.filter((s) => s.is_saved).length})` },
    {
      id: 'favourites',
      label: `Favourites (${stories.filter((s) => s.is_favourite).length})`,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header & Account Sync */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div>
          <p className="text-xs font-medium text-[#E5A93C]">Personal Chronicle</p>
          <h1 className="mt-1 font-editorial text-3xl sm:text-4xl font-semibold text-[#F7F8FC]">
            {user && !isGuest ? `${user.display_name}’s Story Archive` : 'My Stories'}
          </h1>
          <p className="mt-2 text-sm text-[#A3AABB]">
            Resume unfinished journeys, compare completed endings, and replay any world to uncover alternate branches.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onRefresh()}
            disabled={isLoading}
            aria-label="Refresh stories"
            title="Refresh stories"
            className="inline-flex min-h-[44px] w-11 items-center justify-center rounded-xl border border-white/15 bg-[#121622] text-[#CBD0DD] transition-colors hover:border-[#E5A93C]/50 hover:text-white disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin text-[#E5A93C]' : ''}`} />
          </button>
          {isGuest && (
            <button
              type="button"
              onClick={onOpenAuth}
              className="min-h-[44px] rounded-xl border border-white/15 bg-[#121622] px-4 text-xs font-medium text-[#ECEEF4] transition-colors hover:border-[#E5A93C]/50 cursor-pointer whitespace-nowrap"
            >
              Sign In to Sync Across Devices
            </button>
          )}
          <button
            type="button"
            onClick={onCreateNew}
            className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#E5A93C] px-5 text-sm font-semibold text-[#0B0C10] transition-colors hover:bg-[#F0BC58] cursor-pointer whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>New Story</span>
          </button>
        </div>
      </div>

      {/* Clean 4-Metric Summary Strip */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-white/[0.08] bg-[#0F121B] p-4">
          <p className="text-xs text-[#8E96AA]">Stories Started</p>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[#F5F6FA]">
            {stories.length}
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-[#0F121B] p-4">
          <p className="text-xs text-[#8E96AA]">Completed Endings</p>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[#E5A93C]">
            {completedCount}
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-[#0F121B] p-4">
          <p className="text-xs text-[#8E96AA]">Decisions Made</p>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[#F5F6FA]">
            {totalDecisions}
          </p>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-[#0F121B] p-4">
          <p className="text-xs text-[#8E96AA]">Timelines Explored</p>
          <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[#F5F6FA]">
            {totalBranches}
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="mt-7 flex items-center gap-1.5 overflow-x-auto pb-2">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`min-h-[38px] rounded-lg px-3.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              filter === f.id
                ? 'bg-[#E5A93C] text-[#0B0C10]'
                : 'bg-[#111520] text-[#B8BFCE] hover:bg-[#191E2D] hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Story List */}
      {isLoading && stories.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-white/[0.08] bg-[#0F121B] px-6 py-16 text-center">
          <Loader2 className="mx-auto h-7 w-7 animate-spin text-[#E5A93C]" />
          <p className="mt-3 text-sm text-[#A3AABB]">Loading your stories...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-white/[0.08] bg-[#0F121B] px-6 py-16 text-center">
          <h2 className="font-editorial text-xl font-semibold text-[#F5F6FA]">
            No stories in this view yet
          </h2>
          <p className="mt-2 text-sm text-[#9BA2B4]">
            Start a new adventure from the 20-genre library or build your own world in Story Studio.
          </p>
          <button
            type="button"
            onClick={onCreateNew}
            className="mt-6 min-h-[44px] rounded-xl bg-[#E5A93C] px-6 text-sm font-semibold text-[#0B0C10] hover:bg-[#F0BC58] cursor-pointer"
          >
            Start Your First Adventure
          </button>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => {
            const isOpening = openingStoryId === item.story.id;
            const isDeleting = deletingStoryId === item.story.id;
            return (
              <article
                key={item.story.id}
                className="flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0F121B]"
              >
                <div className="relative aspect-[16/9] overflow-hidden bg-[#141825]">
                  <img
                    src={item.story.cover_image}
                    alt={item.story.title}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0F121B] via-[#0F121B]/35 to-transparent" />
                  <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-xs font-mono tabular-nums text-[#E2E5EF]">
                    <span>
                      Ch {item.progress?.current_chapter || 1} · Sc{' '}
                      {item.progress?.current_scene_number || 1}
                    </span>
                    <span className="text-[#E5A93C]">
                      {item.story.status === 'completed'
                        ? `${item.story.ending_type || 'Completed'} ending`
                        : `${item.progress?.progress_percent || 10}%`}
                    </span>
                  </div>
                </div>

                <div className="flex flex-1 flex-col justify-between p-5">
                  <div>
                    <div className="flex items-center justify-between gap-2 text-xs text-[#9BA2B4]">
                      <span className="truncate">
                        {item.story.genre} · {item.story.protagonist_name}
                      </span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        {item.is_saved && <Bookmark className="h-3.5 w-3.5 text-[#E5A93C]" />}
                        {item.is_favourite && (
                          <Heart className="h-3.5 w-3.5 fill-rose-400 text-rose-400" />
                        )}
                      </span>
                    </div>
                    <h2 className="mt-1.5 font-editorial text-xl font-semibold text-[#F5F6FA]">
                      {item.story.title}
                    </h2>
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[#A3AABB]">
                      {item.progress?.current_objective || item.story.custom_topic}
                    </p>
                    <div className="mt-3 flex items-center gap-3 text-[11px] font-mono tabular-nums text-[#8E96AA]">
                      <span className="inline-flex items-center gap-1">
                        <GitBranch className="h-3 w-3 text-[#E5A93C]" />
                        {item.branches_count} branch{item.branches_count === 1 ? '' : 'es'}
                      </span>
                      <span>·</span>
                      <span>{item.scenes_count} scenes</span>
                    </div>
                  </div>

                  {pendingDeleteId === item.story.id ? (
                    <div className="mt-5 flex items-center justify-between gap-2 rounded-xl border border-rose-500/35 bg-rose-950/25 p-2.5">
                      <span className="text-xs text-rose-200">Delete permanently?</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={() => setPendingDeleteId(null)}
                          className="rounded-lg px-2.5 py-1 text-xs text-[#CBD0DD] hover:text-white disabled:opacity-50 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={async () => {
                            await onDeleteStory(item.story.id);
                            setPendingDeleteId(null);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-60 cursor-pointer"
                        >
                          {isDeleting && <Loader2 className="h-3 w-3 animate-spin" />}
                          <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5 flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isOpening || isDeleting}
                        onClick={() => onResumeStory(item.story.id)}
                        className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#E5A93C] px-3.5 text-xs font-semibold text-[#0B0C10] transition-colors hover:bg-[#F0BC58] disabled:opacity-60 cursor-pointer"
                      >
                        {isOpening ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Play className="h-3.5 w-3.5 fill-current" />
                        )}
                        <span>
                          {isOpening
                            ? 'Opening...'
                            : item.story.status === 'completed'
                              ? 'View & Branch'
                              : 'Continue'}
                        </span>
                      </button>
                      <button
                        type="button"
                        disabled={isOpening || isDeleting}
                        onClick={() => onReplayStory(item)}
                        title="Replay from beginning"
                        aria-label={`Replay ${item.story.title}`}
                        className="inline-flex min-h-[40px] w-10 items-center justify-center rounded-xl border border-white/12 bg-[#141825] text-[#CBD0DD] hover:border-white/25 hover:text-white disabled:opacity-50 cursor-pointer"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={isOpening || isDeleting}
                        onClick={() => setPendingDeleteId(item.story.id)}
                        title="Delete story"
                        aria-label={`Delete ${item.story.title}`}
                        className="inline-flex min-h-[40px] w-10 items-center justify-center rounded-xl border border-white/12 bg-[#141825] text-[#9BA2B4] hover:border-rose-400/40 hover:text-rose-300 disabled:opacity-50 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
