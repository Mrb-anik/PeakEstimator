import { useState, useMemo } from 'react';
import { X, Search, Plus } from 'lucide-react';
import { usePriceBook } from '../../hooks/usePriceBook';
import type { PriceBookItem, CategoryType, TradeType } from '../../types';
import { CATEGORY_COLORS } from '../../types';
import { toast } from 'sonner';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  projectTrade: TradeType;
  onAddItem: (item: Partial<import('../../types').ProjectItem>) => void;
}

const CATEGORIES: { value: CategoryType | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'material', label: 'Material' },
  { value: 'labor', label: 'Labor' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'other', label: 'Other' },
];

export default function PriceBookDrawer({ isOpen, onClose, projectTrade, onAddItem }: Props) {
  const { items, addItem } = usePriceBook();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryType | 'all'>('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState<Partial<PriceBookItem>>({
    name: '', category: 'material', default_unit_price: 0, unit: 'ea', trade: projectTrade, default_markup: 15,
  });

  const filtered = useMemo(() => {
    return items.filter(item => {
      const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
      const matchCategory = categoryFilter === 'all' || item.category === categoryFilter;
      return matchSearch && matchCategory;
    }).sort((a, b) => {
      // Show current trade first
      if (a.trade === projectTrade && b.trade !== projectTrade) return -1;
      if (b.trade === projectTrade && a.trade !== projectTrade) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [items, search, categoryFilter, projectTrade]);

  const handleUseItem = (item: PriceBookItem) => {
    onAddItem({
      description: item.name,
      quantity: 1,
      unit: item.unit,
      unit_price: item.default_unit_price,
      category: item.category,
      markup: item.default_markup,
      from_price_book: true,
    });
    toast.success(`Added: ${item.name}`);
  };

  const handleAddCustom = async () => {
    if (!newItem.name) { toast.error('Name required'); return; }
    await addItem(newItem);
    setNewItem({ name: '', category: 'material', default_unit_price: 0, unit: 'ea', trade: projectTrade, default_markup: 15 });
    setShowAddForm(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-navy-950/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-full max-w-lg h-full bg-white dark:bg-navy-900 border-l border-slate-200 dark:border-navy-800 shadow-2xl flex flex-col z-10 animate-slide-in-right">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-navy-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold font-sora text-slate-905 dark:text-white">Price Book</h2>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Quickly select or add items to your project estimate</p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 text-slate-400 dark:text-slate-500 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin space-y-6">
          {showAddForm ? (
            <div className="space-y-4 border border-slate-100 dark:border-navy-800 bg-slate-50/50 dark:bg-navy-950/20 rounded-2xl p-5 animate-scale-in">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold font-sora text-slate-800 dark:text-slate-200">Create New Catalog Item</h3>
                <button 
                  type="button" 
                  onClick={() => setShowAddForm(false)}
                  className="text-xs text-copper hover:text-copper-hover font-semibold transition-colors"
                >
                  Cancel
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Item Name *</label>
                <input 
                  type="text"
                  placeholder="e.g. Copper Pipe 1/2 inch"
                  value={newItem.name || ''}
                  onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-800 rounded-xl text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:border-copper focus:ring-1 focus:ring-copper/40 transition-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Category</label>
                  <select
                    value={newItem.category}
                    onChange={(e) => setNewItem(prev => ({ ...prev, category: e.target.value as CategoryType }))}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-800 rounded-xl text-sm text-slate-800 dark:text-slate-100 focus:border-copper focus:ring-1 focus:ring-copper/40 transition-all"
                  >
                    <option value="material">Material</option>
                    <option value="labor">Labor</option>
                    <option value="equipment">Equipment</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Unit</label>
                  <input 
                    type="text"
                    placeholder="ea, hr, ft, etc."
                    value={newItem.unit || ''}
                    onChange={(e) => setNewItem(prev => ({ ...prev, unit: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-800 rounded-xl text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:border-copper focus:ring-1 focus:ring-copper/40 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Cost/Unit ($)</label>
                  <input 
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={newItem.default_unit_price || ''}
                    onChange={(e) => setNewItem(prev => ({ ...prev, default_unit_price: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-800 rounded-xl text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:border-copper focus:ring-1 focus:ring-copper/40 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">Default Markup (%)</label>
                  <input 
                    type="number"
                    placeholder="15"
                    value={newItem.default_markup || ''}
                    onChange={(e) => setNewItem(prev => ({ ...prev, default_markup: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3.5 py-2.5 bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-800 rounded-xl text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:border-copper focus:ring-1 focus:ring-copper/40 transition-all"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleAddCustom}
                className="w-full mt-2 py-3 bg-copper hover:bg-copper-hover text-white text-sm font-semibold rounded-xl transition-all duration-250 flex items-center justify-center gap-2 shadow-sm"
              >
                <Plus className="w-4 h-4" /> Save to Price Book
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Search and Filters */}
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search price book..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-navy-950 border border-slate-200 dark:border-navy-800 rounded-xl text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:border-copper focus:ring-1 focus:ring-copper/40 transition-all"
                  />
                </div>

                {/* Category Tags */}
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.value}
                      onClick={() => setCategoryFilter(cat.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide border transition-all ${
                        categoryFilter === cat.value
                          ? 'bg-navy-900 dark:bg-white text-white dark:text-navy-950 border-navy-900 dark:border-white shadow-sm'
                          : 'bg-white dark:bg-navy-950 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-navy-800 hover:bg-slate-50 dark:hover:bg-navy-800'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                  
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="ml-auto flex items-center gap-1 text-xs font-bold text-copper hover:text-copper-hover transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Custom
                  </button>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2.5">
                {filtered.length === 0 ? (
                  <div className="text-center py-10 border border-dashed border-slate-200 dark:border-navy-800 rounded-2xl">
                    <span className="text-2xl">📖</span>
                    <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 mt-2">No matching items</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Try another category or add a new custom item.</p>
                  </div>
                ) : (
                  filtered.map((item) => {
                    const isMatchedTrade = item.trade === projectTrade;
                    return (
                      <div 
                        key={item.id} 
                        className={`p-4 border rounded-xl flex items-center justify-between transition-all group ${
                          isMatchedTrade 
                            ? 'bg-slate-50/50 dark:bg-navy-950/20 border-slate-200 dark:border-navy-800/80' 
                            : 'bg-white dark:bg-navy-900 border-slate-100 dark:border-navy-800/50'
                        }`}
                      >
                        <div className="space-y-1 pr-4 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-copper transition-colors">
                              {item.name}
                            </span>
                            {item.is_global && (
                              <span className="bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                                Global
                              </span>
                            )}
                            {isMatchedTrade && (
                              <span className="bg-copper-100/60 dark:bg-copper-900/30 text-copper-700 dark:text-copper-300 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                                Trade Match
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${CATEGORY_COLORS[item.category] || 'category-other'}`}>
                              {item.category}
                            </span>
                            <span>•</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              ${item.default_unit_price.toFixed(2)} / {item.unit}
                            </span>
                            {item.default_markup > 0 && (
                              <>
                                <span>•</span>
                                <span>{item.default_markup}% markup</span>
                              </>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleUseItem(item)}
                          className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-navy-950 hover:bg-copper hover:text-white dark:hover:bg-copper dark:hover:text-white border border-slate-200 dark:border-navy-800 flex items-center justify-center text-slate-600 dark:text-slate-400 transition-all shadow-sm"
                          title="Add to estimate"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


