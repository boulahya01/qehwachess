import { supabase } from '@/lib/supabase';
export type DiscordTarget = {
  scope: 'club' | 'official';
  club_id: string | null;
};
export type DiscordConnection = {
  id: string;
  guild_id: string;
  guild_name: string;
  channel_id: string | null;
  channel_name: string | null;
  connected_by: string;
  enabled: boolean;
  silent: boolean;
  locale: string;
  health: string;
};
export type DiscordDelivery = {
  id: string;
  kind: string;
  status: string;
  attempts: number;
  message_id: string | null;
  error_code: string | null;
  created_at: string;
  guild_id: string;
  channel_id: string;
};
export type DiscordStatus = {
  connection: DiscordConnection | null;
  deliveries: DiscordDelivery[];
  configured: boolean;
  worker_ready: boolean;
  install_url: string | null;
};
const messages: Record<string, string> = {
  tenant_denied: 'You do not have permission to manage this connection.',
  signin_required: 'Your session expired. Please sign in again.',
  expired_flow: 'This connection link expired. Connect Discord again.',
  oauth_cancelled: 'Discord connection was cancelled. You can try again.',
  server_denied: 'You need Manage Server permission in Discord.',
  missing_permissions:
    'The bot needs View Channel, Send Messages and Embed Links in this channel.',
  bot_or_channel_missing:
    'The bot or channel is unavailable. Check the installation and try again.',
  not_configured: 'Discord integration is awaiting backend setup.',
  worker_not_ready: 'Automatic announcements are awaiting delivery setup.',
  not_connected: 'Connect a Discord server first.',
  reconnect_required:
    'Reconnect with your Discord account to manage this server.',
  choose_channel: 'Choose and save an announcement channel first.',
  discord_rate_limited: 'Discord is busy. Please wait before trying again.',
  too_many_requests: 'Please wait 30 seconds before trying again.',
  delivery_uncertain:
    'Delivery could not be confirmed. Check Discord before posting again.',
  no_longer_eligible: 'Skipped because the event or connection changed.',
  retry_not_allowed:
    'This announcement can no longer be retried. Refresh its status.',
};
export const discordError = (code: string) =>
  messages[code] ||
  'Discord could not be reached. Your settings have been preserved.';
export async function discordRequest<T>(
  target: DiscordTarget,
  action: string,
  values: Record<string, unknown> = {}
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(
    'discord-integrations',
    { body: { ...values, ...target, action } }
  );
  if (error) {
    let code = 'service_unavailable';
    if ('context' in error && error.context instanceof Response) {
      const detail = await error.context.json().catch(() => null);
      code = typeof detail?.error === 'string' ? detail.error : code;
    }
    throw new Error(discordError(code));
  }
  if (data?.error) throw new Error(discordError(data.error));
  return data as T;
}
