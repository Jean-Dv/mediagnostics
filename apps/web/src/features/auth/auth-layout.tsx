import { FileHeart, LockKeyhole, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';

export function AuthLayout({
  children,
  subtitle,
  title,
}: {
  children: ReactNode;
  subtitle: string;
  title: string;
}) {
  return (
    <main className="grid min-h-screen bg-slate-50 lg:grid-cols-[minmax(0,1fr)_minmax(28rem,0.85fr)]">
      <section className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-10 flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-teal-700 text-white shadow-sm">
              <FileHeart aria-hidden="true" className="size-6" />
            </div>
            <div>
              <div className="text-lg font-semibold tracking-tight text-slate-950">
                Mediagnostics
              </div>
              <div className="text-sm text-slate-500">Clinical document management</div>
            </div>
          </div>

          <div className="mb-8">
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">{title}</h1>
            <p className="mt-3 text-base leading-7 text-slate-600">{subtitle}</p>
          </div>
          {children}
          <p className="mt-8 text-center text-sm text-slate-500">
            Access is restricted to authorized Mediagnostics users.
          </p>
        </div>
      </section>

      <aside className="relative hidden overflow-hidden bg-slate-950 px-12 py-14 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 size-80 rounded-full bg-teal-500/15 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 size-72 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-teal-300/20 bg-teal-300/10 px-3 py-1.5 text-sm font-medium text-teal-100">
            <ShieldCheck aria-hidden="true" className="size-4" />
            Protected clinical information
          </span>
          <h2 className="mt-8 max-w-lg text-4xl font-semibold leading-tight tracking-tight">
            Documents handled with care at every step.
          </h2>
          <p className="mt-5 max-w-lg text-lg leading-8 text-slate-300">
            Secure processing, controlled publication, and role-based access for laboratory results
            and informed consent documents.
          </p>
        </div>

        <div className="relative rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
          <LockKeyhole aria-hidden="true" className="size-6 text-teal-300" />
          <p className="mt-4 text-base font-medium">Private by design</p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Sessions expire automatically and every sensitive administrative action is audited.
          </p>
        </div>
      </aside>
    </main>
  );
}
