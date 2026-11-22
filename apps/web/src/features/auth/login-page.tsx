import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, LoaderCircle, LogIn } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { login, type Role } from '@/api/auth';
import { ApiError } from '@/api/client';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { navigate } from '@/lib/navigation';

import { AuthLayout } from './auth-layout';

const loginSchema = z.object({
  email: z.email('Enter a valid email address.').trim(),
  password: z.string().min(1, 'Enter your password.'),
});

type LoginValues = z.infer<typeof loginSchema>;

const roleDestinations: Record<Role, string> = {
  ADMIN: '/admin/users',
  OPERATOR: '/operator/documents',
  PATIENT: '/patient/documents',
};

export function LoginPage() {
  const queryClient = useQueryClient();
  const form = useForm<LoginValues>({
    defaultValues: { email: '', password: '' },
    resolver: zodResolver(loginSchema),
  });
  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (session) => {
      queryClient.setQueryData(['session'], session);
      navigate(
        session.passwordChangeRequired ? '/change-password' : roleDestinations[session.role],
        true,
      );
    },
  });
  const passwordChanged =
    new URLSearchParams(window.location.search).get('passwordChanged') === '1';
  const errorMessage =
    mutation.error instanceof ApiError
      ? mutation.error.message
      : mutation.error === null
        ? null
        : 'The service is temporarily unavailable.';

  return (
    <AuthLayout subtitle="Use your assigned account to continue." title="Welcome back">
      {passwordChanged ? (
        <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Password updated. Sign in again to continue.
        </div>
      ) : null}
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
        <FormField error={form.formState.errors.email?.message} label="Email address">
          <Input
            autoComplete="username"
            inputMode="email"
            placeholder="name@example.com"
            {...form.register('email')}
          />
        </FormField>
        <FormField error={form.formState.errors.password?.message} label="Password">
          <Input
            autoComplete="current-password"
            placeholder="Enter your password"
            type="password"
            {...form.register('password')}
          />
        </FormField>
        <Button className="h-11 w-full gap-2" disabled={mutation.isPending} type="submit">
          {mutation.isPending ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <LogIn aria-hidden="true" className="size-4" />
          )}
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}
