import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: number | Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function getDaysRemaining(dlc: number): number {
  const diff = dlc - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function getStatusColor(dlc: number): string {
  const days = getDaysRemaining(dlc);
  if (days <= 0) return '#EF4444'; // Danger
  if (days <= 2) return '#F59E0B'; // Alert
  return '#10B981'; // Success
}

export function getDayColor(timestamp: number): string {
  const day = new Date(timestamp).getDay();
  // Professional color coding (Day of the week)
  const colors = [
    '#FFFFFF', // 0: Sunday (White)
    '#FACC15', // 1: Monday (Yellow)
    '#3B82F6', // 2: Tuesday (Blue)
    '#F472B6', // 3: Wednesday (Pink)
    '#22C55E', // 4: Thursday (Green)
    '#78350F', // 5: Friday (Brown)
    '#F97316', // 6: Saturday (Orange)
  ];
  return colors[day];
}
