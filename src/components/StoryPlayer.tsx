import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Flag,
  GitBranch,
  Heart,
  PanelRightClose,
  PanelRightOpen,
  Pause,
  Play,
  RotateCcw,
  Send,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { DecisionOption, FullStoryState } from '../types/story.ts';
import { AnimatedSceneStage } from './AnimatedSceneStage.tsx';
import { BranchingTreeModal } from './BranchingTreeModal.tsx';
import { StoryDashboardSidebar } from './StoryDashboardSidebar.tsx';

interface StoryPlayerProps {
  state: FullStoryState;
  isGenerating: boolean;
  errorMessage: string | null;
  onContinue: (payload: {
    from_scene_id: string;
    decision_id?: string | null;
    decision_text: string;
    is_custom_action: boolean;
    finish_story?: boolean;
  }) => Promise<void>;
  onJumpToScene: (sceneId: string) => Promise<void>;
  onToggleSave: () => Promise<void>;
  onToggleFavourite: () => Promise<void>;
  onTogglePause: () => Promise<void>;
  onRestartStory: () => Promise<void>;
  onBack: () => void;
  onNewStory: () => void;
}

const ENDING_TITLES: Record<string, string> = {
  successful: 'Triumphant Resolution',
  unexpected: 'Unexpected Turn',
  secret: 'Secret Ending Uncovered',
  neutral: 'Quiet Resolution',
  failure: 'Dark Reckoning',
  alternative: 'Alternative Timeline Ending',
};

