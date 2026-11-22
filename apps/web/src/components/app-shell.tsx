import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Activity, FileHeart, Files, History, LogOut, Menu, Users, X } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { logout, type Session } from '@/api/auth';
import { Button } from '@/components/ui/button';
import { NotificationBell } from '@/components/notification-bell';
import { cn } from '@/lib/utils';
import { navigate } from '@/lib/navigation';

interface NavigationItem {
  disabled?: boolean;
  icon: typeof Users;
  label: string;
  path?: string;
}

const adminNavigation: NavigationItem[] = [
  { icon: Users, label: 'Users', path: '/admin/users' },
  { icon: Files, label: 'Documents', path: '/admin/documents' },
  { icon: History, label: 'Audit', path: '/admin/audit' },
  { icon: Activity, label: 'System', path: '/admin/system' },
];

const operatorNavigation: NavigationItem[] = [
  { icon: Files, label: 'Documents', path: '/operator/documents' },
];

const patientNavigation: NavigationItem[] = [
  { icon: Files, label: 'My documents', path: '/patient/documents' },
];

const roleLabels = { ADMIN: 'Administrator', OPERATOR: 'Operator', PATIENT: 'Patient' } as const;

export function AppShell({
  children,
  pathname,
  session,
}: {
  children: ReactNode;
  pathname: string;
  session: Session;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const queryClient = useQueryClient();
  const logoutMutation = useMutation({
    mutationFn: logout,
    onSettled: () => {
      queryClient.clear();
      navigate('/login', true);
    },
  });
  const navigation =
    session.role === 'ADMIN'
      ? adminNavigation
      : session.role === 'OPERATOR'
        ? operatorNavigation
        : patientNavigation;

  const sidebar = (
    <div className="flex h-full flex-col bg-slate-950 text-white">
      <div className="flex h-20 items-center gap-3 border-b border-white/10 px-6">
        <div className="flex size-10 items-center justify-center rounded-xl bg-teal-600">
          <FileHeart aria-hidden="true" className="size-5" />
        </div>
        <div>
          <div className="font-semibold tracking-tight">Mediagnostics</div>
          <div className="text-xs text-slate-400">Clinical documents</div>
        </div>
      </div>

      <nav aria-label="Primary navigation" className="flex-1 space-y-1 px-3 py-6">
        {navigation.map((item) => {
          const Icon = item.icon;
          const active = item.path === pathname;
          return (
            <button
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors',
                active
                  ? 'bg-teal-600 text-white'
                  : 'text-slate-300 hover:bg-white/8 hover:text-white',
                item.disabled &&
                  'cursor-not-allowed opacity-45 hover:bg-transparent hover:text-slate-300',
              )}
              disabled={item.disabled}
              key={item.label}
              onClick={() => {
                if (item.path !== undefined) {
                  navigate(item.path);
                  setMobileMenuOpen(false);
                }
              }}
              type="button"
            >
              <Icon aria-hidden="true" className="size-5" />
              {item.label}
              {item.disabled ? <span className="ml-auto text-xs text-slate-500">Soon</span> : null}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-4">
        <div className="mb-4">
          <NotificationBell placement="sidebar" />
        </div>
        <div className="mb-3 min-w-0 px-2">
          <div className="truncate text-sm font-medium text-white">{session.fullName}</div>
          <div className="mt-0.5 truncate text-xs text-slate-400">{roleLabels[session.role]}</div>
        </div>
        <Button
          className="w-full justify-start gap-2 border-white/15 bg-transparent text-slate-200 hover:bg-white/10 hover:text-white"
          disabled={logoutMutation.isPending}
          onClick={() => {
            logoutMutation.mutate();
          }}
          variant="outline"
        >
          <LogOut aria-hidden="true" className="size-4" />
          Sign out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{sidebar}</aside>

      <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 lg:hidden">
        <div className="flex items-center gap-2 font-semibold text-slate-950">
          <FileHeart aria-hidden="true" className="size-5 text-teal-700" />
          Mediagnostics
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell placement="header" />
          <Button
            aria-label="Open navigation"
            onClick={() => {
              setMobileMenuOpen(true);
            }}
            size="sm"
            variant="ghost"
          >
            <Menu aria-hidden="true" className="size-5" />
          </Button>
        </div>
      </header>

      {mobileMenuOpen ? (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <button
            aria-label="Close navigation"
            className="flex-1 bg-slate-950/50 backdrop-blur-sm"
            onClick={() => {
              setMobileMenuOpen(false);
            }}
            type="button"
          />
          <aside className="relative h-full w-72 shadow-2xl">
            <Button
              aria-label="Close navigation"
              className="absolute right-3 top-3 z-10 text-slate-300 hover:bg-white/10 hover:text-white"
              onClick={() => {
                setMobileMenuOpen(false);
              }}
              size="sm"
              variant="ghost"
            >
              <X aria-hidden="true" className="size-5" />
            </Button>
            {sidebar}
          </aside>
        </div>
      ) : null}

      <main className="lg:pl-64">{children}</main>
    </div>
  );
}
