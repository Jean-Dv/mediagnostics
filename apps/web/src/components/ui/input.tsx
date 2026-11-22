import type { InputHTMLAttributes } from 'react';

import { cn } from '@/lib/utils';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-950 shadow-xs transition placeholder:text-slate-400 hover:border-slate-400 focus:border-teal-700 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100',
        className,
      )}
      {...props}
    />
  );
}
