import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../api/supabase';
import type { PriceBookItem } from '../types';
import { toast } from 'sonner';

export function usePriceBook() {
  const [items, setItems] = useState<PriceBookItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('price_book')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      toast.error('Failed to load price book');
    } else {
      setItems((data as PriceBookItem[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const addItem = async (item: Partial<PriceBookItem>): Promise<PriceBookItem | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('price_book')
      .insert({
        ...item,
        user_id: user.id,
        is_global: false,
      })
      .select()
      .single();

    if (error) {
      toast.error('Failed to add item');
      return null;
    }

    const created = data as PriceBookItem;
    setItems(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
    toast.success('Item added to price book');
    return created;
  };

  const updateItem = async (id: string, updates: Partial<PriceBookItem>): Promise<void> => {
    const { error } = await supabase
      .from('price_book')
      .update(updates)
      .eq('id', id);

    if (error) {
      toast.error('Failed to update item');
      return;
    }

    setItems(prev => prev.map(item => (item.id === id ? { ...item, ...updates } : item)));
    toast.success('Item updated');
  };

  const deleteItem = async (id: string): Promise<void> => {
    const { error } = await supabase.from('price_book').delete().eq('id', id);

    if (error) {
      toast.error('Failed to delete item');
      return;
    }

    setItems(prev => prev.filter(item => item.id !== id));
    toast.success('Item deleted');
  };

  const globalCount = items.filter(i => i.is_global).length;
  const customCount = items.filter(i => !i.is_global).length;

  return { items, loading, fetchItems, addItem, updateItem, deleteItem, globalCount, customCount };
}
