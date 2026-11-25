import { GoogleGenAI, Type } from '@google/genai';
import {
  GENRES,
  NARRATOR_PERSONALITIES,
  getCoverImageForGenre,
} from '../src/data/catalog.ts';
import type {
  CharacterEmotion,
  EndingType,
  FullStoryState,
  MovementAction,
  NarrativeParagraph,
  StageCharacter,
  StagePosition,
  StoryRecord,
} from '../src/types/story.ts';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please add your Gemini API key in Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export interface GeneratedScenePayload {
  chapter_number: number;
  scene_number: number;
  scene_title: string;
  narrative_paragraphs: NarrativeParagraph[];
  current_location: string;
  atmosphere_mood: string;
  camera_motion: string;
  situation_summary: {
    where: string;
    who_is_present: string[];
    what_happened: string;
    what_you_know: string;
  };
  characters_present: StageCharacter[];
  events: string[];
  new_clues: Array<{
    item_type: 'clue' | 'object' | 'mystery';
    title: string;
    description: string;
  }>;
  resolved_mysteries: string[];
  consequences: string[];
  current_objective: string;
  available_decisions: Array<{
    id: string;
    text: string;
    consequence_hint: string;
    intent_tag: string;
  }>;
  story_summary_update: string;
  progress_percent: number;
  is_ending: boolean;
  ending_type: EndingType;
  ending_epilogue: string | null;
}

const SCENE_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    chapter_number: { type: Type.INTEGER },
    scene_number: { type: Type.INTEGER },
    scene_title: { type: Type.STRING },
    narrative_paragraphs: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: {
            type: Type.STRING,
            description: 'One of: prose, dialogue, thought, action',
          },
          speaker: {
            type: Type.STRING,
            description: 'Speaker name if type is dialogue, else empty string',
          },
          text: { type: Type.STRING },
        },
        required: ['type', 'text'],
      },
    },
    current_location: { type: Type.STRING },
    atmosphere_mood: {
      type: Type.STRING,
      description: 'Short atmospheric cue such as tense, mysterious, ominous, warm, wondrous, urgent, melancholic',
    },
    camera_motion: {
      type: Type.STRING,
      description: 'One of: slow-push, pan-left, pan-right, dramatic-zoom, steady',
    },
    situation_summary: {
      type: Type.OBJECT,
      properties: {
        where: { type: Type.STRING },
        who_is_present: { type: Type.ARRAY, items: { type: Type.STRING } },
        what_happened: { type: Type.STRING },
        what_you_know: { type: Type.STRING },
      },
      required: ['where', 'who_is_present', 'what_happened', 'what_you_know'],
    },
    characters_present: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          role: { type: Type.STRING },
          emotion: {
            type: Type.STRING,
            description: 'One of: calm, suspicious, alarmed, warm, guarded, triumphant, tense, melancholic',
          },
          stage_position: {
            type: Type.STRING,
            description: 'One of: left, center, right',
          },
          movement_action: {
            type: Type.STRING,
            description: 'One of: step_forward, step_back, turn_away, lean_in, enter_left, enter_right, confront, idle',
          },
          dialogue_line: {
            type: Type.STRING,
            description: 'Short vivid spoken line or reaction on stage (optional)',
          },
          relationship_delta: {
            type: Type.INTEGER,
            description: 'Change in trust/relationship from -25 to +25 based on the latest decision',
          },
          relationship_reason: {
            type: Type.STRING,
            description: 'Why the relationship shifted, if non-zero',
          },
          personality: { type: Type.STRING },
          motivation: { type: Type.STRING },
          dialogue_style: { type: Type.STRING },
          secret_hint: { type: Type.STRING },
          avatar_key: {
            type: Type.STRING,
            description: 'One of: elena, kaelen, nyx, protagonist, silhouette',
          },
        },
        required: [
          'name',
          'role',
          'emotion',
          'stage_position',
          'movement_action',
          'relationship_delta',
          'personality',
          'motivation',
          'avatar_key',
        ],
      },
    },
    events: { type: Type.ARRAY, items: { type: Type.STRING } },
    new_clues: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          item_type: {
            type: Type.STRING,
            description: 'One of: clue, object, mystery',
          },
          title: { type: Type.STRING },
          description: { type: Type.STRING },
        },
        required: ['item_type', 'title', 'description'],
      },
    },
    resolved_mysteries: { type: Type.ARRAY, items: { type: Type.STRING } },
    consequences: { type: Type.ARRAY, items: { type: Type.STRING } },
    current_objective: { type: Type.STRING },
    available_decisions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          text: { type: Type.STRING },
          consequence_hint: { type: Type.STRING },
          intent_tag: {
            type: Type.STRING,
            description: 'Single word like Investigate, Confront, Stealth, Persuade, Inspect, Retreat, Improvise',
          },
        },
        required: ['id', 'text', 'consequence_hint', 'intent_tag'],
      },
    },
    story_summary_update: {
      type: Type.STRING,
      description: 'Concise 2-4 sentence cumulative memory summary capturing all major established facts, decisions, clues, and relationship shifts so far.',
    },
    progress_percent: {
      type: Type.INTEGER,
      description: 'Estimated narrative arc progress from 5 to 100',
    },
    is_ending: { type: Type.BOOLEAN },
    ending_type: {
      type: Type.STRING,
      description: 'If is_ending is true, one of: successful, unexpected, secret, neutral, failure, alternative. Otherwise empty string.',
    },
    ending_epilogue: {
      type: Type.STRING,
      description: 'If is_ending is true, a memorable 1-2 paragraph epilogue reflecting the user decisions. Otherwise empty string.',
    },
  },
  required: [
    'chapter_number',
    'scene_number',
    'scene_title',
    'narrative_paragraphs',
    'current_location',
    'atmosphere_mood',
    'camera_motion',
    'situation_summary',
    'characters_present',
    'events',
    'new_clues',
    'resolved_mysteries',
    'consequences',
    'current_objective',
    'available_decisions',
    'story_summary_update',
    'progress_percent',
    'is_ending',
    'ending_type',
    'ending_epilogue',
  ],
};

