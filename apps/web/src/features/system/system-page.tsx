import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  Cloud,
  Database,
  HardDrive,
  LoaderCircle,
  RefreshCw,
  Server,
} from 'lucide-react';

import { getSystemHealth, type SystemComponent } from '@/api/system-health';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const components: {
  description: string;
  icon: typeof Server;
  key: SystemComponent;
  label: string;
}[] = [
  { description: 'NestJS HTTP process', icon: Server, key: 'api', label: 'API' },
  {
    description: 'Clinical data persistence',
    icon: Database,
    key: 'database',
    label: 'PostgreSQL',
  },
  { description: 'Sessions, queues, and heartbeat', icon: HardDrive, key: 'redis', label: 'Redis' },
  {
    description: 'Private clinical document storage',
    icon: Cloud,
    key: 'storage',
    label: 'S3 storage',
  },
  { description: 'Asynchronous PDF processing', icon: Activity, key: 'worker', label: 'Worker' },
];

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'medium',
  timeZone: 'America/Bogota',
});

export function SystemPage() {
  const healthQuery = useQuery({
    queryFn: getSystemHealth,
    queryKey: ['system-health'],
    refetchInterval: 30_000,
  });

  return (
    <div className="mx-auto min-h-screen max-w-[1500px] px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-teal-700">
            <Activity aria-hidden="true" className="size-4" /> Infrastructure status
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">System</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Monitor the services required to operate Mediagnostics.
          </p>
        </div>
        <Button
          className="gap-2"
          disabled={healthQuery.isFetching}
          onClick={() => void healthQuery.refetch()}
          type="button"
          variant="outline"
        >
          <RefreshCw className={healthQuery.isFetching ? 'size-4 animate-spin' : 'size-4'} />
          Refresh
        </Button>
      </header>

      {healthQuery.isPending ? (
        <div className="mt-8 flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-20 text-sm text-slate-500 shadow-sm">
          <LoaderCircle className="size-5 animate-spin" /> Checking system health…
        </div>
      ) : healthQuery.isError ? (
        <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
          <h2 className="font-semibold">System health is unavailable</h2>
          <p className="mt-1 text-sm">The API could not complete the diagnostic checks.</p>
        </div>
      ) : (
        <>
          <section
            className={
              healthQuery.data.status === 'ok'
                ? 'mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-6'
                : 'mt-8 rounded-2xl border border-red-200 bg-red-50 p-6'
            }
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  {healthQuery.data.status === 'ok'
                    ? 'All systems operational'
                    : 'System degradation detected'}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Last checked {dateFormatter.format(new Date(healthQuery.data.checkedAt))}
                </p>
              </div>
              <Badge tone={healthQuery.data.status === 'ok' ? 'success' : 'danger'}>
                {healthQuery.data.status.toUpperCase()}
              </Badge>
            </div>
          </section>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {components.map((component) => {
              const state = healthQuery.data.components[component.key];
              const Icon = component.icon;
              return (
                <article
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                  key={component.key}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex size-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                      <Icon aria-hidden="true" className="size-5" />
                    </div>
                    <Badge tone={state.status === 'up' ? 'success' : 'danger'}>
                      {state.status.toUpperCase()}
                    </Badge>
                  </div>
                  <h2 className="mt-5 font-semibold text-slate-950">{component.label}</h2>
                  <p className="mt-1 text-sm text-slate-500">{component.description}</p>
                  <div className="mt-5 border-t border-slate-100 pt-4 text-sm text-slate-600">
                    Response time: <strong>{state.latencyMs.toString()} ms</strong>
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
