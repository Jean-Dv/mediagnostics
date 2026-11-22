import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'danger' | 'neutral' | 'success' | 'teal';
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold',
        tone === 'danger' && 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200',
        tone === 'neutral' && 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200',
        tone === 'success' && 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200',
        tone === 'teal' && 'bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-200',
      )}
    >
      {children}
    </span>
  );
}
