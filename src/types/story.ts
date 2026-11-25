export type StoryLength = 'Short' | 'Medium' | 'Long';
export type StoryDifficulty = 'Story' | 'Balanced' | 'Unforgiving';
export type StoryPerspective = 'First-Person' | 'Second-Person' | 'Third-Person';
export type SettingMode = 'Realistic' | 'Imaginative';
export type StoryStatus = 'in_progress' | 'paused' | 'completed';
export type EndingType =
  | 'successful'
  | 'unexpected'
  | 'secret'
  | 'neutral'
  | 'failure'
  | 'alternative'
  | null;

export type StagePosition = 'left' | 'center' | 'right';
export type MovementAction =
  | 'step_forward'
  | 'step_back'
  | 'turn_away'
  | 'lean_in'
  | 'enter_left'
  | 'enter_right'
  | 'confront'
  | 'idle';

export type CharacterEmotion =
  | 'calm'
  | 'suspicious'
  | 'alarmed'
  | 'warm'
  | 'guarded'
  | 'triumphant'
  | 'tense'
  | 'melancholic';

export type ParticlePreset = 'mist' | 'embers' | 'stars' | 'rain' | 'snow' | 'dust';

export interface NarrativeParagraph {
  type: 'prose' | 'dialogue' | 'thought' | 'action';
  speaker?: string;
  text: string;
}

export interface StageCharacter {
  name: string;
  role: string;
  emotion: CharacterEmotion;
  stage_position: StagePosition;
  movement_action: MovementAction;
  dialogue_line?: string;
  relationship_delta: number;
  relationship_reason?: string;
  personality: string;
  motivation: string;
  dialogue_style?: string;
  secret_hint?: string;
  avatar_key: 'elena' | 'kaelen' | 'nyx' | 'protagonist' | 'silhouette';
}

export interface SituationSummary {
  where: string;
  who_is_present: string[];
  what_happened: string;
  what_you_know: string;
}

export interface DecisionOption {
  id: string;
  text: string;
  consequence_hint: string;
  intent_tag: string;
}

export interface StoryScene {
  id: string;
  story_id: string;
  branch_id: string;
  parent_scene_id: string | null;
  chapter_number: number;
  scene_number: number;
  scene_title: string;
  narrative_paragraphs: NarrativeParagraph[];
  current_location: string;
  atmosphere_mood: string;
  camera_motion: string;
  scene_image: string;
  situation_summary: SituationSummary;
  characters_present: StageCharacter[];
  events: string[];
  consequences: string[];
  current_objective: string;
  available_decisions: DecisionOption[];
  chosen_decision_text: string | null;
  is_custom_action: boolean;
  is_ending: boolean;
  ending_type: EndingType;
  ending_epilogue?: string | null;
  created_at: string;
}

export interface StoryDecisionRecord {
  id: string;
  story_id: string;
  scene_id: string;
  next_scene_id: string | null;
  branch_id: string;
  decision_id: string | null;
  decision_text: string;
  is_custom_action: boolean;
  consequence_summary: string;
  created_at: string;
}

export interface StoryCharacterRecord {
  id: string;
  story_id: string;
  name: string;
  role: string;
  personality: string;
  background: string;
  motivation: string;
  dialogue_style: string;
  relationship_score: number;
  relationship_label: string;
  knowledge: string[];
  secrets: string[];
  memories: string[];
  avatar_url: string;
  last_emotion: CharacterEmotion;
  updated_at: string;
}

export interface StoryClueRecord {
  id: string;
  story_id: string;
  scene_id: string | null;
  item_type: 'clue' | 'object' | 'mystery';
  title: string;
  description: string;
  status: 'active' | 'resolved';
  created_at: string;
}

export interface StoryBranchRecord {
  id: string;
  story_id: string;
  parent_branch_id: string | null;
  branch_name: string;
  origin_scene_id: string | null;
  is_active: boolean;
  created_at: string;
}

export interface StoryProgressRecord {
  story_id: string;
  user_id: string;
  current_branch_id: string;
  current_scene_id: string;
  current_chapter: number;
  current_scene_number: number;
  current_location: string;
  current_objective: string;
  progress_percent: number;
  decisions_count: number;
  updated_at: string;
}

export interface StoryRecord {
  id: string;
  user_id: string;
  template_id: string | null;
  title: string;
  genre: string;
  custom_topic: string;
  protagonist_name: string;
  protagonist_personality: string;
  protagonist_background: string;
  character_style_image: string | null;
  narrator_personality: string;
  difficulty: StoryDifficulty;
  story_length: StoryLength;
  perspective: StoryPerspective;
  atmosphere: string;
  setting_mode: SettingMode;
  cover_image: string;
  is_public: boolean;
  status: StoryStatus;
  ending_type: EndingType;
  ending_epilogue: string | null;
  rolling_summary: string;
  created_at: string;
  updated_at: string;
}

export interface FullStoryState {
  story: StoryRecord;
  progress: StoryProgressRecord;
  branches: StoryBranchRecord[];
  scenes: StoryScene[];
  decisions: StoryDecisionRecord[];
  characters: StoryCharacterRecord[];
  clues: StoryClueRecord[];
  is_saved: boolean;
  is_favourite: boolean;
}

export interface StorySummaryItem {
  story: StoryRecord;
  progress: StoryProgressRecord | null;
  is_saved: boolean;
  is_favourite: boolean;
  scenes_count: number;
  branches_count: number;
}

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string | null;
  preferred_narrator: string;
  stories_completed: number;
  total_decisions: number;
  created_at: string;
}

export interface CreateStoryInput {
  template_id?: string | null;
  title: string;
  genre: string;
  custom_topic: string;
  protagonist_name: string;
  protagonist_personality: string;
  protagonist_background: string;
  character_style_image?: string | null;
  narrator_personality: string;
  difficulty: StoryDifficulty;
  story_length: StoryLength;
  perspective: StoryPerspective;
  atmosphere: string;
  setting_mode: SettingMode;
  cover_image?: string;
}

export interface GenreDefinition {
  id: string;
  name: string;
  tagline: string;
  narrativeStyle: string;
  atmosphereDefault: string;
  particles: ParticlePreset;
  coverImage: string;
  accentHex: string;
  trending?: boolean;
}

export interface StoryTemplate {
  id: string;
  title: string;
  genre: string;
  hook: string;
  premise: string;
  defaultProtagonist: string;
  defaultPersonality: string;
  defaultBackground: string;
  defaultNarrator: string;
  atmosphere: string;
  settingMode: SettingMode;
  estimatedChapters: number;
  coverImage: string;
  featured?: boolean;
  popular?: boolean;
  starterLocation: string;
  starterTags: string[];
}

export interface NarratorPersonality {
  id: string;
  name: string;
  subtitle: string;
  voiceDirective: string;
}
