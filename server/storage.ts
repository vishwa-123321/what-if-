import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getAvatarForKey, getCoverImageForGenre } from '../src/data/catalog.ts';
import type {
  CreateStoryInput,
  FullStoryState,
  StoryBranchRecord,
  StoryCharacterRecord,
  StoryClueRecord,
  StoryDecisionRecord,
  StoryProgressRecord,
  StoryRecord,
  StoryScene,
  StorySummaryItem,
  UserProfile,
} from '../src/types/story.ts';
import type { GeneratedScenePayload } from './storyEngine.ts';

dotenv.config();

interface LocalUser {
  id: string;
  email: string;
  display_name: string;
  password_salt: string;
  password_hash: string;
  is_guest?: boolean;
  preferred_narrator: string;
  stories_completed: number;
  total_decisions: number;
  created_at: string;
}

interface LocalDatabase {
  profiles: LocalUser[];
  stories: StoryRecord[];
  story_branches: StoryBranchRecord[];
  story_scenes: StoryScene[];
  story_decisions: StoryDecisionRecord[];
  story_characters: StoryCharacterRecord[];
  story_clues: StoryClueRecord[];
  story_progress: StoryProgressRecord[];
  saved_stories: Array<{
    id: string;
    user_id: string;
    story_id: string;
    note: string;
    created_at: string;
  }>;
  favourite_stories: Array<{
    id: string;
    user_id: string;
    story_id: string;
    created_at: string;
  }>;
}

export interface AuthResult {
  user: UserProfile;
  authProvider: 'supabase' | 'local';
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'whatif-store.json');
const TOKEN_SECRET =
  process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

function normalizeSupabaseUrl(raw: string | undefined): string {
  if (!raw) return '';
  return raw
    .trim()
    .replace(/\/(rest|auth|storage|realtime)\/v1\/?$/i, '')
    .replace(/\/+$/, '');
}

function getSupabaseEnv(): { url: string; anonKey: string; serviceKey: string } {
  const url = normalizeSupabaseUrl(
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  );
  const anonKey = (
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ''
  ).trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return { url, anonKey, serviceKey };
}

let cachedBaseClient: SupabaseClient | null = null;

/**
 * Returns a Supabase client configured to respect Row Level Security:
 * - When a user's Supabase JWT is provided and no service role key is needed,
 *   forwards Authorization: Bearer <userAccessToken> so auth.uid() matches the user.
 * - Service role key is only ever used server-side if explicitly configured.
 */
