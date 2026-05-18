import type { ProjectItem, TotalsResult } from '../types';

export function calcTotals(
  items: ProjectItem[],
  laborMarkup: number,
  materialMarkup: number,
  equipmentMarkup: number,
  taxRate: number
): TotalsResult {
  const subtotal = items.reduce((s, i) => s + (i.quantity * i.unit_price), 0);
  const laborSub = items
    .filter(i => i.category === 'labor')
    .reduce((s, i) => s + (i.quantity * i.unit_price), 0);
  const matSub = items
    .filter(i => i.category === 'material')
    .reduce((s, i) => s + (i.quantity * i.unit_price), 0);
  const eqSub = items
    .filter(i => i.category === 'equipment')
    .reduce((s, i) => s + (i.quantity * i.unit_price), 0);
  const otherSub = subtotal - laborSub - matSub - eqSub;

  const marginAmount =
    (laborSub * laborMarkup / 100) +
    (matSub * materialMarkup / 100) +
    (eqSub * equipmentMarkup / 100) +
    (otherSub * 0.15);

  const taxAmount = (subtotal + marginAmount) * (taxRate / 100);
  const total = subtotal + marginAmount + taxAmount;

  return { subtotal, laborSub, matSub, eqSub, otherSub, marginAmount, taxAmount, total };
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number): string {
  return `${value}%`;
}
