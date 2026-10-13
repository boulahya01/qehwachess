import {
  backend,
  client,
  env,
  failure,
  origin,
  trustedOrigin,
} from '../_shared/discord-platform.ts';
import { hash, random } from '../_shared/discord-service.ts';
import { IntegrationError, managesGuild } from '../_shared/discord-domain.ts';
Deno.serve(async (request) => {
  let destination: string | undefined;
  try {
    if (request.method !== 'GET')
      throw new IntegrationError('invalid_request', 405);
    const url = new URL(request.url),
      state = url.searchParams.get('state');
    if (!state || !/^[0-9a-f]{64}$/.test(state))
      throw new IntegrationError('expired_flow');
    const db = backend(client());
    const flow = (await db('oauth_consume', { hash: await hash(state) })) as {
      user_id: string;
      scope: string;
      club_id: string | null;
      return_origin: string | null;
    };
    destination =
      trustedOrigin(flow.return_origin || origin()) +
      '/#/integrations/discord/' +
      flow.scope +
      (flow.club_id ? '/' + flow.club_id : '');
    await db('status', {
      user_id: flow.user_id,
      scope: flow.scope,
      club_id: flow.club_id,
    });
    if (url.searchParams.has('error'))
      throw new IntegrationError('oauth_cancelled');
    const code = url.searchParams.get('code');
    if (!code || code.length > 4096) throw new IntegrationError('expired_flow');
    const callback =
      env('SUPABASE_URL') + '/functions/v1/discord-connect-callback';
    const tokenResponse = await fetch(
      'https://discord.com/api/v10/oauth2/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: env('DISCORD_CLIENT_ID'),
          client_secret: env('DISCORD_CLIENT_SECRET'),
          grant_type: 'authorization_code',
          code,
          redirect_uri: callback,
        }),
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!tokenResponse.ok) throw new IntegrationError('expired_flow');
    const token = await tokenResponse.json();
    try {
      const get = async <T>(path: string): Promise<T> => {
        const r = await fetch('https://discord.com/api/v10' + path, {
          headers: { Authorization: 'Bearer ' + token.access_token },
          signal: AbortSignal.timeout(10000),
        });
        if (!r.ok) throw new IntegrationError('discord_unavailable', 503);
        return r.json();
      };
      const me = await get<{ id: string }>('/users/@me');
      const guilds: { id: string; name: string }[] = [];
      let after = '';
      for (let page = 0; page < 10; page++) {
        const batch = await get<
          { id: string; name: string; owner: boolean; permissions: string }[]
        >('/users/@me/guilds?limit=200' + (after ? '&after=' + after : ''));
        guilds.push(
          ...batch
            .filter(
              (g) => g.owner || managesGuild('', me.id, BigInt(g.permissions))
            )
            .map((g) => ({ id: g.id, name: g.name.slice(0, 100) }))
        );
        if (batch.length < 200) break;
        after = batch[batch.length - 1].id;
      }
      const ticket = random();
      await db('oauth_finish', {
        hash: await hash(state),
        ticket: await hash(ticket),
        discord_user_id: me.id,
        guilds,
      });
      destination += '?ticket=' + ticket;
    } finally {
      // Do not retain user access or refresh tokens.
      await fetch('https://discord.com/api/v10/oauth2/token/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: env('DISCORD_CLIENT_ID'),
          client_secret: env('DISCORD_CLIENT_SECRET'),
          token: token.access_token,
        }),
        signal: AbortSignal.timeout(5000),
      }).catch(() => undefined);
    }
    return new Response(null, {
      status: 303,
      headers: {
        Location: destination,
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
      },
    });
  } catch (error) {
    if (destination)
      return new Response(null, {
        status: 303,
        headers: {
          Location:
            destination +
            '?error=' +
            (error instanceof IntegrationError
              ? error.code
              : 'discord_unavailable'),
          'Cache-Control': 'no-store',
          'Referrer-Policy': 'no-referrer',
        },
      });
    return failure(error);
  }
});
