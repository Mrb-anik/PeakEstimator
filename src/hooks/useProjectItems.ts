import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../api/supabase';
import type { ProjectItem, CategoryType } from '../types';
import { toast } from 'sonner';

export function useProjectItems(projectId: string | undefined) {
  const [items, setItems] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchItems = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('project_items')
      .select('*')
      .eq('project_id', projectId)
      .order('sort_order', { ascending: true });

    if (error) {
      toast.error('Failed to load line items');
    } else {
      setItems((data as ProjectItem[]) || []);
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const addItem = async (itemData?: Partial<ProjectItem>): Promise<ProjectItem | null> => {
    if (!projectId) return null;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const maxOrder = items.length > 0 ? Math.max(...items.map(i => i.sort_order)) + 1 : 0;

    const newItem = {
      project_id: projectId,
      user_id: user.id,
      description: itemData?.description || '',
      quantity: itemData?.quantity ?? 1,
      unit: itemData?.unit || 'ea',
      unit_price: itemData?.unit_price ?? 0,
      category: (itemData?.category || 'material') as CategoryType,
      markup: itemData?.markup ?? 15,
      sort_order: maxOrder,
      from_price_book: itemData?.from_price_book ?? false,
    };

    const { data, error } = await supabase
      .from('project_items')
      .insert(newItem)
      .select()
      .single();

    if (error) {
      toast.error('Failed to add item');
      return null;
    }

    const created = data as ProjectItem;
    setItems(prev => [...prev, created]);
    return created;
  };

  const updateItem = useCallback((id: string, updates: Partial<ProjectItem>) => {
    // Optimistic UI update
    setItems(prev =>
      prev.map(item => (item.id === id ? { ...item, ...updates } : item))
    );

    // Debounced save
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const { error } = await supabase
        .from('project_items')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        toast.error('Failed to save changes');
      }
    }, 800);
  }, []);

  const deleteItem = async (id: string): Promise<void> => {
    const { error } = await supabase.from('project_items').delete().eq('id', id);

    if (error) {
      toast.error('Failed to delete item');
      return;
    }

    setItems(prev => prev.filter(item => item.id !== id));
  };

  const reorderItems = async (newItems: ProjectItem[]): Promise<void> => {
    setItems(newItems);

    const updates = newItems.map((item, index) => ({
      id: item.id,
      sort_order: index,
    }));

    // Update sort_order for each item
    for (const update of updates) {
      await supabase
        .from('project_items')
        .update({ sort_order: update.sort_order })
        .eq('id', update.id);
    }
  };

  return { items, loading, fetchItems, addItem, updateItem, deleteItem, reorderItems, setItems };
}
