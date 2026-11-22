import { Check, Copy, KeyRound } from 'lucide-react';
import { useState } from 'react';

import type { TemporaryCredential } from '@/api/users';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';

export function CredentialDialog({
  credential,
  onClose,
}: {
  credential: TemporaryCredential;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyPassword = async () => {
    await navigator.clipboard.writeText(credential.temporaryPassword);
    setCopied(true);
  };

  return (
    <Modal
      description="This password will not be displayed again after closing this dialog."
      onClose={onClose}
      title="Temporary password"
    >
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
        Share this credential securely with {credential.user.fullName}. The user must replace it at
        first sign-in.
      </div>
      <div className="mt-5">
        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
          <KeyRound aria-hidden="true" className="size-4" />
          One-time credential
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-slate-50 p-3">
          <code className="min-w-0 flex-1 overflow-x-auto font-mono text-base font-semibold text-slate-950">
            {credential.temporaryPassword}
          </code>
          <Button
            className="shrink-0 gap-2"
            onClick={() => void copyPassword()}
            size="sm"
            variant="outline"
          >
            {copied ? (
              <Check aria-hidden="true" className="size-4 text-emerald-700" />
            ) : (
              <Copy aria-hidden="true" className="size-4" />
            )}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      </div>
      <Button className="mt-6 w-full" onClick={onClose} type="button">
        I saved the password
      </Button>
    </Modal>
  );
}
