import { AnimatePresence, motion } from 'motion/react';
import { Eye, EyeOff, MapPin, Volume2, VolumeX } from 'lucide-react';
import { useMemo, useState } from 'react';
import { getAvatarForKey, getGenreByName } from '../data/catalog.ts';
import type {
  CharacterEmotion,
  MovementAction,
  ParticlePreset,
  StageCharacter,
  StoryScene,
} from '../types/story.ts';

interface AnimatedSceneStageProps {
  scene: StoryScene;
  genre: string;
  protagonistCustomImage?: string | null;
  isGenerating: boolean;
  onSelectCharacter: (characterName: string) => void;
}

const MOOD_OVERLAY: Record<string, string> = {
  tense: 'from-amber-950/35 via-[#090A0F]/45 to-[#090A0F]',
  ominous: 'from-rose-950/35 via-[#090A0F]/50 to-[#090A0F]',
  mysterious: 'from-indigo-950/35 via-[#090A0F]/45 to-[#090A0F]',
  warm: 'from-amber-900/30 via-[#090A0F]/40 to-[#090A0F]',
  wondrous: 'from-sky-950/30 via-[#090A0F]/40 to-[#090A0F]',
  urgent: 'from-orange-950/40 via-[#090A0F]/45 to-[#090A0F]',
  melancholic: 'from-slate-900/45 via-[#090A0F]/50 to-[#090A0F]',
};

const EMOTION_LABEL: Record<CharacterEmotion, string> = {
  calm: 'Composed',
  suspicious: 'Suspicious',
  alarmed: 'Alarmed',
  warm: 'Warm',
  guarded: 'Guarded',
  triumphant: 'Resolute',
  tense: 'On Edge',
  melancholic: 'Somber',
};

function getCharacterMotionVariants(action: MovementAction) {
  switch (action) {
    case 'step_forward':
      return {
        initial: { opacity: 0, y: 26, scale: 0.92 },
        animate: { opacity: 1, y: -6, scale: 1.04 },
      };
    case 'step_back':
      return {
        initial: { opacity: 0, y: 0, scale: 1.04 },
        animate: { opacity: 0.88, y: 12, scale: 0.93 },
      };
    case 'turn_away':
      return {
        initial: { opacity: 0, x: 0, rotate: 0 },
        animate: { opacity: 0.85, x: 10, rotate: -2.5 },
      };
    case 'lean_in':
      return {
        initial: { opacity: 0, y: 18, scale: 0.96 },
        animate: { opacity: 1, y: -4, scale: 1.05, rotate: 1.2 },
      };
    case 'enter_left':
      return {
        initial: { opacity: 0, x: -70, scale: 0.95 },
        animate: { opacity: 1, x: 0, scale: 1 },
      };
    case 'enter_right':
      return {
        initial: { opacity: 0, x: 70, scale: 0.95 },
        animate: { opacity: 1, x: 0, scale: 1 },
      };
    case 'confront':
      return {
        initial: { opacity: 0, y: 22, scale: 0.94 },
        animate: { opacity: 1, y: -10, scale: 1.07 },
      };
    default:
      return {
        initial: { opacity: 0, y: 14, scale: 0.97 },
        animate: { opacity: 1, y: 0, scale: 1 },
      };
  }
}

function getCameraAnimation(cameraMotion: string) {
  switch (cameraMotion) {
    case 'pan-left':
      return { scale: [1.06, 1.08, 1.06], x: ['1.5%', '-1.5%', '1.5%'] };
    case 'pan-right':
      return { scale: [1.06, 1.08, 1.06], x: ['-1.5%', '1.5%', '-1.5%'] };
    case 'dramatic-zoom':
      return { scale: [1, 1.09], x: ['0%', '0%'] };
    case 'steady':
      return { scale: 1.02, x: '0%' };
    default:
      return { scale: [1, 1.06, 1], x: ['0%', '-0.8%', '0%'] };
  }
}

