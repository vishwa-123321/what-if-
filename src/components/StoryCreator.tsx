import { ArrowRight, Shuffle, Upload, X } from 'lucide-react';
import { useState, type ChangeEvent, type FormEvent } from 'react';
import {
  CHARACTER_STYLE_PRESETS,
  GENRES,
  NARRATOR_PERSONALITIES,
  STORY_TEMPLATES,
  getGenreByName,
} from '../data/catalog.ts';
import type {
  CreateStoryInput,
  SettingMode,
  StoryDifficulty,
  StoryLength,
  StoryPerspective,
  StoryTemplate,
} from '../types/story.ts';

interface StoryCreatorProps {
  initialTemplate?: StoryTemplate | null;
  initialGenre?: string | null;
  isCreating: boolean;
  errorMessage: string | null;
  onCreate: (input: CreateStoryInput) => Promise<void>;
  onCancel: () => void;
}

function resizeImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxSide = 640;
        let { width, height } = img;
        if (width > maxSide || height > maxSide) {
          const ratio = Math.min(maxSide / width, maxSide / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Image processing failed.'));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => reject(new Error('Invalid image file.'));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });
}

export function StoryCreator({
  initialTemplate,
  initialGenre,
  isCreating,
  errorMessage,
  onCreate,
  onCancel,
}: StoryCreatorProps) {
  const defaultGenre =
    initialTemplate?.genre || initialGenre || GENRES[0].name;
  const genreDef = getGenreByName(defaultGenre);

  const [genre, setGenre] = useState(defaultGenre);
  const [title, setTitle] = useState(initialTemplate?.title || '');
  const [customTopic, setCustomTopic] = useState(initialTemplate?.premise || '');
  const [protagonistName, setProtagonistName] = useState(
    initialTemplate?.defaultProtagonist || 'Elena Vance'
  );
  const [protagonistPersonality, setProtagonistPersonality] = useState(
    initialTemplate?.defaultPersonality || 'Observant, principled, quick under pressure'
  );
  const [protagonistBackground, setProtagonistBackground] = useState(
    initialTemplate?.defaultBackground || ''
  );
  const [narratorPersonality, setNarratorPersonality] = useState(
    initialTemplate?.defaultNarrator || NARRATOR_PERSONALITIES[0].name
  );
  const [difficulty, setDifficulty] = useState<StoryDifficulty>('Balanced');
  const [storyLength, setStoryLength] = useState<StoryLength>('Medium');
  const [perspective, setPerspective] = useState<StoryPerspective>('Second-Person');
  const [atmosphere, setAtmosphere] = useState(
    initialTemplate?.atmosphere || genreDef.atmosphereDefault
  );
  const [settingMode, setSettingMode] = useState<SettingMode>(
    initialTemplate?.settingMode || 'Imaginative'
  );
  const [selectedPresetId, setSelectedPresetId] = useState<string>('elena');
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleGenreSelect = (genreName: string) => {
    setGenre(genreName);
    const def = getGenreByName(genreName);
    setAtmosphere(def.atmosphereDefault);
  };

  const handleRandomStory = () => {
    const pick =
      STORY_TEMPLATES[Math.floor(Math.random() * STORY_TEMPLATES.length)];
    const randNarrator =
      NARRATOR_PERSONALITIES[
        Math.floor(Math.random() * NARRATOR_PERSONALITIES.length)
      ];
    const randPreset =
      CHARACTER_STYLE_PRESETS[
        Math.floor(Math.random() * CHARACTER_STYLE_PRESETS.length)
      ];
    setGenre(pick.genre);
    setTitle(pick.title);
    setCustomTopic(pick.premise);
    setProtagonistName(pick.defaultProtagonist);
    setProtagonistPersonality(pick.defaultPersonality);
    setProtagonistBackground(pick.defaultBackground);
    setNarratorPersonality(randNarrator.name);
    setAtmosphere(pick.atmosphere);
    setSettingMode(pick.settingMode);
    setSelectedPresetId(randPreset.id);
    setUploadedImage(null);
  };

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    if (!file.type.startsWith('image/')) {
      setUploadError('Please upload a PNG, JPG, or WebP portrait image.');
      return;
    }
    try {
      const dataUrl = await resizeImageFile(file);
      setUploadedImage(dataUrl);
      setSelectedPresetId('custom');
    } catch (err: any) {
      setUploadError(err?.message || 'Unable to process image.');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isCreating) return;
    const selectedGenreDef = getGenreByName(genre);
    const fallbackTitle = title.trim() || `Chronicle of ${genre}`;
    const fallbackTopic =
      customTopic.trim() ||
      `An original ${genre.toLowerCase()} interactive adventure centered on ${protagonistName.trim() || 'the protagonist'} in a ${atmosphere.toLowerCase()} world.`;

    await onCreate({
      template_id: initialTemplate?.id || null,
      title: fallbackTitle,
      genre,
      custom_topic: fallbackTopic,
      protagonist_name: protagonistName.trim() || 'Elena Vance',
      protagonist_personality:
        protagonistPersonality.trim() || 'Observant and resolute',
      protagonist_background: protagonistBackground.trim(),
      character_style_image: uploadedImage,
      narrator_personality: narratorPersonality,
      difficulty,
      story_length: storyLength,
      perspective,
      atmosphere: atmosphere.trim() || selectedGenreDef.atmosphereDefault,
      setting_mode: settingMode,
      cover_image: initialTemplate?.coverImage || selectedGenreDef.coverImage,
    });
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div>
          <p className="text-xs font-medium text-[#E5A93C]">Story Studio</p>
          <h1 className="mt-1 font-editorial text-3xl sm:text-4xl font-semibold tracking-tight text-[#F7F8FC]">
            Craft Your Interactive World
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-[#A3AABB]">
            Shape your protagonist, upload a character style portrait, choose your AI narrator’s voice, and enter a branching chronicle with no scene limit.
          </p>
        </div>

        <button
          type="button"
          onClick={handleRandomStory}
          disabled={isCreating}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/15 bg-[#141825] px-4 py-2 text-sm font-medium text-[#ECEEF4] transition-colors hover:border-[#E5A93C]/50 cursor-pointer whitespace-nowrap"
        >
          <Shuffle className="h-4 w-4 text-[#E5A93C]" />
          <span>Random Story</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-8 space-y-10">
        {/* Step 1: Genre Selection (All 20 Genres) */}
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="font-editorial text-xl font-semibold text-[#F5F6FA]">
              01. Choose a Genre
            </h2>
            <span className="text-xs text-[#8E96AA]">20 narrative universes</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-5">
            {GENRES.map((g) => {
              const active = g.name === genre;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => handleGenreSelect(g.name)}
                  className={`min-h-[44px] rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition-colors cursor-pointer ${
                    active
                      ? 'border-[#E5A93C] bg-[#1D1B14] text-[#F7F8FC]'
                      : 'border-white/[0.08] bg-[#10131C] text-[#B8BFCE] hover:border-white/20 hover:text-white'
                  }`}
                >
                  {g.name}
                </button>
              );
            })}
          </div>
        </section>

        {/* Step 2: Story Identity & Premise */}
        <section className="grid grid-cols-1 gap-6 border-t border-white/[0.08] pt-8 md:grid-cols-2">
          <div className="md:col-span-2">
            <h2 className="font-editorial text-xl font-semibold text-[#F5F6FA]">
              02. Title &amp; Premise
            </h2>
          </div>

          <div>
            <label
              htmlFor="story-title"
              className="block text-xs font-medium text-[#A3AABB]"
            >
              Story Title
            </label>
            <input
              id="story-title"
              type="text"
              required
              maxLength={140}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., The Midnight Viaduct"
              className="mt-2 w-full min-h-[46px] rounded-xl border border-white/12 bg-[#0E111A] px-4 py-2.5 text-sm text-[#F5F6FA] placeholder-[#656D82] focus:border-[#E5A93C] focus:outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="story-atmosphere"
              className="block text-xs font-medium text-[#A3AABB]"
            >
              Atmosphere
            </label>
            <input
              id="story-atmosphere"
              type="text"
              maxLength={80}
              value={atmosphere}
              onChange={(e) => setAtmosphere(e.target.value)}
              placeholder="e.g., Moonlit Snow & Amber Carriage"
              className="mt-2 w-full min-h-[46px] rounded-xl border border-white/12 bg-[#0E111A] px-4 py-2.5 text-sm text-[#F5F6FA] placeholder-[#656D82] focus:border-[#E5A93C] focus:outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="story-topic"
              className="block text-xs font-medium text-[#A3AABB]"
            >
              Custom Topic or Opening Situation
            </label>
            <textarea
              id="story-topic"
              rows={3}
              required
              maxLength={1200}
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
              placeholder="Describe the world, mystery, or conflict you want to step into..."
              className="mt-2 w-full rounded-xl border border-white/12 bg-[#0E111A] px-4 py-3 text-sm leading-relaxed text-[#F5F6FA] placeholder-[#656D82] focus:border-[#E5A93C] focus:outline-none"
            />
          </div>
        </section>

        {/* Step 3: Protagonist & Character Style Image */}
        <section className="border-t border-white/[0.08] pt-8">
          <h2 className="font-editorial text-xl font-semibold text-[#F5F6FA]">
            03. Main Character &amp; Visual Style
          </h2>
          <p className="mt-1 text-xs text-[#9BA2B4]">
            Choose a visual archetype or upload your own character portrait image—our AI engine analyzes your uploaded style and animates your cast on stage.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Character Visual Selector + Custom Image Upload */}
            <div className="lg:col-span-5 space-y-3">
              <div className="grid grid-cols-3 gap-2.5">
                {CHARACTER_STYLE_PRESETS.map((preset) => {
                  const active = !uploadedImage && selectedPresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setUploadedImage(null);
                        setSelectedPresetId(preset.id);
                        if (!title) {
                          setProtagonistName(preset.name);
                          setProtagonistPersonality(preset.personality);
                        }
                      }}
                      className={`overflow-hidden rounded-xl border text-left transition-colors cursor-pointer ${
                        active
                          ? 'border-[#E5A93C] bg-[#1A1C24]'
                          : 'border-white/10 bg-[#10131C] hover:border-white/25'
                      }`}
                    >
                      <div className="aspect-[3/4] w-full overflow-hidden">
                        <img
                          src={preset.avatar}
                          alt={preset.name}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover object-top"
                        />
                      </div>
                      <div className="p-2">
                        <p className="truncate text-xs font-semibold text-[#F5F6FA]">
                          {preset.archetype}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Upload Custom Character Style Image */}
              <div className="rounded-xl border border-dashed border-white/15 bg-[#0E111A] p-3.5">
                {uploadedImage ? (
                  <div className="flex items-center gap-3">
                    <img
                      src={uploadedImage}
                      alt="Uploaded character style"
                      className="h-16 w-14 rounded-lg border border-[#E5A93C]/50 object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-[#F5F6FA]">
                        Custom Character Portrait Loaded
                      </p>
                      <p className="text-[11px] text-[#9BA2B4]">
                        AI will weave this visual aesthetic into your scenes.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setUploadedImage(null);
                        setSelectedPresetId('elena');
                      }}
                      aria-label="Remove uploaded portrait"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-[#A3AABB] hover:text-white cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <Upload className="h-4 w-4 text-[#E5A93C]" />
                      <div>
                        <p className="text-xs font-medium text-[#ECEEF4]">
                          Upload Character Style Image
                        </p>
                        <p className="text-[11px] text-[#8E96AA]">
                          PNG, JPG, or WebP portrait (optional)
                        </p>
                      </div>
                    </div>
                    <span className="rounded-lg border border-white/12 px-3 py-1.5 text-xs font-medium text-[#DDE1EC]">
                      Browse
                    </span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleImageUpload}
                      className="sr-only"
                    />
                  </label>
                )}
                {uploadError && (
                  <p className="mt-2 text-xs text-rose-400">{uploadError}</p>
                )}
              </div>
            </div>

            {/* Protagonist Fields */}
            <div className="lg:col-span-7 space-y-4">
              <div>
                <label
                  htmlFor="protagonist-name"
                  className="block text-xs font-medium text-[#A3AABB]"
                >
                  Main Character Name
                </label>
                <input
                  id="protagonist-name"
                  type="text"
                  required
                  maxLength={80}
                  value={protagonistName}
                  onChange={(e) => setProtagonistName(e.target.value)}
                  className="mt-1.5 w-full min-h-[44px] rounded-xl border border-white/12 bg-[#0E111A] px-4 py-2.5 text-sm text-[#F5F6FA] focus:border-[#E5A93C] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="protagonist-personality"
                  className="block text-xs font-medium text-[#A3AABB]"
                >
                  Character Personality
                </label>
                <input
                  id="protagonist-personality"
                  type="text"
                  required
                  maxLength={160}
                  value={protagonistPersonality}
                  onChange={(e) => setProtagonistPersonality(e.target.value)}
                  placeholder="e.g., Methodical, empathetic, skeptical of authority"
                  className="mt-1.5 w-full min-h-[44px] rounded-xl border border-white/12 bg-[#0E111A] px-4 py-2.5 text-sm text-[#F5F6FA] focus:border-[#E5A93C] focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="protagonist-bg"
                  className="block text-xs font-medium text-[#A3AABB]"
                >
                  Optional Character Background
                </label>
                <textarea
                  id="protagonist-bg"
                  rows={3}
                  maxLength={400}
                  value={protagonistBackground}
                  onChange={(e) => setProtagonistBackground(e.target.value)}
                  placeholder="Past history, secrets, profession, or personal stake in this journey..."
                  className="mt-1.5 w-full rounded-xl border border-white/12 bg-[#0E111A] px-4 py-2.5 text-sm text-[#F5F6FA] placeholder-[#656D82] focus:border-[#E5A93C] focus:outline-none"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Step 4: AI Narrator Personality & Engine Rules */}
        <section className="border-t border-white/[0.08] pt-8 space-y-6">
          <div>
            <h2 className="font-editorial text-xl font-semibold text-[#F5F6FA]">
              04. Narrative Personality &amp; Structure
            </h2>
            <p className="mt-1 text-xs text-[#9BA2B4]">
              Select the distinct storytelling voice driving prose rhythm, dialogue, and dramatic twists.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {NARRATOR_PERSONALITIES.map((np) => {
              const active = narratorPersonality === np.name;
              return (
                <button
                  key={np.id}
                  type="button"
                  onClick={() => setNarratorPersonality(np.name)}
                  className={`rounded-xl border p-4 text-left transition-colors cursor-pointer ${
                    active
                      ? 'border-[#E5A93C] bg-[#191A16]'
                      : 'border-white/[0.08] bg-[#10131C] hover:border-white/20'
                  }`}
                >
                  <p className="text-sm font-semibold text-[#F5F6FA]">{np.name}</p>
                  <p className="mt-1 text-xs leading-relaxed text-[#9BA2B4]">
                    {np.subtitle}
                  </p>
                </button>
              );
            })}
          </div>

          {/* 4 Segmented Controls Row */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs font-medium text-[#A3AABB]">Story Length</p>
              <div className="mt-2 grid grid-cols-3 gap-1 rounded-xl bg-[#0D1018] p-1 border border-white/[0.08]">
                {(['Short', 'Medium', 'Long'] as StoryLength[]).map((len) => (
                  <button
                    key={len}
                    type="button"
                    onClick={() => setStoryLength(len)}
                    className={`min-h-[38px] rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      storyLength === len
                        ? 'bg-[#E5A93C] text-[#0B0C10]'
                        : 'text-[#A3AABB] hover:text-white'
                    }`}
                  >
                    {len}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-[#A3AABB]">Difficulty</p>
              <div className="mt-2 grid grid-cols-3 gap-1 rounded-xl bg-[#0D1018] p-1 border border-white/[0.08]">
                {(['Story', 'Balanced', 'Unforgiving'] as StoryDifficulty[]).map(
                  (diff) => (
                    <button
                      key={diff}
                      type="button"
                      onClick={() => setDifficulty(diff)}
                      className={`min-h-[38px] rounded-lg px-1 text-xs font-medium transition-colors cursor-pointer truncate ${
                        difficulty === diff
                          ? 'bg-[#E5A93C] text-[#0B0C10]'
                          : 'text-[#A3AABB] hover:text-white'
                      }`}
                    >
                      {diff}
                    </button>
                  )
                )}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-[#A3AABB]">Narration</p>
              <div className="mt-2 grid grid-cols-3 gap-1 rounded-xl bg-[#0D1018] p-1 border border-white/[0.08]">
                {(
                  [
                    { val: 'First-Person', label: '1st' },
                    { val: 'Second-Person', label: '2nd' },
                    { val: 'Third-Person', label: '3rd' },
                  ] as const
                ).map((p) => (
                  <button
                    key={p.val}
                    type="button"
                    onClick={() => setPerspective(p.val)}
                    className={`min-h-[38px] rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      perspective === p.val
                        ? 'bg-[#E5A93C] text-[#0B0C10]'
                        : 'text-[#A3AABB] hover:text-white'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-[#A3AABB]">World Tone</p>
              <div className="mt-2 grid grid-cols-2 gap-1 rounded-xl bg-[#0D1018] p-1 border border-white/[0.08]">
                {(['Realistic', 'Imaginative'] as SettingMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setSettingMode(mode)}
                    className={`min-h-[38px] rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      settingMode === mode
                        ? 'bg-[#E5A93C] text-[#0B0C10]'
                        : 'text-[#A3AABB] hover:text-white'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {errorMessage && (
          <div
            role="alert"
            className="rounded-xl border border-rose-500/35 bg-rose-950/30 px-4 py-3 text-sm text-rose-100"
          >
            {errorMessage}
          </div>
        )}

        {/* Submit Actions */}
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-white/[0.08] pt-6">
          <button
            type="button"
            onClick={onCancel}
            disabled={isCreating}
            className="min-h-[46px] rounded-xl border border-white/12 px-5 py-2.5 text-sm font-medium text-[#CBD0DD] hover:border-white/25 hover:text-white cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isCreating}
            className="inline-flex min-h-[46px] items-center gap-2 rounded-xl bg-[#E5A93C] px-7 py-2.5 text-sm font-semibold text-[#0B0C10] transition-colors hover:bg-[#F0BC58] disabled:opacity-50 cursor-pointer"
          >
            <span>{isCreating ? 'Opening Scene Generating...' : 'Begin Adventure'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
