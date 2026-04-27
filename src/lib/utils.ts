import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: number | Date): string {
  const d = new Date(date);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

export function getDaysRemaining(dlc: number): number {
  const diff = dlc - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function getStatusColor(dlc: number): string {
  const days = getDaysRemaining(dlc);
  if (days <= 0) return '#EF4444';
  if (days <= 2) return '#F59E0B';
  return '#10B981';
}

export function getDayColor(timestamp: number): string {
  const day = new Date(timestamp).getDay();
  const colors = [
    '#FFFFFF',
    '#FACC15',
    '#3B82F6',
    '#F472B6',
    '#22C55E',
    '#78350F',
    '#F97316',
  ];
  return colors[day];
}

export function randomId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
