import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Bell, CheckCheck, FileCheck2, LoaderCircle, RefreshCw } from 'lucide-react';
import { useState } from 'react';

import {
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationRecord,
} from '@/api/notifications';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'America/Bogota',
});

export function NotificationBell({ placement }: { placement: 'header' | 'sidebar' }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const notificationsQuery = useQuery({
    queryFn: getNotifications,
    queryKey: ['notifications'],
    refetchInterval: 30_000,
  });
  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
  const markAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
  const unreadCount = notificationsQuery.data?.unreadCount ?? 0;

  return (
    <>
      <button
        aria-expanded={open}
        aria-label={`Notifications${unreadCount === 0 ? '' : `, ${unreadCount.toString()} unread`}`}
        className={cn(
          'relative flex items-center justify-center rounded-lg transition-colors',
          placement === 'sidebar'
            ? 'h-10 w-full gap-3 border border-white/15 text-sm font-medium text-slate-200 hover:bg-white/10'
            : 'size-9 text-slate-700 hover:bg-slate-100',
        )}
        onClick={() => {
          setOpen((current) => !current);
        }}
        type="button"
      >
        <Bell aria-hidden="true" className="size-5" />
        {placement === 'sidebar' ? <span>Notifications</span> : null}
        {unreadCount === 0 ? null : (
          <span
            className={cn(
              'flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold text-white',
              placement === 'header' && 'absolute -right-1 -top-1',
              placement === 'sidebar' && 'ml-auto mr-2',
            )}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open ? (
        <>
          <button
            aria-label="Close notifications"
            className="fixed inset-0 z-40 bg-slate-950/20"
            onClick={() => {
              setOpen(false);
            }}
            type="button"
          />
          <section
            aria-label="Notifications"
            className={cn(
              'fixed z-50 flex max-h-[min(36rem,calc(100vh-5rem))] w-[calc(100vw-2rem)] max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl',
              placement === 'sidebar' ? 'bottom-4 left-[17rem]' : 'right-4 top-[4.5rem]',
            )}
          >
            <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="font-semibold text-slate-950">Notifications</h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {unreadCount === 0
                    ? 'You are all caught up.'
                    : `${unreadCount.toString()} unread`}
                </p>
              </div>
              <Button
                className="gap-2"
                disabled={unreadCount === 0 || markAllMutation.isPending}
                onClick={() => {
                  markAllMutation.mutate();
                }}
                size="sm"
                variant="ghost"
              >
                <CheckCheck className="size-4" /> Mark all read
              </Button>
            </header>
            <div className="overflow-y-auto">
              {notificationsQuery.isPending ? (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-500">
                  <LoaderCircle className="size-5 animate-spin" /> Loading notifications…
                </div>
              ) : notificationsQuery.isError ? (
                <div className="px-5 py-10 text-center text-sm text-red-700">
                  Notifications could not be loaded.
                  <Button
                    className="mx-auto mt-3 gap-2"
                    onClick={() => void notificationsQuery.refetch()}
                    size="sm"
                    variant="outline"
                  >
                    <RefreshCw className="size-4" /> Try again
                  </Button>
                </div>
              ) : notificationsQuery.data.items.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm text-slate-500">
                  No notifications yet.
                </div>
              ) : (
                notificationsQuery.data.items.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onRead={() => {
                      if (notification.readAt === null) markReadMutation.mutate(notification.id);
                    }}
                  />
                ))
              )}
            </div>
          </section>
        </>
      ) : null}
    </>
  );
}

function NotificationItem({
  notification,
  onRead,
}: {
  notification: NotificationRecord;
  onRead: () => void;
}) {
  const annulled = notification.type === 'DOCUMENT_ANNULLED';
  const Icon = annulled ? Ban : FileCheck2;
  return (
    <button
      className={cn(
        'flex w-full gap-3 border-b border-slate-100 px-5 py-4 text-left last:border-b-0 hover:bg-slate-50',
        notification.readAt === null && 'bg-teal-50/50',
      )}
      onClick={onRead}
      type="button"
    >
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full',
          annulled ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700',
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-slate-950">
          {notificationMessage(notification)}
        </span>
        <span className="mt-1 block truncate text-sm text-slate-600">
          {notification.document?.title ?? 'Document unavailable'}
        </span>
        <span className="mt-1 block text-xs text-slate-500">
          {dateFormatter.format(new Date(notification.createdAt))}
        </span>
      </span>
      {notification.readAt === null ? (
        <span aria-label="Unread" className="mt-2 size-2 rounded-full bg-teal-600" />
      ) : null}
    </button>
  );
}

function notificationMessage(notification: NotificationRecord): string {
  if (notification.type === 'DOCUMENT_ANNULLED') return 'A document was annulled';
  if (notification.type === 'DOCUMENT_REPLACED') return 'A replacement document was published';
  return 'A new document was published';
}
