import { apiRequest } from './client';

export type SystemComponent = 'api' | 'database' | 'redis' | 'storage' | 'worker';

export interface ComponentHealth {
  latencyMs: number;
  status: 'down' | 'up';
}

export interface SystemHealth {
  checkedAt: string;
  components: Record<SystemComponent, ComponentHealth>;
  status: 'degraded' | 'ok';
}

export function getSystemHealth(): Promise<SystemHealth> {
  return apiRequest<SystemHealth>('/api/v1/health/system');
}
