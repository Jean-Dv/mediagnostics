import type { ReactNode } from 'react';

export function FormField({
  children,
  error,
  label,
}: {
  children: ReactNode;
  error?: string;
  label: string;
}) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-slate-800">{label}</div>
      {children}
      {error === undefined ? null : (
        <p className="text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
