import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { Discord, IntegrationError } from './discord-domain.ts';
import type { Backend, Payload } from './discord-service.ts';
export function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new IntegrationError('not_configured', 503);
  return value;
}
export function origin() {
  const url = new URL(env('QEHWA_APP_ORIGIN'));
  if (
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    (url.protocol !== 'https:' &&
      !['localhost', '127.0.0.1'].includes(url.hostname))
  )
    throw new IntegrationError('not_configured', 503);
  return url.origin;
}
export function client() {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) =>
        fetch(input, { ...init, signal: AbortSignal.timeout(10000) }),
    },
  });
}
const databaseCodes = new Set([
  'tenant_denied',
  'expired_flow',
  'server_denied',
  'too_many_requests',
  'not_connected',
  'choose_channel',
  'reconnect_required',
]);
export function backend(service: ReturnType<typeof client>): Backend {
  return async (p_action: string, p: Payload = {}) => {
    if (p_action === 'oauth_origin') {
      const result = await service.rpc('discord_set_return_origin', {
        p_hash: p.hash,
        p_origin: p.origin,
      });
      if (result.error || !result.data)
        throw new IntegrationError('service_unavailable', 503);
      return true;
    }
    if (p_action === 'retry_failed') {
      const retried = await service.rpc('discord_retry_failed', {
        p_connection: p.connection_id,
        p_delivery: p.delivery_id,
      });
      if (retried.error) throw new IntegrationError('service_unavailable', 503);
      return retried.data;
    }
    const { data, error } = await service.rpc('discord_backend', {
      p_action,
      p,
    });
    if (error)
      throw new IntegrationError(
        databaseCodes.has(error.message)
          ? error.message
          : 'service_unavailable',
        error.message === 'tenant_denied'
          ? 403
          : error.message === 'too_many_requests'
            ? 429
            : 503
      );
    if (p_action === 'status' && data?.connection?.id) {
      const history = await service.rpc('discord_delivery_history', {
        p_connection: data.connection.id,
      });
      if (history.error) throw new IntegrationError('service_unavailable', 503);
      data.deliveries = history.data;
    }
    return data;
  };
}
export function discord() {
  return new Discord(env('DISCORD_BOT_TOKEN'), env('DISCORD_CLIENT_ID'));
}
export function configured() {
  return [
    'DISCORD_BOT_TOKEN',
    'DISCORD_CLIENT_ID',
    'DISCORD_CLIENT_SECRET',
    'QEHWA_APP_ORIGIN',
  ].every((key) => Boolean(Deno.env.get(key)));
}
export function cors(request: Request) {
  const allowed = [
    origin(),
    ...(Deno.env.get('QEHWA_ALLOWED_ORIGINS') || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean),
  ];
  const incoming = request.headers.get('Origin');
  if (incoming && !allowed.includes(incoming))
    throw new IntegrationError('origin_denied', 403);
  return {
    'Access-Control-Allow-Origin': incoming || origin(),
    'Access-Control-Allow-Headers':
      'authorization, apikey, content-type, x-client-info, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
    'Cache-Control': 'no-store',
  };
}
export function trustedOrigin(candidate: string) {
  const allowed = [
    origin(),
    ...(Deno.env.get('QEHWA_ALLOWED_ORIGINS') || '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean),
  ];
  if (!allowed.includes(candidate))
    throw new IntegrationError('origin_denied', 403);
  return candidate;
}
export function response(
  data: unknown,
  status = 200,
  headers: Record<string, string> = {}
) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...headers,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}
export function failure(error: unknown, headers: Record<string, string> = {}) {
  const e =
    error instanceof IntegrationError
      ? error
      : new IntegrationError('service_unavailable', 503);
  return response({ error: e.code }, e.status, headers);
}
