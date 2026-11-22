import { useQuery } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  KeyRound,
  Pencil,
  Plus,
  Power,
  Search,
  UserRoundX,
  UsersRound,
} from 'lucide-react';
import { useState, type SyntheticEvent } from 'react';

import type { Role, Session } from '@/api/auth';
import { ApiError } from '@/api/client';
import {
  listUsers,
  type TemporaryCredential,
  type UserStatus,
  type UserSummary,
} from '@/api/users';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { CredentialDialog } from './credential-dialog';
import { UserActionDialog, type UserAction } from './user-action-dialog';
import { UserFormDialog } from './user-form-dialog';

const roleLabels: Record<Role, string> = {
  ADMIN: 'Administrator',
  OPERATOR: 'Operator',
  PATIENT: 'Patient',
};

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeZone: 'America/Bogota',
});

interface PendingAction {
  action: UserAction;
  user: UserSummary;
}

export function UsersPage({ session }: { session: Session }) {
  const [page, setPage] = useState(1);
  const [role, setRole] = useState<Role | ''>('');
  const [status, setStatus] = useState<UserStatus | ''>('');
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserSummary | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [credential, setCredential] = useState<TemporaryCredential | null>(null);

  const usersQuery = useQuery({
    placeholderData: (previous) => previous,
    queryFn: () =>
      listUsers({
        page,
        ...(role === '' ? {} : { role }),
        ...(search === '' ? {} : { search }),
        ...(status === '' ? {} : { status }),
      }),
    queryKey: ['users', { page, role, search, status }],
  });

  const totalPages = Math.max(
    1,
    Math.ceil((usersQuery.data?.total ?? 0) / (usersQuery.data?.pageSize ?? 20)),
  );
  const errorMessage =
    usersQuery.error instanceof ApiError
      ? usersQuery.error.message
      : usersQuery.isError
        ? 'Users could not be loaded.'
        : null;

  const submitSearch = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearch(searchDraft.trim());
    setPage(1);
  };

  const openCreateDialog = () => {
    setEditingUser(null);
    setFormOpen(true);
  };

  const openEditDialog = (user: UserSummary) => {
    setEditingUser(user);
    setFormOpen(true);
  };

  const receiveCredential = (nextCredential: TemporaryCredential) => {
    setFormOpen(false);
    setPendingAction(null);
    setCredential(nextCredential);
  };

  return (
    <div className="mx-auto min-h-screen max-w-[1600px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-teal-700">
            <UsersRound aria-hidden="true" className="size-4" />
            Access management
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Users</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Create accounts, manage access status, and issue temporary credentials.
          </p>
        </div>
        <Button className="gap-2 self-start sm:self-auto" onClick={openCreateDialog} type="button">
          <Plus aria-hidden="true" className="size-4" />
          Create user
        </Button>
      </header>

      <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4 sm:p-5">
          <form
            className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_180px_180px_auto]"
            onSubmit={submitSearch}
          >
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
              />
              <Input
                aria-label="Search users"
                className="pl-9"
                onChange={(event) => {
                  setSearchDraft(event.target.value);
                }}
                placeholder="Search name, email, or clinical code"
                value={searchDraft}
              />
            </div>
            <select
              aria-label="Filter by role"
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
              onChange={(event) => {
                setRole(event.target.value as Role | '');
                setPage(1);
              }}
              value={role}
            >
              <option value="">All roles</option>
              <option value="ADMIN">Administrator</option>
              <option value="OPERATOR">Operator</option>
              <option value="PATIENT">Patient</option>
            </select>
            <select
              aria-label="Filter by status"
              className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
              onChange={(event) => {
                setStatus(event.target.value as UserStatus | '');
                setPage(1);
              }}
              value={status}
            >
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="DISABLED">Disabled</option>
            </select>
            <Button className="gap-2" type="submit" variant="outline">
              <Search aria-hidden="true" className="size-4" />
              Search
            </Button>
          </form>
        </div>

        {errorMessage === null ? null : (
          <div
            className="m-5 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
            role="alert"
          >
            <CircleAlert aria-hidden="true" className="size-5 shrink-0" />
            <span className="flex-1">{errorMessage}</span>
            <Button
              onClick={() => void usersQuery.refetch()}
              size="sm"
              type="button"
              variant="outline"
            >
              Try again
            </Button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3.5" scope="col">
                  User
                </th>
                <th className="px-5 py-3.5" scope="col">
                  Role
                </th>
                <th className="px-5 py-3.5" scope="col">
                  Clinical code
                </th>
                <th className="px-5 py-3.5" scope="col">
                  Status
                </th>
                <th className="px-5 py-3.5" scope="col">
                  Created
                </th>
                <th className="px-5 py-3.5 text-right" scope="col">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {usersQuery.isPending ? (
                Array.from({ length: 5 }, (_, index) => (
                  <tr key={index}>
                    <td className="px-5 py-5" colSpan={6}>
                      <div className="h-5 animate-pulse rounded bg-slate-100" />
                    </td>
                  </tr>
                ))
              ) : usersQuery.data?.items.length === 0 ? (
                <tr>
                  <td className="px-5 py-16 text-center" colSpan={6}>
                    <UsersRound aria-hidden="true" className="mx-auto size-9 text-slate-300" />
                    <p className="mt-3 font-medium text-slate-800">No users found</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Adjust the filters or create a new account.
                    </p>
                  </td>
                </tr>
              ) : (
                usersQuery.data?.items.map((user) => {
                  const ownAccount = user.id === session.id;
                  return (
                    <tr className="text-sm text-slate-700 hover:bg-slate-50/70" key={user.id}>
                      <td className="px-5 py-4">
                        <div className="font-medium text-slate-950">{user.fullName}</div>
                        <div className="mt-0.5 text-slate-500">{user.email}</div>
                      </td>
                      <td className="px-5 py-4">
                        <Badge tone={user.role === 'ADMIN' ? 'teal' : 'neutral'}>
                          {roleLabels[user.role]}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 font-mono text-xs text-slate-600">
                        {user.clinicalCode ?? '—'}
                      </td>
                      <td className="px-5 py-4">
                        <Badge tone={user.status === 'ACTIVE' ? 'success' : 'danger'}>
                          {user.status === 'ACTIVE' ? 'Active' : 'Disabled'}
                        </Badge>
                        {user.passwordChangeRequired && user.status === 'ACTIVE' ? (
                          <div className="mt-1.5 text-xs text-amber-700">
                            Password change pending
                          </div>
                        ) : null}
                      </td>
                      <td className="px-5 py-4 text-slate-500">
                        {dateFormatter.format(new Date(user.createdAt))}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-1">
                          <Button
                            aria-label={`Edit ${user.fullName}`}
                            onClick={() => {
                              openEditDialog(user);
                            }}
                            size="sm"
                            type="button"
                            variant="ghost"
                          >
                            <Pencil aria-hidden="true" className="size-4" />
                          </Button>
                          {user.status === 'ACTIVE' ? (
                            <>
                              <Button
                                aria-label={`Reset password for ${user.fullName}`}
                                disabled={ownAccount}
                                onClick={() => {
                                  setPendingAction({ action: 'reset-password', user });
                                }}
                                size="sm"
                                title={
                                  ownAccount
                                    ? 'You cannot reset your own password here.'
                                    : 'Reset password'
                                }
                                type="button"
                                variant="ghost"
                              >
                                <KeyRound aria-hidden="true" className="size-4" />
                              </Button>
                              <Button
                                aria-label={`Disable ${user.fullName}`}
                                disabled={ownAccount}
                                onClick={() => {
                                  setPendingAction({ action: 'disable', user });
                                }}
                                size="sm"
                                title={
                                  ownAccount
                                    ? 'You cannot disable your own account.'
                                    : 'Disable user'
                                }
                                type="button"
                                variant="ghost"
                              >
                                <UserRoundX aria-hidden="true" className="size-4 text-red-700" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              aria-label={`Reactivate ${user.fullName}`}
                              onClick={() => {
                                setPendingAction({ action: 'reactivate', user });
                              }}
                              size="sm"
                              title="Reactivate user"
                              type="button"
                              variant="ghost"
                            >
                              <Power aria-hidden="true" className="size-4 text-emerald-700" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <footer className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {usersQuery.data === undefined
              ? 'Loading users…'
              : `${String(usersQuery.data.total)} user${usersQuery.data.total === 1 ? '' : 's'} total`}
          </div>
          <div className="flex items-center gap-3">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-1">
              <Button
                aria-label="Previous page"
                disabled={page <= 1}
                onClick={() => {
                  setPage((current) => current - 1);
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                <ChevronLeft aria-hidden="true" className="size-4" />
              </Button>
              <Button
                aria-label="Next page"
                disabled={page >= totalPages}
                onClick={() => {
                  setPage((current) => current + 1);
                }}
                size="sm"
                type="button"
                variant="outline"
              >
                <ChevronRight aria-hidden="true" className="size-4" />
              </Button>
            </div>
          </div>
        </footer>
      </section>

      {formOpen ? (
        <UserFormDialog
          onClose={() => {
            setFormOpen(false);
          }}
          onCredential={receiveCredential}
          user={editingUser}
        />
      ) : null}
      {pendingAction === null ? null : (
        <UserActionDialog
          action={pendingAction.action}
          onClose={() => {
            setPendingAction(null);
          }}
          onCredential={receiveCredential}
          user={pendingAction.user}
        />
      )}
      {credential === null ? null : (
        <CredentialDialog
          credential={credential}
          onClose={() => {
            setCredential(null);
          }}
        />
      )}
    </div>
  );
}
