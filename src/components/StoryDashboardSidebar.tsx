import {
  BookOpen,
  Compass,
  History,
  KeyRound,
  RotateCcw,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { FullStoryState } from '../types/story.ts';

type SidebarTab = 'state' | 'characters' | 'clues' | 'history';

interface StoryDashboardSidebarProps {
  state: FullStoryState;
  focusedCharacterName: string | null;
  onClearFocusedCharacter: () => void;
  onJumpToScene: (sceneId: string) => void;
  onCloseMobile?: () => void;
}

export function StoryDashboardSidebar({
  state,
  focusedCharacterName,
  onClearFocusedCharacter,
  onJumpToScene,
  onCloseMobile,
}: StoryDashboardSidebarProps) {
  const [activeTab, setActiveTab] = useState<SidebarTab>('state');

  useEffect(() => {
    if (focusedCharacterName) {
      setActiveTab('characters');
    }
  }, [focusedCharacterName]);

  const currentScene =
    state.scenes.find((s) => s.id === state.progress.current_scene_id) ||
    state.scenes[state.scenes.length - 1];

  const activeBranch = state.branches.find(
    (b) => b.id === state.progress.current_branch_id
  );

  const clues = state.clues.filter((c) => c.item_type === 'clue');
  const objects = state.clues.filter((c) => c.item_type === 'object');
  const mysteries = state.clues.filter((c) => c.item_type === 'mystery');

  const tabs: Array<{ id: SidebarTab; label: string; icon: typeof Compass; count?: number }> = [
    { id: 'state', label: 'State', icon: Compass },
    { id: 'characters', label: 'Cast', icon: Users, count: state.characters.length },
    { id: 'clues', label: 'Clues', icon: KeyRound, count: state.clues.length },
    { id: 'history', label: 'Log', icon: History, count: state.decisions.length },
  ];

  return (
    <aside
      aria-label="Story Dashboard"
      className="flex h-full flex-col rounded-2xl border border-white/[0.08] bg-[#0E111A]"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3.5">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-[#E5A93C]" />
          <h3 className="text-sm font-semibold text-[#F5F6FA]">Story Dossier</h3>
        </div>
        {onCloseMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close dashboard"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#9BA2B4] hover:bg-white/[0.06] hover:text-white lg:hidden cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Segmented Tab Controls */}
      <div className="grid grid-cols-4 gap-1 border-b border-white/[0.08] bg-[#0B0D14] p-1.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id !== 'characters') onClearFocusedCharacter();
              }}
              className={`flex min-h-[38px] items-center justify-center gap-1 rounded-lg px-2 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                active
                  ? 'bg-[#191E2D] text-[#F5F6FA]'
                  : 'text-[#8F96A8] hover:text-[#D7DBE6]'
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${active ? 'text-[#E5A93C]' : ''}`} />
              <span>{tab.label}</span>
              {typeof tab.count === 'number' && tab.count > 0 && (
                <span className="font-mono text-[10px] tabular-nums text-[#8F96A8]">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {activeTab === 'state' && (
          <>
            {/* Arc Progress */}
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#9BA2B4]">Narrative Arc</span>
                <span className="font-mono font-medium tabular-nums text-[#E5A93C]">
                  {state.progress.progress_percent}%
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className="h-full rounded-full bg-[#E5A93C] transition-all duration-500"
                  style={{ width: `${state.progress.progress_percent}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-[#8E96AA] font-mono tabular-nums">
                <span>
                  Ch {state.progress.current_chapter} · Sc {state.progress.current_scene_number}
                </span>
                <span>{state.decisions.length} decisions</span>
              </div>
            </div>

            <div className="border-t border-white/[0.07] pt-4 space-y-3">
              <div>
                <p className="text-xs text-[#8E96AA]">Current Objective</p>
                <p className="mt-1 text-sm font-medium leading-snug text-[#F2F4F8]">
                  {currentScene?.current_objective || state.progress.current_objective}
                </p>
              </div>

              <div>
                <p className="text-xs text-[#8E96AA]">Current Location</p>
                <p className="mt-0.5 text-sm text-[#D6DBE8]">
                  {currentScene?.current_location || state.progress.current_location}
                </p>
              </div>

              <div>
                <p className="text-xs text-[#8E96AA]">Active Timeline</p>
                <p className="mt-0.5 text-sm text-[#D6DBE8]">
                  {activeBranch?.branch_name || 'Primary Timeline'}
                </p>
              </div>

              <div>
                <p className="text-xs text-[#8E96AA]">Status</p>
                <p className="mt-0.5 text-sm capitalize text-[#D6DBE8]">
                  {state.story.status.replace('_', ' ')}
                  {state.story.ending_type ? ` · ${state.story.ending_type} ending` : ''}
                </p>
              </div>
            </div>

            <div className="border-t border-white/[0.07] pt-4">
              <p className="text-xs text-[#8E96AA]">Protagonist</p>
              <p className="mt-1 text-sm font-semibold text-[#F5F6FA]">
                {state.story.protagonist_name}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-[#A3AABB]">
                {state.story.protagonist_personality}
              </p>
              <p className="mt-2 text-xs text-[#8E96AA]">
                Narrator: <span className="text-[#CBD0DD]">{state.story.narrator_personality}</span>
              </p>
            </div>

            {state.story.rolling_summary && (
              <div className="border-t border-white/[0.07] pt-4">
                <p className="text-xs text-[#8E96AA]">Story Memory</p>
                <p className="mt-1 text-xs leading-relaxed text-[#C2C8D6]">
                  {state.story.rolling_summary}
                </p>
              </div>
            )}
          </>
        )}

        {activeTab === 'characters' && (
          <div className="space-y-4">
            {state.characters.length === 0 ? (
              <p className="py-8 text-center text-xs text-[#8E96AA]">
                No characters met yet. Continue exploring to encounter key figures.
              </p>
            ) : (
              state.characters.map((char) => {
                const isFocused =
                  focusedCharacterName &&
                  char.name.toLowerCase() === focusedCharacterName.toLowerCase();
                const meterPercent = Math.round(((char.relationship_score + 100) / 200) * 100);
                return (
                  <div
                    key={char.id}
                    className={`rounded-xl border p-3.5 transition-colors ${
                      isFocused
                        ? 'border-[#E5A93C]/60 bg-[#171B28]'
                        : 'border-white/[0.07] bg-[#121521]'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <img
                        src={char.avatar_url}
                        alt={char.name}
                        referrerPolicy="no-referrer"
                        className="h-14 w-12 shrink-0 rounded-lg border border-white/10 object-cover object-top"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[#F5F6FA]">
                          {char.name}
                        </p>
                        <p className="text-xs text-[#9BA2B4]">{char.role}</p>
                        <div className="mt-1.5 flex items-center justify-between text-[11px]">
                          <span className="text-[#E5A93C] font-medium">
                            {char.relationship_label}
                          </span>
                          <span className="font-mono tabular-nums text-[#8E96AA]">
                            {char.relationship_score > 0
                              ? `+${char.relationship_score}`
                              : char.relationship_score}
                          </span>
                        </div>
                        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/[0.08]">
                          <div
                            className={`h-full rounded-full ${
                              char.relationship_score >= 0
                                ? 'bg-[#E5A93C]'
                                : 'bg-rose-400'
                            }`}
                            style={{ width: `${meterPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 space-y-2 border-t border-white/[0.06] pt-2.5 text-xs">
                      <p className="text-[#C2C8D6]">
                        <span className="text-[#8E96AA]">Personality: </span>
                        {char.personality}
                      </p>
                      <p className="text-[#C2C8D6]">
                        <span className="text-[#8E96AA]">Motivation: </span>
                        {char.motivation}
                      </p>
                      {char.memories.length > 0 && (
                        <div>
                          <p className="text-[#8E96AA]">Remembers:</p>
                          <ul className="mt-1 space-y-1 text-[#D6DBE8]">
                            {char.memories.slice(-3).map((mem, idx) => (
                              <li key={idx} className="leading-snug">
                                · {mem}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {char.secrets.length > 0 && (
                        <div>
                          <p className="text-[#8E96AA]">Suspected Secrets:</p>
                          <ul className="mt-1 space-y-1 text-[#E5A93C]/90">
                            {char.secrets.map((sec, idx) => (
                              <li key={idx} className="leading-snug">
                                · {sec}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'clues' && (
          <div className="space-y-5">
            {state.clues.length === 0 ? (
              <p className="py-8 text-center text-xs text-[#8E96AA]">
                Clues, objects, and unresolved mysteries will record here automatically as you investigate.
              </p>
            ) : (
              <>
                {clues.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-[#E5A93C]">
                      Discovered Clues ({clues.length})
                    </p>
                    <ul className="mt-2 space-y-2.5">
                      {clues.map((c) => (
                        <li
                          key={c.id}
                          className="border-b border-white/[0.06] pb-2.5 last:border-0"
                        >
                          <p className="text-xs font-semibold text-[#F2F4F8]">{c.title}</p>
                          <p className="mt-0.5 text-xs leading-relaxed text-[#A3AABB]">
                            {c.description}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {objects.length > 0 && (
                  <div className="border-t border-white/[0.07] pt-4">
                    <p className="text-xs font-medium text-[#E5A93C]">
                      Inventory &amp; Key Objects ({objects.length})
                    </p>
                    <ul className="mt-2 space-y-2.5">
                      {objects.map((o) => (
                        <li
                          key={o.id}
                          className="border-b border-white/[0.06] pb-2.5 last:border-0"
                        >
                          <p className="text-xs font-semibold text-[#F2F4F8]">{o.title}</p>
                          <p className="mt-0.5 text-xs leading-relaxed text-[#A3AABB]">
                            {o.description}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {mysteries.length > 0 && (
                  <div className="border-t border-white/[0.07] pt-4">
                    <p className="text-xs font-medium text-[#E5A93C]">
                      Mysteries ({mysteries.length})
                    </p>
                    <ul className="mt-2 space-y-2.5">
                      {mysteries.map((m) => (
                        <li
                          key={m.id}
                          className="border-b border-white/[0.06] pb-2.5 last:border-0"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p
                              className={`text-xs font-semibold ${
                                m.status === 'resolved'
                                  ? 'line-through text-[#7F879A]'
                                  : 'text-[#F2F4F8]'
                              }`}
                            >
                              {m.title}
                            </p>
                            <span className="text-[11px] text-[#8E96AA]">
                              {m.status === 'resolved' ? 'Resolved' : 'Open'}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs leading-relaxed text-[#A3AABB]">
                            {m.description}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium text-[#9BA2B4]">
                Explored Scenes ({state.scenes.length})
              </p>
              <div className="mt-2 space-y-2">
                {state.scenes.map((sc) => {
                  const isCurrent = sc.id === state.progress.current_scene_id;
                  return (
                    <div
                      key={sc.id}
                      className={`rounded-lg border p-2.5 ${
                        isCurrent
                          ? 'border-[#E5A93C]/50 bg-[#171C29]'
                          : 'border-white/[0.07] bg-[#11141F]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] tabular-nums text-[#8E96AA]">
                          Ch {sc.chapter_number} · Sc {sc.scene_number}
                        </span>
                        {!isCurrent && (
                          <button
                            type="button"
                            onClick={() => onJumpToScene(sc.id)}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-[#E5A93C] hover:underline cursor-pointer"
                          >
                            <RotateCcw className="h-3 w-3" />
                            <span>Revisit</span>
                          </button>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs font-semibold text-[#F2F4F8]">
                        {sc.scene_title}
                      </p>
                      {sc.chosen_decision_text && (
                        <p className="mt-1 text-[11px] text-[#A3AABB] leading-snug">
                          Choice: “{sc.chosen_decision_text}”
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