function buildSystemInstruction(story: StoryRecord): string {
  const genreDef =
    GENRES.find((g) => g.name.toLowerCase() === story.genre.toLowerCase()) ||
    GENRES[0];
  const narrator =
    NARRATOR_PERSONALITIES.find(
      (n) => n.name.toLowerCase() === story.narrator_personality.toLowerCase()
    ) || NARRATOR_PERSONALITIES[0];

  const lengthGuidance =
    story.story_length === 'Short'
      ? 'SHORT ARC (target 7 to 10 scenes across 2-3 chapters). Do NOT end before scene 6 unless the player explicitly requests Finish Story or makes a catastrophically fatal choice on Unforgiving difficulty.'
      : story.story_length === 'Long'
        ? 'LONG SAGA (target 20 to 30+ scenes across 5-8 chapters). Build deep multi-chapter developments, evolving alliances, mid-story turning points, and layered revelations. NEVER rush to an ending early.'
        : 'MEDIUM CHRONICLE (target 12 to 18 scenes across 3-5 chapters). Pace introduction, rising tension, turning points, climax, and resolution organically. NEVER end after 3 or 4 decisions.';

  return [
    `You are the WHAT IF 3.0 Interactive Story Engine — a world-class branching narrative architect and stage director.`,
    `NARRATOR PERSONALITY (${narrator.name}): ${narrator.voiceDirective}`,
    `GENRE (${genreDef.name}): ${genreDef.narrativeStyle}. Atmosphere: ${story.atmosphere}. Setting Mode: ${story.setting_mode}.`,
    `PERSPECTIVE: ${story.perspective}. DIFFICULTY: ${story.difficulty}.`,
    `PACING & LENGTH RULE: ${lengthGuidance}`,
    `CRITICAL RULES:`,
    `1. NEVER act like a generic chatbot. Write vivid, playable, literary interactive fiction broken into 3-6 readable paragraphs mixing atmospheric prose, crisp character dialogue, and tactile action beats.`,
    `2. CONTEXT-AWARE DECISIONS ONLY: Every scene (unless is_ending=true) MUST offer 4 to 5 sharply distinct, concrete decisions grounded strictly in what is physically present, known, and possible RIGHT NOW. Never offer random or repetitive filler choices.`,
    `3. TRUE CONSEQUENCES & CONTINUITY: Honor EVERY previous decision, discovered clue, item, and character relationship. Never contradict established facts or pretend the player chose differently. Characters remember how the player treated them and shift trust/behavior accordingly.`,
    `4. CUSTOM ACTION HANDLING: If the player enters a custom action, execute it faithfully and reshape the scene around it. If the custom action is physically impossible under established circumstances, narrate organically why it cannot succeed right now while keeping momentum alive and giving fresh options.`,
    `5. ANIMATED STAGE DIRECTION: Include 1 to 3 characters present in the scene in characters_present (including key NPCs—and optionally the protagonist when dramatically appropriate—distinct stage_position left/center/right so they never stack on the same spot). Choose dynamic movement_action (step_forward, step_back, turn_away, lean_in, enter_left, enter_right, confront, idle) and emotion reflecting how they physically react to the player's latest decision! Assign avatar_key consistently per character across scenes (elena, kaelen, nyx, protagonist, or silhouette).`,
    `6. NO PREMATURE ENDINGS: Never stop after 3 decisions! Only set is_ending=true when the central arc has genuinely reached a satisfying climax & resolution OR the prompt explicitly says USER_REQUESTED_ENDING=true.`,
    `7. Return strictly valid JSON conforming to the responseSchema.`,
  ].join('\n');
}

