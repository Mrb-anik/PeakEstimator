export type TradeType = 'electrical' | 'roofing' | 'hvac' | 'painting' | 'plumbing' | 'drain' | 'general' | 'other';
export type StatusType = 'lead' | 'bidding' | 'sent' | 'approved' | 'won' | 'lost';
export type CategoryType = 'material' | 'labor' | 'equipment' | 'other';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  company_name: string;
  company_email: string;
  company_phone: string;
  company_logo: string;
  default_labor_markup: number;
  default_material_markup: number;
  default_equipment_markup: number;
  default_tax_rate: number;
  created_at?: string;
  updated_at?: string;
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  status: StatusType;
  trade: TradeType;
  subtotal: number;
  margin_amount: number;
  tax_amount: number;
  total_value: number;
  labor_markup: number;
  material_markup: number;
  equipment_markup: number;
  tax_rate: number;
  notes: string;
  share_token: string;
  client_approved_at: string | null;
  client_message: string;
  follow_up_sent_at: string | null;
  project_address: string;
  start_date: string;
  valid_until: string;
  company_name: string;
  company_email: string;
  company_phone: string;
  company_logo: string;
  created_at: string;
  updated_at?: string;
}

export interface ProjectItem {
  id: string;
  project_id: string;
  user_id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  category: CategoryType;
  markup: number;
  total: number;
  sort_order: number;
  from_price_book: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface PriceBookItem {
  id: string;
  user_id: string | null;
  name: string;
  description: string;
  trade: TradeType;
  category: CategoryType;
  default_unit_price: number;
  unit: string;
  default_markup: number;
  tags: string;
  is_global: boolean;
  created_at?: string;
}

export interface TotalsResult {
  subtotal: number;
  laborSub: number;
  matSub: number;
  eqSub: number;
  otherSub: number;
  marginAmount: number;
  taxAmount: number;
  total: number;
}

export const TRADE_EMOJIS: Record<TradeType, string> = {
  electrical: '⚡',
  roofing: '🏠',
  hvac: '❄️',
  painting: '🎨',
  plumbing: '🔧',
  drain: '🚿',
  general: '🏗️',
  other: '📋',
};

export const STATUS_COLORS: Record<StatusType, string> = {
  lead: 'status-lead',
  bidding: 'status-bidding',
  sent: 'status-sent',
  approved: 'status-approved',
  won: 'status-won',
  lost: 'status-lost',
};

export const CATEGORY_COLORS: Record<CategoryType, string> = {
  material: 'category-material',
  labor: 'category-labor',
  equipment: 'category-equipment',
  other: 'category-other',
};
