import { Heart, Play, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { GENRES, STORY_TEMPLATES } from '../data/catalog.ts';
import type { StoryTemplate } from '../types/story.ts';

interface StoryLibraryProps {
  initialQuery?: string;
  initialGenre?: string;
  favouriteIds: string[];
  onPlayTemplate: (template: StoryTemplate) => void;
  onCustomizeTemplate: (template: StoryTemplate) => void;
  onCreateCustom: (genre?: string | null) => void;
  onToggleFavourite: (id: string) => void;
}

export function StoryLibrary({
  initialQuery = '',
  initialGenre = 'All',
  favouriteIds,
  onPlayTemplate,
  onCustomizeTemplate,
  onCreateCustom,
  onToggleFavourite,
}: StoryLibraryProps) {
  const [query, setQuery] = useState(initialQuery);
  const [selectedGenre, setSelectedGenre] = useState(initialGenre);
  const [onlyFavourites, setOnlyFavourites] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return STORY_TEMPLATES.filter((tpl) => {
      if (selectedGenre !== 'All' && tpl.genre !== selectedGenre) return false;
      if (onlyFavourites && !favouriteIds.includes(tpl.id)) return false;
      if (!q) return true;
      return (
        tpl.title.toLowerCase().includes(q) ||
        tpl.genre.toLowerCase().includes(q) ||
        tpl.hook.toLowerCase().includes(q) ||
        tpl.premise.toLowerCase().includes(q) ||
        tpl.starterLocation.toLowerCase().includes(q) ||
        tpl.starterTags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [query, selectedGenre, onlyFavourites, favouriteIds]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div>
          <p className="text-xs font-medium text-[#E5A93C]">Complete Story Catalog</p>
          <h1 className="mt-1 font-editorial text-3xl sm:text-4xl font-semibold text-[#F7F8FC]">
            Explore All 20 Story Worlds
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[#A3AABB]">
            Every genre carries its own narrative voice, atmospheric staging, and branching decision logic—jump straight in or customize any world before you begin.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            onCreateCustom(selectedGenre !== 'All' ? selectedGenre : null)
          }
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#E5A93C] px-5 py-2.5 text-sm font-semibold text-[#0B0C10] transition-colors hover:bg-[#F0BC58] cursor-pointer whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          <span>Create Custom Story</span>
        </button>
      </div>

      {/* Search & Genre Filters */}
      <div className="mt-6 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8E96AA]" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title, genre, setting, or theme..."
              className="min-h-[44px] w-full rounded-xl border border-white/12 bg-[#0E111A] pl-10 pr-4 text-sm text-[#F5F6FA] placeholder-[#70788D] focus:border-[#E5A93C] focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => setOnlyFavourites((v) => !v)}
            className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border px-4 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              onlyFavourites
                ? 'border-rose-400/50 bg-rose-500/15 text-rose-200'
                : 'border-white/12 bg-[#0E111A] text-[#CBD0DD] hover:border-white/25'
            }`}
          >
            <Heart className={`h-3.5 w-3.5 ${onlyFavourites ? 'fill-current' : ''}`} />
            <span>Favourites Only</span>
          </button>
        </div>

        {/* Interactive Genre Filter Bar */}
        <div
          role="tablist"
          aria-label="Filter stories by genre"
          className="flex items-center gap-1.5 overflow-x-auto pb-2"
        >
          <button
            type="button"
            onClick={() => setSelectedGenre('All')}
            className={`min-h-[38px] rounded-lg px-3.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              selectedGenre === 'All'
                ? 'bg-[#E5A93C] text-[#0B0C10]'
                : 'bg-[#111520] text-[#B8BFCE] hover:bg-[#191E2D] hover:text-white'
            }`}
          >
            All Genres (20)
          </button>
          {GENRES.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setSelectedGenre(g.name)}
              className={`min-h-[38px] rounded-lg px-3.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selectedGenre === g.name
                  ? 'bg-[#E5A93C] text-[#0B0C10]'
                  : 'bg-[#111520] text-[#B8BFCE] hover:bg-[#191E2D] hover:text-white'
              }`}
            >
              {g.name}
            </button>
          ))}
        </div>
      </div>

      {/* Results Count */}
      <p className="mt-4 text-xs text-[#8E96AA] font-mono tabular-nums">
        Showing {filtered.length} of {STORY_TEMPLATES.length} curated stories
      </p>

      {/* Empty State */}
      {filtered.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-white/[0.08] bg-[#0F121B] px-6 py-16 text-center">
          <h2 className="font-editorial text-xl font-semibold text-[#F5F6FA]">
            No matching stories found
          </h2>
          <p className="mt-2 text-sm text-[#9BA2B4]">
            Try another keyword, clear your genre filter, or generate a brand-new original world.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setSelectedGenre('All');
                setOnlyFavourites(false);
              }}
              className="min-h-[42px] rounded-xl border border-white/15 px-4 text-xs font-medium text-[#ECEEF4] cursor-pointer"
            >
              Reset Filters
            </button>
            <button
              type="button"
              onClick={() => onCreateCustom()}
              className="min-h-[42px] rounded-xl bg-[#E5A93C] px-5 text-xs font-semibold text-[#0B0C10] cursor-pointer"
            >
              Create Original Story
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((tpl) => {
            const isFav = favouriteIds.includes(tpl.id);
            return (
              <article
                key={tpl.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0F121B] transition-colors hover:border-white/20"
              >
                <div className="relative aspect-[16/9] overflow-hidden bg-[#141825]">
                  <img
                    src={tpl.coverImage}
                    alt={tpl.title}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0F121B] via-[#0F121B]/25 to-transparent" />
                  <button
                    type="button"
                    onClick={() => onToggleFavourite(tpl.id)}
                    aria-label={isFav ? 'Remove favourite' : 'Add favourite'}
                    className={`absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-lg border backdrop-blur-md transition-colors cursor-pointer ${
                      isFav
                        ? 'border-rose-400/50 bg-rose-500/20 text-rose-300'
                        : 'border-white/15 bg-[#090A0F]/65 text-[#DDE1EC] hover:border-white/35'
                    }`}
                  >
                    <Heart className={`h-4 w-4 ${isFav ? 'fill-current' : ''}`} />
                  </button>
                </div>

                <div className="flex flex-1 flex-col justify-between p-5">
                  <div>
                    <p className="text-xs text-[#9BA2B4]">
                      {tpl.genre} · {tpl.estimatedChapters} Chapters · {tpl.settingMode}
                    </p>
                    <h2 className="mt-1.5 font-editorial text-xl font-semibold text-[#F5F6FA]">
                      {tpl.title}
                    </h2>
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[#A8AFBF]">
                      {tpl.hook}
                    </p>
                    <p className="mt-3 text-xs text-[#8E96AA]">
                      Lead: {tpl.defaultProtagonist} · {tpl.defaultNarrator}
                    </p>
                  </div>

                  <div className="mt-5 flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => onPlayTemplate(tpl)}
                      className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#E5A93C] px-3.5 text-xs font-semibold text-[#0B0C10] transition-colors hover:bg-[#F0BC58] cursor-pointer"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>Start</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onCustomizeTemplate(tpl)}
                      className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-white/12 bg-[#141825] px-3.5 text-xs font-medium text-[#DDE1EC] transition-colors hover:border-white/25 cursor-pointer"
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      <span>Customize</span>
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
