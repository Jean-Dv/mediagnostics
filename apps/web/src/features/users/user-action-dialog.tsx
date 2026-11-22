import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle } from 'lucide-react';

import { ApiError } from '@/api/client';
import {
  disableUser,
  reactivateUser,
  resetUserPassword,
  type TemporaryCredential,
  type UserSummary,
} from '@/api/users';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';

export type UserAction = 'disable' | 'reactivate' | 'reset-password';

const actionCopy: Record<UserAction, { confirm: string; description: string; title: string }> = {
  disable: {
    confirm: 'Disable account',
    description:
      'The user will lose access immediately and all active sessions will be invalidated.',
    title: 'Disable user?',
  },
  reactivate: {
    confirm: 'Reactivate account',
    description:
      'A new temporary password will be generated and the user must change it at sign-in.',
    title: 'Reactivate user?',
  },
  'reset-password': {
    confirm: 'Reset password',
    description:
      'All active sessions will be invalidated and a new one-time password will be generated.',
    title: 'Reset password?',
  },
};

export function UserActionDialog({
  action,
  onClose,
  onCredential,
  user,
}: {
  action: UserAction;
  onClose: () => void;
  onCredential: (credential: TemporaryCredential) => void;
  user: UserSummary;
}) {
  const queryClient = useQueryClient();
  const copy = actionCopy[action];
  const mutation = useMutation({
    mutationFn: async () => {
      if (action === 'disable') {
        await disableUser(user.id);
        return null;
      }
      return action === 'reactivate' ? reactivateUser(user.id) : resetUserPassword(user.id);
    },
    onSuccess: async (credential) => {
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      if (credential === null) {
        onClose();
      } else {
        onCredential(credential);
      }
    },
  });
  const errorMessage =
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.error === null
        ? null
        : 'The action could not be completed.';

  return (
    <Modal description={copy.description} onClose={onClose} title={copy.title}>
      <div className="rounded-lg bg-slate-100 px-4 py-3">
        <div className="font-medium text-slate-950">{user.fullName}</div>
        <div className="mt-0.5 text-sm text-slate-600">{user.email}</div>
      </div>
      {errorMessage === null ? null : (
        <div
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {errorMessage}
        </div>
      )}
      <div className="mt-6 flex justify-end gap-3">
        <Button onClick={onClose} type="button" variant="outline">
          Cancel
        </Button>
        <Button
          className="gap-2"
          disabled={mutation.isPending}
          onClick={() => {
            mutation.mutate();
          }}
          type="button"
          variant={action === 'disable' ? 'destructive' : 'default'}
        >
          {mutation.isPending ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : null}
          {copy.confirm}
        </Button>
      </div>
    </Modal>
  );
}
