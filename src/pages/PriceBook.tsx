import { useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, Search, Check, X } from 'lucide-react';
import { usePriceBook } from '../hooks/usePriceBook';
import type { PriceBookItem, CategoryType, TradeType } from '../types';
import { TRADE_EMOJIS, CATEGORY_COLORS } from '../types';
import { toast } from 'sonner';

const TRADES = ['all', 'electrical', 'roofing', 'hvac', 'painting', 'plumbing', 'drain', 'general', 'other'] as const;
const CATEGORIES = ['all', 'material', 'labor', 'equipment', 'other'] as const;

type TradeFilter = typeof TRADES[number];
type CategoryFilter = typeof CATEGORIES[number];

const BLANK_ITEM: Partial<PriceBookItem> = {
  name: '', description: '', trade: 'general', category: 'material',
  default_unit_price: 0, unit: 'ea', default_markup: 15, tags: '',
};

export default function PriceBook() {
  const { items, loading, addItem, updateItem, deleteItem, globalCount, customCount } = usePriceBook();
  const [search, setSearch] = useState('');
  const [tradeFilter, setTradeFilter] = useState<TradeFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<PriceBookItem>>(BLANK_ITEM);

  const filtered = useMemo(() => {
    return items.filter(item => {
      const matchSearch = !search ||
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        (item.description || '').toLowerCase().includes(search.toLowerCase());
      const matchTrade = tradeFilter === 'all' || item.trade === tradeFilter;
      const matchCat = categoryFilter === 'all' || item.category === categoryFilter;
      return matchSearch && matchTrade && matchCat;
    });
  }, [items, search, tradeFilter, categoryFilter]);

  const handleSave = async () => {
    if (!formData.name) { toast.error('Name is required'); return; }
    if (editingId) {
      await updateItem(editingId, formData);
      setEditingId(null);
    } else {
      await addItem(formData);
      setShowForm(false);
    }
    setFormData(BLANK_ITEM);
  };

  const handleEdit = (item: PriceBookItem) => {
    setEditingId(item.id);
    setFormData({ ...item });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this price book item?')) return;
    await deleteItem(id);
  };

  const handleCancel = () => {
    setEditingId(null);
    setShowForm(false);
    setFormData(BLANK_ITEM);
  };

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto animate-fade-in font-inter select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-sora font-extrabold text-text-primary dark:text-text-darkPrimary">Price Book</h1>
          <p className="text-text-secondary dark:text-text-darkSecondary text-sm mt-0.5">
            {globalCount} standard rates + {customCount} custom item{customCount !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          id="add-price-book-item"
          onClick={() => { setShowForm(true); setEditingId(null); setFormData(BLANK_ITEM); }}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-copper hover:bg-copper-hover active:bg-copper-600 text-white rounded-xl font-bold text-sm transition-all shadow-md hover:-translate-y-0.5 active:translate-y-0 w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" />
          Add Item
        </button>
      </div>

      {/* Add form drawer wrapper */}
      {showForm && (
        <div className="bg-slate-50 dark:bg-navy border border-app-border dark:border-navy-800 rounded-2xl p-6 mb-6 shadow-sm animate-scale-in">
          <h3 className="text-sm sm:text-base font-sora font-bold text-text-primary dark:text-text-darkPrimary mb-4">New Price Book Item</h3>
          <ItemForm data={formData} onChange={setFormData} onSave={handleSave} onCancel={handleCancel} />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row md:items-center gap-4 mb-6">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="Search price book..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-navy border border-slate-200 dark:border-navy-800 rounded-xl text-sm text-text-primary dark:text-text-darkPrimary placeholder-slate-400 dark:placeholder-slate-500 focus:border-copper focus:ring-1 focus:ring-copper/40 transition-all shadow-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <select
              value={tradeFilter}
              onChange={e => setTradeFilter(e.target.value as TradeFilter)}
              className="pl-4 pr-10 py-2.5 bg-white dark:bg-navy border border-slate-200 dark:border-navy-800 rounded-xl text-sm text-text-primary dark:text-text-darkPrimary focus:border-copper focus:ring-1 focus:ring-copper/40 transition-all shadow-sm cursor-pointer appearance-none min-w-[150px]"
            >
              <option value="all">All Trades</option>
              {TRADES.filter(t => t !== 'all').map(t => (
                <option key={t} value={t}>
                  {TRADE_EMOJIS[t as TradeType]} {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-text-secondary dark:text-text-darkSecondary">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-white dark:bg-navy border border-slate-200 dark:border-navy-800 rounded-xl p-1 shadow-sm overflow-x-auto scrollbar-thin">
            {CATEGORIES.map(c => (
              <button
                key={c}
                onClick={() => setCategoryFilter(c)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                  categoryFilter === c 
                    ? 'bg-copper text-white shadow-sm' 
                    : 'text-text-secondary dark:text-text-darkSecondary hover:text-text-primary dark:hover:text-white hover:bg-slate-50 dark:hover:bg-navy-950'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white dark:bg-navy border border-app-border dark:border-navy-800 shadow-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-20 flex justify-center">
            <div className="w-8 h-8 border-4 border-copper border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-text-secondary dark:text-text-darkSecondary text-sm font-semibold">
            No items found
          </div>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <div className="min-w-[950px] divide-y divide-app-border dark:divide-navy-800">
              {/* Header */}
              <div className="grid grid-cols-12 gap-3 px-6 py-4 bg-slate-50 dark:bg-navy-950 border-b border-app-border dark:border-navy-800">
                <div className="col-span-4 text-[10px] font-bold text-text-secondary dark:text-text-darkSecondary uppercase tracking-wider">Item Name & Description</div>
                <div className="col-span-2 text-[10px] font-bold text-text-secondary dark:text-text-darkSecondary uppercase tracking-wider">Trade</div>
                <div className="col-span-2 text-[10px] font-bold text-text-secondary dark:text-text-darkSecondary uppercase tracking-wider">Category</div>
                <div className="col-span-1 text-[10px] font-bold text-text-secondary dark:text-text-darkSecondary uppercase tracking-wider">Unit</div>
                <div className="col-span-1 text-[10px] font-bold text-text-secondary dark:text-text-darkSecondary uppercase tracking-wider text-right">Unit Price</div>
                <div className="col-span-1 text-[10px] font-bold text-text-secondary dark:text-text-darkSecondary uppercase tracking-wider text-right">Default Markup</div>
                <div className="col-span-1 text-[10px] font-bold text-text-secondary dark:text-text-darkSecondary uppercase tracking-wider text-right">Actions</div>
              </div>

              {/* Rows */}
              <div className="divide-y divide-app-border dark:divide-navy-800">
                {filtered.map(item => (
                  editingId === item.id ? (
                    <div key={item.id} className="px-6 py-5 bg-slate-50/50 dark:bg-navy-950/40 border-y border-copper/10">
                      <ItemForm data={formData} onChange={setFormData} onSave={handleSave} onCancel={handleCancel} />
                    </div>
                  ) : (
                    <div
                      key={item.id}
                      className="grid grid-cols-12 gap-3 px-6 py-4 hover:bg-slate-50 dark:hover:bg-navy-950/60 items-center group transition-colors"
                    >
                      <div className="col-span-4 min-w-0 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-text-primary dark:text-text-darkPrimary truncate">{item.name}</span>
                          {item.is_global && (
                            <span className="flex-shrink-0 px-2 py-0.5 bg-slate-100 dark:bg-navy-950 text-slate-500 dark:text-slate-400 rounded border border-slate-200 dark:border-navy-850 text-[10px] font-bold uppercase tracking-wide">
                              Global
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <div className="text-xs text-text-secondary dark:text-text-darkSecondary truncate mt-0.5 font-medium">{item.description}</div>
                        )}
                      </div>
                      
                      <div className="col-span-2 text-sm text-text-primary dark:text-text-darkPrimary capitalize font-semibold">
                        {item.trade ? `${TRADE_EMOJIS[item.trade as TradeType]} ${item.trade}` : '—'}
                      </div>
                      
                      <div className="col-span-2">
                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider capitalize ${CATEGORY_COLORS[item.category]}`}>
                          {item.category}
                        </span>
                      </div>
                      
                      <div className="col-span-1 text-sm text-text-secondary dark:text-text-darkSecondary font-medium">{item.unit}</div>
                      
                      <div className="col-span-1 text-sm font-bold text-text-primary dark:text-text-darkPrimary text-right">
                        ${item.default_unit_price.toFixed(2)}
                      </div>
                      
                      <div className="col-span-1 text-sm text-text-secondary dark:text-text-darkSecondary font-semibold text-right">
                        {item.default_markup}%
                      </div>
                      
                      <div className="col-span-1 flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                        {!item.is_global && (
                          <>
                            <button
                              onClick={() => handleEdit(item)}
                              className="md:opacity-0 group-hover:opacity-100 p-1.5 text-text-secondary dark:text-text-darkSecondary hover:text-copper hover:bg-slate-100 dark:hover:bg-navy-950 rounded-lg transition-all"
                              title="Edit Rate"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="md:opacity-0 group-hover:opacity-100 p-1.5 text-text-secondary dark:text-text-darkSecondary hover:text-status-danger hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-all"
                              title="Delete Rate"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ItemForm({
  data,
  onChange,
  onSave,
  onCancel,
}: {
  data: Partial<PriceBookItem>;
  onChange: (d: Partial<PriceBookItem>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const inputClass = 'w-full px-3.5 py-2.5 bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-xl text-sm text-text-primary dark:text-text-darkPrimary placeholder-slate-400 dark:placeholder-slate-500 focus:border-copper focus:ring-1 focus:ring-copper/40 transition-all';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary dark:text-text-darkSecondary mb-1.5">Item Name *</label>
          <input
            type="text"
            value={data.name || ''}
            onChange={e => onChange({ ...data, name: e.target.value })}
            placeholder="e.g. 14/2 NMD90 Romex Wire"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary dark:text-text-darkSecondary mb-1.5">Trade Discipline</label>
          <div className="relative">
            <select
              value={data.trade || 'general'}
              onChange={e => onChange({ ...data, trade: e.target.value as TradeType })}
              className={`${inputClass} appearance-none cursor-pointer pr-10`}
            >
              {['electrical', 'roofing', 'hvac', 'painting', 'plumbing', 'drain', 'general', 'other'].map(t => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-text-secondary dark:text-text-darkSecondary">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
            </div>
          </div>
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary dark:text-text-darkSecondary mb-1.5">Item Description (Optional)</label>
        <textarea
          value={data.description || ''}
          onChange={e => onChange({ ...data, description: e.target.value })}
          placeholder="Brief details about material specifications or labor parameters..."
          className={`${inputClass} min-h-[70px] resize-y`}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary dark:text-text-darkSecondary mb-1.5">Category</label>
          <div className="relative">
            <select
              value={data.category || 'material'}
              onChange={e => onChange({ ...data, category: e.target.value as CategoryType })}
              className={`${inputClass} appearance-none cursor-pointer pr-10`}
            >
              {['material', 'labor', 'equipment', 'other'].map(c => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-text-secondary dark:text-text-darkSecondary">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
            </div>
          </div>
        </div>
        
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary dark:text-text-darkSecondary mb-1.5">Unit Price</label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-sm">$</span>
            <input
              type="number"
              value={data.default_unit_price || 0}
              onChange={e => onChange({ ...data, default_unit_price: parseFloat(e.target.value) || 0 })}
              className={`${inputClass} pl-7`}
              min="0"
              step="0.01"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary dark:text-text-darkSecondary mb-1.5">Unit of Measure</label>
          <div className="relative">
            <select
              value={data.unit || 'ea'}
              onChange={e => onChange({ ...data, unit: e.target.value })}
              className={`${inputClass} appearance-none cursor-pointer pr-10`}
            >
              {['ea', 'hr', 'ft', 'lf', 'sq', 'sqft', 'gal', 'lb', 'cy', 'day', 'visit', 'job'].map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-text-secondary dark:text-text-darkSecondary">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
            </div>
          </div>
        </div>
        
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary dark:text-text-darkSecondary mb-1.5">Default Markup</label>
          <div className="relative">
            <input
              type="number"
              value={data.default_markup ?? 15}
              onChange={e => onChange({ ...data, default_markup: parseFloat(e.target.value) || 0 })}
              className={`${inputClass} pr-8`}
              min="0"
              max="100"
            />
            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-sm">%</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 justify-end pt-2">
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 px-5 py-2.5 bg-white dark:bg-navy border border-slate-200 dark:border-navy-750 text-text-secondary dark:text-text-darkSecondary rounded-xl text-sm font-bold hover:bg-slate-50 dark:hover:bg-navy-950 transition-all cursor-pointer"
        >
          <X className="w-4 h-4" /> Cancel
        </button>
        <button
          onClick={onSave}
          className="flex items-center gap-1.5 px-5 py-2.5 bg-copper hover:bg-copper-hover active:bg-copper-600 text-white rounded-xl text-sm font-bold transition-all shadow-md active:translate-y-0 hover:-translate-y-0.5 cursor-pointer"
        >
          <Check className="w-4 h-4" /> Save Item
        </button>
      </div>
    </div>
  );
}
