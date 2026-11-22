import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Check, LoaderCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { changePassword } from '@/api/auth';
import { ApiError } from '@/api/client';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { navigate } from '@/lib/navigation';

import { AuthLayout } from './auth-layout';

const changePasswordSchema = z
  .object({
    confirmPassword: z.string(),
    currentPassword: z.string().min(1, 'Enter your temporary password.'),
    newPassword: z.string().min(15, 'Use at least 15 characters.').max(128),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  });

type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

export function ChangePasswordPage() {
  const queryClient = useQueryClient();
  const form = useForm<ChangePasswordValues>({
    defaultValues: { confirmPassword: '', currentPassword: '', newPassword: '' },
    resolver: zodResolver(changePasswordSchema),
  });
  const mutation = useMutation({
    mutationFn: (values: ChangePasswordValues) =>
      changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword }),
    onSuccess: () => {
      queryClient.setQueryData(['session'], null);
      navigate('/login?passwordChanged=1', true);
    },
  });
  const errorMessage =
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.error === null
        ? null
        : 'The password could not be updated.';

  return (
    <AuthLayout
      subtitle="Replace the temporary password before accessing clinical information."
      title="Create a secure password"
    >
      <div className="mb-6 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm leading-6 text-teal-900">
        Your new password must contain at least 15 characters and be different from the temporary
        password.
      </div>
      {errorMessage === null ? null : (
        <div
          className="mb-5 flex gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {errorMessage}
        </div>
      )}
      <form
        className="space-y-5"
        onSubmit={form.handleSubmit((values) => {
          mutation.mutate(values);
        })}
      >
        <FormField
          error={form.formState.errors.currentPassword?.message}
          label="Temporary password"
        >
          <Input
            autoComplete="current-password"
            type="password"
            {...form.register('currentPassword')}
          />
        </FormField>
        <FormField error={form.formState.errors.newPassword?.message} label="New password">
          <Input autoComplete="new-password" type="password" {...form.register('newPassword')} />
        </FormField>
        <FormField
          error={form.formState.errors.confirmPassword?.message}
          label="Confirm new password"
        >
          <Input
            autoComplete="new-password"
            type="password"
            {...form.register('confirmPassword')}
          />
        </FormField>
        <Button className="h-11 w-full gap-2" disabled={mutation.isPending} type="submit">
          {mutation.isPending ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Check aria-hidden="true" className="size-4" />
          )}
          Update password
        </Button>
      </form>
    </AuthLayout>
  );
}
