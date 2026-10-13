import { ReactNode } from 'react';

export function Card({
  children,
  className = '',
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={`surface-card ${hover ? 'surface-card-interactive' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
