import { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' };
  return (
    <div className={`${sizes[size]} animate-spin`} aria-hidden="true">
      <div className="w-full h-full rounded-full border-2 border-surface-700 border-t-brand-500" />
    </div>
  );
}
export function PageLoader() {
  const { t } = useLanguage();
  return (
    <div role="status" aria-label={t('Loading')} className="page-skeleton">
      <span className="sr-only">{t('Loading')}</span>
      {[0, 1, 2].map((id) => (
        <div key={id} aria-hidden="true" className="skeleton-card">
          <div className="skeleton skeleton-media" />
          <div className="skeleton skeleton-line w-3/4" />
          <div className="skeleton skeleton-line w-1/2" />
          <div className="skeleton skeleton-line w-2/3" />
        </div>
      ))}
    </div>
  );
}
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="text-brand-400 mb-4" aria-hidden="true">
        {icon}
      </div>
      <h3 className="text-xl font-medium">{title}</h3>
      {description && (
        <p className="mt-3 text-sm text-gray-500 max-w-sm leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
export function ErrorState({ message }: { message: string }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <AlertTriangle size={28} className="text-error-400 mb-4" aria-hidden="true" />
      <p className="text-gray-400 max-w-sm leading-relaxed">{message}</p>
    </div>
  );
}
