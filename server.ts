import dotenv from 'dotenv';
import express, { type NextFunction, type Request, type Response } from 'express';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import {
  appendContinuationScene,
  authenticateToken,
  createStoryWithOpening,
  deleteStory,
  ensureGuestProfile,
  getFullStoryState,
  getPersistenceMode,
  listUserStories,
  loginLocalUser,
  registerLocalUser,
  switchCurrentScene,
  toggleFavouriteStory,
  toggleSavedStory,
  updateStoryStatus,
  updateUserProfile,
  type StorageContext,
} from './server/storage.ts';
import { generateNextScene, generateOpeningScene } from './server/storyEngine.ts';
import type { CreateStoryInput, UserProfile } from './src/types/story.ts';

dotenv.config();

interface AuthedRequest extends Request {
  user?: UserProfile;
  storageCtx?: StorageContext;
}

const inFlightStories = new Set<string>();

function extractBearer(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return undefined;
  return header.slice(7).trim();
}

async function requireUser(req: AuthedRequest, res: Response, next: NextFunction) {
  try {
    const token = extractBearer(req);
    const authResult = await authenticateToken(token);
    if (!authResult) {
      return res.status(401).json({ error: 'Authentication required. Please sign in.' });
    }
    req.user = authResult.user;
    req.storageCtx = {
      accessToken: token,
      authProvider: authResult.authProvider,
    };
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(401).json({ error: 'Invalid session.' });
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '6mb' }));

  app.get('/api/config', (_req, res) => {
    res.json({
      persistence: getPersistenceMode(),
      supabaseEnabled: Boolean(
        process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY
      ),
    });
  });

  app.post('/api/auth/guest', async (req, res) => {
    try {
      const guestId =
        typeof req.body?.guestId === 'string' ? req.body.guestId : undefined;
      const result = await ensureGuestProfile(guestId);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Unable to start session.' });
    }
  });

  app.post('/api/auth/register', async (req, res) => {
    try {
      const { email, password, display_name } = req.body || {};
      const result = await registerLocalUser(
        String(email || ''),
        String(password || ''),
        String(display_name || '')
      );
      res.status(201).json(result);
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Registration failed.' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body || {};
      const result = await loginLocalUser(
        String(email || ''),
        String(password || '')
      );
      res.json(result);
    } catch (err: any) {
      res.status(401).json({ error: err?.message || 'Sign in failed.' });
    }
  });

  app.get('/api/auth/me', requireUser, (req: AuthedRequest, res) => {
    res.json({ user: req.user });
  });

  app.patch('/api/profile', requireUser, async (req: AuthedRequest, res) => {
    try {
      const { display_name, preferred_narrator } = req.body || {};
      const updated = await updateUserProfile(
        req.user!.id,
        {
          display_name: typeof display_name === 'string' ? display_name : undefined,
          preferred_narrator:
            typeof preferred_narrator === 'string' ? preferred_narrator : undefined,
        },
        req.storageCtx
      );
      res.json({ user: updated });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Could not update profile.' });
    }
  });

  // Stories Library & State Endpoints
  app.get('/api/stories', requireUser, async (req: AuthedRequest, res) => {
    try {
      const data = await listUserStories(req.user!.id, req.storageCtx);
      res.json(data);
    } catch (err: any) {
      console.error('List stories error:', err);
      res.status(500).json({ error: err?.message || 'Unable to load your stories right now.' });
    }
  });

  app.post('/api/stories', requireUser, async (req: AuthedRequest, res) => {
    try {
      const body = (req.body || {}) as Partial<CreateStoryInput>;
      const title = String(body.title || '').trim();
      const genre = String(body.genre || 'Mystery').trim();
      const protagonist_name = String(body.protagonist_name || 'Elena Vance').trim();
      const custom_topic = String(body.custom_topic || '').trim();

      if (!title || title.length > 140) {
        return res.status(400).json({ error: 'Please provide a story title (1–140 characters).' });
      }
      if (!custom_topic || custom_topic.length > 1200) {
        return res.status(400).json({ error: 'Please provide a story premise or topic.' });
      }

      const input: CreateStoryInput = {
        template_id: body.template_id || null,
        title,
        genre,
        custom_topic,
        protagonist_name,
        protagonist_personality:
          String(body.protagonist_personality || 'Observant and resolute').trim(),
        protagonist_background: String(body.protagonist_background || '').trim(),
        character_style_image:
          typeof body.character_style_image === 'string' &&
          body.character_style_image.startsWith('data:image/')
            ? body.character_style_image
            : null,
        narrator_personality: String(body.narrator_personality || 'Noir Auteur').trim(),
        difficulty: (['Story', 'Balanced', 'Unforgiving'].includes(String(body.difficulty))
          ? body.difficulty
          : 'Balanced') as CreateStoryInput['difficulty'],
        story_length: (['Short', 'Medium', 'Long'].includes(String(body.story_length))
          ? body.story_length
          : 'Medium') as CreateStoryInput['story_length'],
        perspective: (['First-Person', 'Second-Person', 'Third-Person'].includes(
          String(body.perspective)
        )
          ? body.perspective
          : 'Second-Person') as CreateStoryInput['perspective'],
        atmosphere: String(body.atmosphere || 'Atmospheric').trim(),
        setting_mode: body.setting_mode === 'Realistic' ? 'Realistic' : 'Imaginative',
        cover_image: typeof body.cover_image === 'string' ? body.cover_image : undefined,
      };

      const draftStory = {
        id: 'pending',
        user_id: req.user!.id,
        template_id: input.template_id || null,
        title: input.title,
        genre: input.genre,
        custom_topic: input.custom_topic,
        protagonist_name: input.protagonist_name,
        protagonist_personality: input.protagonist_personality,
        protagonist_background: input.protagonist_background,
        character_style_image: input.character_style_image || null,
        narrator_personality: input.narrator_personality,
        difficulty: input.difficulty,
        story_length: input.story_length,
        perspective: input.perspective,
        atmosphere: input.atmosphere,
        setting_mode: input.setting_mode,
        cover_image: input.cover_image || '',
        is_public: false,
        status: 'in_progress' as const,
        ending_type: null,
        ending_epilogue: null,
        rolling_summary: '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const opening = await generateOpeningScene(draftStory);
      const fullState = await createStoryWithOpening(
        req.user!.id,
        input,
        opening,
        req.storageCtx
      );
      res.status(201).json(fullState);
    } catch (err: any) {
      console.error('Create story error:', err);
      res.status(502).json({
        error:
          err?.message ||
          'The AI story engine encountered an error generating your opening scene. Please try again.',
      });
    }
  });

  app.get('/api/stories/:id', requireUser, async (req: AuthedRequest, res) => {
    try {
      const state = await getFullStoryState(
        req.user!.id,
        req.params.id,
        req.storageCtx
      );
      if (!state) {
        return res.status(404).json({ error: 'Story not found.' });
      }
      res.json(state);
    } catch (err: any) {
      console.error('Get story error:', err);
      res.status(500).json({ error: err?.message || 'Failed to load story state.' });
    }
  });

  app.post('/api/stories/:id/continue', requireUser, async (req: AuthedRequest, res) => {
    const storyId = req.params.id;
    if (inFlightStories.has(storyId)) {
      return res
        .status(409)
        .json({ error: 'A scene is already being generated for this story. Please wait.' });
    }

    inFlightStories.add(storyId);
    try {
      const {
        from_scene_id,
        decision_id,
        decision_text,
        is_custom_action,
        finish_story,
      } = req.body || {};

      const actionText = String(decision_text || '').trim();
      if (!finish_story && (!actionText || actionText.length > 600)) {
        return res.status(400).json({
          error: 'Please select a decision or enter a custom action (up to 600 characters).',
        });
      }

      const currentState = await getFullStoryState(
        req.user!.id,
        storyId,
        req.storageCtx
      );
      if (!currentState) {
        return res.status(404).json({ error: 'Story not found.' });
      }
      if (currentState.story.user_id !== req.user!.id) {
        return res
          .status(403)
          .json({ error: 'You do not have permission to modify this story.' });
      }

      const activeSceneId =
        typeof from_scene_id === 'string' &&
        currentState.scenes.some((s) => s.id === from_scene_id)
          ? from_scene_id
          : currentState.progress.current_scene_id;

      const effectiveState =
        activeSceneId !== currentState.progress.current_scene_id
          ? {
              ...currentState,
              progress: { ...currentState.progress, current_scene_id: activeSceneId },
            }
          : currentState;

      const effectiveDecisionText =
        finish_story && !actionText
          ? 'Bring the current threads to their decisive climax and resolution.'
          : actionText;

      const activeBranch = currentState.branches.find(
        (b) => b.id === effectiveState.progress.current_branch_id
      );

      const nextPayload = await generateNextScene(
        effectiveState,
        effectiveDecisionText,
        Boolean(is_custom_action),
        {
          finishStory: Boolean(finish_story),
          branchName: activeBranch?.branch_name,
        }
      );

      const updatedState = await appendContinuationScene(
        req.user!.id,
        storyId,
        activeSceneId,
        typeof decision_id === 'string' ? decision_id : null,
        effectiveDecisionText,
        Boolean(is_custom_action),
        nextPayload,
        req.storageCtx
      );

      res.json(updatedState);
    } catch (err: any) {
      console.error('Continue story error:', err);
      res.status(502).json({
        error:
          err?.message ||
          'Scene generation interrupted. Your previous scene is safely preserved — please retry.',
      });
    } finally {
      inFlightStories.delete(storyId);
    }
  });

  app.post('/api/stories/:id/switch-scene', requireUser, async (req: AuthedRequest, res) => {
    try {
      const sceneId = String(req.body?.scene_id || '');
      if (!sceneId) {
        return res.status(400).json({ error: 'scene_id is required.' });
      }
      const updated = await switchCurrentScene(
        req.user!.id,
        req.params.id,
        sceneId,
        req.storageCtx
      );
      res.json(updated);
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Unable to navigate to scene.' });
    }
  });

  app.patch('/api/stories/:id/status', requireUser, async (req: AuthedRequest, res) => {
    try {
      const status = req.body?.status;
      if (!['in_progress', 'paused', 'completed'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status.' });
      }
      const updated = await updateStoryStatus(
        req.user!.id,
        req.params.id,
        status,
        req.storageCtx
      );
      res.json({ story: updated });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Unable to update story status.' });
    }
  });

  app.post('/api/stories/:id/save', requireUser, async (req: AuthedRequest, res) => {
    try {
      const is_saved = await toggleSavedStory(
        req.user!.id,
        req.params.id,
        req.storageCtx
      );
      res.json({ is_saved });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Unable to save story.' });
    }
  });

  app.post('/api/favourites/:id', requireUser, async (req: AuthedRequest, res) => {
    try {
      const is_favourite = await toggleFavouriteStory(
        req.user!.id,
        req.params.id,
        req.storageCtx
      );
      res.json({ is_favourite });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Unable to toggle favourite.' });
    }
  });

  app.delete('/api/stories/:id', requireUser, async (req: AuthedRequest, res) => {
    try {
      await deleteStory(req.user!.id, req.params.id, req.storageCtx);
      res.json({ deleted: true });
    } catch (err: any) {
      res.status(400).json({ error: err?.message || 'Unable to delete story.' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`WHAT IF 3.0 server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
