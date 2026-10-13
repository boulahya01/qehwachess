import { TournamentFormat, TournamentStatus } from '@/types';

type Language = 'en' | 'fr' | 'ar';

const dateLocales: Record<Language, string> = {
  en: 'en-US',
  fr: 'fr-FR',
  ar: 'ar',
};

export function formatDate(dateStr: string, language: Language = 'en'): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString(dateLocales[language], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateRange(startDate: string, endDate: string, language: Language = 'en'): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const locale = dateLocales[language];

  if (startDate === endDate) {
    return start.toLocaleDateString(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    if (language === 'en') {
      return `${start.toLocaleDateString(locale, { month: 'short' })} ${start.getDate()}-${end.getDate()}, ${end.getFullYear()}`;
    }
    return `${start.toLocaleDateString(locale, { day: 'numeric' })}-${end.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }

  return `${start.toLocaleDateString(locale, { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

export function formatPrice(amount: number): string {
  if (amount === 0) return 'Free';
  return `${amount} MAD`;
}

export function getDaysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function formatLabel(str: string): string {
  return str
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export const tournamentFormatLabels: Record<TournamentFormat, string> = {
  'swiss': 'Swiss System',
  'round-robin': 'Round Robin',
  'knockout': 'Knockout',
  'blitz': 'Blitz',
  'rapid': 'Rapid',
  'classical': 'Classical',
  'simultaneous': 'Simultaneous',
};

export const tournamentStatusLabels: Record<TournamentStatus, string> = {
  'draft': 'Draft',
  'pending': 'Pending Review',
  'published': 'Published',
  'cancelled': 'Cancelled',
  'completed': 'Completed',
};

export const tournamentStatusColors: Record<TournamentStatus, string> = {
  'draft': 'bg-gray-600/20 text-gray-300 border-gray-500/30',
  'pending': 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  'published': 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  'cancelled': 'bg-red-500/20 text-red-300 border-red-500/30',
  'completed': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
};

export function getChessPieceIcon(format: TournamentFormat): string {
  const icons: Record<TournamentFormat, string> = {
    'swiss': '♟',
    'round-robin': '♜',
    'knockout': '♞',
    'blitz': '⚡',
    'rapid': '♗',
    'classical': '♚',
    'simultaneous': '♛',
  };
  return icons[format] || '♟';
}
