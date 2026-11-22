import { useQuery } from '@tanstack/react-query';
import { CircleAlert, FileHeart, LoaderCircle } from 'lucide-react';
import { useEffect } from 'react';

import { getSession, type Role } from '@/api/auth';
import { AppShell } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { AuditPage } from '@/features/audit/audit-page';
import { ChangePasswordPage } from '@/features/auth/change-password-page';
import { LoginPage } from '@/features/auth/login-page';
import { AdminDocumentsPage } from '@/features/documents/admin-documents-page';
import { OperatorDocumentsPage } from '@/features/documents/operator-documents-page';
import { PatientDocumentsPage } from '@/features/documents/patient-documents-page';
import { SystemPage } from '@/features/system/system-page';
import { UsersPage } from '@/features/users/users-page';
import { navigate, usePathname } from '@/lib/navigation';

const roleDestinations: Record<Role, string> = {
  ADMIN: '/admin/users',
  OPERATOR: '/operator/documents',
  PATIENT: '/patient/documents',
};

function LoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="text-center text-slate-600">
        <FileHeart aria-hidden="true" className="mx-auto size-9 text-teal-700" />
        <LoaderCircle aria-hidden="true" className="mx-auto mt-5 size-5 animate-spin" />
        <p className="mt-3 text-sm">Loading your workspace…</p>
      </div>
    </main>
  );
}

export function App() {
  const pathname = usePathname();
  const sessionQuery = useQuery({
    queryFn: getSession,
    queryKey: ['session'],
    retry: false,
  });
  const session = sessionQuery.data;

  useEffect(() => {
    if (sessionQuery.isPending || sessionQuery.isError) return;

    if (session === null || session === undefined) {
      if (pathname !== '/login') navigate('/login', true);
      return;
    }

    if (session.passwordChangeRequired) {
      if (pathname !== '/change-password') navigate('/change-password', true);
      return;
    }

    const destination = roleDestinations[session.role];
    const allowedPaths =
      session.role === 'ADMIN'
        ? ['/admin/users', '/admin/documents', '/admin/audit', '/admin/system']
        : [destination];
    if (!allowedPaths.includes(pathname)) navigate(destination, true);
  }, [pathname, session, sessionQuery.isError, sessionQuery.isPending]);

  if (sessionQuery.isPending) return <LoadingScreen />;

  if (sessionQuery.isError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm">
          <CircleAlert aria-hidden="true" className="mx-auto size-9 text-red-700" />
          <h1 className="mt-4 text-xl font-semibold text-slate-950">Service unavailable</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            The application could not verify your session. Check the API connection and try again.
          </p>
          <Button className="mt-6 gap-2" onClick={() => void sessionQuery.refetch()} type="button">
            <LoaderCircle aria-hidden="true" className="size-4" />
            Try again
          </Button>
        </section>
      </main>
    );
  }

  if (session === null || session === undefined) return <LoginPage />;
  if (session.passwordChangeRequired) return <ChangePasswordPage />;

  const content =
    session.role === 'ADMIN' ? (
      pathname === '/admin/system' ? (
        <SystemPage />
      ) : pathname === '/admin/audit' ? (
        <AuditPage />
      ) : pathname === '/admin/documents' ? (
        <AdminDocumentsPage />
      ) : (
        <UsersPage session={session} />
      )
    ) : session.role === 'OPERATOR' ? (
      <OperatorDocumentsPage />
    ) : (
      <PatientDocumentsPage />
    );

  return (
    <AppShell pathname={pathname} session={session}>
      {content}
    </AppShell>
  );
}
