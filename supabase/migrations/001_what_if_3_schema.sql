-- WHAT IF 3.0 — Complete Supabase PostgreSQL Schema & Row Level Security
-- Run this migration in your Supabase SQL Editor to provision all 10 tables.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. profiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL,
  email TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  preferred_narrator TEXT DEFAULT 'Noir Auteur',
  stories_completed INTEGER DEFAULT 0,
  total_decisions INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. stories
CREATE TABLE IF NOT EXISTS public.stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  template_id TEXT,
  title TEXT NOT NULL,
  genre TEXT NOT NULL,
  custom_topic TEXT,
  protagonist_name TEXT NOT NULL,
  protagonist_personality TEXT NOT NULL,
  protagonist_background TEXT,
  character_style_image TEXT,
  narrator_personality TEXT NOT NULL DEFAULT 'Noir Auteur',
  difficulty TEXT NOT NULL DEFAULT 'Balanced',
  story_length TEXT NOT NULL DEFAULT 'Medium',
  perspective TEXT NOT NULL DEFAULT 'Second-Person',
  atmosphere TEXT NOT NULL DEFAULT 'Atmospheric',
  setting_mode TEXT NOT NULL DEFAULT 'Imaginative',
  cover_image TEXT,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'in_progress',
  ending_type TEXT,
  ending_epilogue TEXT,
  rolling_summary TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. story_branches
CREATE TABLE IF NOT EXISTS public.story_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  parent_branch_id UUID REFERENCES public.story_branches(id) ON DELETE SET NULL,
  branch_name TEXT NOT NULL,
  origin_scene_id UUID,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. story_scenes
CREATE TABLE IF NOT EXISTS public.story_scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.story_branches(id) ON DELETE SET NULL,
  parent_scene_id UUID REFERENCES public.story_scenes(id) ON DELETE SET NULL,
  chapter_number INTEGER NOT NULL DEFAULT 1,
  scene_number INTEGER NOT NULL DEFAULT 1,
  scene_title TEXT NOT NULL,
  narrative_paragraphs JSONB NOT NULL DEFAULT '[]'::jsonb,
  current_location TEXT NOT NULL,
  atmosphere_mood TEXT NOT NULL DEFAULT 'mysterious',
  camera_motion TEXT NOT NULL DEFAULT 'slow-push',
  scene_image TEXT,
  situation_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  characters_present JSONB NOT NULL DEFAULT '[]'::jsonb,
  events JSONB NOT NULL DEFAULT '[]'::jsonb,
  consequences JSONB NOT NULL DEFAULT '[]'::jsonb,
  current_objective TEXT NOT NULL DEFAULT '',
  available_decisions JSONB NOT NULL DEFAULT '[]'::jsonb,
  chosen_decision_text TEXT,
  is_custom_action BOOLEAN NOT NULL DEFAULT FALSE,
  is_ending BOOLEAN NOT NULL DEFAULT FALSE,
  ending_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. story_decisions
CREATE TABLE IF NOT EXISTS public.story_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  scene_id UUID NOT NULL REFERENCES public.story_scenes(id) ON DELETE CASCADE,
  next_scene_id UUID REFERENCES public.story_scenes(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES public.story_branches(id) ON DELETE SET NULL,
  decision_id TEXT,
  decision_text TEXT NOT NULL,
  is_custom_action BOOLEAN NOT NULL DEFAULT FALSE,
  consequence_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. story_characters
CREATE TABLE IF NOT EXISTS public.story_characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  personality TEXT NOT NULL,
  background TEXT NOT NULL DEFAULT '',
  motivation TEXT NOT NULL DEFAULT '',
  dialogue_style TEXT NOT NULL DEFAULT '',
  relationship_score INTEGER NOT NULL DEFAULT 0,
  relationship_label TEXT NOT NULL DEFAULT 'Neutral',
  knowledge JSONB NOT NULL DEFAULT '[]'::jsonb,
  secrets JSONB NOT NULL DEFAULT '[]'::jsonb,
  memories JSONB NOT NULL DEFAULT '[]'::jsonb,
  avatar_url TEXT,
  last_emotion TEXT NOT NULL DEFAULT 'calm',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(story_id, name)
);

-- 7. story_clues
CREATE TABLE IF NOT EXISTS public.story_clues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  scene_id UUID REFERENCES public.story_scenes(id) ON DELETE SET NULL,
  item_type TEXT NOT NULL DEFAULT 'clue', -- 'clue' | 'object' | 'mystery'
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'resolved'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. story_progress
CREATE TABLE IF NOT EXISTS public.story_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id UUID UNIQUE NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  current_branch_id UUID REFERENCES public.story_branches(id) ON DELETE SET NULL,
  current_scene_id UUID REFERENCES public.story_scenes(id) ON DELETE SET NULL,
  current_chapter INTEGER NOT NULL DEFAULT 1,
  current_scene_number INTEGER NOT NULL DEFAULT 1,
  current_location TEXT NOT NULL DEFAULT '',
  current_objective TEXT NOT NULL DEFAULT '',
  progress_percent INTEGER NOT NULL DEFAULT 0,
  decisions_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. saved_stories
CREATE TABLE IF NOT EXISTS public.saved_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  story_id UUID NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, story_id)
);

-- 10. favourite_stories
CREATE TABLE IF NOT EXISTS public.favourite_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  story_id TEXT NOT NULL, -- supports both template IDs and user story UUIDs
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, story_id)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_stories_user_id ON public.stories(user_id);
CREATE INDEX IF NOT EXISTS idx_story_scenes_story_id ON public.story_scenes(story_id);
CREATE INDEX IF NOT EXISTS idx_story_decisions_story_id ON public.story_decisions(story_id);
CREATE INDEX IF NOT EXISTS idx_story_characters_story_id ON public.story_characters(story_id);
CREATE INDEX IF NOT EXISTS idx_story_clues_story_id ON public.story_clues(story_id);
CREATE INDEX IF NOT EXISTS idx_story_branches_story_id ON public.story_branches(story_id);

-- Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_clues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favourite_stories ENABLE ROW LEVEL SECURITY;

-- Policies: Users can only read/write their own data unless story is explicitly public
CREATE POLICY "profiles_own_access" ON public.profiles
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "stories_own_or_public_read" ON public.stories
  FOR SELECT USING (auth.uid() = user_id OR is_public = TRUE);

CREATE POLICY "stories_own_write" ON public.stories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "stories_own_update" ON public.stories
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "stories_own_delete" ON public.stories
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "story_branches_owner_access" ON public.story_branches
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND (s.user_id = auth.uid() OR s.is_public = TRUE))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.user_id = auth.uid())
  );

CREATE POLICY "story_scenes_owner_access" ON public.story_scenes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND (s.user_id = auth.uid() OR s.is_public = TRUE))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.user_id = auth.uid())
  );

CREATE POLICY "story_decisions_owner_access" ON public.story_decisions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND (s.user_id = auth.uid() OR s.is_public = TRUE))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.user_id = auth.uid())
  );

CREATE POLICY "story_characters_owner_access" ON public.story_characters
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND (s.user_id = auth.uid() OR s.is_public = TRUE))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.user_id = auth.uid())
  );

CREATE POLICY "story_clues_owner_access" ON public.story_clues
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND (s.user_id = auth.uid() OR s.is_public = TRUE))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.user_id = auth.uid())
  );

CREATE POLICY "story_progress_own_access" ON public.story_progress
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "saved_stories_own_access" ON public.saved_stories
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "favourite_stories_own_access" ON public.favourite_stories
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