function getSupabaseClient(userAccessToken?: string): SupabaseClient | null {
  const { url, anonKey, serviceKey } = getSupabaseEnv();
  const effectiveKey = anonKey || serviceKey;
  if (!url || !effectiveKey || url.includes('MY_') || effectiveKey.includes('MY_')) {
    return null;
  }

  // Forward user JWT for native Supabase Row Level Security enforcement
  if (userAccessToken && anonKey) {
    return createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: {
          Authorization: `Bearer ${userAccessToken}`,
        },
      },
    });
  }

  if (!cachedBaseClient) {
    cachedBaseClient = createClient(url, serviceKey || anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cachedBaseClient;
}

export function getPersistenceMode(): 'supabase' | 'local' {
  const { url, anonKey, serviceKey } = getSupabaseEnv();
  return url && (anonKey || serviceKey) && !url.includes('MY_')
    ? 'supabase'
    : 'local';
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_REGEX.test(value);
}

interface StoredStoryStateBlob {
  template_id?: string | null;
  protagonist_personality?: string;
  protagonist_background?: string;
  character_style_image?: string | null;
  narrator_personality?: string;
  difficulty?: StoryRecord['difficulty'];
  story_length?: StoryRecord['story_length'];
  perspective?: StoryRecord['perspective'];
  atmosphere?: string;
  setting_mode?: StoryRecord['setting_mode'];
  cover_image?: string;
  is_public?: boolean;
  ending_type?: StoryRecord['ending_type'];
  ending_epilogue?: string | null;
  rolling_summary?: string;
  progress?: {
    current_branch_id?: string;
    current_scene_id?: string;
    current_location?: string;
    current_objective?: string;
    progress_percent?: number;
    decisions_count?: number;
  };
  branches_meta?: Record<
    string,
    { parent_branch_id: string | null; origin_scene_id: string | null; is_active: boolean }
  >;
  characters_meta?: Record<
    string,
    {
      role?: string;
      motivation?: string;
      dialogue_style?: string;
      relationship_score?: number;
      relationship_label?: string;
      knowledge?: string[];
      secrets?: string[];
      memories?: string[];
      avatar_url?: string;
      last_emotion?: StoryCharacterRecord['last_emotion'];
      updated_at?: string;
    }
  >;
  clues_meta?: Record<
    string,
    { item_type?: StoryClueRecord['item_type']; scene_id?: string | null; status?: 'active' | 'resolved' }
  >;
  decisions_meta?: Record<
    string,
    { next_scene_id?: string | null; branch_id?: string | null; decision_id?: string | null; is_custom_action?: boolean }
  >;
}

function buildStoryStateBlob(
  story: StoryRecord,
  progress: StoryProgressRecord,
  branches: StoryBranchRecord[],
  characters: StoryCharacterRecord[],
  clues: StoryClueRecord[],
  decisions: StoryDecisionRecord[]
): StoredStoryStateBlob {
  const branches_meta: StoredStoryStateBlob['branches_meta'] = {};
  for (const b of branches) {
    branches_meta[b.id] = {
      parent_branch_id: b.parent_branch_id,
      origin_scene_id: b.origin_scene_id,
      is_active: b.is_active,
    };
  }
  const characters_meta: StoredStoryStateBlob['characters_meta'] = {};
  for (const c of characters) {
    characters_meta[c.id] = {
      role: c.role,
      motivation: c.motivation,
      dialogue_style: c.dialogue_style,
      relationship_score: c.relationship_score,
      relationship_label: c.relationship_label,
      knowledge: c.knowledge,
      secrets: c.secrets,
      memories: c.memories,
      avatar_url: c.avatar_url,
      last_emotion: c.last_emotion,
      updated_at: c.updated_at,
    };
  }
  const clues_meta: StoredStoryStateBlob['clues_meta'] = {};
  for (const cl of clues) {
    clues_meta[cl.id] = {
      item_type: cl.item_type,
      scene_id: cl.scene_id,
      status: cl.status,
    };
  }
  const decisions_meta: StoredStoryStateBlob['decisions_meta'] = {};
  for (const d of decisions) {
    decisions_meta[d.id] = {
      next_scene_id: d.next_scene_id,
      branch_id: d.branch_id,
      decision_id: d.decision_id,
      is_custom_action: d.is_custom_action,
    };
  }

  return {
    template_id: story.template_id,
    protagonist_personality: story.protagonist_personality,
    protagonist_background: story.protagonist_background,
    character_style_image: story.character_style_image,
    narrator_personality: story.narrator_personality,
    difficulty: story.difficulty,
    story_length: story.story_length,
    perspective: story.perspective,
    atmosphere: story.atmosphere,
    setting_mode: story.setting_mode,
    cover_image: story.cover_image,
    is_public: story.is_public,
    ending_type: story.ending_type,
    ending_epilogue: story.ending_epilogue,
    rolling_summary: story.rolling_summary,
    progress: {
      current_branch_id: progress.current_branch_id,
      current_scene_id: progress.current_scene_id,
      current_location: progress.current_location,
      current_objective: progress.current_objective,
      progress_percent: progress.progress_percent,
      decisions_count: progress.decisions_count,
    },
    branches_meta,
    characters_meta,
    clues_meta,
    decisions_meta,
  };
}

function toSupabaseStoryRow(story: StoryRecord, storyState: StoredStoryStateBlob) {
  return {
    id: story.id,
    user_id: story.user_id,
    title: story.title,
    genre: story.genre,
    description: story.custom_topic,
    main_character: story.protagonist_name,
    status: story.status,
    story_state: storyState,
    created_at: story.created_at,
    updated_at: story.updated_at,
  };
}

function fromSupabaseStoryRow(row: any): {
  story: StoryRecord;
  stateBlob: StoredStoryStateBlob;
} {
  const blob: StoredStoryStateBlob =
    row?.story_state && typeof row.story_state === 'object' ? row.story_state : {};
  const genre = String(row?.genre || 'Mystery');
  const story: StoryRecord = {
    id: String(row.id),
    user_id: String(row.user_id),
    template_id: blob.template_id ?? null,
    title: String(row.title || 'Untitled Story'),
    genre,
    custom_topic: String(row.description || ''),
    protagonist_name: String(row.main_character || 'Elena Vance'),
    protagonist_personality: blob.protagonist_personality || 'Observant and resolute',
    protagonist_background: blob.protagonist_background || '',
    character_style_image: blob.character_style_image ?? null,
    narrator_personality: blob.narrator_personality || 'Noir Auteur',
    difficulty: blob.difficulty || 'Balanced',
    story_length: blob.story_length || 'Medium',
    perspective: blob.perspective || 'Second-Person',
    atmosphere: blob.atmosphere || 'Atmospheric',
    setting_mode: blob.setting_mode || 'Imaginative',
    cover_image: blob.cover_image || getCoverImageForGenre(genre),
    is_public: Boolean(blob.is_public),
    status: (['in_progress', 'paused', 'completed'].includes(row.status)
      ? row.status
      : 'in_progress') as StoryRecord['status'],
    ending_type: blob.ending_type ?? null,
    ending_epilogue: blob.ending_epilogue ?? null,
    rolling_summary: blob.rolling_summary || String(row.description || ''),
    created_at: row.created_at || new Date().toISOString(),
    updated_at: row.updated_at || row.created_at || new Date().toISOString(),
  };
  return { story, stateBlob: blob };
}

function toSupabaseSceneRow(scene: StoryScene) {
  const narrative = (scene.narrative_paragraphs || [])
    .map((p) => (p.speaker ? `${p.speaker}: ${p.text}` : p.text))
    .join('\n\n');
  return {
    id: scene.id,
    story_id: scene.story_id,
    chapter_number: scene.chapter_number,
    scene_number: scene.scene_number,
    scene_title: scene.scene_title,
    narrative,
    scene_data: {
      branch_id: scene.branch_id,
      parent_scene_id: scene.parent_scene_id,
      narrative_paragraphs: scene.narrative_paragraphs,
      current_location: scene.current_location,
      atmosphere_mood: scene.atmosphere_mood,
      camera_motion: scene.camera_motion,
      scene_image: scene.scene_image,
      situation_summary: scene.situation_summary,
      characters_present: scene.characters_present,
      events: scene.events,
      consequences: scene.consequences,
      current_objective: scene.current_objective,
      available_decisions: scene.available_decisions,
      chosen_decision_text: scene.chosen_decision_text,
      is_custom_action: scene.is_custom_action,
      is_ending: scene.is_ending,
      ending_type: scene.ending_type,
      ending_epilogue: scene.ending_epilogue,
    },
    created_at: scene.created_at,
  };
}

function fromSupabaseSceneRow(row: any, fallbackCover: string): StoryScene {
  const data = row?.scene_data && typeof row.scene_data === 'object' ? row.scene_data : {};
  const fallbackNarrative = String(row?.narrative || '').trim();
  const paragraphs =
    Array.isArray(data.narrative_paragraphs) && data.narrative_paragraphs.length > 0
      ? data.narrative_paragraphs
      : fallbackNarrative
        ? fallbackNarrative.split(/\n\n+/).map((text: string) => ({
            type: 'prose' as const,
            text,
          }))
        : [{ type: 'prose' as const, text: 'The scene unfolds before you.' }];

  return {
    id: String(row.id),
    story_id: String(row.story_id),
    branch_id: String(data.branch_id || ''),
    parent_scene_id: data.parent_scene_id ?? null,
    chapter_number: Number(row.chapter_number) || 1,
    scene_number: Number(row.scene_number) || 1,
    scene_title: String(row.scene_title || `Scene ${row.scene_number || 1}`),
    narrative_paragraphs: paragraphs,
    current_location: String(data.current_location || 'Unknown Location'),
    atmosphere_mood: String(data.atmosphere_mood || 'mysterious'),
    camera_motion: String(data.camera_motion || 'slow-push'),
    scene_image: String(data.scene_image || fallbackCover),
    situation_summary:
      data.situation_summary && typeof data.situation_summary === 'object'
        ? data.situation_summary
        : {
            where: String(data.current_location || 'Unknown Location'),
            who_is_present: [],
            what_happened: fallbackNarrative.slice(0, 180) || 'The scene begins.',
            what_you_know: 'Explore the scene to uncover more.',
          },
    characters_present: Array.isArray(data.characters_present) ? data.characters_present : [],
    events: Array.isArray(data.events) ? data.events : [],
    consequences: Array.isArray(data.consequences) ? data.consequences : [],
    current_objective: String(data.current_objective || 'Decide your next move'),
    available_decisions: Array.isArray(data.available_decisions) ? data.available_decisions : [],
    chosen_decision_text: data.chosen_decision_text ?? null,
    is_custom_action: Boolean(data.is_custom_action),
    is_ending: Boolean(data.is_ending),
    ending_type: data.ending_type ?? null,
    ending_epilogue: data.ending_epilogue ?? null,
    created_at: row.created_at || new Date().toISOString(),
  };
}

function toSupabaseBranchRow(branch: StoryBranchRecord) {
  return {
    id: branch.id,
    story_id: branch.story_id,
    branch_name: branch.branch_name,
    parent_scene_id: branch.parent_branch_id ? branch.origin_scene_id : null,
    created_at: branch.created_at,
  };
}

function fromSupabaseBranchRow(
  row: any,
  meta?: StoredStoryStateBlob['branches_meta']
): StoryBranchRecord {
  const extra = meta?.[row.id];
  return {
    id: String(row.id),
    story_id: String(row.story_id),
    parent_branch_id: extra?.parent_branch_id ?? null,
    branch_name: String(row.branch_name || 'Primary Timeline'),
    origin_scene_id: extra?.origin_scene_id ?? row.parent_scene_id ?? null,
    is_active: extra?.is_active ?? true,
    created_at: row.created_at || new Date().toISOString(),
  };
}

function toSupabaseDecisionRow(d: StoryDecisionRecord) {
  return {
    id: d.id,
    story_id: d.story_id,
    scene_id: d.scene_id,
    decision_text: d.decision_text,
    consequence: d.consequence_summary,
    created_at: d.created_at,
  };
}

function fromSupabaseDecisionRow(
  row: any,
  meta?: StoredStoryStateBlob['decisions_meta']
): StoryDecisionRecord {
  const extra = meta?.[row.id];
  return {
    id: String(row.id),
    story_id: String(row.story_id),
    scene_id: String(row.scene_id),
    next_scene_id: extra?.next_scene_id ?? null,
    branch_id: extra?.branch_id || '',
    decision_id: extra?.decision_id ?? null,
    decision_text: String(row.decision_text || ''),
    is_custom_action: Boolean(extra?.is_custom_action),
    consequence_summary: String(row.consequence || ''),
    created_at: row.created_at || new Date().toISOString(),
  };
}

function toSupabaseCharacterRow(c: StoryCharacterRecord) {
  return {
    id: c.id,
    story_id: c.story_id,
    character_name: c.name,
    personality: c.personality,
    background: c.background || c.motivation || c.role,
    relationship: c.relationship_label,
    created_at: c.updated_at,
  };
}

function fromSupabaseCharacterRow(
  row: any,
  meta?: StoredStoryStateBlob['characters_meta'],
  fallbackAvatar?: string | null
): StoryCharacterRecord {
  const extra = meta?.[row.id];
  const score = typeof extra?.relationship_score === 'number' ? extra.relationship_score : 0;
  return {
    id: String(row.id),
    story_id: String(row.story_id),
    name: String(row.character_name || 'Companion'),
    role: extra?.role || 'Character',
    personality: String(row.personality || 'Measured'),
    background: String(row.background || ''),
    motivation: extra?.motivation || String(row.background || ''),
    dialogue_style: extra?.dialogue_style || 'Measured',
    relationship_score: score,
    relationship_label: extra?.relationship_label || String(row.relationship || 'Neutral'),
    knowledge: Array.isArray(extra?.knowledge) ? extra.knowledge : [],
    secrets: Array.isArray(extra?.secrets) ? extra.secrets : [],
    memories: Array.isArray(extra?.memories) ? extra.memories : [],
    avatar_url: extra?.avatar_url || getAvatarForKey('elena', fallbackAvatar),
    last_emotion: extra?.last_emotion || 'calm',
    updated_at: extra?.updated_at || row.created_at || new Date().toISOString(),
  };
}

function toSupabaseClueRow(cl: StoryClueRecord) {
  return {
    id: cl.id,
    story_id: cl.story_id,
    clue_name: cl.title,
    clue_description: cl.description,
    created_at: cl.created_at,
  };
}

function fromSupabaseClueRow(
  row: any,
  meta?: StoredStoryStateBlob['clues_meta']
): StoryClueRecord {
  const extra = meta?.[row.id];
  return {
    id: String(row.id),
    story_id: String(row.story_id),
    scene_id: extra?.scene_id || '',
    item_type: extra?.item_type || 'clue',
    title: String(row.clue_name || 'Clue'),
    description: String(row.clue_description || ''),
    status: extra?.status || 'active',
    created_at: row.created_at || new Date().toISOString(),
  };
}

function shouldUseSupabase(authProvider?: 'supabase' | 'local'): boolean {
  if (authProvider === 'local') return false;
  return getPersistenceMode() === 'supabase';
}

function formatSupabaseError(context: string, error: { message?: string; code?: string; details?: string }): Error {
  const detail = error?.message || 'Unknown database error';
  if (error?.code === '42501' || detail.toLowerCase().includes('row-level security')) {
    return new Error(
      `${context}: Permission denied by Supabase Row Level Security. Please sign in with your account.`
    );
  }
  if (error?.code === '42P01' || detail.toLowerCase().includes('does not exist')) {
    return new Error(
      `${context}: Required Supabase table is missing. Please run /supabase/migrations/001_what_if_3_schema.sql in your Supabase SQL Editor.`
    );
  }
  return new Error(`${context}: ${detail}`);
}

function emptyDb(): LocalDatabase {
  return {
    profiles: [],
    stories: [],
    story_branches: [],
    story_scenes: [],
    story_decisions: [],
    story_characters: [],
    story_clues: [],
    story_progress: [],
    saved_stories: [],
    favourite_stories: [],
  };
}

function loadLocalDb(): LocalDatabase {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      const fresh = emptyDb();
      fs.writeFileSync(DB_FILE, JSON.stringify(fresh, null, 2), 'utf-8');
      return fresh;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return { ...emptyDb(), ...parsed };
  } catch {
    return emptyDb();
  }
}

