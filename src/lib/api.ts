import type {
  CreateStoryInput,
  FullStoryState,
  StoryStatus,
  StorySummaryItem,
  UserProfile,
} from '../types/story.ts';

// Keep auth token strictly in memory (never in localStorage or sessionStorage)
let authTokenInMemory: string | null = null;

export function setAuthToken(token: string | null): void {
  authTokenInMemory = token;
}

export function getAuthToken(): string | null {
  return authTokenInMemory;
}

async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (authTokenInMemory) {
    headers.Authorization = `Bearer ${authTokenInMemory}`;
  }

  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || 'Unexpected server response.' };
  }

  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }

  return data as T;
}

export const api = {
  getConfig: () =>
    apiFetch<{ persistence: 'supabase' | 'local'; supabaseEnabled: boolean }>(
      '/api/config'
    ),

  ensureGuest: (guestId?: string) =>
    apiFetch<{ token: string; user: UserProfile }>('/api/auth/guest', {
      method: 'POST',
      body: JSON.stringify({ guestId }),
    }),

  register: (email: string, password: string, display_name: string) =>
    apiFetch<{ token: string; user: UserProfile }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, display_name }),
    }),

  login: (email: string, password: string) =>
    apiFetch<{ token: string; user: UserProfile }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  getMe: () => apiFetch<{ user: UserProfile }>('/api/auth/me'),

  updateProfile: (updates: { display_name?: string; preferred_narrator?: string }) =>
    apiFetch<{ user: UserProfile }>('/api/profile', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    }),

  listStories: () =>
    apiFetch<{ stories: StorySummaryItem[]; favourite_ids: string[] }>('/api/stories'),

  createStory: (input: CreateStoryInput) =>
    apiFetch<FullStoryState>('/api/stories', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  getStory: (storyId: string) =>
    apiFetch<FullStoryState>(`/api/stories/${encodeURIComponent(storyId)}`),

  continueStory: (
    storyId: string,
    payload: {
      from_scene_id: string;
      decision_id?: string | null;
      decision_text: string;
      is_custom_action: boolean;
      finish_story?: boolean;
    }
  ) =>
    apiFetch<FullStoryState>(`/api/stories/${encodeURIComponent(storyId)}/continue`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  switchScene: (storyId: string, sceneId: string) =>
    apiFetch<FullStoryState>(
      `/api/stories/${encodeURIComponent(storyId)}/switch-scene`,
      {
        method: 'POST',
        body: JSON.stringify({ scene_id: sceneId }),
      }
    ),

  updateStoryStatus: (storyId: string, status: StoryStatus) =>
    apiFetch<{ story: FullStoryState['story'] }>(
      `/api/stories/${encodeURIComponent(storyId)}/status`,
      {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }
    ),

  toggleSaveStory: (storyId: string) =>
    apiFetch<{ is_saved: boolean }>(
      `/api/stories/${encodeURIComponent(storyId)}/save`,
      { method: 'POST' }
    ),

  toggleFavourite: (id: string) =>
    apiFetch<{ is_favourite: boolean }>(
      `/api/favourites/${encodeURIComponent(id)}`,
      { method: 'POST' }
    ),

  deleteStory: (storyId: string) =>
    apiFetch<{ deleted: boolean }>(`/api/stories/${encodeURIComponent(storyId)}`, {
      method: 'DELETE',
    }),
};