export function StoryPlayer({
  state,
  isGenerating,
  errorMessage,
  onContinue,
  onJumpToScene,
  onToggleSave,
  onToggleFavourite,
  onTogglePause,
  onRestartStory,
  onBack,
  onNewStory,
}: StoryPlayerProps) {
  const [selectedDecision, setSelectedDecision] = useState<DecisionOption | null>(null);
  const [customAction, setCustomAction] = useState('');
  const [dashboardOpen, setDashboardOpen] = useState(true);
  const [mobileDashboardOpen, setMobileDashboardOpen] = useState(false);
  const [treeOpen, setTreeOpen] = useState(false);
  const [focusedCharacter, setFocusedCharacter] = useState<string | null>(null);
  const [lastSubmitted, setLastSubmitted] = useState<{
    from_scene_id: string;
    decision_id?: string | null;
    decision_text: string;
    is_custom_action: boolean;
    finish_story?: boolean;
  } | null>(null);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);

  const scenes = Array.isArray(state?.scenes) ? state.scenes : [];
  const branches = Array.isArray(state?.branches) ? state.branches : [];
  const decisions = Array.isArray(state?.decisions) ? state.decisions : [];

  const currentScene =
    scenes.find((s) => s.id === state?.progress?.current_scene_id) ||
    scenes[scenes.length - 1];

  useEffect(() => {
    setSelectedDecision(null);
    setCustomAction('');
    setConfirmFinish(false);
    setConfirmRestart(false);
    stageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [currentScene?.id]);

  if (!currentScene) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center">
        <div className="rounded-2xl border border-white/[0.08] bg-[#0F121B] p-8">
          <h2 className="font-editorial text-2xl font-semibold text-[#F5F6FA]">
            Scene data unavailable
          </h2>
          <p className="mt-2 text-sm text-[#A3AABB]">
            This story does not have a saved scene yet. You can return to your library or start a fresh story.
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="min-h-[42px] rounded-xl border border-white/15 px-4 text-xs font-medium text-[#ECEEF4] hover:border-white/30 cursor-pointer"
            >
              Back to Library
            </button>
            <button
              type="button"
              onClick={onNewStory}
              className="min-h-[42px] rounded-xl bg-[#E5A93C] px-4 text-xs font-semibold text-[#0B0C10] hover:bg-[#F0BC58] cursor-pointer"
            >
              Start New Story
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmitAction = async () => {
    if (isGenerating) return;
    const trimmedCustom = customAction.trim();
    const isCustom = trimmedCustom.length > 0;
    const decisionText = isCustom ? trimmedCustom : selectedDecision?.text || '';
    if (!decisionText) return;

    const payload = {
      from_scene_id: currentScene.id,
      decision_id: isCustom ? null : selectedDecision?.id || null,
      decision_text: decisionText,
      is_custom_action: isCustom,
    };
    setLastSubmitted(payload);
    await onContinue(payload);
  };

  const handleFinishNow = async () => {
    if (isGenerating) return;
    const payload = {
      from_scene_id: currentScene.id,
      decision_id: null,
      decision_text:
        customAction.trim() ||
        selectedDecision?.text ||
        'Bring all active threads to a decisive climax and resolution.',
      is_custom_action: Boolean(customAction.trim()),
      finish_story: true,
    };
    setLastSubmitted(payload);
    setConfirmFinish(false);
    await onContinue(payload);
  };

  const handleRetry = async () => {
    if (!lastSubmitted || isGenerating) return;
    await onContinue(lastSubmitted);
  };

  const isPaused = state.story.status === 'paused';
  const canSubmit =
    !isGenerating &&
    !isPaused &&
    (customAction.trim().length > 0 || selectedDecision !== null);

  return (
    <div ref={stageRef} className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Compact Story Control Toolbar */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs font-medium text-[#CBD0DD] transition-colors hover:border-white/25 hover:text-white cursor-pointer whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Library</span>
          </button>
          <div className="min-w-0">
            <h1 className="truncate font-editorial text-lg sm:text-xl font-semibold text-[#F5F6FA]">
              {state.story.title}
            </h1>
            <p className="truncate text-xs text-[#8E96AA]">
              {state.story.genre} · {state.story.narrator_personality} ·{' '}
              <span className="font-mono tabular-nums">
                {decisions.length} decision{decisions.length === 1 ? '' : 's'}
              </span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTreeOpen(true)}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-white/12 bg-[#131723] px-3 text-xs font-medium text-[#ECEEF4] transition-colors hover:border-[#E5A93C]/50 cursor-pointer whitespace-nowrap"
          >
            <GitBranch className="h-3.5 w-3.5 text-[#E5A93C]" />
            <span>Branches ({branches.length})</span>
          </button>

          <button
            type="button"
            onClick={onToggleSave}
            className={`inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
              state.is_saved
                ? 'border-[#E5A93C]/50 bg-[#E5A93C]/12 text-[#E5A93C]'
                : 'border-white/12 bg-[#131723] text-[#CBD0DD] hover:border-white/25'
            }`}
          >
            <Bookmark className="h-3.5 w-3.5" />
            <span>{state.is_saved ? 'Saved' : 'Save'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleFavourite}
            aria-label={state.is_favourite ? 'Remove from favourites' : 'Add to favourites'}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border transition-colors cursor-pointer ${
              state.is_favourite
                ? 'border-rose-400/40 bg-rose-500/12 text-rose-400'
                : 'border-white/12 bg-[#131723] text-[#CBD0DD] hover:border-white/25'
            }`}
          >
            <Heart className={`h-4 w-4 ${state.is_favourite ? 'fill-current' : ''}`} />
          </button>

          {!currentScene.is_ending && (
            <button
              type="button"
              onClick={onTogglePause}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-white/12 bg-[#131723] px-3 text-xs font-medium text-[#CBD0DD] transition-colors hover:border-white/25 cursor-pointer whitespace-nowrap"
            >
              {isPaused ? (
                <>
                  <Play className="h-3.5 w-3.5 text-[#E5A93C]" />
                  <span>Resume</span>
                </>
              ) : (
                <>
                  <Pause className="h-3.5 w-3.5" />
                  <span>Pause</span>
                </>
              )}
            </button>
          )}

          {!currentScene.is_ending && (
            <button
              type="button"
              onClick={() => setConfirmFinish((v) => !v)}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-white/12 bg-[#131723] px-3 text-xs font-medium text-[#CBD0DD] transition-colors hover:border-[#E5A93C]/40 cursor-pointer whitespace-nowrap"
            >
              <Flag className="h-3.5 w-3.5" />
              <span>Finish Story</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setConfirmRestart((v) => !v)}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-white/12 bg-[#131723] px-3 text-xs font-medium text-[#CBD0DD] transition-colors hover:border-white/25 cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Restart</span>
          </button>

          <button
            type="button"
            onClick={() => setDashboardOpen((d) => !d)}
            className="hidden lg:inline-flex h-10 items-center gap-1.5 rounded-lg border border-white/12 bg-[#131723] px-3 text-xs font-medium text-[#CBD0DD] transition-colors hover:border-white/25 cursor-pointer whitespace-nowrap"
          >
            {dashboardOpen ? (
              <PanelRightClose className="h-4 w-4 text-[#E5A93C]" />
            ) : (
              <PanelRightOpen className="h-4 w-4 text-[#E5A93C]" />
            )}
            <span>Dossier</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileDashboardOpen(true)}
            className="inline-flex lg:hidden h-10 items-center gap-1.5 rounded-lg border border-white/12 bg-[#131723] px-3 text-xs font-medium text-[#CBD0DD] cursor-pointer whitespace-nowrap"
          >
            <PanelRightOpen className="h-4 w-4 text-[#E5A93C]" />
            <span>Dossier</span>
          </button>
        </div>
      </div>

      {/* Inline confirmation banners (no window.alert / window.confirm) */}
      {confirmFinish && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E5A93C]/40 bg-[#171510] px-4 py-3 text-sm">
          <p className="text-[#F2E6CE]">
            Ready to bring <strong>{state.story.title}</strong> to its climactic finale based on every choice so far?
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmFinish(false)}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-[#D6DBE8] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleFinishNow}
              disabled={isGenerating}
              className="rounded-lg bg-[#E5A93C] px-3.5 py-1.5 text-xs font-semibold text-[#0B0C10] hover:bg-[#F0BC58] cursor-pointer disabled:opacity-50"
            >
              Generate Finale
            </button>
          </div>
        </div>
      )}

      {confirmRestart && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/15 bg-[#141723] px-4 py-3 text-sm">
          <p className="text-[#DDE1EC]">
            Start a brand-new run of <strong>{state.story.title}</strong> from Chapter 1? (Your current run stays saved in My Stories.)
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmRestart(false)}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-medium text-[#D6DBE8] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={async () => {
                setConfirmRestart(false);
                await onRestartStory();
              }}
              disabled={isGenerating}
              className="rounded-lg bg-[#E5A93C] px-3.5 py-1.5 text-xs font-semibold text-[#0B0C10] hover:bg-[#F0BC58] cursor-pointer disabled:opacity-50"
            >
              Start Fresh Run
            </button>
          </div>
        </div>
      )}

      {/* Main Content + Collapsible Story Dashboard */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
        <div
          className={
            dashboardOpen ? 'space-y-6 lg:col-span-8' : 'space-y-6 lg:col-span-12'
          }
        >
          {/* Animated Scene Visual Theater */}
          <AnimatedSceneStage
            scene={currentScene}
            genre={state.story.genre}
            protagonistCustomImage={state.story.character_style_image}
            isGenerating={isGenerating}
            onSelectCharacter={(name) => {
              setFocusedCharacter(name);
              setDashboardOpen(true);
              if (window.innerWidth < 1024) setMobileDashboardOpen(true);
            }}
          />

          {/* Pause Notice */}
          {isPaused && !currentScene.is_ending && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E5A93C]/35 bg-[#161510] px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-[#F5F6FA]">Story Paused</p>
                <p className="text-xs text-[#B6BAC8]">
                  Your progress, clues, and character relationships are safely stored.
                </p>
              </div>
              <button
                type="button"
                onClick={onTogglePause}
                className="inline-flex items-center gap-2 rounded-lg bg-[#E5A93C] px-4 py-2 text-xs font-semibold text-[#0B0C10] hover:bg-[#F0BC58] cursor-pointer"
              >
                <Play className="h-3.5 w-3.5" />
                <span>Resume Story</span>
              </button>
            </div>
          )}

          {/* Story Narrative Panel (Reading-First Typography) */}
          <AnimatePresence mode="wait">
            <motion.article
              key={currentScene.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-2xl border border-white/[0.08] bg-[#0F121B] p-6 sm:p-8"
            >
              {/* Previous Consequences Recalled */}
              {currentScene.consequences.length > 0 && currentScene.scene_number > 1 && (
                <div className="mb-6 border-b border-white/[0.07] pb-4">
                  <p className="text-xs font-medium text-[#E5A93C]">
                    Immediate Consequences
                  </p>
                  <ul className="mt-1.5 space-y-1 text-sm text-[#C9CEDB]">
                    {currentScene.consequences.map((con, idx) => (
                      <li key={idx}>— {con}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Formatted Literary Narrative Paragraphs */}
              <div className="mx-auto max-w-[68ch] space-y-5 text-[16px] leading-[1.78] tracking-[0.008em] text-[#E8EBF2]">
                {currentScene.narrative_paragraphs.map((para, idx) => {
                  if (para.type === 'dialogue') {
                    return (
                      <div
                        key={idx}
                        className="rounded-xl border border-white/[0.07] bg-[#141825] px-5 py-3.5"
                      >
                        {para.speaker && (
                          <p className="mb-1 text-xs font-semibold text-[#E5A93C]">
                            {para.speaker}
                          </p>
                        )}
                        <p className="text-[#F4F6FA]">{para.text}</p>
                      </div>
                    );
                  }
                  if (para.type === 'thought') {
                    return (
                      <p key={idx} className="italic text-[#BDC4D6]">
                        {para.text}
                      </p>
                    );
                  }
                  if (para.type === 'action') {
                    return (
                      <p key={idx} className="font-medium text-[#F5F6FA]">
                        {para.text}
                      </p>
                    );
                  }
                  return <p key={idx}>{para.text}</p>;
                })}
              </div>

              {/* Current Situation Grounding Strip */}
              <div className="mt-8 grid grid-cols-1 gap-4 border-t border-white/[0.08] pt-6 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-[#8E96AA]">Where You Are</p>
                  <p className="mt-1 text-sm text-[#DFE3EE]">
                    {currentScene.situation_summary.where}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#8E96AA]">Who Is Present</p>
                  <p className="mt-1 text-sm text-[#DFE3EE]">
                    {currentScene.situation_summary.who_is_present.length > 0
                      ? currentScene.situation_summary.who_is_present.join(', ')
                      : 'Alone for the moment'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#8E96AA]">What Just Happened</p>
                  <p className="mt-1 text-sm text-[#DFE3EE]">
                    {currentScene.situation_summary.what_happened}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#8E96AA]">What You Currently Know</p>
                  <p className="mt-1 text-sm text-[#DFE3EE]">
                    {currentScene.situation_summary.what_you_know}
                  </p>
                </div>
              </div>
            </motion.article>
          </AnimatePresence>

          {/* Error Banner with Safe Retry */}
          {errorMessage && (
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-500/35 bg-rose-950/30 px-5 py-4 text-sm text-rose-100"
            >
              <div className="flex items-start gap-2.5">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                <div>
                  <p className="font-medium">Could not generate the next scene</p>
                  <p className="mt-0.5 text-xs text-rose-200/80">{errorMessage}</p>
                </div>
              </div>
              {lastSubmitted && (
                <button
                  type="button"
                  onClick={handleRetry}
                  disabled={isGenerating}
                  className="rounded-lg bg-rose-500/20 border border-rose-400/40 px-3.5 py-2 text-xs font-semibold text-rose-100 hover:bg-rose-500/30 cursor-pointer"
                >
                  Retry Action
                </button>
              )}
            </div>
          )}

          {/* Decision Section OR Ending Resolution */}
          {currentScene.is_ending ? (
            <section className="rounded-2xl border border-[#E5A93C]/35 bg-[#12151F] p-6 sm:p-8">
              <p className="font-mono text-xs tabular-nums text-[#E5A93C]">
                Story Complete · {state.decisions.length} Decisions · {state.branches.length} Branch
                {state.branches.length === 1 ? '' : 'es'}
              </p>
              <h2 className="mt-2 font-editorial text-2xl sm:text-3xl font-semibold text-[#F7F8FC]">
                {ENDING_TITLES[currentScene.ending_type || 'alternative'] ||
                  'Story Concluded'}
              </h2>
              {currentScene.ending_epilogue && (
                <p className="mt-4 max-w-[66ch] text-[15px] leading-relaxed text-[#D8DDE9]">
                  {currentScene.ending_epilogue}
                </p>
              )}

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setTreeOpen(true)}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#E5A93C] px-5 py-2.5 text-sm font-semibold text-[#0B0C10] transition-colors hover:bg-[#F0BC58] cursor-pointer"
                >
                  <GitBranch className="h-4 w-4" />
                  <span>Explore Alternate Branch</span>
                </button>
                <button
                  type="button"
                  onClick={onRestartStory}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/15 bg-[#181C29] px-5 py-2.5 text-sm font-medium text-[#ECEEF4] transition-colors hover:border-white/30 cursor-pointer"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Replay Story</span>
                </button>
                <button
                  type="button"
                  onClick={onNewStory}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/12 px-5 py-2.5 text-sm font-medium text-[#CBD0DD] transition-colors hover:text-white cursor-pointer"
                >
                  <span>Start Another Adventure</span>
                </button>
              </div>
            </section>
          ) : (
            <section
              aria-label="Choose Your Action"
              className="rounded-2xl border border-white/[0.08] bg-[#0F121B] p-6 sm:p-7"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-editorial text-xl font-semibold text-[#F5F6FA]">
                  What will you do?
                </h2>
                <span className="text-xs text-[#8E96AA]">
                  Select a decision below or write your own custom action
                </span>
              </div>

              {/* Contextual Decision Cards */}
              <div className="mt-4 grid grid-cols-1 gap-3">
                {currentScene.available_decisions.map((decision, idx) => {
                  const isSelected =
                    selectedDecision?.id === decision.id &&
                    customAction.trim().length === 0;
                  return (
                    <button
                      key={decision.id}
                      type="button"
                      disabled={isGenerating || isPaused}
                      onClick={() => {
                        setCustomAction('');
                        setSelectedDecision(decision);
                      }}
                      className={`group flex items-start gap-4 rounded-xl border p-4 text-left transition-all cursor-pointer disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-[#E5A93C] ${
                        isSelected
                          ? 'border-[#E5A93C] bg-[#191C26]'
                          : 'border-white/[0.09] bg-[#131723] hover:border-white/25 hover:bg-[#171B29]'
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono text-xs font-semibold tabular-nums transition-colors ${
                          isSelected
                            ? 'bg-[#E5A93C] text-[#0B0C10]'
                            : 'bg-white/[0.06] text-[#A3AABB] group-hover:text-white'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-medium text-[#F4F6FA]">
                            {decision.text}
                          </span>
                          <span className="text-xs font-medium text-[#E5A93C]/85 shrink-0">
                            {decision.intent_tag}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-[#9BA2B4]">
                          {decision.consequence_hint}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Custom Action Input + Continue Button */}
              <div className="mt-5 border-t border-white/[0.08] pt-5">
                <label
                  htmlFor="custom-action-input"
                  className="block text-xs font-medium text-[#A3AABB]"
                >
                  Or write any custom action
                </label>
                <div className="mt-2 flex flex-col gap-3 sm:flex-row">
                  <input
                    id="custom-action-input"
                    type="text"
                    value={customAction}
                    disabled={isGenerating || isPaused}
                    onChange={(e) => {
                      setCustomAction(e.target.value);
                      if (e.target.value.trim().length > 0) {
                        setSelectedDecision(null);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && canSubmit) {
                        e.preventDefault();
                        handleSubmitAction();
                      }
                    }}
                    maxLength={600}
                    placeholder="e.g., Hide the photograph, pretend I saw nothing, and quietly watch who checks the luggage..."
                    className="min-h-[46px] flex-1 rounded-xl border border-white/12 bg-[#0B0D14] px-4 py-2.5 text-sm text-[#F5F6FA] placeholder-[#6B7387] focus:border-[#E5A93C] focus:outline-none disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={handleSubmitAction}
                    disabled={!canSubmit}
                    className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-[#E5A93C] px-6 py-2.5 text-sm font-semibold text-[#0B0C10] transition-colors hover:bg-[#F0BC58] disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {isGenerating ? (
                      <span>Generating...</span>
                    ) : customAction.trim().length > 0 ? (
                      <>
                        <Send className="h-4 w-4" />
                        <span>Take Custom Action</span>
                      </>
                    ) : (
                      <>
                        <span>Continue</span>
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Desktop Collapsible Story Dashboard */}
        {dashboardOpen && (
          <div className="hidden lg:block lg:col-span-4 lg:sticky lg:top-20 lg:h-[calc(100vh-6.5rem)]">
            <StoryDashboardSidebar
              state={state}
              focusedCharacterName={focusedCharacter}
              onClearFocusedCharacter={() => setFocusedCharacter(null)}
              onJumpToScene={onJumpToScene}
            />
          </div>
        )}
      </div>

      {/* Mobile Slide-Over Story Dashboard */}
      {mobileDashboardOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-sm lg:hidden">
          <div className="h-full w-full max-w-sm p-3">
            <StoryDashboardSidebar
              state={state}
              focusedCharacterName={focusedCharacter}
              onClearFocusedCharacter={() => setFocusedCharacter(null)}
              onJumpToScene={async (sceneId) => {
                setMobileDashboardOpen(false);
                await onJumpToScene(sceneId);
              }}
              onCloseMobile={() => setMobileDashboardOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Interactive Branching Narrative Tree Modal */}
      {treeOpen && (
        <BranchingTreeModal
          state={state}
          onClose={() => setTreeOpen(false)}
          onJumpToScene={onJumpToScene}
        />
      )}
    </div>
  );
}