function AmbientParticles({ preset }: { preset: ParticlePreset }) {
  const dots = useMemo(
    () =>
      Array.from({ length: 18 }, (_, i) => ({
        id: i,
        left: `${(i * 19 + 7) % 94}%`,
        top: `${(i * 23 + 11) % 86}%`,
        delay: `${(i % 6) * 0.85}s`,
        duration: `${4.5 + (i % 5) * 1.3}s`,
        size: preset === 'rain' ? 2 : 2 + (i % 3),
      })),
    [preset]
  );

  if (preset === 'rain') {
    return (
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-45">
        {dots.map((d) => (
          <motion.span
            key={d.id}
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 420, opacity: [0, 0.7, 0] }}
            transition={{
              duration: 1.1 + (d.id % 4) * 0.25,
              repeat: Infinity,
              delay: (d.id % 7) * 0.18,
              ease: 'linear',
            }}
            style={{ left: d.left }}
            className="absolute top-0 h-10 w-[1px] rotate-[12deg] bg-gradient-to-b from-transparent via-slate-200/70 to-transparent"
          />
        ))}
      </div>
    );
  }

  const colorClass =
    preset === 'embers'
      ? 'bg-[#E5A93C]/80 shadow-[0_0_8px_rgba(229,169,60,0.7)]'
      : preset === 'snow'
        ? 'bg-white/75'
        : preset === 'stars'
          ? 'bg-sky-200/80'
          : 'bg-slate-200/40';

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {dots.map((d) => (
        <motion.span
          key={d.id}
          animate={{
            y: preset === 'embers' ? [12, -34, 12] : preset === 'snow' ? [-14, 34, -14] : [-10, 12, -10],
            x: [0, d.id % 2 === 0 ? 12 : -12, 0],
            opacity: [0.15, 0.75, 0.15],
          }}
          transition={{
            duration: 5 + (d.id % 5) * 1.4,
            repeat: Infinity,
            delay: (d.id % 6) * 0.5,
            ease: 'easeInOut',
          }}
          style={{
            left: d.left,
            top: d.top,
            width: `${d.size}px`,
            height: `${d.size}px`,
          }}
          className={`absolute rounded-full ${colorClass}`}
        />
      ))}
    </div>
  );
}