function normalizeScenePayload(
  raw: Record<string, unknown>,
  expectedChapter: number,
  expectedScene: number
): GeneratedScenePayload {
  const validEmotions: CharacterEmotion[] = [
    'calm',
    'suspicious',
    'alarmed',
    'warm',
    'guarded',
    'triumphant',
    'tense',
    'melancholic',
  ];
  const validPositions: StagePosition[] = ['left', 'center', 'right'];
  const validMoves: MovementAction[] = [
    'step_forward',
    'step_back',
    'turn_away',
    'lean_in',
    'enter_left',
    'enter_right',
    'confront',
    'idle',
  ];
  const validEndings: Array<Exclude<EndingType, null>> = [
    'successful',
    'unexpected',
    'secret',
    'neutral',
    'failure',
    'alternative',
  ];

  const paragraphsRaw = Array.isArray(raw.narrative_paragraphs)
    ? raw.narrative_paragraphs
    : [];
  const narrative_paragraphs: NarrativeParagraph[] = paragraphsRaw
    .map((p: any) => ({
      type: (['prose', 'dialogue', 'thought', 'action'].includes(p?.type)
        ? p.type
        : 'prose') as NarrativeParagraph['type'],
      speaker: typeof p?.speaker === 'string' && p.speaker.trim() ? p.speaker.trim() : undefined,
      text: String(p?.text || '').trim(),
    }))
    .filter((p) => p.text.length > 0);

  if (narrative_paragraphs.length === 0) {
    narrative_paragraphs.push({
      type: 'prose',
      text: 'The room settles into expectant silence as the consequences of your last move ripple outward.',
    });
  }

  const usedPositions = new Set<StagePosition>();
  const charactersRaw = Array.isArray(raw.characters_present)
    ? raw.characters_present.slice(0, 3)
    : [];
  const characters_present: StageCharacter[] = charactersRaw.map((c: any, idx: number) => {
    let pos: StagePosition = validPositions.includes(c?.stage_position)
      ? c.stage_position
      : validPositions[idx % 3];
    if (usedPositions.has(pos)) {
      pos = validPositions.find((p) => !usedPositions.has(p)) || pos;
    }
    usedPositions.add(pos);

    const avatarKey = ['elena', 'kaelen', 'nyx', 'protagonist', 'silhouette'].includes(
      c?.avatar_key
    )
      ? c.avatar_key
      : (['elena', 'kaelen', 'nyx'][idx % 3] as StageCharacter['avatar_key']);

    return {
      name: String(c?.name || `Stranger ${idx + 1}`).trim(),
      role: String(c?.role || 'Companion').trim(),
      emotion: (validEmotions.includes(c?.emotion)
        ? c.emotion
        : 'calm') as CharacterEmotion,
      stage_position: pos,
      movement_action: (validMoves.includes(c?.movement_action)
        ? c.movement_action
        : 'idle') as MovementAction,
      dialogue_line:
        typeof c?.dialogue_line === 'string' && c.dialogue_line.trim()
          ? c.dialogue_line.trim()
          : undefined,
      relationship_delta: Math.max(
        -25,
        Math.min(25, Number.isFinite(Number(c?.relationship_delta)) ? Number(c.relationship_delta) : 0)
      ),
      relationship_reason:
        typeof c?.relationship_reason === 'string' && c.relationship_reason.trim()
          ? c.relationship_reason.trim()
          : undefined,
      personality: String(c?.personality || 'Guarded and observant').trim(),
      motivation: String(c?.motivation || 'Protecting their own agenda').trim(),
      dialogue_style:
        typeof c?.dialogue_style === 'string' ? c.dialogue_style.trim() : undefined,
      secret_hint:
        typeof c?.secret_hint === 'string' && c.secret_hint.trim()
          ? c.secret_hint.trim()
          : undefined,
      avatar_key: avatarKey,
    };
  });

  const is_ending = Boolean(raw.is_ending);
  const rawEndingType = String(raw.ending_type || '').toLowerCase();
  const ending_type: EndingType = is_ending
    ? (validEndings.includes(rawEndingType as any)
        ? (rawEndingType as EndingType)
        : 'alternative')
    : null;

  const decisionsRaw = Array.isArray(raw.available_decisions)
    ? raw.available_decisions
    : [];
  const available_decisions = is_ending
    ? []
    : decisionsRaw
        .slice(0, 6)
        .map((d: any, idx: number) => ({
          id: String(d?.id || `choice_${idx + 1}`),
          text: String(d?.text || '').trim(),
          consequence_hint: String(d?.consequence_hint || 'Shifts the scene forward').trim(),
          intent_tag: String(d?.intent_tag || 'Act').trim(),
        }))
        .filter((d) => d.text.length > 0);

  const sit: any = raw.situation_summary || {};
  const newCluesRaw = Array.isArray(raw.new_clues) ? raw.new_clues : [];

  return {
    chapter_number: Math.max(1, Number(raw.chapter_number) || expectedChapter),
    scene_number: Math.max(1, Number(raw.scene_number) || expectedScene),
    scene_title: String(raw.scene_title || `Scene ${expectedScene}`).trim(),
    narrative_paragraphs,
    current_location: String(raw.current_location || 'Uncharted Crossing').trim(),
    atmosphere_mood: String(raw.atmosphere_mood || 'mysterious').trim(),
    camera_motion: String(raw.camera_motion || 'slow-push').trim(),
    situation_summary: {
      where: String(sit.where || raw.current_location || 'Unknown location').trim(),
      who_is_present: Array.isArray(sit.who_is_present)
        ? sit.who_is_present.map((s: any) => String(s))
        : characters_present.map((c) => c.name),
      what_happened: String(sit.what_happened || 'The situation has shifted.').trim(),
      what_you_know: String(sit.what_you_know || 'Key questions remain open.').trim(),
    },
    characters_present,
    events: Array.isArray(raw.events) ? raw.events.map((e: any) => String(e)) : [],
    new_clues: newCluesRaw
      .map((cl: any) => ({
        item_type: (['clue', 'object', 'mystery'].includes(cl?.item_type)
          ? cl.item_type
          : 'clue') as 'clue' | 'object' | 'mystery',
        title: String(cl?.title || '').trim(),
        description: String(cl?.description || '').trim(),
      }))
      .filter((cl) => cl.title.length > 0),
    resolved_mysteries: Array.isArray(raw.resolved_mysteries)
      ? raw.resolved_mysteries.map((m: any) => String(m))
      : [],
    consequences: Array.isArray(raw.consequences)
      ? raw.consequences.map((c: any) => String(c))
      : [],
    current_objective: String(raw.current_objective || 'Uncover what comes next').trim(),
    available_decisions,
    story_summary_update: String(raw.story_summary_update || '').trim(),
    progress_percent: Math.max(
      5,
      Math.min(100, Number(raw.progress_percent) || (is_ending ? 100 : Math.min(92, expectedScene * 7)))
    ),
    is_ending,
    ending_type,
    ending_epilogue:
      is_ending && typeof raw.ending_epilogue === 'string' && raw.ending_epilogue.trim()
        ? raw.ending_epilogue.trim()
        : null,
  };
}

