import {
  announcement,
  Discord,
  IntegrationError,
  snowflake,
} from './discord-domain.ts';
export type Payload = Record<string, unknown>;
export type Backend = (action: string, payload?: Payload) => Promise<unknown>;
export type Target = {
  user_id: string;
  scope: 'club' | 'official';
  club_id: string | null;
};
export type Connection = {
  id: string;
  guild_id: string;
  guild_name: string;
  channel_id: string;
  discord_user_id: string;
  locale: string;
  silent: boolean;
};
export type Task = {
  connection: Connection;
  delivery: { id: string; claim_token: string; attempts: number; kind: string };
  tournament: {
    id: string;
    title: string;
    venue: string;
    start_date: string;
    end_date: string;
  } | null;
};
export async function hash(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
    ),
    (b) => b.toString(16).padStart(2, '0')
  ).join('');
}
export function random() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
    b.toString(16).padStart(2, '0')
  ).join('');
}
export function target(user: string, scope: unknown, club: unknown): Target {
  if (
    !['club', 'official'].includes(String(scope)) ||
    (scope === 'club' &&
      (typeof club !== 'string' || !/^[0-9a-f-]{36}$/i.test(club))) ||
    (scope === 'official' && club)
  )
    throw new IntegrationError('invalid_request');
  return {
    user_id: user,
    scope: scope as Target['scope'],
    club_id: scope === 'club' ? (club as string) : null,
  };
}
export async function processDelivery(
  db: Backend,
  discord: Discord,
  origin: string,
  id: string,
  msgId?: number
) {
  const deadline = Date.now() + 50000;
  const task = (await db('prepare', { id, msg_id: msgId })) as Task | null;
  if (!task) return { status: 'skipped' };
  const { connection: c, delivery: d } = task;
  const identity = { id: d.id, claim: d.claim_token };
  try {
    await discord.verifyChannel(c.guild_id, c.discord_user_id, c.channel_id);
    if (Date.now() > deadline)
      throw new IntegrationError('discord_unavailable', 503, 30);
    const body = announcement(
      origin,
      c.locale,
      c.silent,
      d.id,
      task.tournament
    );
    if (!(await db('arm', identity))) return { status: 'skipped' };
    const sent = await discord.call<{ id: string }>(
      '/channels/' + c.channel_id + '/messages',
      'POST',
      body
    );
    if (!snowflake(sent.id))
      throw new IntegrationError('delivery_uncertain', 503, 0, true);
    // If persistence fails after send, the lease recovery marks it uncertain.
    try {
      await db('settle', { ...identity, status: 'sent', message_id: sent.id });
    } catch {
      throw new IntegrationError('delivery_uncertain', 503, 0, true);
    }
    return { status: 'sent' };
  } catch (error) {
    const known =
      error instanceof IntegrationError
        ? error
        : new IntegrationError('delivery_uncertain', 503, 0, true);
    const state = known.uncertain
      ? 'uncertain'
      : known.retryAfter
        ? 'retry'
        : 'failed';
    const status = await db('settle', {
      ...identity,
      status: state,
      error_code: known.code,
      delay:
        known.code === 'discord_rate_limited'
          ? known.retryAfter
          : Math.max(
              known.retryAfter,
              Math.min(3600, 15 * 2 ** Math.min(d.attempts, 8))
            ),
    });
    return { status, error: known.code };
  }
}
export async function action(
  db: Backend,
  discord: Discord,
  origin: string,
  clientId: string,
  callback: string,
  tenant: Target,
  input: Payload,
  returnOrigin?: string
) {
  const which = input.action;
  // Authorization always precedes Discord traffic and every mutation.
  const current = (await db('status', tenant)) as {
    connection: Connection | null;
    worker_ready: boolean;
  };
  if (which === 'status') return current;
  if (which === 'start') {
    const state = random();
    await db('oauth_begin', { ...tenant, hash: await hash(state) });
    if (returnOrigin)
      await db('oauth_origin', {
        hash: await hash(state),
        origin: returnOrigin,
      });
    const url = new URL('https://discord.com/oauth2/authorize');
    url.search = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      scope: 'identify guilds',
      redirect_uri: callback,
      state,
      prompt: 'consent',
    }).toString();
    return { url: url.toString() };
  }
  if (which === 'pending' || which === 'connect') {
    if (
      typeof input.ticket !== 'string' ||
      !/^[0-9a-f]{64}$/.test(input.ticket)
    )
      throw new IntegrationError('expired_flow');
    const ticket = await hash(input.ticket);
    const pending = (await db('pending', { ...tenant, ticket })) as {
      guilds: { id: string; name: string }[];
      discord_user_id: string;
    };
    if (which === 'pending') return { guilds: pending.guilds };
    if (
      !snowflake(input.guild_id) ||
      !pending.guilds.some((g) => g.id === input.guild_id)
    )
      throw new IntegrationError('server_denied', 403);
    const verified = await discord.server(
      input.guild_id,
      pending.discord_user_id
    );
    await db('connect', {
      ...tenant,
      ticket,
      guild_id: verified.server.id,
      guild_name: verified.server.name.slice(0, 100),
    });
    return { connected: true };
  }
  if (which === 'disconnect') {
    await db('disconnect', tenant);
    return { disconnected: true };
  }
  const c = (await db('identity', tenant)) as Connection;
  if (which === 'channels')
    return { channels: await discord.channels(c.guild_id, c.discord_user_id) };
  if (which === 'save') {
    if (
      !snowflake(input.channel_id) ||
      typeof input.enabled !== 'boolean' ||
      typeof input.silent !== 'boolean' ||
      !['en', 'fr', 'ar'].includes(String(input.locale))
    )
      throw new IntegrationError('invalid_request');
    if (input.enabled && !current.worker_ready)
      throw new IntegrationError('worker_not_ready', 503);
    const channel = await discord.verifyChannel(
      c.guild_id,
      c.discord_user_id,
      input.channel_id
    );
    await db('settings', {
      ...tenant,
      channel_id: channel.id,
      channel_name: channel.name.slice(0, 100),
      enabled: input.enabled,
      silent: input.silent,
      locale: input.locale,
    });
    return { saved: true };
  }
  if (which === 'test') {
    // Only an explicit authenticated Test action posts a sample.
    await discord.verifyChannel(c.guild_id, c.discord_user_id, c.channel_id);
    const id = (await db('test', tenant)) as string;
    return processDelivery(db, discord, origin, id);
  }
  if (which === 'retry') {
    if (
      typeof input.delivery_id !== 'string' ||
      !/^[0-9a-f-]{36}$/i.test(input.delivery_id)
    )
      throw new IntegrationError('invalid_request');
    await discord.verifyChannel(c.guild_id, c.discord_user_id, c.channel_id);
    if (
      !(await db('retry_failed', {
        connection_id: c.id,
        delivery_id: input.delivery_id,
      }))
    )
      throw new IntegrationError('retry_not_allowed');
    return { queued: true };
  }
  throw new IntegrationError('invalid_request');
}
