import { useEffect, useState, useRef } from 'react';
import { Link, useRouter } from '@/context/RouterContext';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import {
  discordError,
  discordRequest,
  DiscordStatus,
} from '@/lib/discordIntegration';
import { PageLoader } from '@/components/ui/Feedback';
import { AuthMessage } from '@/components/auth/AuthParts';
import { Field } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { discordTranslations } from '@/lib/translationsDiscord';
import { Plug, CheckCircle2, ExternalLink } from 'lucide-react';
export function DiscordIntegrationPage() {
  const { route, navigate, confirmLeave } = useRouter();
  const { user } = useAuth(),
    { t: baseT, language } = useLanguage();
  const t = (text: string) =>
    language === 'en'
      ? baseT(text)
      : (discordTranslations[language][text] ?? baseT(text));
  const scope = route.name === 'discordIntegration' ? route.scope : 'official';
  const clubId =
    route.name === 'discordIntegration' ? (route.clubId ?? null) : null;
  const ticket = route.name === 'discordIntegration' ? route.ticket : undefined;
  const callbackError =
    route.name === 'discordIntegration' ? route.error : undefined;
  const target = { scope, club_id: clubId };
  const [status, setStatus] = useState<DiscordStatus | null>(null);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null),
    [notice, setNotice] = useState<string | null>(null);
  const [guilds, setGuilds] = useState<{ id: string; name: string }[]>([]),
    [guild, setGuild] = useState('');
  const [channels, setChannels] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState({
    channel_id: '',
    enabled: false,
    silent: true,
    locale: 'en',
  });
  const [saved, setSaved] = useState(form),
    [confirm, setConfirm] = useState<'disconnect' | 'test' | 'retry' | null>(
      null
    );
  const [retryId, setRetryId] = useState('');
  const confirmRegion = useRef<HTMLElement>(null),
    confirmTrigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (confirm) confirmRegion.current?.focus();
  }, [confirm]);
  function closeConfirm() {
    setConfirm(null);
    confirmTrigger.current?.focus();
  }
  function ask(
    value: 'disconnect' | 'test' | 'retry',
    button: HTMLButtonElement
  ) {
    confirmTrigger.current = button;
    setConfirm(value);
  }
  const dirty = JSON.stringify(form) !== JSON.stringify(saved);
  const allowLeave = useUnsavedChanges(dirty);
  useEffect(() => {
    let active = true;
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    setStatus(null);
    setGuilds([]);
    setChannels([]);
    void (async () => {
      try {
        const data = await discordRequest<DiscordStatus>(target, 'status');
        if (!active) return;
        setStatus(data);
        const c = data.connection;
        const next = {
          channel_id: c?.channel_id || '',
          enabled: c?.enabled || false,
          silent: c?.silent ?? true,
          locale: c?.locale || 'en',
        };
        setForm(next);
        setSaved(next);
        if (callbackError) setError(discordError(callbackError));
        if (ticket) {
          const pending = await discordRequest<{
            guilds: { id: string; name: string }[];
          }>(target, 'pending', { ticket });
          if (active) setGuilds(pending.guilds);
        }
      } catch (e) {
        if (active)
          setError(
            e instanceof Error
              ? e.message
              : 'Discord could not be reached. Your settings have been preserved.'
          );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
    // Identity changes invalidate a tenant's previously displayed settings.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, clubId, user?.id, ticket, callbackError]);
  async function run(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await work();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Discord could not be reached. Your settings have been preserved.'
      );
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    const next = await discordRequest<DiscordStatus>(target, 'status');
    setStatus(next);
    return next;
  }
  const connection = status?.connection;
  const connected = Boolean(connection && connection.health !== 'disconnected');
  const ownIdentity = connection?.connected_by === user?.id;
  if (!user)
    return (
      <div className="v2-container editor-page">
        <h1>{t('Discord announcements')}</h1>
        <p>{t('Sign in to manage Discord announcements.')}</p>
        <Link className="action action-primary" to={{ name: 'signin' }}>
          {t('Sign in')}
        </Link>
      </div>
    );
  if (loading)
    return (
      <div className="v2-container editor-page">
        <PageLoader />
      </div>
    );
  return (
    <div className="v2-container discord-settings">
      <Link
        className="text-link"
        to={{ name: scope === 'club' ? 'clubManagement' : 'admin' }}
      >
        {t('Back to workspace')}
      </Link>
      <header className="security-heading">
        <Plug size={24} aria-hidden="true" />
        <h1>{t('Discord announcements')}</h1>
        <p>
          {t(
            scope === 'club'
              ? 'Share your club’s published tournaments with your Discord server.'
              : 'Share public tournaments with the official community.'
          )}
        </p>
      </header>
      <AuthMessage message={error ? t(error) : null} />
      <AuthMessage message={notice ? t(notice) : null} success />
      {!status && (
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await refresh();
            })
          }
        >
          {t('Retry')}
        </Button>
      )}
      {status && (
        <>
          {!status.configured && (
            <p className="auth-message">
              {t('Discord integration is awaiting backend setup.')}
            </p>
          )}
          <section className="security-section">
            <div>
              <h2>{t('Discord server')}</h2>
              <p>
                {connected ? connection?.guild_name : t('No server connected')}
              </p>
            </div>
            <div className="discord-server-actions">
              {!ticket && (
                <Button
                  variant="secondary"
                  disabled={busy || !status.configured}
                  onClick={() =>
                    void run(async () => {
                      if (!confirmLeave()) return;
                      const result = await discordRequest<{ url: string }>(
                        target,
                        'start'
                      );
                      window.location.assign(result.url);
                    })
                  }
                >
                  {t(
                    connected
                      ? 'Connect another server'
                      : 'Connect Discord server'
                  )}
                </Button>
              )}
              {ticket && (
                <form
                  className="auth-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => {
                      await discordRequest(target, 'connect', {
                        ticket,
                        guild_id: guild,
                      });
                      allowLeave();
                      navigate({
                        name: 'discordIntegration',
                        scope,
                        clubId: clubId || undefined,
                      });
                    });
                  }}
                >
                  <label htmlFor="discord-guild">
                    {t('Choose your server')}
                  </label>
                  <Field>
                    <select
                      id="discord-guild"
                      className="auth-input"
                      required
                      value={guild}
                      onChange={(e) => setGuild(e.target.value)}
                    >
                      <option value="">{t('Choose your server')}</option>
                      {guilds.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {!guilds.length && (
                    <p>
                      {t(
                        'No servers with Manage Server permission were found.'
                      )}
                    </p>
                  )}
                  <Button variant="primary" disabled={busy || !guild}>
                    {t(busy ? 'Connecting...' : 'Connect server')}
                  </Button>
                  <button
                    type="button"
                    className="auth-text-button"
                    disabled={busy}
                    onClick={() =>
                      navigate({
                        name: 'discordIntegration',
                        scope,
                        clubId: clubId || undefined,
                      })
                    }
                  >
                    {t('Cancel')}
                  </button>
                </form>
              )}
              {status.install_url && (
                <a
                  className="text-link"
                  href={status.install_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t('Install the Qehwa Chess bot')}
                  <ExternalLink size={14} aria-hidden="true" />
                </a>
              )}
              {connected && !ownIdentity && (
                <p className="field-hint">
                  {t(
                    'Reconnect with your Discord account to manage this server.'
                  )}
                </p>
              )}
            </div>
          </section>
          {connected && (
            <section className="security-section">
              <div>
                <h2>{t('Announcement channel')}</h2>
                <p>{t('Only channels where the bot can post are listed.')}</p>
              </div>
              <form
                className="auth-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    await discordRequest(target, 'save', form);
                    setSaved(form);
                    allowLeave();
                    await refresh();
                    setNotice('Discord settings saved.');
                  });
                }}
              >
                <button
                  type="button"
                  className="text-link"
                  disabled={busy || !ownIdentity}
                  onClick={() =>
                    void run(async () => {
                      const result = await discordRequest<{
                        channels: { id: string; name: string }[];
                      }>(target, 'channels');
                      setChannels(result.channels);
                      if (!result.channels.length)
                        setError(
                          'The bot needs View Channel, Send Messages and Embed Links in this channel.'
                        );
                    })
                  }
                >
                  {t('Load available channels')}
                </button>
                <label htmlFor="discord-channel">{t('Channel')}</label>
                <Field>
                  <select
                    className="auth-input"
                    id="discord-channel"
                    required
                    disabled={!ownIdentity || busy}
                    value={form.channel_id}
                    onChange={(e) =>
                      setForm({ ...form, channel_id: e.target.value })
                    }
                  >
                    <option value="">{t('Choose a channel')}</option>
                    {connection?.channel_id &&
                      !channels.some((c) => c.id === connection.channel_id) && (
                        <option value={connection.channel_id}>
                          #{connection.channel_name}
                        </option>
                      )}
                    {channels.map((c) => (
                      <option key={c.id} value={c.id}>
                        #{c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <label htmlFor="discord-locale">
                  {t('Announcement language')}
                </label>
                <select
                  className="auth-input"
                  id="discord-locale"
                  disabled={busy || !ownIdentity}
                  value={form.locale}
                  onChange={(e) => setForm({ ...form, locale: e.target.value })}
                >
                  <option value="en">English</option>
                  <option value="fr">Français</option>
                  <option value="ar">العربية</option>
                </select>
                <label className="discord-check">
                  <input
                    type="checkbox"
                    disabled={busy || !ownIdentity || !status.worker_ready}
                    checked={form.enabled}
                    onChange={(e) =>
                      setForm({ ...form, enabled: e.target.checked })
                    }
                  />
                  {t('Automatically announce published tournaments')}
                </label>
                {!status.worker_ready && (
                  <p className="field-hint">
                    {t('Automatic announcements are awaiting delivery setup.')}
                  </p>
                )}
                <label className="discord-check">
                  <input
                    type="checkbox"
                    disabled={busy || !ownIdentity}
                    checked={form.silent}
                    onChange={(e) =>
                      setForm({ ...form, silent: e.target.checked })
                    }
                  />
                  {t('Post quietly without notification sounds')}
                </label>
                <p className="field-hint">
                  {t(
                    'Drafts and pending tournaments are never announced. Individual events can opt out.'
                  )}
                </p>
                <div className="security-form-actions">
                  <Button
                    variant="primary"
                    disabled={busy || !dirty || !ownIdentity}
                  >
                    {t(busy && dirty ? 'Saving...' : 'Save settings')}
                  </Button>
                  <span className="field-hint">
                    {t(dirty ? 'You have unsaved changes.' : 'Settings saved.')}
                  </span>
                </div>
              </form>
            </section>
          )}
          {connected && (
            <section className="security-section">
              <div>
                <h2>{t('Check the connection')}</h2>
                <p>
                  {t(
                    'A test posts one clearly labelled sample to the saved channel.'
                  )}
                </p>
              </div>
              <div className="security-form-actions">
                <Button
                  variant="secondary"
                  disabled={
                    busy || dirty || !connection?.channel_id || !ownIdentity
                  }
                  onClick={(e) => ask('test', e.currentTarget)}
                >
                  {t('Send test announcement')}
                </Button>
                <button
                  className="auth-text-button text-danger"
                  disabled={busy}
                  onClick={(e) => ask('disconnect', e.currentTarget)}
                >
                  {t('Disconnect server')}
                </button>
              </div>
            </section>
          )}
          {confirm && (
            <section
              ref={confirmRegion}
              tabIndex={-1}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && !busy) closeConfirm();
              }}
              className="auth-confirm"
              role="region"
              aria-label={t('Confirm Discord action')}
            >
              <p>
                {t(
                  confirm === 'test'
                    ? 'Post one test announcement to the saved channel?'
                    : confirm === 'retry'
                      ? 'Retry this failed announcement to the saved channel?'
                      : 'Disconnect this server and stop future announcements?'
                )}
              </p>
              <div className="security-form-actions">
                <Button
                  variant={confirm === 'disconnect' ? 'danger' : 'primary'}
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      if (confirm === 'disconnect') {
                        if (!confirmLeave()) return;
                        await discordRequest(target, 'disconnect');
                        allowLeave();
                        setForm({ ...form, enabled: false });
                        setSaved({ ...form, enabled: false });
                        setNotice('Discord server disconnected.');
                      } else if (confirm === 'retry') {
                        await discordRequest(target, 'retry', {
                          delivery_id: retryId,
                        });
                        setNotice('Announcement queued for retry.');
                      } else {
                        const result = await discordRequest<{
                          status: string;
                          error?: string;
                        }>(target, 'test');
                        if (result.status !== 'sent')
                          throw new Error(
                            discordError(result.error || 'delivery_uncertain')
                          );
                        setNotice('Test announcement sent.');
                      }
                      setConfirm(null);
                      await refresh();
                    })
                  }
                >
                  {t(
                    confirm === 'test'
                      ? 'Send test announcement'
                      : confirm === 'retry'
                        ? 'Retry announcement'
                        : 'Disconnect server'
                  )}
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={closeConfirm}
                >
                  {t('Cancel')}
                </Button>
              </div>
            </section>
          )}
          <section className="security-section">
            <div>
              <h2>{t('Recent deliveries')}</h2>
              <p>
                {t(
                  'Only future publications are announced. Connecting does not repost old tournaments.'
                )}
              </p>
            </div>
            <div>
              <button
                className="text-link"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await refresh();
                  })
                }
              >
                {t('Refresh status')}
              </button>
              {!status.deliveries.length && (
                <p className="field-hint">{t('No announcements yet.')}</p>
              )}
              <ul className="discord-deliveries">
                {status.deliveries.map((d) => (
                  <li key={d.id}>
                    <div>
                      <span>
                        {t(
                          d.kind === 'test'
                            ? 'Test announcement'
                            : 'Tournament announcement'
                        )}
                      </span>
                      <small>
                        {new Intl.DateTimeFormat(language, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        }).format(new Date(d.created_at))}
                      </small>
                    </div>
                    <div>
                      <span
                        className={
                          'badge ' +
                          (d.status === 'sent' ? 'text-brand-400' : '')
                        }
                      >
                        {d.status === 'sent' && (
                          <CheckCircle2 size={14} aria-hidden="true" />
                        )}
                        {t(d.status)}
                      </span>
                      {d.error_code && (
                        <p className="field-hint">
                          {t(discordError(d.error_code))}
                        </p>
                      )}
                      {d.status === 'failed' &&
                        d.kind === 'publication' &&
                        connected &&
                        ownIdentity && (
                          <button
                            className="text-link"
                            disabled={busy || dirty || !form.enabled}
                            onClick={(e) => {
                              setRetryId(d.id);
                              ask('retry', e.currentTarget);
                            }}
                          >
                            {t('Retry announcement')}
                          </button>
                        )}
                      {d.message_id && connection && (
                        <a
                          className="text-link"
                          href={
                            'https://discord.com/channels/' +
                            d.guild_id +
                            '/' +
                            d.channel_id +
                            '/' +
                            d.message_id
                          }
                          target="_blank"
                          rel="noreferrer"
                        >
                          {t('View in Discord')}
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