async function callGeminiWithRetry(
  contents: any,
  systemInstruction: string
): Promise<Record<string, unknown>> {
  const ai = getAiClient();
  const models = ['gemini-4-hydrogen', 'gemini-3.8-flash'];
  let lastError: unknown;

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: SCENE_RESPONSE_SCHEMA,
          },
        });

        const rawText = (response.text ?? '').trim();
        if (!rawText) {
          throw new Error('Empty response from Gemini story engine');
        }
        const cleaned = rawText
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/\s*```$/, '')
          .trim();
        return JSON.parse(cleaned);
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        const isTransient =
          msg.includes('503') ||
          msg.includes('UNAVAILABLE') ||
          msg.includes('429') ||
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('overloaded');
        if (isTransient && attempt === 0) {
          await new Promise((r) => setTimeout(r, 600));
          continue;
        }
        // On persistent transient/model error, break to try fallback model
        break;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Failed to generate story scene.');
}

function parseDataUrlImage(dataUrl: string | null): { mimeType: string; data: string } | null {
  if (!dataUrl || !dataUrl.startsWith('data:image/')) return null;
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/i);
  if (!match) return null;
  const mimeType = match[1].toLowerCase() === 'image/jpg' ? 'image/jpeg' : match[1].toLowerCase();
  // Guard against overly huge payloads
  if (match[2].length > 3_500_000) return null;
  return { mimeType, data: match[2] };
}

export async function generateOpeningScene(
  story: StoryRecord
): Promise<GeneratedScenePayload> {
  const promptText = [
    `BEGIN NEW INTERACTIVE STORY:`,
    `Title: ${story.title}`,
    `Genre: ${story.genre}`,
    `Premise / Topic: ${story.custom_topic}`,
    `Main Character: ${story.protagonist_name}`,
    `Character Personality: ${story.protagonist_personality}`,
    `Character Background: ${story.protagonist_background || 'To be revealed through play'}`,
    `Narrator Style: ${story.narrator_personality}`,
    `Atmosphere: ${story.atmosphere}`,
    `Setting Mode: ${story.setting_mode}`,
    `Story Length: ${story.story_length}`,
    `Difficulty: ${story.difficulty}`,
    story.character_style_image
      ? `NOTE: The user provided a visual reference image for their protagonist/character aesthetic. Weave subtle visual details (wardrobe, demeanor, presence) naturally into the opening scene.`
      : '',
    `TASK: Generate Chapter 1, Scene 1.`,
    `- Establish the vivid setting, central inciting conflict, and 1-2 memorable interactive NPCs physically present on stage (using distinct stage_position values and animated movement_action).`,
    `- Plant 1-2 tangible initial clues, objects, or unresolved mysteries in new_clues.`,
    `- Present 4-5 deeply contextual, distinct decisions in available_decisions.`,
    `- Set is_ending=false and progress_percent=8.`,
  ]
    .filter(Boolean)
    .join('\n');

  const imagePart = parseDataUrlImage(story.character_style_image);
  const contents = imagePart
    ? {
        parts: [
          { inlineData: imagePart },
          { text: promptText },
        ],
      }
    : promptText;

  const raw = await callGeminiWithRetry(contents, buildSystemInstruction(story));
  return normalizeScenePayload(raw, 1, 1);
}

export async function generateNextScene(
  state: FullStoryState,
  decisionText: string,
  isCustomAction: boolean,
  options?: { finishStory?: boolean; branchName?: string }
): Promise<GeneratedScenePayload> {
  const { story, progress, scenes, characters, clues, decisions } = state;

  // Build ordered branch lineage leading to current scene
  const sceneMap = new Map(scenes.map((s) => [s.id, s]));
  const lineage: typeof scenes = [];
  let cursor: (typeof scenes)[number] | undefined =
    sceneMap.get(progress.current_scene_id) || scenes[scenes.length - 1];
  const visited = new Set<string>();
  while (cursor && !visited.has(cursor.id)) {
    visited.add(cursor.id);
    lineage.unshift(cursor);
    cursor = cursor.parent_scene_id ? sceneMap.get(cursor.parent_scene_id) : undefined;
  }

  const latestScene = lineage[lineage.length - 1];
  const recentScenes = lineage.slice(-4);

  const nextSceneNumber = (latestScene?.scene_number || progress.current_scene_number) + 1;
  const currentChapter = latestScene?.chapter_number || progress.current_chapter;
  const shouldAdvanceChapter =
    nextSceneNumber > 1 && nextSceneNumber % 4 === 1;
  const suggestedChapter = shouldAdvanceChapter ? currentChapter + 1 : currentChapter;

  const memoryBlock = {
    story_id: story.id,
    story_title: story.title,
    genre: story.genre,
    protagonist: {
      name: story.protagonist_name,
      personality: story.protagonist_personality,
      background: story.protagonist_background,
    },
    current_chapter: currentChapter,
    current_scene_number: latestScene?.scene_number || progress.current_scene_number,
    total_decisions_so_far: decisions.length + 1,
    active_branch: options?.branchName || 'Primary Timeline',
    cumulative_story_summary: story.rolling_summary || 'Opening just concluded.',
    current_location: latestScene?.current_location || progress.current_location,
    current_objective: latestScene?.current_objective || progress.current_objective,
    characters_memory: characters.map((c) => ({
      name: c.name,
      role: c.role,
      personality: c.personality,
      motivation: c.motivation,
      relationship_score: c.relationship_score,
      relationship_label: c.relationship_label,
      last_emotion: c.last_emotion,
      memories_of_player: c.memories.slice(-5),
      known_secrets: c.secrets.slice(-3),
    })),
    discovered_clues: clues
      .filter((c) => c.item_type === 'clue')
      .map((c) => `${c.title}: ${c.description}`),
    inventory_objects: clues
      .filter((c) => c.item_type === 'object')
      .map((c) => `${c.title}: ${c.description}`),
    unresolved_mysteries: clues
      .filter((c) => c.item_type === 'mystery' && c.status === 'active')
      .map((c) => `${c.title}: ${c.description}`),
    recent_scenes: recentScenes.map((s) => ({
      chapter: s.chapter_number,
      scene: s.scene_number,
      title: s.scene_title,
      location: s.current_location,
      summary: s.situation_summary.what_happened,
      decision_taken: s.chosen_decision_text,
      narrative_excerpt: s.narrative_paragraphs.map((p) => p.text).join(' ').slice(0, 650),
    })),
  };

  const userPrompt = [
    `CURRENT NARRATIVE STATE & MEMORY:`,
    JSON.stringify(memoryBlock, null, 2),
    ``,
    `PLAYER'S NEW DECISION (${isCustomAction ? 'CUSTOM FREE-FORM ACTION' : 'SELECTED CHOICE'}):`,
    `"${decisionText}"`,
    ``,
    options?.finishStory
      ? `USER_REQUESTED_ENDING=true: Bring this story to a resonant, decisive, earned conclusion in this scene. Resolve the central conflict based strictly on the player's choices, clues, and character relationships. Set is_ending=true, choose the most fitting ending_type (successful, unexpected, secret, neutral, failure, or alternative), and write a rich ending_epilogue.`
      : `CONTINUE THE STORY:`,
    `- Advance to Scene ${nextSceneNumber} (Suggested Chapter: ${suggestedChapter}).`,
    `- Show immediate, concrete consequences of "${decisionText}" in the opening paragraph.`,
    `- Have characters physically react and move on stage (stage_position, movement_action, emotion, relationship_delta) in direct response to this choice.`,
    `- Maintain strict continuity with all clues, objects, and character memories above. Never reset or contradict the story.`,
    `- Introduce a fresh development, discovery, tension, or character turn appropriate to the pacing.`,
    options?.finishStory
      ? `- Do NOT generate further decisions since is_ending=true.`
      : `- Offer 4 to 5 sharply contextual next decisions grounded in this new situation.`,
  ].join('\n');

  const raw = await callGeminiWithRetry(userPrompt, buildSystemInstruction(story));
  const parsed = normalizeScenePayload(raw, suggestedChapter, nextSceneNumber);

  // Guardrail against premature ending unless explicitly requested by user
  if (!options?.finishStory && parsed.is_ending) {
    const minScenes =
      story.story_length === 'Short' ? 6 : story.story_length === 'Long' ? 16 : 10;
    if (nextSceneNumber < minScenes) {
      parsed.is_ending = false;
      parsed.ending_type = null;
      parsed.ending_epilogue = null;
      if (parsed.available_decisions.length < 3) {
        parsed.available_decisions = [
          {
            id: 'continue_investigate',
            text: 'Press deeper into the immediate lead before the trail cools',
            consequence_hint: 'Uncovers hidden stakes behind the recent turn',
            intent_tag: 'Investigate',
          },
          {
            id: 'confront_ally',
            text: 'Confront the closest witness about what they withheld',
            consequence_hint: 'Tests trust and may reveal a secret motive',
            intent_tag: 'Confront',
          },
          {
            id: 'regroup_plan',
            text: 'Step back, review every clue gathered so far, and alter course',
            consequence_hint: 'Opens a safer tactical approach',
            intent_tag: 'Strategize',
          },
        ];
      }
    }
  }

  return parsed;
}

export function resolveSceneImage(genre: string, storyCover: string): string {
  return storyCover || getCoverImageForGenre(genre);
}
