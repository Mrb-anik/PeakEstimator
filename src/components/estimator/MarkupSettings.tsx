import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { Project } from '../../types';

interface Props {
  project: Project;
  onUpdate: (updates: Partial<Project>) => void;
}

export default function MarkupSettings({ project, onUpdate }: Props) {
  const [open, setOpen] = useState(false);

  const handleChange = (field: string, value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0) {
      onUpdate({ [field]: num });
    }
  };
  return (
    <div className="bg-white dark:bg-navy-900 rounded-2xl border border-slate-100 dark:border-navy-800/80 shadow-card overflow-hidden transition-all duration-200">
      <button
        id="markup-settings-toggle"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/50 dark:hover:bg-navy-800/40 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200 font-sora">Markup & Tax Settings</span>
          <span className="px-2.5 py-0.5 bg-copper-50/50 dark:bg-copper-950/20 text-copper border border-copper-100/50 dark:border-copper-900/30 rounded text-xs font-bold font-sora">
            L:{project.labor_markup}% · M:{project.material_markup}% · E:{project.equipment_markup}% · T:{project.tax_rate}%
          </span>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-slate-400 dark:text-slate-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500" />
        )}
      </button>

      {open && (
        <div className="px-5 pb-5 grid grid-cols-2 md:grid-cols-4 gap-4 border-t border-slate-100 dark:border-navy-800 pt-4 animate-fade-in">
          <MarkupField
            label="Labor Markup"
            value={project.labor_markup}
            field="labor_markup"
            color="blue"
            onChange={handleChange}
          />
          <MarkupField
            label="Material Markup"
            value={project.material_markup}
            field="material_markup"
            color="emerald"
            onChange={handleChange}
          />
          <MarkupField
            label="Equipment Markup"
            value={project.equipment_markup}
            field="equipment_markup"
            color="amber"
            onChange={handleChange}
          />
          <MarkupField
            label="Tax Rate"
            value={project.tax_rate}
            field="tax_rate"
            color="violet"
            onChange={handleChange}
          />
        </div>
      )}
    </div>
  );
}

function MarkupField({
  label,
  value,
  field,
  color,
  onChange,
}: {
  label: string;
  value: number;
  field: string;
  color: 'blue' | 'emerald' | 'amber' | 'violet';
  onChange: (field: string, value: string) => void;
}) {
  const textColorMap = {
    blue: 'text-blue-600 dark:text-blue-400',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    amber: 'text-amber-600 dark:text-amber-400',
    violet: 'text-violet-600 dark:text-violet-400',
  };

  const focusBorderColorMap = {
    blue: 'focus:border-blue-500 dark:focus:border-blue-500',
    emerald: 'focus:border-emerald-500 dark:focus:border-emerald-500',
    amber: 'focus:border-amber-500 dark:focus:border-amber-500',
    violet: 'focus:border-violet-500 dark:focus:border-violet-500',
  };

  return (
    <div>
      <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-2 font-sora">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={e => onChange(field, e.target.value)}
          min="0"
          max="100"
          step="0.5"
          className={`w-full pr-7 pl-3 py-2.5 border rounded-xl text-sm font-bold transition-all bg-white dark:bg-navy-950/50 border-slate-200 dark:border-navy-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-1 focus:ring-copper/40 ${focusBorderColorMap[color]}`}
        />
        <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold ${textColorMap[color]}`}>%</span>
      </div>
    </div>
  );
}