function saveLocalDb(db: LocalDatabase): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpFile = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf-8');
  fs.renameSync(tmpFile, DB_FILE);
}

function hashPassword(password: string, salt?: string): { salt: string; hash: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, actualSalt, 64).toString('hex');
  return { salt: actualSalt, hash };
}

function signToken(payload: { uid: string; email: string; display_name: string }): string {
  const encoded = Buffer.from(
    JSON.stringify({ ...payload, iat: Date.now() }),
    'utf-8'
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyLocalToken(
  token: string
): { uid: string; email: string; display_name: string } | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(encoded)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf-8'));
    if (typeof parsed.uid === 'string' && typeof parsed.email === 'string') {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function relationshipLabelFromScore(score: number): string {
  if (score >= 55) return 'Devoted Ally';
  if (score >= 25) return 'Trusted';
  if (score >= 8) return 'Warming';
  if (score <= -55) return 'Bitter Rival';
  if (score <= -25) return 'Distrustful';
  if (score <= -8) return 'Guarded';
  return 'Neutral';
}

export async function authenticateToken(
  token: string | undefined
): Promise<AuthResult | null> {
  if (!token) return null;

  // 1. Verify Supabase JWT first when Supabase is configured
  const sb = getSupabaseClient(token);
  if (sb) {
    try {
      const { data, error } = await sb.auth.getUser(token);
      if (!error && data?.user) {
        const u = data.user;
        const displayName =
          (u.user_metadata?.display_name as string) ||
          (u.email ? u.email.split('@')[0] : 'Storyteller');
        const profile = await upsertSupabaseProfile(
          sb,
          u.id,
          u.email || `${u.id}@story.local`,
          displayName
        );
        return { user: profile, authProvider: 'supabase' };
      }
    } catch {
      // Fall through to local token verification
    }
  }

  // 2. Local signed session token (used for Explorer guest mode or when Supabase isn't configured)
  const verified = verifyLocalToken(token);
  if (!verified) return null;

  const db = loadLocalDb();
  const found = db.profiles.find((p) => p.id === verified.uid);
  if (!found) return null;

  return {
    authProvider: 'local',
    user: {
      id: found.id,
      email: found.email,
      display_name: found.display_name,
      preferred_narrator: found.preferred_narrator,
      stories_completed: found.stories_completed,
      total_decisions: found.total_decisions,
      created_at: found.created_at,
    },
  };
}

async function upsertSupabaseProfile(
  sb: SupabaseClient,
  userId: string,
  email: string,
  displayName: string
): Promise<UserProfile> {
  const { data: existing } = await sb
    .from('profiles')
    .select('id, full_name, avatar_url, created_at')
    .eq('id', userId)
    .maybeSingle();

  if (existing) {
    return {
      id: existing.id,
      email,
      display_name: existing.full_name || displayName,
      avatar_url: existing.avatar_url,
      preferred_narrator: 'Noir Auteur',
      stories_completed: 0,
      total_decisions: 0,
      created_at: existing.created_at || new Date().toISOString(),
    };
  }

  const { data: inserted, error } = await sb
    .from('profiles')
    .upsert(
      {
        id: userId,
        full_name: displayName,
      },
      { onConflict: 'id' }
    )
    .select('id, full_name, avatar_url, created_at')
    .single();

  if (error || !inserted) {
    return {
      id: userId,
      email,
      display_name: displayName,
      preferred_narrator: 'Noir Auteur',
      stories_completed: 0,
      total_decisions: 0,
      created_at: new Date().toISOString(),
    };
  }

  return {
    id: inserted.id,
    email,
    display_name: inserted.full_name || displayName,
    avatar_url: inserted.avatar_url,
    preferred_narrator: 'Noir Auteur',
    stories_completed: 0,
    total_decisions: 0,
    created_at: inserted.created_at || new Date().toISOString(),
  };
}

export async function registerLocalUser(
  email: string,
  password: string,
  displayName: string
): Promise<{ token: string; user: UserProfile }> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    throw new Error('Please enter a valid email address.');
  }
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  const db = loadLocalDb();
  if (db.profiles.some((p) => p.email === normalizedEmail)) {
    throw new Error('An account with this email already exists. Please sign in.');
  }

  const { salt, hash } = hashPassword(password);
  const now = new Date().toISOString();
  const newUser: LocalUser = {
    id: crypto.randomUUID(),
    email: normalizedEmail,
    display_name: displayName.trim() || normalizedEmail.split('@')[0],
    password_salt: salt,
    password_hash: hash,
    is_guest: false,
    preferred_narrator: 'Noir Auteur',
    stories_completed: 0,
    total_decisions: 0,
    created_at: now,
  };

  db.profiles.push(newUser);
  saveLocalDb(db);

  const token = signToken({
    uid: newUser.id,
    email: newUser.email,
    display_name: newUser.display_name,
  });

  return {
    token,
    user: {
      id: newUser.id,
      email: newUser.email,
      display_name: newUser.display_name,
      preferred_narrator: newUser.preferred_narrator,
      stories_completed: 0,
      total_decisions: 0,
      created_at: now,
    },
  };
}

export async function loginLocalUser(
  email: string,
  password: string
): Promise<{ token: string; user: UserProfile }> {
  const normalizedEmail = email.trim().toLowerCase();
  const db = loadLocalDb();
  const found = db.profiles.find((p) => p.email === normalizedEmail && !p.is_guest);
  if (!found) {
    throw new Error('Invalid email or password.');
  }
  const { hash } = hashPassword(password, found.password_salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(found.password_hash, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error('Invalid email or password.');
  }

  const token = signToken({
    uid: found.id,
    email: found.email,
    display_name: found.display_name,
  });

  return {
    token,
    user: {
      id: found.id,
      email: found.email,
      display_name: found.display_name,
      preferred_narrator: found.preferred_narrator,
      stories_completed: found.stories_completed,
      total_decisions: found.total_decisions,
      created_at: found.created_at,
    },
  };
}

export async function ensureGuestProfile(
  guestId?: string
): Promise<{ token: string; user: UserProfile }> {
  const db = loadLocalDb();
  if (guestId) {
    const existing = db.profiles.find(
      (p) =>
        p.id === guestId &&
        p.is_guest === true &&
        p.email.endsWith('@whatif.universe')
    );
    if (existing) {
      return {
        token: signToken({
          uid: existing.id,
          email: existing.email,
          display_name: existing.display_name,
        }),
        user: {
          id: existing.id,
          email: existing.email,
          display_name: existing.display_name,
          preferred_narrator: existing.preferred_narrator,
          stories_completed: existing.stories_completed,
          total_decisions: existing.total_decisions,
          created_at: existing.created_at,
        },
      };
    }
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const { salt, hash } = hashPassword(crypto.randomBytes(16).toString('hex'));
  const guest: LocalUser = {
    id,
    email: `explorer-${id.slice(0, 6)}@whatif.universe`,
    display_name: 'Explorer',
    password_salt: salt,
    password_hash: hash,
    is_guest: true,
    preferred_narrator: 'Noir Auteur',
    stories_completed: 0,
    total_decisions: 0,
    created_at: now,
  };
  db.profiles.push(guest);
  saveLocalDb(db);

  return {
    token: signToken({
      uid: guest.id,
      email: guest.email,
      display_name: guest.display_name,
    }),
    user: {
      id: guest.id,
      email: guest.email,
      display_name: guest.display_name,
      preferred_narrator: guest.preferred_narrator,
      stories_completed: 0,
      total_decisions: 0,
      created_at: now,
    },
  };
}

export interface StorageContext {
  accessToken?: string;
  authProvider?: 'supabase' | 'local';
}

export async function updateUserProfile(
  userId: string,
  updates: { display_name?: string; preferred_narrator?: string },
  ctx?: StorageContext
): Promise<UserProfile> {
  if (shouldUseSupabase(ctx?.authProvider)) {
    const sb = getSupabaseClient(ctx?.accessToken);
    if (sb) {
      const authUserRes = ctx?.accessToken ? await sb.auth.getUser(ctx.accessToken) : null;
      const authEmail = authUserRes?.data?.user?.email || '';

      const { data, error } = await sb
        .from('profiles')
        .upsert(
          {
            id: userId,
            ...(updates.display_name ? { full_name: updates.display_name.trim() } : {}),
          },
          { onConflict: 'id' }
        )
        .select('id, full_name, avatar_url, created_at')
        .single();

      if (error) {
        throw formatSupabaseError('Unable to update profile', error);
      }
      return {
        id: data.id,
        email: authEmail,
        display_name: data.full_name || updates.display_name || 'Storyteller',
        avatar_url: data.avatar_url,
        preferred_narrator: updates.preferred_narrator?.trim() || 'Noir Auteur',
        stories_completed: 0,
        total_decisions: 0,
        created_at: data.created_at || new Date().toISOString(),
      };
    }
  }

  const db = loadLocalDb();
  const profile = db.profiles.find((p) => p.id === userId);
  if (!profile) {
    throw new Error('Profile not found.');
  }
  if (updates.display_name?.trim()) {
    profile.display_name = updates.display_name.trim();
  }
  if (updates.preferred_narrator?.trim()) {
    profile.preferred_narrator = updates.preferred_narrator.trim();
  }
  saveLocalDb(db);

  return {
    id: profile.id,
    email: profile.email,
    display_name: profile.display_name,
    preferred_narrator: profile.preferred_narrator,
    stories_completed: profile.stories_completed,
    total_decisions: profile.total_decisions,
    created_at: profile.created_at,
  };
}

export async function createStoryWithOpening(
  userId: string,
  input: CreateStoryInput,
  opening: GeneratedScenePayload,
  ctx?: StorageContext
): Promise<FullStoryState> {
  const now = new Date().toISOString();
  const storyId = crypto.randomUUID();
  const branchId = crypto.randomUUID();
  const sceneId = crypto.randomUUID();
  const coverImage = input.cover_image || getCoverImageForGenre(input.genre);

  const story: StoryRecord = {
    id: storyId,
    user_id: userId,
    template_id: input.template_id || null,
    title: input.title.trim(),
    genre: input.genre,
    custom_topic: input.custom_topic.trim(),
    protagonist_name: input.protagonist_name.trim(),
    protagonist_personality: input.protagonist_personality.trim(),
    protagonist_background: input.protagonist_background.trim(),
    character_style_image: input.character_style_image || null,
    narrator_personality: input.narrator_personality || 'Noir Auteur',
    difficulty: input.difficulty || 'Balanced',
    story_length: input.story_length || 'Medium',
    perspective: input.perspective || 'Second-Person',
    atmosphere: input.atmosphere || 'Atmospheric',
    setting_mode: input.setting_mode || 'Imaginative',
    cover_image: coverImage,
    is_public: false,
    status: opening.is_ending ? 'completed' : 'in_progress',
    ending_type: opening.ending_type,
    ending_epilogue: opening.ending_epilogue,
    rolling_summary:
      opening.story_summary_update || opening.situation_summary.what_happened,
    created_at: now,
    updated_at: now,
  };

  const branch: StoryBranchRecord = {
    id: branchId,
    story_id: storyId,
    parent_branch_id: null,
    branch_name: 'Primary Timeline',
    origin_scene_id: sceneId,
    is_active: true,
    created_at: now,
  };

  const scene: StoryScene = {
    id: sceneId,
    story_id: storyId,
    branch_id: branchId,
    parent_scene_id: null,
    chapter_number: opening.chapter_number,
    scene_number: opening.scene_number,
    scene_title: opening.scene_title,
    narrative_paragraphs: opening.narrative_paragraphs,
    current_location: opening.current_location,
    atmosphere_mood: opening.atmosphere_mood,
    camera_motion: opening.camera_motion,
    scene_image: coverImage,
    situation_summary: opening.situation_summary,
    characters_present: opening.characters_present,
    events: opening.events,
    consequences: opening.consequences,
    current_objective: opening.current_objective,
    available_decisions: opening.available_decisions,
    chosen_decision_text: null,
    is_custom_action: false,
    is_ending: opening.is_ending,
    ending_type: opening.ending_type,
    ending_epilogue: opening.ending_epilogue,
    created_at: now,
  };

  const characters: StoryCharacterRecord[] = opening.characters_present.map((c) => {
    const score = Math.max(-100, Math.min(100, c.relationship_delta || 0));
    return {
      id: crypto.randomUUID(),
      story_id: storyId,
      name: c.name,
      role: c.role,
      personality: c.personality,
      background: '',
      motivation: c.motivation,
      dialogue_style: c.dialogue_style || 'Measured',
      relationship_score: score,
      relationship_label: relationshipLabelFromScore(score),
      knowledge: [],
      secrets: c.secret_hint ? [c.secret_hint] : [],
      memories: c.relationship_reason ? [c.relationship_reason] : ['First encounter'],
      avatar_url: getAvatarForKey(c.avatar_key, story.character_style_image),
      last_emotion: c.emotion,
      updated_at: now,
    };
  });

  const clues: StoryClueRecord[] = opening.new_clues.map((cl) => ({
    id: crypto.randomUUID(),
    story_id: storyId,
    scene_id: sceneId,
    item_type: cl.item_type,
    title: cl.title,
    description: cl.description,
    status: 'active',
    created_at: now,
  }));

  const progress: StoryProgressRecord = {
    story_id: storyId,
    user_id: userId,
    current_branch_id: branchId,
    current_scene_id: sceneId,
    current_chapter: scene.chapter_number,
    current_scene_number: scene.scene_number,
    current_location: scene.current_location,
    current_objective: scene.current_objective,
    progress_percent: opening.progress_percent,
    decisions_count: 0,
    updated_at: now,
  };

  if (shouldUseSupabase(ctx?.authProvider)) {
    const sb = getSupabaseClient(ctx?.accessToken);
    if (sb) {
      const stateBlob = buildStoryStateBlob(
        story,
        progress,
        [branch],
        characters,
        clues,
        []
      );

      const { error: storyErr } = await sb
        .from('stories')
        .insert(toSupabaseStoryRow(story, stateBlob));
      if (storyErr) throw formatSupabaseError('Failed to save story', storyErr);

      const { error: sceneErr } = await sb
        .from('story_scenes')
        .insert(toSupabaseSceneRow(scene));
      if (sceneErr) throw formatSupabaseError('Failed to save opening scene', sceneErr);

      const { error: branchErr } = await sb
        .from('story_branches')
        .insert(toSupabaseBranchRow(branch));
      if (branchErr) throw formatSupabaseError('Failed to save story branch', branchErr);

      if (characters.length > 0) {
        const { error: charsErr } = await sb
          .from('story_characters')
          .insert(characters.map(toSupabaseCharacterRow));
        if (charsErr) throw formatSupabaseError('Failed to save story characters', charsErr);
      }
      if (clues.length > 0) {
        const { error: cluesErr } = await sb
          .from('story_clues')
          .insert(clues.map(toSupabaseClueRow));
        if (cluesErr) throw formatSupabaseError('Failed to save story clues', cluesErr);
      }

      const { error: progErr } = await sb.from('story_progress').insert({
        story_id: storyId,
        current_chapter: progress.current_chapter,
        current_scene: progress.current_scene_number,
        updated_at: now,
      });
      if (progErr) throw formatSupabaseError('Failed to save story progress', progErr);

      return {
        story,
        progress,
        branches: [branch],
        scenes: [scene],
        decisions: [],
        characters,
        clues,
        is_saved: false,
        is_favourite: false,
      };
    }
  }

  const db = loadLocalDb();
  db.stories.push(story);
  db.story_branches.push(branch);
  db.story_scenes.push(scene);
  db.story_characters.push(...characters);
  db.story_clues.push(...clues);
  db.story_progress.push(progress);
  saveLocalDb(db);

  return {
    story,
    progress,
    branches: [branch],
    scenes: [scene],
    decisions: [],
    characters,
    clues,
    is_saved: false,
    is_favourite: false,
  };
}

export async function getFullStoryState(
  userId: string,
  storyId: string,
  ctx?: StorageContext
): Promise<FullStoryState | null> {
  if (shouldUseSupabase(ctx?.authProvider)) {
    const sb = getSupabaseClient(ctx?.accessToken);
    if (sb) {
      const { data: rawStory, error: storyErr } = await sb
        .from('stories')
        .select('*')
        .eq('id', storyId)
        .maybeSingle();

      if (storyErr) throw formatSupabaseError('Failed to load story', storyErr);
      if (!rawStory) return null;

      const { story, stateBlob } = fromSupabaseStoryRow(rawStory);
      if (story.user_id !== userId && !story.is_public) {
        return null;
      }

      const [
        branchesRes,
        scenesRes,
        decisionsRes,
        charsRes,
        cluesRes,
        progRes,
        savedRes,
        favRes,
      ] = await Promise.all([
        sb
          .from('story_branches')
          .select('*')
          .eq('story_id', storyId)
          .order('created_at', { ascending: true }),
        sb
          .from('story_scenes')
          .select('*')
          .eq('story_id', storyId)
          .order('created_at', { ascending: true }),
        sb
          .from('story_decisions')
          .select('*')
          .eq('story_id', storyId)
          .order('created_at', { ascending: true }),
        sb
          .from('story_characters')
          .select('*')
          .eq('story_id', storyId)
          .order('created_at', { ascending: true }),
        sb
          .from('story_clues')
          .select('*')
          .eq('story_id', storyId)
          .order('created_at', { ascending: true }),
        sb
          .from('story_progress')
          .select('*')
          .eq('story_id', storyId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        sb
          .from('saved_stories')
          .select('id')
          .eq('user_id', userId)
          .eq('story_id', storyId)
          .maybeSingle(),
        sb
          .from('favourite_stories')
          .select('id')
          .eq('user_id', userId)
          .eq('story_id', storyId)
          .maybeSingle(),
      ]);

      if (scenesRes.error) {
        throw formatSupabaseError('Failed to load story scenes', scenesRes.error);
      }

      const scenes = (scenesRes.data || []).map((r: any) =>
        fromSupabaseSceneRow(r, story.cover_image)
      );
      const branches = (branchesRes.data || []).map((r: any) =>
        fromSupabaseBranchRow(r, stateBlob.branches_meta)
      );
      const decisions = (decisionsRes.data || []).map((r: any) =>
        fromSupabaseDecisionRow(r, stateBlob.decisions_meta)
      );
      const characters = (charsRes.data || []).map((r: any) =>
        fromSupabaseCharacterRow(r, stateBlob.characters_meta, story.character_style_image)
      );
      const clues = (cluesRes.data || []).map((r: any) =>
        fromSupabaseClueRow(r, stateBlob.clues_meta)
      );

      const latestScene = scenes[scenes.length - 1];
      const progMeta = stateBlob.progress || {};
      const currentScene =
        scenes.find((s) => s.id === progMeta.current_scene_id) || latestScene;

      const progress: StoryProgressRecord = {
        story_id: storyId,
        user_id: userId,
        current_branch_id:
          progMeta.current_branch_id || currentScene?.branch_id || branches[0]?.id || '',
        current_scene_id: currentScene?.id || '',
        current_chapter:
          Number(progRes.data?.current_chapter) || currentScene?.chapter_number || 1,
        current_scene_number:
          Number(progRes.data?.current_scene) || currentScene?.scene_number || 1,
        current_location:
          progMeta.current_location || currentScene?.current_location || '',
        current_objective:
          progMeta.current_objective || currentScene?.current_objective || '',
        progress_percent:
          typeof progMeta.progress_percent === 'number'
            ? progMeta.progress_percent
            : story.status === 'completed'
              ? 100
              : 10,
        decisions_count:
          typeof progMeta.decisions_count === 'number'
            ? progMeta.decisions_count
            : decisions.length,
        updated_at: progRes.data?.updated_at || story.updated_at,
      };

      return {
        story,
        progress,
        branches,
        scenes,
        decisions,
        characters,
        clues,
        is_saved: Boolean(savedRes.data),
        is_favourite: Boolean(favRes.data),
      };
    }
  }

  const db = loadLocalDb();
  const story = db.stories.find((s) => s.id === storyId);
  if (!story || (story.user_id !== userId && !story.is_public)) {
    return null;
  }

  const branches = db.story_branches.filter((b) => b.story_id === storyId);
  const scenes = db.story_scenes
    .filter((s) => s.story_id === storyId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const decisions = db.story_decisions
    .filter((d) => d.story_id === storyId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  const characters = db.story_characters.filter((c) => c.story_id === storyId);
  const clues = db.story_clues.filter((c) => c.story_id === storyId);
  const progress =
    db.story_progress.find((p) => p.story_id === storyId) || {
      story_id: storyId,
      user_id: userId,
      current_branch_id: branches[0]?.id || '',
      current_scene_id: scenes[scenes.length - 1]?.id || '',
      current_chapter: scenes[scenes.length - 1]?.chapter_number || 1,
      current_scene_number: scenes[scenes.length - 1]?.scene_number || 1,
      current_location: scenes[scenes.length - 1]?.current_location || '',
      current_objective: scenes[scenes.length - 1]?.current_objective || '',
      progress_percent: 10,
      decisions_count: decisions.length,
      updated_at: story.updated_at,
    };

  const is_saved = db.saved_stories.some(
    (s) => s.user_id === userId && s.story_id === storyId
  );
  const is_favourite = db.favourite_stories.some(
    (f) => f.user_id === userId && f.story_id === storyId
  );

  return {
    story,
    progress,
    branches,
    scenes,
    decisions,
    characters,
    clues,
    is_saved,
    is_favourite,
  };
}

export async function appendContinuationScene(
  userId: string,
  storyId: string,
  fromSceneId: string,
  decisionId: string | null,
  decisionText: string,
  isCustomAction: boolean,
  generated: GeneratedScenePayload,
  ctx?: StorageContext
): Promise<FullStoryState> {
  const existing = await getFullStoryState(userId, storyId, ctx);
  if (!existing || existing.story.user_id !== userId) {
    throw new Error('Story not found or access denied.');
  }

  const now = new Date().toISOString();
  const parentScene =
    existing.scenes.find((s) => s.id === fromSceneId) ||
    existing.scenes[existing.scenes.length - 1];

  const existingChildren = existing.scenes.filter(
    (s) => s.parent_scene_id === parentScene.id
  );
  let activeBranchId = parentScene.branch_id || existing.progress.current_branch_id;
  let newBranch: StoryBranchRecord | null = null;

  if (existingChildren.length > 0) {
    activeBranchId = crypto.randomUUID();
    const branchCount = existing.branches.length + 1;
    newBranch = {
      id: activeBranchId,
      story_id: storyId,
      parent_branch_id: parentScene.branch_id,
      branch_name: `Branch ${branchCount}: ${decisionText.slice(0, 32)}`,
      origin_scene_id: parentScene.id,
      is_active: true,
      created_at: now,
    };
  }

  const newSceneId = crypto.randomUUID();
  const newScene: StoryScene = {
    id: newSceneId,
    story_id: storyId,
    branch_id: activeBranchId,
    parent_scene_id: parentScene.id,
    chapter_number: generated.chapter_number,
    scene_number: generated.scene_number,
    scene_title: generated.scene_title,
    narrative_paragraphs: generated.narrative_paragraphs,
    current_location: generated.current_location,
    atmosphere_mood: generated.atmosphere_mood,
    camera_motion: generated.camera_motion,
    scene_image: existing.story.cover_image,
    situation_summary: generated.situation_summary,
    characters_present: generated.characters_present,
    events: generated.events,
    consequences: generated.consequences,
    current_objective: generated.current_objective,
    available_decisions: generated.available_decisions,
    chosen_decision_text: null,
    is_custom_action: false,
    is_ending: generated.is_ending,
    ending_type: generated.ending_type,
    ending_epilogue: generated.ending_epilogue,
    created_at: now,
  };

  const decisionRecord: StoryDecisionRecord = {
    id: crypto.randomUUID(),
    story_id: storyId,
    scene_id: parentScene.id,
    next_scene_id: newSceneId,
    branch_id: activeBranchId,
    decision_id: decisionId,
    decision_text: decisionText,
    is_custom_action: isCustomAction,
    consequence_summary:
      generated.consequences[0] || generated.situation_summary.what_happened,
    created_at: now,
  };

  const charMap = new Map(
    existing.characters.map((c) => [c.name.toLowerCase(), { ...c }])
  );
  const upsertedCharacters: StoryCharacterRecord[] = [];

  for (const stageChar of generated.characters_present) {
    const key = stageChar.name.toLowerCase();
    const prev = charMap.get(key);
    if (prev) {
      const nextScore = Math.max(
        -100,
        Math.min(100, prev.relationship_score + (stageChar.relationship_delta || 0))
      );
      const updatedMemories = [...prev.memories];
      if (stageChar.relationship_reason) {
        updatedMemories.push(
          `Scene ${generated.scene_number}: ${stageChar.relationship_reason}`
        );
      } else if (stageChar.relationship_delta !== 0) {
        updatedMemories.push(
          `Scene ${generated.scene_number}: Reacted to "${decisionText.slice(0, 60)}"`
        );
      }
      const updatedSecrets = [...prev.secrets];
      if (stageChar.secret_hint && !updatedSecrets.includes(stageChar.secret_hint)) {
        updatedSecrets.push(stageChar.secret_hint);
      }
      const updated: StoryCharacterRecord = {
        ...prev,
        role: stageChar.role || prev.role,
        personality: stageChar.personality || prev.personality,
        motivation: stageChar.motivation || prev.motivation,
        relationship_score: nextScore,
        relationship_label: relationshipLabelFromScore(nextScore),
        memories: updatedMemories.slice(-12),
        secrets: updatedSecrets.slice(-6),
        last_emotion: stageChar.emotion,
        updated_at: now,
      };
      charMap.set(key, updated);
      upsertedCharacters.push(updated);
    } else {
      const score = Math.max(-100, Math.min(100, stageChar.relationship_delta || 0));
      const created: StoryCharacterRecord = {
        id: crypto.randomUUID(),
        story_id: storyId,
        name: stageChar.name,
        role: stageChar.role,
        personality: stageChar.personality,
        background: '',
        motivation: stageChar.motivation,
        dialogue_style: stageChar.dialogue_style || 'Distinct',
        relationship_score: score,
        relationship_label: relationshipLabelFromScore(score),
        knowledge: [],
        secrets: stageChar.secret_hint ? [stageChar.secret_hint] : [],
        memories: [
          stageChar.relationship_reason ||
            `Met in Scene ${generated.scene_number} at ${generated.current_location}`,
        ],
        avatar_url: getAvatarForKey(
          stageChar.avatar_key,
          existing.story.character_style_image
        ),
        last_emotion: stageChar.emotion,
        updated_at: now,
      };
      charMap.set(key, created);
      upsertedCharacters.push(created);
    }
  }

  const existingTitles = new Set(existing.clues.map((c) => c.title.toLowerCase()));
  const insertedClues: StoryClueRecord[] = generated.new_clues
    .filter((cl) => !existingTitles.has(cl.title.toLowerCase()))
    .map((cl) => ({
      id: crypto.randomUUID(),
      story_id: storyId,
      scene_id: newSceneId,
      item_type: cl.item_type,
      title: cl.title,
      description: cl.description,
      status: 'active',
      created_at: now,
    }));

  const resolvedLower = new Set(
    generated.resolved_mysteries.map((m) => m.toLowerCase())
  );

  const updatedStory: StoryRecord = {
    ...existing.story,
    status: generated.is_ending ? 'completed' : 'in_progress',
    ending_type: generated.is_ending ? generated.ending_type : existing.story.ending_type,
    ending_epilogue: generated.is_ending
      ? generated.ending_epilogue
      : existing.story.ending_epilogue,
    rolling_summary: generated.story_summary_update || existing.story.rolling_summary,
    updated_at: now,
  };

  const updatedProgress: StoryProgressRecord = {
    story_id: storyId,
    user_id: userId,
    current_branch_id: activeBranchId,
    current_scene_id: newSceneId,
    current_chapter: newScene.chapter_number,
    current_scene_number: newScene.scene_number,
    current_location: newScene.current_location,
    current_objective: newScene.current_objective,
    progress_percent: generated.is_ending ? 100 : generated.progress_percent,
    decisions_count: existing.decisions.length + 1,
    updated_at: now,
  };

  if (shouldUseSupabase(ctx?.authProvider)) {
    const sb = getSupabaseClient(ctx?.accessToken);
    if (sb) {
      if (newBranch) {
        const { error } = await sb
          .from('story_branches')
          .insert(toSupabaseBranchRow(newBranch));
        if (error) throw formatSupabaseError('Failed to save story branch', error);
      }

      const updatedParentScene: StoryScene = {
        ...parentScene,
        chosen_decision_text: decisionText,
        is_custom_action: isCustomAction,
      };
      const parentRow = toSupabaseSceneRow(updatedParentScene);
      const { error: parentErr } = await sb
        .from('story_scenes')
        .update({ scene_data: parentRow.scene_data })
        .eq('id', parentScene.id);
      if (parentErr) throw formatSupabaseError('Failed to update previous scene', parentErr);

      const { error: sceneErr } = await sb
        .from('story_scenes')
        .insert(toSupabaseSceneRow(newScene));
      if (sceneErr) throw formatSupabaseError('Failed to save next scene', sceneErr);

      const { error: decErr } = await sb
        .from('story_decisions')
        .insert(toSupabaseDecisionRow(decisionRecord));
      if (decErr) throw formatSupabaseError('Failed to record decision', decErr);

      const existingCharIds = new Set(existing.characters.map((c) => c.id));
      for (const ch of upsertedCharacters) {
        if (existingCharIds.has(ch.id)) {
          const { error: charErr } = await sb
            .from('story_characters')
            .update({
              personality: ch.personality,
              background: ch.background || ch.motivation || ch.role,
              relationship: ch.relationship_label,
            })
            .eq('id', ch.id);
          if (charErr) throw formatSupabaseError('Failed to update character', charErr);
        } else {
          const { error: charErr } = await sb
            .from('story_characters')
            .insert(toSupabaseCharacterRow(ch));
          if (charErr) throw formatSupabaseError('Failed to save character', charErr);
        }
      }

      if (insertedClues.length > 0) {
        const { error: clueErr } = await sb
          .from('story_clues')
          .insert(insertedClues.map(toSupabaseClueRow));
        if (clueErr) throw formatSupabaseError('Failed to save clues', clueErr);
      }

      const allBranches = newBranch ? [...existing.branches, newBranch] : existing.branches;
      const allCharacters = Array.from(charMap.values());
      const allClues = [
        ...existing.clues.map((c) =>
          resolvedLower.has(c.title.toLowerCase()) ? { ...c, status: 'resolved' as const } : c
        ),
        ...insertedClues,
      ];
      const allDecisions = [...existing.decisions, decisionRecord];
      const nextStateBlob = buildStoryStateBlob(
        updatedStory,
        updatedProgress,
        allBranches,
        allCharacters,
        allClues,
        allDecisions
      );

      const { error: stErr } = await sb
        .from('stories')
        .update({
          status: updatedStory.status,
          story_state: nextStateBlob,
          updated_at: now,
        })
        .eq('id', storyId)
        .eq('user_id', userId);
      if (stErr) throw formatSupabaseError('Failed to update story metadata', stErr);

      const { data: existingProg } = await sb
        .from('story_progress')
        .select('id')
        .eq('story_id', storyId)
        .limit(1)
        .maybeSingle();

      if (existingProg) {
        const { error: progErr } = await sb
          .from('story_progress')
          .update({
            current_chapter: updatedProgress.current_chapter,
            current_scene: updatedProgress.current_scene_number,
            updated_at: now,
          })
          .eq('id', existingProg.id);
        if (progErr) throw formatSupabaseError('Failed to update story progress', progErr);
      } else {
        const { error: progErr } = await sb.from('story_progress').insert({
          story_id: storyId,
          current_chapter: updatedProgress.current_chapter,
          current_scene: updatedProgress.current_scene_number,
          updated_at: now,
        });
        if (progErr) throw formatSupabaseError('Failed to save story progress', progErr);
      }

      const refreshed = await getFullStoryState(userId, storyId, ctx);
      if (!refreshed) throw new Error('Unable to reload story from Supabase.');
      return refreshed;
    }
  }

  const db = loadLocalDb();
  if (newBranch) {
    db.story_branches.push(newBranch);
  }
  const dbParent = db.story_scenes.find((s) => s.id === parentScene.id);
  if (dbParent) {
    dbParent.chosen_decision_text = decisionText;
    dbParent.is_custom_action = isCustomAction;
  }
  db.story_scenes.push(newScene);
  db.story_decisions.push(decisionRecord);

  db.story_characters = db.story_characters.filter((c) => c.story_id !== storyId);
  db.story_characters.push(...Array.from(charMap.values()));

  for (const clue of db.story_clues) {
    if (clue.story_id === storyId && resolvedLower.has(clue.title.toLowerCase())) {
      clue.status = 'resolved';
    }
  }
  db.story_clues.push(...insertedClues);

  const dbStoryIdx = db.stories.findIndex((s) => s.id === storyId);
  if (dbStoryIdx >= 0) db.stories[dbStoryIdx] = updatedStory;

  const dbProgIdx = db.story_progress.findIndex((p) => p.story_id === storyId);
  if (dbProgIdx >= 0) db.story_progress[dbProgIdx] = updatedProgress;
  else db.story_progress.push(updatedProgress);

  const dbProfile = db.profiles.find((p) => p.id === userId);
  if (dbProfile) {
    dbProfile.total_decisions += 1;
    if (generated.is_ending && existing.story.status !== 'completed') {
      dbProfile.stories_completed += 1;
    }
  }

  saveLocalDb(db);

  const finalState = await getFullStoryState(userId, storyId, ctx);
  if (!finalState) throw new Error('Unable to reload updated story state.');
  return finalState;
}

export async function listUserStories(
  userId: string,
  ctx?: StorageContext
): Promise<{
  stories: StorySummaryItem[];
  favourite_ids: string[];
}> {
  if (shouldUseSupabase(ctx?.authProvider)) {
    const sb = getSupabaseClient(ctx?.accessToken);
    if (sb) {
      const [storiesRes, savedRes, favRes] = await Promise.all([
        sb
          .from('stories')
          .select('*')
          .eq('user_id', userId)
          .order('updated_at', { ascending: false }),
        sb.from('saved_stories').select('story_id').eq('user_id', userId),
        sb.from('favourite_stories').select('story_id').eq('user_id', userId),
      ]);

      if (storiesRes.error) {
        throw formatSupabaseError('Failed to fetch your stories', storiesRes.error);
      }

      const parsedStories = (storiesRes.data || []).map((row: any) =>
        fromSupabaseStoryRow(row)
      );
      const storyIds = parsedStories.map((p) => p.story.id);

      let progRows: any[] = [];
      let sceneRows: any[] = [];
      let branchRows: any[] = [];

      if (storyIds.length > 0) {
        const [progRes, scenesRes, branchesRes] = await Promise.all([
          sb.from('story_progress').select('*').in('story_id', storyIds),
          sb.from('story_scenes').select('story_id').in('story_id', storyIds),
          sb.from('story_branches').select('story_id').in('story_id', storyIds),
        ]);
        progRows = progRes.data || [];
        sceneRows = scenesRes.data || [];
        branchRows = branchesRes.data || [];
      }

      const progRowMap = new Map<string, any>();
      for (const p of progRows) {
        progRowMap.set(p.story_id, p);
      }
      const savedSet = new Set((savedRes.data || []).map((s: any) => String(s.story_id)));
      const favIds = (favRes.data || []).map((f: any) => String(f.story_id));
      const favSet = new Set(favIds);

      const sceneCounts = new Map<string, number>();
      for (const row of sceneRows) {
        sceneCounts.set(row.story_id, (sceneCounts.get(row.story_id) || 0) + 1);
      }
      const branchCounts = new Map<string, number>();
      for (const row of branchRows) {
        branchCounts.set(row.story_id, (branchCounts.get(row.story_id) || 0) + 1);
      }

      return {
        stories: parsedStories.map(({ story, stateBlob }) => {
          const progRow = progRowMap.get(story.id);
          const progMeta = stateBlob.progress || {};
          const progress: StoryProgressRecord = {
            story_id: story.id,
            user_id: userId,
            current_branch_id: progMeta.current_branch_id || '',
            current_scene_id: progMeta.current_scene_id || '',
            current_chapter: Number(progRow?.current_chapter) || 1,
            current_scene_number: Number(progRow?.current_scene) || 1,
            current_location: progMeta.current_location || '',
            current_objective: progMeta.current_objective || story.custom_topic,
            progress_percent:
              typeof progMeta.progress_percent === 'number'
                ? progMeta.progress_percent
                : story.status === 'completed'
                  ? 100
                  : 10,
            decisions_count: Number(progMeta.decisions_count) || 0,
            updated_at: progRow?.updated_at || story.updated_at,
          };

          return {
            story,
            progress,
            is_saved: savedSet.has(story.id),
            is_favourite: favSet.has(story.id),
            scenes_count: sceneCounts.get(story.id) || 1,
            branches_count: branchCounts.get(story.id) || 1,
          };
        }),
        favourite_ids: favIds,
      };
    }
  }

  const db = loadLocalDb();
  const userStories = db.stories
    .filter((s) => s.user_id === userId)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const savedSet = new Set(
    db.saved_stories.filter((s) => s.user_id === userId).map((s) => s.story_id)
  );
  const favIds = db.favourite_stories
    .filter((f) => f.user_id === userId)
    .map((f) => f.story_id);
  const favSet = new Set(favIds);

  return {
    stories: userStories.map((story) => ({
      story,
      progress: db.story_progress.find((p) => p.story_id === story.id) || null,
      is_saved: savedSet.has(story.id),
      is_favourite: favSet.has(story.id),
      scenes_count: db.story_scenes.filter((sc) => sc.story_id === story.id).length,
      branches_count: db.story_branches.filter((b) => b.story_id === story.id).length,
    })),
    favourite_ids: favIds,
  };
}

export async function toggleSavedStory(
  userId: string,
  storyId: string,
  ctx?: StorageContext
): Promise<boolean> {
  if (shouldUseSupabase(ctx?.authProvider)) {
    const sb = getSupabaseClient(ctx?.accessToken);
    if (sb) {
      const { data: existing, error: fetchErr } = await sb
        .from('saved_stories')
        .select('id')
        .eq('user_id', userId)
        .eq('story_id', storyId)
        .maybeSingle();

      if (fetchErr) throw formatSupabaseError('Failed to check saved state', fetchErr);

      if (existing) {
        const { error } = await sb.from('saved_stories').delete().eq('id', existing.id);
        if (error) throw formatSupabaseError('Failed to unsave story', error);
        return false;
      }
      const { error } = await sb
        .from('saved_stories')
        .insert({ user_id: userId, story_id: storyId });
      if (error) throw formatSupabaseError('Failed to save story', error);
      return true;
    }
  }

  const db = loadLocalDb();
  const idx = db.saved_stories.findIndex(
    (s) => s.user_id === userId && s.story_id === storyId
  );
  if (idx >= 0) {
    db.saved_stories.splice(idx, 1);
    saveLocalDb(db);
    return false;
  }
  db.saved_stories.push({
    id: crypto.randomUUID(),
    user_id: userId,
    story_id: storyId,
    note: '',
    created_at: new Date().toISOString(),
  });
  saveLocalDb(db);
  return true;
}

export async function toggleFavouriteStory(
  userId: string,
  storyId: string,
  ctx?: StorageContext
): Promise<boolean> {
  if (shouldUseSupabase(ctx?.authProvider)) {
    const sb = getSupabaseClient(ctx?.accessToken);
    if (sb && isUuid(storyId)) {
      const { data: existing, error: fetchErr } = await sb
        .from('favourite_stories')
        .select('id')
        .eq('user_id', userId)
        .eq('story_id', storyId)
        .maybeSingle();

      if (fetchErr) throw formatSupabaseError('Failed to check favourite state', fetchErr);

      if (existing) {
        const { error } = await sb
          .from('favourite_stories')
          .delete()
          .eq('id', existing.id);
        if (error) throw formatSupabaseError('Failed to remove favourite', error);
        return false;
      }
      const { error } = await sb
        .from('favourite_stories')
        .insert({ user_id: userId, story_id: storyId });
      if (error) throw formatSupabaseError('Failed to add favourite', error);
      return true;
    }
  }

  const db = loadLocalDb();
  const idx = db.favourite_stories.findIndex(
    (f) => f.user_id === userId && f.story_id === storyId
  );
  if (idx >= 0) {
    db.favourite_stories.splice(idx, 1);
    saveLocalDb(db);
    return false;
  }
  db.favourite_stories.push({
    id: crypto.randomUUID(),
    user_id: userId,
    story_id: storyId,
    created_at: new Date().toISOString(),
  });
  saveLocalDb(db);
  return true;
}

export async function updateStoryStatus(
  userId: string,
  storyId: string,
  status: 'in_progress' | 'paused' | 'completed',
  ctx?: StorageContext
): Promise<StoryRecord> {
  const existing = await getFullStoryState(userId, storyId, ctx);
  if (!existing || existing.story.user_id !== userId) {
    throw new Error('Story not found or access denied.');
  }
  const now = new Date().toISOString();
  const updated: StoryRecord = { ...existing.story, status, updated_at: now };

  if (shouldUseSupabase(ctx?.authProvider)) {
    const sb = getSupabaseClient(ctx?.accessToken);
    if (sb) {
      const { error } = await sb
        .from('stories')
        .update({ status, updated_at: now })
        .eq('id', storyId)
        .eq('user_id', userId);
      if (error) throw formatSupabaseError('Failed to update story status', error);
      return updated;
    }
  }

  const db = loadLocalDb();
  const st = db.stories.find((s) => s.id === storyId && s.user_id === userId);
  if (st) {
    st.status = status;
    st.updated_at = now;
    saveLocalDb(db);
  }
  return updated;
}

export async function switchCurrentScene(
  userId: string,
  storyId: string,
  sceneId: string,
  ctx?: StorageContext
): Promise<FullStoryState> {
  const existing = await getFullStoryState(userId, storyId, ctx);
  if (!existing || existing.story.user_id !== userId) {
    throw new Error('Story not found or access denied.');
  }
  const target = existing.scenes.find((s) => s.id === sceneId);
  if (!target) {
    throw new Error('Scene not found.');
  }

  const now = new Date().toISOString();
  const updatedProgress: StoryProgressRecord = {
    ...existing.progress,
    current_branch_id: target.branch_id,
    current_scene_id: target.id,
    current_chapter: target.chapter_number,
    current_scene_number: target.scene_number,
    current_location: target.current_location,
    current_objective: target.current_objective,
    updated_at: now,
  };

  if (shouldUseSupabase(ctx?.authProvider)) {
    const sb = getSupabaseClient(ctx?.accessToken);
    if (sb) {
      const nextStatus =
        !target.is_ending && existing.story.status === 'completed'
          ? 'in_progress'
          : existing.story.status;
      const updatedStory: StoryRecord = {
        ...existing.story,
        status: nextStatus,
        updated_at: now,
      };
      const nextStateBlob = buildStoryStateBlob(
        updatedStory,
        updatedProgress,
        existing.branches,
        existing.characters,
        existing.clues,
        existing.decisions
      );

      const { error: storyErr } = await sb
        .from('stories')
        .update({
          status: nextStatus,
          story_state: nextStateBlob,
          updated_at: now,
        })
        .eq('id', storyId)
        .eq('user_id', userId);
      if (storyErr) throw formatSupabaseError('Failed to switch scene', storyErr);

      const { data: existingProg } = await sb
        .from('story_progress')
        .select('id')
        .eq('story_id', storyId)
        .limit(1)
        .maybeSingle();

      if (existingProg) {
        await sb
          .from('story_progress')
          .update({
            current_chapter: updatedProgress.current_chapter,
            current_scene: updatedProgress.current_scene_number,
            updated_at: now,
          })
          .eq('id', existingProg.id);
      } else {
        await sb.from('story_progress').insert({
          story_id: storyId,
          current_chapter: updatedProgress.current_chapter,
          current_scene: updatedProgress.current_scene_number,
          updated_at: now,
        });
      }

      const refreshed = await getFullStoryState(userId, storyId, ctx);
      if (!refreshed) throw new Error('Failed to reload story after switching scene.');
      return refreshed;
    }
  }

  const db = loadLocalDb();
  const idx = db.story_progress.findIndex((p) => p.story_id === storyId);
  if (idx >= 0) db.story_progress[idx] = updatedProgress;
  else db.story_progress.push(updatedProgress);

  const st = db.stories.find((s) => s.id === storyId);
  if (st && !target.is_ending && st.status === 'completed') {
    st.status = 'in_progress';
    st.updated_at = now;
  }
  saveLocalDb(db);

  const refreshed = await getFullStoryState(userId, storyId, ctx);
  if (!refreshed) throw new Error('Failed to switch scene.');
  return refreshed;
}

export async function deleteStory(
  userId: string,
  storyId: string,
  ctx?: StorageContext
): Promise<void> {
  if (shouldUseSupabase(ctx?.authProvider)) {
    const sb = getSupabaseClient(ctx?.accessToken);
    if (sb) {
      const { error } = await sb
        .from('stories')
        .delete()
        .eq('id', storyId)
        .eq('user_id', userId);
      if (error) throw formatSupabaseError('Failed to delete story', error);
      return;
    }
  }

  const db = loadLocalDb();
  const target = db.stories.find((s) => s.id === storyId && s.user_id === userId);
  if (!target) return;

  db.stories = db.stories.filter((s) => s.id !== storyId);
  db.story_branches = db.story_branches.filter((b) => b.story_id !== storyId);
  db.story_scenes = db.story_scenes.filter((s) => s.story_id !== storyId);
  db.story_decisions = db.story_decisions.filter((d) => d.story_id !== storyId);
  db.story_characters = db.story_characters.filter((c) => c.story_id !== storyId);
  db.story_clues = db.story_clues.filter((c) => c.story_id !== storyId);
  db.story_progress = db.story_progress.filter((p) => p.story_id !== storyId);
  db.saved_stories = db.saved_stories.filter((s) => s.story_id !== storyId);
  db.favourite_stories = db.favourite_stories.filter((f) => f.story_id !== storyId);
  saveLocalDb(db);
}