export function AnimatedSceneStage({
  scene,
  genre,
  protagonistCustomImage,
  isGenerating,
  onSelectCharacter,
}: AnimatedSceneStageProps) {
  const [motionEnabled, setMotionEnabled] = useState(true);
  const [stageVisible, setStageVisible] = useState(true);
  const [imgError, setImgError] = useState(false);

  const genreDef = getGenreByName(genre);
  const moodGradient =
    MOOD_OVERLAY[scene.atmosphere_mood.toLowerCase()] || MOOD_OVERLAY.mysterious;

  // Order characters cleanly into left, center, right stage slots
  const stageSlots = useMemo(() => {
    const order: Record<string, number> = { left: 0, center: 1, right: 2 };
    return [...scene.characters_present].sort(
      (a, b) => (order[a.stage_position] ?? 1) - (order[b.stage_position] ?? 1)
    );
  }, [scene.characters_present]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.09] bg-[#0D1018]">
      {/* Top thin controls overlay */}
      <div className="absolute right-4 top-4 z-30 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMotionEnabled((m) => !m)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/15 bg-[#090A0F]/75 px-3 text-xs font-medium text-[#DDE1EC] backdrop-blur-md transition-colors hover:border-[#E5A93C]/50 cursor-pointer whitespace-nowrap"
          title={motionEnabled ? 'Pause stage animation' : 'Enable stage animation'}
        >
          {motionEnabled ? (
            <Volume2 className="h-3.5 w-3.5 text-[#E5A93C]" />
          ) : (
            <VolumeX className="h-3.5 w-3.5 text-[#8A92A6]" />
          )}
          <span>{motionEnabled ? 'Live Stage' : 'Static'}</span>
        </button>
        <button
          type="button"
          onClick={() => setStageVisible((v) => !v)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/15 bg-[#090A0F]/75 px-3 text-xs font-medium text-[#DDE1EC] backdrop-blur-md transition-colors hover:border-[#E5A93C]/50 cursor-pointer whitespace-nowrap"
        >
          {stageVisible ? (
            <EyeOff className="h-3.5 w-3.5 text-[#9BA2B4]" />
          ) : (
            <Eye className="h-3.5 w-3.5 text-[#E5A93C]" />
          )}
          <span>{stageVisible ? 'Hide Visual' : 'Show Visual'}</span>
        </button>
      </div>

      {stageVisible && (
        <div className="relative min-h-[340px] sm:min-h-[410px] lg:min-h-[440px] w-full overflow-hidden">
          {/* Animated Scene Backdrop */}
          <AnimatePresence mode="wait">
            <motion.div
              key={`${scene.id}-bg`}
              initial={{ opacity: 0.25 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0.2 }}
              transition={{ duration: 0.65 }}
              className="absolute inset-0"
            >
              {!imgError && scene.scene_image ? (
                <motion.img
                  src={scene.scene_image}
                  alt={`${scene.scene_title} — ${scene.current_location}`}
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                  animate={motionEnabled ? getCameraAnimation(scene.camera_motion) : undefined}
                  transition={{
                    duration: 18,
                    repeat: scene.camera_motion === 'dramatic-zoom' ? 0 : Infinity,
                    ease: 'easeInOut',
                  }}
                  className="h-full w-full object-cover object-center"
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-[#161B2B] via-[#0E111A] to-[#090A0F]" />
              )}
            </motion.div>
          </AnimatePresence>

          {/* Measured Scrim & Atmospheric Grading */}
          <div
            className={`pointer-events-none absolute inset-0 bg-gradient-to-t ${moodGradient}`}
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#090A0F]/75 via-transparent to-[#090A0F]/65" />

          {/* Dynamic Genre Particles */}
          {motionEnabled && <AmbientParticles preset={genreDef.particles} />}

          {/* Animated Characters Stage Layer */}
          <div className="relative z-20 flex min-h-[340px] sm:min-h-[410px] lg:min-h-[440px] flex-col justify-between p-5 sm:p-7">
            {/* Top-left clean unboxed scene metadata */}
            <div className="max-w-xl pr-36">
              <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-[#C8CDD9] font-mono tabular-nums">
                <span className="text-[#E5A93C]">
                  Chapter {scene.chapter_number}
                </span>
                <span aria-hidden="true">·</span>
                <span>Scene {scene.scene_number}</span>
                <span aria-hidden="true">·</span>
                <span className="font-sans text-[#D7DBE6]">{genre}</span>
              </div>
              <h2 className="mt-1.5 font-editorial text-2xl sm:text-3xl font-semibold tracking-tight text-[#F7F8FC] text-balance drop-shadow-sm">
                {scene.scene_title}
              </h2>
              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-[#C2C8D6]">
                <MapPin className="h-3.5 w-3.5 text-[#E5A93C] shrink-0" />
                <span>{scene.current_location}</span>
              </div>
            </div>

            {/* Interactive Animated Characters Positioning Grid */}
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
              {(['left', 'center', 'right'] as const).map((slot) => {
                const char = stageSlots.find((c) => c.stage_position === slot);
                if (!char) {
                  return <div key={slot} className="hidden sm:block" />;
                }
                const variants = getCharacterMotionVariants(char.movement_action);
                const avatar = getAvatarForKey(char.avatar_key, protagonistCustomImage);
                const isConfronting =
                  char.movement_action === 'confront' ||
                  char.movement_action === 'step_forward';

                return (
                  <AnimatePresence key={`${scene.id}-${char.name}`} mode="wait">
                    <motion.button
                      type="button"
                      onClick={() => onSelectCharacter(char.name)}
                      initial={motionEnabled ? variants.initial : false}
                      animate={motionEnabled ? variants.animate : { opacity: 1 }}
                      transition={{
                        duration: 0.55,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      whileHover={motionEnabled ? { y: -6 } : undefined}
                      className={`group relative flex items-end gap-3 rounded-xl border p-3 text-left backdrop-blur-md transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#E5A93C] ${
                        isConfronting
                          ? 'border-[#E5A93C]/45 bg-[#0D101A]/85 shadow-lg shadow-black/40'
                          : 'border-white/12 bg-[#0D101A]/75 hover:border-white/25'
                      }`}
                    >
                      {/* Animated character portrait with subtle breathing motion */}
                      <motion.div
                        animate={
                          motionEnabled
                            ? { y: [0, -2.5, 0] }
                            : undefined
                        }
                        transition={{
                          duration: 4.2,
                          repeat: Infinity,
                          ease: 'easeInOut',
                        }}
                        className="relative h-20 w-16 shrink-0 overflow-hidden rounded-lg border border-white/15 bg-[#151925]"
                      >
                        <img
                          src={avatar}
                          alt={char.name}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-105"
                        />
                      </motion.div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-[#F5F6FA]">
                            {char.name}
                          </span>
                          {char.relationship_delta !== 0 && (
                            <span
                              className={`font-mono text-xs font-medium tabular-nums shrink-0 ${
                                char.relationship_delta > 0
                                  ? 'text-emerald-400'
                                  : 'text-rose-400'
                              }`}
                            >
                              {char.relationship_delta > 0
                                ? `+${char.relationship_delta}`
                                : char.relationship_delta}{' '}
                              Trust
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[#A3AABB]">
                          <span className="truncate">{char.role}</span>
                          <span aria-hidden="true">·</span>
                          <span className="text-[#E5A93C] shrink-0">
                            {EMOTION_LABEL[char.emotion] || char.emotion}
                          </span>
                        </div>
                        {char.dialogue_line && (
                          <p className="mt-1.5 line-clamp-2 text-xs italic leading-relaxed text-[#E2E5EF]">
                            “{char.dialogue_line}”
                          </p>
                        )}
                      </div>
                    </motion.button>
                  </AnimatePresence>
                );
              })}
            </div>
          </div>

          {/* Subtle transition shimmer when AI is generating next scene */}
          {isGenerating && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#090A0F]/65 backdrop-blur-sm">
              <div className="text-center px-6">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#E5A93C]/25 border-t-[#E5A93C]" />
                <p className="mt-3 font-editorial text-lg text-[#F5F6FA]">
                  Directing the next scene...
                </p>
                <p className="mt-1 text-xs text-[#A3AABB]">
                  Updating character positions, memories, and consequences
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
