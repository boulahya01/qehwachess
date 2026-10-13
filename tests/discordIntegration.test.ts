import { describe, it, expect, vi } from 'vitest';
import {
  announcement,
  canSend,
  Discord,
  IntegrationError,
  managesGuild,
  SEND_PERMISSIONS,
} from '../supabase/functions/_shared/discord-domain';
import {
  action,
  Backend,
  processDelivery,
  Task,
} from '../supabase/functions/_shared/discord-service';
const guild = '100000000000000001',
  bot = '100000000000000002',
  actor = '100000000000000003',
  channel = '100000000000000004';
const tenant = {
  user_id: 'test-user',
  scope: 'club' as const,
  club_id: '10000000-0000-4000-8000-000000000001',
};
const task: Task = {
  connection: {
    id: 'connection',
    guild_id: guild,
    guild_name: 'Club',
    channel_id: channel,
    discord_user_id: actor,
    locale: 'en',
    silent: true,
  },
  delivery: {
    id: '00000000-0000-4000-8000-000000000001',
    claim_token: 'claim',
    attempts: 1,
    kind: 'publication',
  },
  tournament: {
    id: 'event',
    title: 'Hello @everyone [link](https://bad.invalid)',
    venue: 'Test café',
    start_date: '2027-01-01',
    end_date: '2027-01-02',
  },
};
describe('Discord permissions and safe announcements', () => {
  it('handles everyone, role and member channel overwrites in Discord order', () => {
    const roles = [
      { id: guild, permissions: SEND_PERMISSIONS.toString() },
      { id: 'extra', permissions: '0' },
    ];
    const member = { roles: ['extra'] };
    const base = {
      id: channel,
      name: 'events',
      type: 0,
      guild_id: guild,
      permission_overwrites: [
        { id: guild, type: 0, deny: '2048', allow: '0' },
        { id: 'extra', type: 0, deny: '0', allow: '2048' },
      ],
    };
    expect(canSend(guild, bot, roles, member, base)).toBe(true);
    expect(
      canSend(guild, bot, roles, member, {
        ...base,
        permission_overwrites: [
          ...base.permission_overwrites,
          { id: bot, type: 1, deny: '16384', allow: '0' },
        ],
      })
    ).toBe(false);
    expect(canSend(guild, bot, roles, member, { ...base, type: 2 })).toBe(
      false
    );
    expect(
      canSend(guild, bot, roles, member, { ...base, guild_id: 'another' })
    ).toBe(false);
    expect(
      canSend(
        guild,
        bot,
        roles,
        { ...member, communication_disabled_until: '2999-01-01' },
        base
      )
    ).toBe(false);
  });
  it('accepts guild owner/admin/manage-server authority but not ordinary membership', () => {
    expect(managesGuild(actor, actor, 0n)).toBe(true);
    expect(managesGuild('other', actor, 8n)).toBe(true);
    expect(managesGuild('other', actor, 32n)).toBe(true);
    expect(managesGuild('other', actor, 2048n)).toBe(false);
  });
  it('suppresses mentions, uses a stable nonce and includes only public event fields', () => {
    const payload = announcement(
      'https://example.org',
      'ar',
      true,
      task.delivery.id,
      task.tournament
    );
    expect(payload.allowed_mentions.parse).toEqual([]);
    expect(payload.enforce_nonce).toBe(true);
    expect(payload.nonce.length).toBe(25);
    expect(payload.flags).toBe(4096);
    expect(payload.embeds[0].url).toBe(
      'https://example.org/#/tournaments/event'
    );
    expect(payload.embeds[0].title).not.toContain('https://bad');
    expect(JSON.stringify(payload)).not.toMatch(/email|phone|participants/);
    expect(
      announcement('https://example.org', 'en', false, 'sample', null).embeds[0]
        .title
    ).toContain('Test announcement');
  });
  it('rejects insecure nonlocal event origins', () =>
    expect(() =>
      announcement('http://external.invalid', 'en', true, 'a')
    ).toThrow('not_configured'));
});
describe('tenant and delivery boundaries', () => {
  it('checks tenant access before Discord calls or configuration writes', async () => {
    const db = vi
      .fn<Backend>()
      .mockRejectedValue(new IntegrationError('tenant_denied', 403));
    const server = vi.fn();
    const discord = { server } as unknown as Discord;
    await expect(
      action(db, discord, 'https://example.org', 'client', 'callback', tenant, {
        action: 'connect',
        ticket: 'a'.repeat(64),
        guild_id: guild,
      })
    ).rejects.toThrow('tenant_denied');
    expect(server).not.toHaveBeenCalled();
    expect(db).toHaveBeenCalledTimes(1);
  });
  it('rejects a server not present in the authenticated consent result', async () => {
    const db = vi
      .fn<Backend>()
      .mockResolvedValueOnce({ connection: null })
      .mockResolvedValueOnce({ guilds: [], discord_user_id: actor });
    const server = vi.fn();
    await expect(
      action(
        db,
        { server } as unknown as Discord,
        'https://example.org',
        'client',
        'callback',
        tenant,
        { action: 'connect', ticket: 'a'.repeat(64), guild_id: guild }
      )
    ).rejects.toThrow('server_denied');
    expect(server).not.toHaveBeenCalled();
  });
  it('never sends a cancelled, disabled, stale or already completed delivery', async () => {
    const db = vi.fn<Backend>().mockResolvedValue(null);
    const call = vi.fn();
    await processDelivery(
      db,
      { call } as unknown as Discord,
      'https://example.org',
      'job',
      1
    );
    expect(call).not.toHaveBeenCalled();
  });
  it('rechecks eligibility immediately before sending', async () => {
    const db = vi
      .fn<Backend>()
      .mockResolvedValueOnce(task)
      .mockResolvedValueOnce(false);
    const call = vi.fn(),
      verifyChannel = vi.fn().mockResolvedValue({});
    await processDelivery(
      db,
      { call, verifyChannel } as unknown as Discord,
      'https://example.org',
      'job',
      1
    );
    expect(call).not.toHaveBeenCalled();
    expect(db.mock.calls[1][0]).toBe('arm');
  });
  it('acknowledges a successful send with its message id', async () => {
    const db = vi
      .fn<Backend>()
      .mockResolvedValueOnce(task)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce('sent');
    const call = vi.fn().mockResolvedValue({ id: '100000000000000005' }),
      verifyChannel = vi.fn().mockResolvedValue({});
    expect(
      await processDelivery(
        db,
        { call, verifyChannel } as unknown as Discord,
        'https://example.org',
        'job',
        1
      )
    ).toEqual({ status: 'sent' });
    expect(db.mock.calls[2]).toEqual([
      'settle',
      expect.objectContaining({
        status: 'sent',
        message_id: '100000000000000005',
        claim: 'claim',
      }),
    ]);
  });
  it('keeps a successful remote send uncertain when storing its receipt fails', async () => {
    const db = vi
      .fn<Backend>()
      .mockResolvedValueOnce(task)
      .mockResolvedValueOnce(true)
      .mockRejectedValueOnce(new Error('database unavailable'))
      .mockResolvedValueOnce('uncertain');
    const call = vi.fn().mockResolvedValue({ id: '100000000000000005' });
    const verifyChannel = vi.fn().mockResolvedValue({});
    expect(
      await processDelivery(
        db,
        { call, verifyChannel } as unknown as Discord,
        'https://example.org',
        'job',
        1
      )
    ).toEqual({ status: 'uncertain', error: 'delivery_uncertain' });
    expect(call).toHaveBeenCalledTimes(1);
    expect(db.mock.calls[3]).toEqual([
      'settle',
      expect.objectContaining({ status: 'uncertain' }),
    ]);
  });
  it('binds the OAuth return origin to the hashed state rather than the public URL', async () => {
    const db = vi.fn<Backend>().mockResolvedValue({ connection: null });
    const result = (await action(
      db,
      {} as Discord,
      'https://example.org',
      'client',
      'https://backend.example.org/callback',
      tenant,
      { action: 'start' },
      'http://127.0.0.1:4174'
    )) as { url: string };
    const url = new URL(result.url);
    const state = url.searchParams.get('state');
    expect(state).toMatch(/^[0-9a-f]{64}$/);
    expect(db.mock.calls[1][1]?.hash).not.toBe(state);
    expect(db.mock.calls[2]).toEqual([
      'oauth_origin',
      {
        hash: db.mock.calls[1][1]?.hash,
        origin: 'http://127.0.0.1:4174',
      },
    ]);
    expect(url.searchParams.get('scope')).toBe('identify guilds');
    expect(url.searchParams.has('return_origin')).toBe(false);
  });
  it.each([
    ['missing_permissions', 403, 0, 'failed'],
    ['discord_rate_limited', 429, 12, 'retry'],
    ['discord_unavailable', 503, 30, 'retry'],
  ] as const)(
    'handles %s without posting',
    async (code, http, delay, state) => {
      const db = vi
        .fn<Backend>()
        .mockResolvedValueOnce({
          ...task,
          delivery: {
            ...task.delivery,
            attempts: code === 'discord_unavailable' ? 3 : 1,
          },
        })
        .mockResolvedValueOnce(state);
      const call = vi.fn(),
        verifyChannel = vi
          .fn()
          .mockRejectedValue(new IntegrationError(code, http, delay));
      await processDelivery(
        db,
        { call, verifyChannel } as unknown as Discord,
        'https://example.org',
        'job',
        1
      );
      expect(call).not.toHaveBeenCalled();
      expect(db.mock.calls[1]).toEqual([
        'settle',
        expect.objectContaining({
          status: state,
          error_code: code,
          delay: code === 'discord_unavailable' ? 120 : delay || 30,
        }),
      ]);
    }
  );
  it('does not blindly retry an ambiguous remote send', async () => {
    const db = vi
      .fn<Backend>()
      .mockResolvedValueOnce(task)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce('uncertain');
    const call = vi
        .fn()
        .mockRejectedValue(
          new IntegrationError('delivery_uncertain', 503, 0, true)
        ),
      verifyChannel = vi.fn().mockResolvedValue({});
    await processDelivery(
      db,
      { call, verifyChannel } as unknown as Discord,
      'https://example.org',
      'job',
      1
    );
    expect(db.mock.calls[2]).toEqual([
      'settle',
      expect.objectContaining({ status: 'uncertain' }),
    ]);
    expect(call).toHaveBeenCalledTimes(1);
  });
  it('treats transport failures during POST as uncertain', async () => {
    const discord = new Discord(
      'synthetic-token',
      'synthetic-client',
      vi.fn().mockRejectedValue(new Error('connection dropped'))
    );
    await expect(
      discord.call('/channels/' + channel + '/messages', 'POST', {})
    ).rejects.toMatchObject({ code: 'delivery_uncertain', uncertain: true });
  });
  it('honors Discord rate-limit delay without exposing the response body', async () => {
    const discord = new Discord(
      'synthetic-token',
      'synthetic-client',
      vi.fn().mockResolvedValue(
        new Response('{"retry_after":1.7,"private":"not exposed"}', {
          status: 429,
        })
      )
    );
    await expect(discord.call('/users/@me')).rejects.toMatchObject({
      code: 'discord_rate_limited',
      retryAfter: 2,
    });
  });
});
