import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, MessageCircle, Send, Users } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from '@/context/RouterContext';
import { useLanguage } from '@/context/LanguageContext';
import { supabase } from '@/lib/supabase';
import type { CommunityMessage } from '@/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState, ErrorState, PageLoader } from '@/components/ui/Feedback';

type ThreadProfile = { id: string; full_name: string; avatar_url: string | null };
type ThreadMeetup = { id: string; title: string; creator_id: string };
type MessageRow = CommunityMessage & {
  sender: ThreadProfile | null;
  recipient: ThreadProfile | null;
  meetup: ThreadMeetup | null;
};

const messageSelect = [
  'id',
  'sender_id',
  'recipient_id',
  'meetup_id',
  'body',
  'created_at',
  'sender:profiles!community_messages_sender_id_fkey(id, full_name, avatar_url)',
  'recipient:profiles!community_messages_recipient_id_fkey(id, full_name, avatar_url)',
  'meetup:casual_meetups!community_messages_meetup_id_fkey(id, title, creator_id)',
].join(',');

export function MessagesPage({ playerId, meetupId }: { playerId?: string; meetupId?: string }) {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const { navigate } = useRouter();
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [people, setPeople] = useState<ThreadProfile[]>([]);
  const [meetup, setMeetup] = useState<ThreadMeetup | null>(null);
  const [canUseMeetupChat, setCanUseMeetupChat] = useState(false);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadThread = useCallback(async () => {
    if (!user) return;
    let query = supabase
      .from('community_messages')
      .select(messageSelect)
      .order('created_at', { ascending: true })
      .limit(200);

    if (meetupId) {
      query = query.eq('meetup_id', meetupId);
    } else if (playerId) {
      const pair = [
        `and(sender_id.eq.${user.id},recipient_id.eq.${playerId})`,
        `and(sender_id.eq.${playerId},recipient_id.eq.${user.id})`,
      ].join(',');
      query = query.or(pair);
    }

    const { data, error: queryError } = await query;
    if (queryError) {
      setError(queryError.message);
      return;
    }
    setMessages((data ?? []) as unknown as MessageRow[]);
    setError(null);
  }, [meetupId, playerId, user]);

  useEffect(() => {
    if (!user) return;
    const authUser = user;
    let active = true;
    async function loadInitialData() {
      setLoading(true);
      setError(null);
      setPeople([]);
      setMeetup(null);
      setMessages([]);
      setCanUseMeetupChat(false);
      let canLoadThread = true;

      if (playerId) {
        const { data: player, error: playerError } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .eq('id', playerId)
          .in('role', ['player', 'organizer'])
          .maybeSingle();
        if (!active) return;
        if (playerError) setError(playerError.message);
        else if (!player || player.id === authUser.id) {
          setError(t('Player not found.'));
          canLoadThread = false;
        } else setPeople([player as ThreadProfile]);
      }

      if (meetupId) {
        const { data: meetupData, error: meetupError } = await supabase
          .from('casual_meetups')
          .select('id, title, creator_id')
          .eq('id', meetupId)
          .maybeSingle();
        if (!active) return;
        if (meetupError) setError(meetupError.message);
        else if (!meetupData) setError(t('Meetup not found.'));
        else {
          setMeetup(meetupData as ThreadMeetup);
          if (meetupData.creator_id === authUser.id) {
            setCanUseMeetupChat(true);
          } else {
            const { data: attendance, error: attendanceError } = await supabase
              .from('meetup_attendees')
              .select('id')
              .eq('meetup_id', meetupId)
              .eq('player_id', authUser.id)
              .eq('status', 'joined')
              .maybeSingle();
            if (!active) return;
            if (attendanceError) setError(attendanceError.message);
            canLoadThread = Boolean(attendance);
            setCanUseMeetupChat(Boolean(attendance));
            if (!attendance && !attendanceError) setError(t('Join this meetup before opening its group chat.'));
          }
        }
      }

      if (!playerId && !meetupId) {
        const { data, error: inboxError } = await supabase
          .from('community_messages')
          .select(messageSelect)
          .is('meetup_id', null)
          .or(`sender_id.eq.${authUser.id},recipient_id.eq.${authUser.id}`)
          .order('created_at', { ascending: false })
          .limit(200);
        if (!active) return;
        if (inboxError) setError(inboxError.message);
        else {
          const latestByPerson = new Map<string, ThreadProfile>();
          for (const row of (data ?? []) as unknown as MessageRow[]) {
            const other = row.sender_id === authUser.id ? row.recipient : row.sender;
            if (other && !latestByPerson.has(other.id)) latestByPerson.set(other.id, other);
          }
          setPeople([...latestByPerson.values()]);
          setMessages((data ?? []) as unknown as MessageRow[]);
        }
      } else if (canLoadThread) {
        await loadThread();
      }
      if (active) setLoading(false);
    }
    void loadInitialData();
    const timer = window.setInterval(() => {
      if (active && (playerId || meetupId)) void loadThread();
    }, 5000);
    const channel = playerId || meetupId
      ? supabase
          .channel(`community-messages-${user.id}-${playerId ?? meetupId}`)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'community_messages' },
            () => {
              if (active) void loadThread();
            }
          )
          .subscribe()
      : null;
    return () => {
      active = false;
      window.clearInterval(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [loadThread, meetupId, playerId, t, user]);

  const heading = useMemo(() => {
    if (meetupId) return meetup?.title ?? t('Meetup chat');
    if (playerId) return people[0]?.full_name ?? t('Direct message');
    return t('Messages');
  }, [meetup, meetupId, people, playerId, t]);

  if (!user) {
    navigate({ name: 'signin' });
    return null;
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !user || sending || (!playerId && !meetupId)) return;
    setSending(true);
    setError(null);
    const { error: insertError } = await supabase.from('community_messages').insert({
      sender_id: user.id,
      recipient_id: playerId ?? null,
      meetup_id: meetupId ?? null,
      body,
    });
    if (insertError) {
      setError(insertError.message);
    } else {
      setDraft('');
      await loadThread();
    }
    setSending(false);
  }

  const locale = language === 'ar' ? 'ar' : language;
  const timeFormat = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' });

  return (
    <div className="min-h-screen pt-24 pb-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center gap-3">
          {(playerId || meetupId) && (
            <button type="button" onClick={() => navigate({ name: 'messages' })} aria-label={t('Back to messages')} className="rounded-lg p-2 text-gray-400 hover:bg-white/5 hover:text-white">
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <div>
            <h1 className="text-3xl font-bold text-white">{heading}</h1>
            <p className="mt-1 text-sm text-gray-500">{meetupId ? t('Meetup group chat') : playerId ? t('Private conversation') : t('Your conversations')}</p>
          </div>
        </div>

        {error && <div className="mb-4"><ErrorState message={error} /></div>}

        {loading ? <PageLoader /> : playerId || meetupId ? playerId && people[0]?.id !== playerId ? (
          <Card className="p-6"><p className="text-center text-sm text-gray-400">{t('Player not found.')}</p></Card>
        ) : meetupId && !canUseMeetupChat ? (
          <Card className="p-6"><p className="text-center text-sm text-gray-400">{t('Join this meetup before opening its group chat.')}</p></Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="flex h-[55vh] min-h-80 flex-col gap-3 overflow-y-auto p-4 sm:p-6" aria-live="polite">
              {messages.length === 0 ? (
                <EmptyState icon={<MessageCircle className="h-10 w-10" />} title={t('No messages yet')} description={t('Send the first message to start the conversation.')} />
              ) : messages.map((message) => {
                const own = message.sender_id === user.id;
                return (
                  <div key={message.id} className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${own ? 'bg-brand-600 text-white' : 'bg-surface-800 text-gray-100'}`}>
                      {meetupId && <p className="mb-1 text-xs font-semibold text-brand-300">{own ? t('You') : message.sender?.full_name}</p>}
                      <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>
                      <p className={`mt-1 text-right text-[10px] ${own ? 'text-brand-100/70' : 'text-gray-500'}`}>{timeFormat.format(new Date(message.created_at))}</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <form onSubmit={sendMessage} className="flex items-end gap-3 border-t border-surface-700 p-4">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                maxLength={2000}
                rows={2}
                placeholder={t('Write a message...')}
                aria-label={t('Write a message...')}
                className="max-h-32 min-h-11 flex-1 resize-y rounded-xl border border-surface-700 bg-surface-800 px-3.5 py-3 text-sm text-white placeholder-gray-500 focus:border-brand-500 focus:outline-none"
              />
              <Button type="submit" disabled={sending || !draft.trim()} aria-label={t('Send message')}>
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">{sending ? t('Sending...') : t('Send')}</span>
              </Button>
            </form>
          </Card>
        ) : people.length === 0 ? (
          <Card className="p-6">
            <EmptyState icon={<MessageCircle className="h-12 w-12" />} title={t('No conversations yet')} description={t('Open the player directory and message someone to start chatting.')} action={<Button onClick={() => navigate({ name: 'players' })}>{t('Browse Players')}</Button>} />
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {people.map((person) => {
              const lastMessage = messages.find((message) =>
                message.sender_id === person.id || message.recipient_id === person.id
              );
              return (
                <button key={person.id} type="button" onClick={() => navigate({ name: 'messages', playerId: person.id })} className="text-left">
                  <Card hover className="flex items-center gap-4 p-4">
                    {person.avatar_url ? (
                      <img src={person.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-500/20 text-lg font-bold text-brand-200">{person.full_name.charAt(0)}</div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-white">{person.full_name}</p>
                      <p className="truncate text-sm text-gray-400">{lastMessage?.body ?? t('No messages yet')}</p>
                    </div>
                    {lastMessage && <span className="text-xs text-gray-500">{timeFormat.format(new Date(lastMessage.created_at))}</span>}
                    <Users className="h-4 w-4 text-gray-500" />
                  </Card>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
