import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { ApiError } from '@/api/client';
import { createUser, updateUser, type TemporaryCredential, type UserSummary } from '@/api/users';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';

const userFormSchema = z.object({
  email: z.email('Enter a valid email address.').trim(),
  fullName: z.string().trim().min(2, 'Enter at least 2 characters.').max(200),
  role: z.enum(['ADMIN', 'OPERATOR', 'PATIENT']),
});

type UserFormValues = z.infer<typeof userFormSchema>;

export function UserFormDialog({
  onClose,
  onCredential,
  user,
}: {
  onClose: () => void;
  onCredential: (credential: TemporaryCredential) => void;
  user: UserSummary | null;
}) {
  const queryClient = useQueryClient();
  const editing = user !== null;
  const form = useForm<UserFormValues>({
    defaultValues: {
      email: user?.email ?? '',
      fullName: user?.fullName ?? '',
      role: user?.role ?? 'PATIENT',
    },
    resolver: zodResolver(userFormSchema),
  });
  useEffect(() => {
    form.reset({
      email: user?.email ?? '',
      fullName: user?.fullName ?? '',
      role: user?.role ?? 'PATIENT',
    });
  }, [form, user]);

  const mutation = useMutation({
    mutationFn: async (values: UserFormValues) => {
      if (user === null) {
        return { credential: await createUser(values) };
      }
      await updateUser(user.id, { email: values.email, fullName: values.fullName });
      return { credential: null };
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      if (result.credential === null) {
        onClose();
      } else {
        onCredential(result.credential);
      }
    },
  });
  const errorMessage =
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.error === null
        ? null
        : 'The user could not be saved.';

  return (
    <Modal
      description={
        editing
          ? 'Only the name and email can be changed. Role and clinical code remain immutable.'
          : 'A temporary password will be generated and displayed once.'
      }
      onClose={onClose}
      title={editing ? 'Edit user' : 'Create user'}
    >
      {errorMessage === null ? null : (
        <div
          className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {errorMessage}
        </div>
      )}
      <form
        className="space-y-5"
        onSubmit={form.handleSubmit((values) => {
          mutation.mutate(values);
        })}
      >
        <FormField error={form.formState.errors.fullName?.message} label="Full name">
          <Input autoComplete="name" placeholder="Jane Doe" {...form.register('fullName')} />
        </FormField>
        <FormField error={form.formState.errors.email?.message} label="Email address">
          <Input
            autoComplete="email"
            inputMode="email"
            placeholder="name@example.com"
            {...form.register('email')}
          />
        </FormField>
        <FormField error={form.formState.errors.role?.message} label="Role">
          <select
            className="h-11 w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-950 disabled:bg-slate-100 disabled:text-slate-500"
            disabled={editing}
            {...form.register('role')}
          >
            <option value="PATIENT">Patient</option>
            <option value="OPERATOR">Operator</option>
            <option value="ADMIN">Administrator</option>
          </select>
        </FormField>
        <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
          <Button onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button className="gap-2" disabled={mutation.isPending} type="submit">
            {mutation.isPending ? (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            ) : null}
            {editing ? 'Save changes' : 'Create user'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
