import { motion } from 'motion/react';
import {
  ArrowRight,
  Compass,
  Heart,
  Play,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { ASSETS, GENRES, STORY_TEMPLATES } from '../data/catalog.ts';
import type { StorySummaryItem, StoryTemplate } from '../types/story.ts';

interface HomePageProps {
  userStories: StorySummaryItem[];
  favouriteIds: string[];
  onStartCreator: (genre?: string | null) => void;
  onExploreLibrary: (query?: string, genre?: string) => void;
  onPlayTemplate: (template: StoryTemplate) => void;
  onCustomizeTemplate: (template: StoryTemplate) => void;
  onResumeStory: (storyId: string) => void;
  onToggleFavourite: (id: string) => void;
}

export function HomePage({
  userStories,
  favouriteIds,
  onStartCreator,
  onExploreLibrary,
  onPlayTemplate,
  onCustomizeTemplate,
  onResumeStory,
  onToggleFavourite,
}: HomePageProps) {
  const [searchInput, setSearchInput] = useState('');

  const activeStories = userStories.filter((s) => s.story.status !== 'completed');
  const recentStories = userStories.slice(0, 3);
  const featuredTemplates = STORY_TEMPLATES.filter((t) => t.featured);
  const popularTemplates = STORY_TEMPLATES.filter((t) => t.popular).slice(0, 6);
  const trendingGenres = GENRES.filter((g) => g.trending);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    onExploreLibrary(searchInput.trim(), 'All');
  };

  return (
    <div className="pb-20">
      {/* Cinematic Widescreen Hero */}
      <section className="relative overflow-hidden border-b border-white/[0.08]">
        <div className="absolute inset-0">
          <img
            src={ASSETS.midnightExpress}
            alt="Midnight Express crossing an alpine viaduct"
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover object-center animate-ken-burns opacity-65"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#090A0F] via-[#090A0F]/82 to-[#090A0F]/35" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#090A0F] via-transparent to-[#090A0F]/55" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8 lg:py-32">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-2xl"
          >
            <p className="text-xs font-medium tracking-wide text-[#E5A93C]">
              Interactive AI Story Universe
            </p>
            <h1 className="mt-4 font-editorial text-4xl font-semibold leading-[1.08] tracking-tight text-[#F7F8FC] sm:text-5xl lg:text-6xl text-balance">
              One story. Infinite possibilities. Every decision matters.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-[#C7CDD9] sm:text-lg">
              Step into living fictional worlds where characters remember how you treat them, physically react on stage to your choices, and branch into lasting endings shaped by what you decide—or invent yourself.
            </p>

            {/* Primary CTA & Secondary Link */}
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => onStartCreator()}
                className="inline-flex min-h-[48px] items-center gap-2.5 rounded-xl bg-[#E5A93C] px-7 py-3 text-sm font-semibold text-[#0B0C10] transition-colors hover:bg-[#F0BC58] cursor-pointer whitespace-nowrap"
              >
                <span>Start Your Adventure</span>
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onExploreLibrary('', 'All')}
                className="inline-flex min-h-[48px] items-center gap-2 rounded-xl border border-white/15 bg-[#0E111A]/80 px-6 py-3 text-sm font-medium text-[#ECEEF4] backdrop-blur-md transition-colors hover:border-white/30 cursor-pointer whitespace-nowrap"
              >
                <Compass className="h-4 w-4 text-[#E5A93C]" />
                <span>Explore 20 Worlds</span>
              </button>
            </div>

            {/* Inline Quick Search */}
            <form
              onSubmit={handleSearch}
              className="mt-9 flex max-w-lg items-center rounded-xl border border-white/12 bg-[#0E111A]/85 p-1.5 backdrop-blur-md focus-within:border-[#E5A93C]/60"
            >
              <Search className="ml-3 h-4 w-4 text-[#8E96AA] shrink-0" />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search stories, mysteries, genres, or worlds..."
                className="min-h-[40px] flex-1 bg-transparent px-3 text-sm text-[#F5F6FA] placeholder-[#7B8396] focus:outline-none"
              />
              <button
                type="submit"
                className="min-h-[40px] rounded-lg bg-white/[0.08] px-4 text-xs font-medium text-[#ECEEF4] transition-colors hover:bg-white/[0.14] cursor-pointer whitespace-nowrap"
              >
                Search
              </button>
            </form>
          </motion.div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-20 px-4 pt-14 sm:px-6 lg:px-8">
        {/* Continue Your Story (Only renders when user has active stories) */}
        {activeStories.length > 0 && (
          <section aria-labelledby="continue-heading">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-[#E5A93C]">Resume Session</p>
                <h2
                  id="continue-heading"
                  className="mt-1 font-editorial text-2xl sm:text-3xl font-semibold text-[#F7F8FC]"
                >
                  Continue Your Story
                </h2>
              </div>
              <span className="font-mono text-xs tabular-nums text-[#8E96AA]">
                {activeStories.length} active
              </span>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {activeStories.slice(0, 3).map((item) => (
                <article
                  key={item.story.id}
                  className="group flex flex-col overflow-hidden rounded-2xl border border-white/[0.09] bg-[#10131D] transition-colors hover:border-[#E5A93C]/45"
                >
                  <div className="relative aspect-[16/9] overflow-hidden bg-[#151925]">
                    <img
                      src={item.story.cover_image}
                      alt={item.story.title}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#10131D] via-[#10131D]/30 to-transparent" />
                    <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-xs font-mono tabular-nums text-[#D7DBE6]">
                      <span>
                        Ch {item.progress?.current_chapter || 1} · Sc{' '}
                        {item.progress?.current_scene_number || 1}
                      </span>
                      <span className="text-[#E5A93C]">
                        {item.progress?.progress_percent || 10}%
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col justify-between p-5">
                    <div>
                      <p className="text-xs text-[#9BA2B4]">
                        {item.story.genre} · {item.story.protagonist_name} ·{' '}
                        {item.branches_count} branch{item.branches_count === 1 ? '' : 'es'}
                      </p>
                      <h3 className="mt-1.5 font-editorial text-xl font-semibold text-[#F5F6FA]">
                        {item.story.title}
                      </h3>
                      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[#A3AABB]">
                        {item.progress?.current_objective || item.story.custom_topic}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onResumeStory(item.story.id)}
                      className="mt-5 inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-xl bg-[#E5A93C] px-4 text-xs font-semibold text-[#0B0C10] transition-colors hover:bg-[#F0BC58] cursor-pointer"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>Continue Adventure</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Featured AI Stories */}
        <section aria-labelledby="featured-heading">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-[#E5A93C]">Curated Premiers</p>
              <h2
                id="featured-heading"
                className="mt-1 font-editorial text-2xl sm:text-3xl font-semibold text-[#F7F8FC]"
              >
                Featured AI Stories
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onExploreLibrary('', 'All')}
              className="text-sm font-medium text-[#C8CDD9] transition-colors hover:text-[#E5A93C] cursor-pointer"
            >
              Browse all 20 worlds →
            </button>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
            {featuredTemplates.map((tpl) => {
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
                      aria-label={
                        isFav
                          ? `Remove ${tpl.title} from favourites`
                          : `Add ${tpl.title} to favourites`
                      }
                      className={`absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-lg border backdrop-blur-md transition-colors cursor-pointer ${
                        isFav
                          ? 'border-rose-400/50 bg-rose-500/20 text-rose-300'
                          : 'border-white/15 bg-[#090A0F]/65 text-[#DDE1EC] hover:border-white/35'
                      }`}
                    >
                      <Heart className={`h-4 w-4 ${isFav ? 'fill-current' : ''}`} />
                    </button>
                  </div>

                  <div className="flex flex-1 flex-col justify-between p-6">
                    <div>
                      <p className="text-xs text-[#9BA2B4]">
                        {tpl.genre} · {tpl.estimatedChapters} Chapters · {tpl.defaultNarrator}
                      </p>
                      <h3 className="mt-1.5 font-editorial text-2xl font-semibold text-[#F5F6FA]">
                        {tpl.title}
                      </h3>
                      <p className="mt-2.5 text-sm leading-relaxed text-[#B8BFCE]">
                        {tpl.hook}
                      </p>
                    </div>

                    <div className="mt-6 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => onPlayTemplate(tpl)}
                        className="inline-flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded-xl bg-[#E5A93C] px-4 text-xs font-semibold text-[#0B0C10] transition-colors hover:bg-[#F0BC58] cursor-pointer"
                      >
                        <Play className="h-3.5 w-3.5 fill-current" />
                        <span>Play Now</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onCustomizeTemplate(tpl)}
                        className="inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-xl border border-white/12 bg-[#141825] px-4 text-xs font-medium text-[#DDE1EC] transition-colors hover:border-white/25 cursor-pointer whitespace-nowrap"
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
        </section>

        {/* Trending Genres */}
        <section aria-labelledby="genres-heading">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-[#E5A93C]">20 Distinct Storytelling Engines</p>
              <h2
                id="genres-heading"
                className="mt-1 font-editorial text-2xl sm:text-3xl font-semibold text-[#F7F8FC]"
              >
                Trending Genres
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onExploreLibrary('', 'All')}
              className="text-sm font-medium text-[#C8CDD9] transition-colors hover:text-[#E5A93C] cursor-pointer"
            >
              View all 20 genres →
            </button>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {trendingGenres.map((genre) => (
              <button
                key={genre.id}
                type="button"
                onClick={() => onExploreLibrary('', genre.name)}
                className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#10131C] p-5 text-left transition-colors hover:border-[#E5A93C]/50 cursor-pointer"
              >
                <p className="font-editorial text-lg font-semibold text-[#F5F6FA] group-hover:text-[#E5A93C] transition-colors">
                  {genre.name}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-[#9BA2B4]">
                  {genre.tagline}
                </p>
                <p className="mt-4 text-xs font-medium text-[#CBD0DD]">
                  Explore genre →
                </p>
              </button>
            ))}
          </div>
        </section>

        {/* Popular Stories */}
        <section aria-labelledby="popular-heading">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-[#E5A93C]">Reader Favorites</p>
              <h2
                id="popular-heading"
                className="mt-1 font-editorial text-2xl sm:text-3xl font-semibold text-[#F7F8FC]"
              >
                Popular Interactive Stories
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onStartCreator()}
              className="text-sm font-medium text-[#C8CDD9] transition-colors hover:text-[#E5A93C] cursor-pointer"
            >
              Create a custom world →
            </button>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {popularTemplates.map((tpl) => (
              <article
                key={tpl.id}
                className="flex flex-col justify-between rounded-2xl border border-white/[0.08] bg-[#0F121B] p-5 transition-colors hover:border-white/20"
              >
                <div>
                  <p className="text-xs text-[#9BA2B4]">
                    {tpl.genre} · {tpl.starterLocation}
                  </p>
                  <h3 className="mt-1.5 font-editorial text-xl font-semibold text-[#F5F6FA]">
                    {tpl.title}
                  </h3>
                  <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[#A8AFBF]">
                    {tpl.hook}
                  </p>
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-white/[0.07] pt-4">
                  <span className="text-xs text-[#8E96AA]">
                    {tpl.defaultNarrator}
                  </span>
                  <button
                    type="button"
                    onClick={() => onPlayTemplate(tpl)}
                    className="text-xs font-semibold text-[#E5A93C] hover:text-[#F0BC58] cursor-pointer"
                  >
                    Enter Story →
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Recently Played */}
        {recentStories.length > 0 && (
          <section aria-labelledby="recent-heading" className="border-t border-white/[0.08] pt-12">
            <h2
              id="recent-heading"
              className="font-editorial text-2xl font-semibold text-[#F7F8FC]"
            >
              Recently Played
            </h2>
            <div className="mt-5 divide-y divide-white/[0.07] rounded-2xl border border-white/[0.08] bg-[#0E111A]">
              {recentStories.map((item) => (
                <div
                  key={item.story.id}
                  className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#F5F6FA]">
                      {item.story.title}
                    </p>
                    <p className="mt-0.5 text-xs text-[#8E96AA] font-mono tabular-nums">
                      {item.story.genre} · Ch {item.progress?.current_chapter || 1}, Sc{' '}
                      {item.progress?.current_scene_number || 1} · {item.scenes_count} scenes
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onResumeStory(item.story.id)}
                    className="min-h-[38px] rounded-lg border border-white/12 px-4 text-xs font-medium text-[#ECEEF4] transition-colors hover:border-[#E5A93C]/50 hover:text-[#E5A93C] cursor-pointer whitespace-nowrap"
                  >
                    {item.story.status === 'completed' ? 'Review Ending' : 'Resume'}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
