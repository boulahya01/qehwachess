export type Role = { id: string; permissions: string };
export type Member = {
  roles: string[];
  communication_disabled_until?: string | null;
};
export type Channel = {
  id: string;
  name: string;
  type: number;
  guild_id?: string;
  permission_overwrites: {
    id: string;
    type: number;
    allow: string;
    deny: string;
  }[];
};
export const ADMIN = 8n,
  MANAGE_GUILD = 32n,
  SEND_PERMISSIONS = 19456n;
export const snowflake = (id: unknown): id is string =>
  typeof id === 'string' && /^[0-9]{17,20}$/.test(id);
export function guildPermissions(guild: string, roles: Role[], member: Member) {
  return roles
    .filter((r) => r.id === guild || member.roles.includes(r.id))
    .reduce((bits, r) => bits | BigInt(r.permissions), 0n);
}
export function managesGuild(owner: string, user: string, bits: bigint) {
  return owner === user || (bits & (ADMIN | MANAGE_GUILD)) !== 0n;
}
export function canSend(
  guild: string,
  bot: string,
  roles: Role[],
  member: Member,
  channel: Channel
) {
  if (
    ![0, 5].includes(channel.type) ||
    (channel.guild_id && channel.guild_id !== guild)
  )
    return false;
  if (
    member.communication_disabled_until &&
    new Date(member.communication_disabled_until).getTime() > Date.now()
  )
    return false;
  let bits = guildPermissions(guild, roles, member);
  if (bits & ADMIN) return true;
  const overwrites = channel.permission_overwrites || [];
  const everyone = overwrites.find((o) => o.type === 0 && o.id === guild);
  if (everyone) bits = (bits & ~BigInt(everyone.deny)) | BigInt(everyone.allow);
  const selected = overwrites.filter(
    (o) => o.type === 0 && member.roles.includes(o.id)
  );
  bits =
    (bits & ~selected.reduce((b, o) => b | BigInt(o.deny), 0n)) |
    selected.reduce((b, o) => b | BigInt(o.allow), 0n);
  const personal = overwrites.find((o) => o.type === 1 && o.id === bot);
  if (personal) bits = (bits & ~BigInt(personal.deny)) | BigInt(personal.allow);
  return (bits & SEND_PERMISSIONS) === SEND_PERMISSIONS;
}
export function publicText(value: string, max: number) {
  return Array.from(
    value
      .replace(/[\r\n]+/g, ' ')
      .replace(/https?:\/\//gi, 'https[:]//')
      .replace(/([\\*_\x60~|[\]])/g, '\\$1')
      .replace(/</g, '‹')
      .replace(/>/g, '›')
  )
    .slice(0, max)
    .join('');
}
export function announcement(
  origin: string,
  locale: string,
  silent: boolean,
  nonce: string,
  tournament?: {
    id: string;
    title: string;
    start_date: string;
    end_date: string;
    venue: string;
  } | null
) {
  const url = new URL(origin);
  if (
    url.protocol !== 'https:' &&
    !['localhost', '127.0.0.1'].includes(url.hostname)
  )
    throw new Error('not_configured');
  const labels =
    locale === 'ar'
      ? {
          dates: 'التاريخ',
          venue: 'المكان',
          test: 'رسالة اختبار',
          sample: 'هذه رسالة اختبار من Qehwa Chess. لا تعلن عن بطولة فعلية.',
        }
      : locale === 'fr'
        ? {
            dates: 'Dates',
            venue: 'Lieu',
            test: 'Annonce de test',
            sample: 'Ceci est un test de Qehwa Chess, sans tournoi réel.',
          }
        : {
            dates: 'Dates',
            venue: 'Venue',
            test: 'Test announcement',
            sample: 'This is a Qehwa Chess test, not a published tournament.',
          };
  return {
    allowed_mentions: { parse: [] },
    flags: silent ? 4096 : 0,
    nonce: nonce.replace(/-/g, '').slice(0, 25),
    enforce_nonce: true,
    embeds: [
      tournament
        ? {
            title: publicText(tournament.title, 200),
            url:
              url.origin +
              '/#/tournaments/' +
              encodeURIComponent(tournament.id),
            color: 0x1c6749,
            fields: [
              {
                name: labels.dates,
                value:
                  tournament.start_date +
                  (tournament.end_date !== tournament.start_date
                    ? ' – ' + tournament.end_date
                    : ''),
                inline: true,
              },
              {
                name: labels.venue,
                value: publicText(tournament.venue, 500) || '—',
                inline: true,
              },
            ],
            footer: { text: 'Qehwa Chess' },
          }
        : {
            title: 'Qehwa Chess · ' + labels.test,
            description: labels.sample,
            color: 0x1c6749,
          },
    ],
  };
}
export class IntegrationError extends Error {
  constructor(
    public code: string,
    public status = 400,
    public retryAfter = 0,
    public uncertain = false
  ) {
    super(code);
  }
}
export class Discord {
  private botId?: string;
  constructor(
    private token: string,
    private clientId: string,
    private request: typeof fetch = fetch
  ) {}
  async call<T>(
    path: string,
    method = 'GET',
    body?: unknown,
    accessToken?: string
  ): Promise<T> {
    let response: Response;
    try {
      response = await this.request('https://discord.com/api/v10' + path, {
        method,
        headers: {
          Authorization: accessToken
            ? 'Bearer ' + accessToken
            : 'Bot ' + this.token,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(10000),
      });
    } catch {
      throw new IntegrationError(
        method === 'POST' ? 'delivery_uncertain' : 'discord_unavailable',
        503,
        30,
        method === 'POST'
      );
    }
    if (response.status === 429) {
      const rate = await response.json().catch(() => ({ retry_after: 30 }));
      throw new IntegrationError(
        'discord_rate_limited',
        429,
        Math.max(1, Math.min(3600, Math.ceil(Number(rate.retry_after) || 30)))
      );
    }
    if (!response.ok) {
      if (method === 'POST' && response.status >= 500)
        throw new IntegrationError('delivery_uncertain', 503, 0, true);
      throw new IntegrationError(
        response.status === 401
          ? 'not_configured'
          : response.status === 403
            ? 'missing_permissions'
            : response.status === 404
              ? 'bot_or_channel_missing'
              : 'discord_unavailable',
        response.status >= 500 ? 503 : 400,
        response.status >= 500 ? 30 : 0
      );
    }
    return response.json();
  }
  async identity() {
    if (!this.botId) {
      const me = await this.call<{ id: string; bot: boolean }>('/users/@me');
      if (!me.bot || me.id !== this.clientId)
        throw new IntegrationError('not_configured', 503);
      this.botId = me.id;
    }
    return this.botId;
  }
  async server(guild: string, actor: string) {
    if (!snowflake(guild) || !snowflake(actor))
      throw new IntegrationError('invalid_request');
    const bot = await this.identity();
    const [server, member, botMember] = await Promise.all([
      this.call<{ id: string; name: string; owner_id: string; roles: Role[] }>(
        '/guilds/' + guild
      ),
      this.call<Member>('/guilds/' + guild + '/members/' + actor),
      this.call<Member>('/guilds/' + guild + '/members/' + bot),
    ]);
    if (
      !managesGuild(
        server.owner_id,
        actor,
        guildPermissions(guild, server.roles, member)
      )
    )
      throw new IntegrationError('server_denied', 403);
    return { server, bot, botMember };
  }
  async channels(guild: string, actor: string) {
    const context = await this.server(guild, actor);
    const channels = await this.call<Channel[]>(
      '/guilds/' + guild + '/channels'
    );
    return channels
      .filter((channel) =>
        canSend(
          guild,
          context.bot,
          context.server.roles,
          context.botMember,
          channel
        )
      )
      .map(({ id, name }) => ({ id, name }));
  }
  async verifyChannel(guild: string, actor: string, channelId: string) {
    if (!snowflake(channelId)) throw new IntegrationError('invalid_request');
    const context = await this.server(guild, actor);
    const channel = await this.call<Channel>('/channels/' + channelId);
    if (
      channel.guild_id !== guild ||
      !canSend(
        guild,
        context.bot,
        context.server.roles,
        context.botMember,
        channel
      )
    )
      throw new IntegrationError('missing_permissions', 403);
    return channel;
  }
}
