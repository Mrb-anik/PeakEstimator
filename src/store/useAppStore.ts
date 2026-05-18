import { create } from 'zustand';
import type { Profile } from '../types';
import { supabase } from '../api/supabase';

interface AppState {
  profile: Profile | null;
  loading: boolean;
  setProfile: (profile: Profile | null) => void;
  fetchProfile: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  profile: null,
  loading: false,

  setProfile: (profile) => set({ profile }),

  fetchProfile: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    set({ loading: true });
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!error && data) {
      set({ profile: data as Profile });
    }
    set({ loading: false });
  },

  updateProfile: async (updates) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select()
      .single();

    if (!error && data) {
      set({ profile: data as Profile });
    }
  },
}));
