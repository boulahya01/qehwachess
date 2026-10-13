import { useState, useEffect } from 'react';
import { Link, useRouter } from '@/context/RouterContext';
import { useAuth } from '@/context/AuthContext';
import { useCities } from '@/hooks/useData';
import { supabase } from '@/lib/supabase';
import { authError } from '@/lib/authFlow';
import { AuthMessage } from '@/components/auth/AuthParts';
import { Button } from '@/components/ui/Button';

import { PageLoader } from '@/components/ui/Feedback';
import { ArrowRight, Save, ImageUp, ChevronDown } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export function ProfilePage() {
  const { t } = useLanguage();
  const { user, profile, refreshProfile } = useAuth();
  const { navigate } = useRouter();
  const { cities } = useCities();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [cityId, setCityId] = useState(profile?.city_id ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [lichessUsername, setLichessUsername] = useState(
    profile?.lichess_username ?? ''
  );
  const [chesscomUsername, setChesscomUsername] = useState(
    profile?.chesscom_username ?? ''
  );
  const [fideId, setFideId] = useState(profile?.fide_id ?? '');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? '');
      setPhone(profile.phone ?? '');
      setBio(profile.bio ?? '');
      setCityId(profile.city_id ?? '');
      setUsername(profile.username ?? '');
      setLichessUsername(profile.lichess_username ?? '');
      setChesscomUsername(profile.chesscom_username ?? '');
      setFideId(profile.fide_id ?? '');
    }
  }, [profile]);

  useEffect(() => {
    if (!user) navigate({ name: 'signin' });
  }, [user, navigate]);
  if (!user) return null;

  if (!profile)
    return (
      <div className="pt-24">
        <PageLoader />
      </div>
    );

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const { error: saveError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim() || 'Chess player',
          phone: phone.trim() || null,
          bio: bio.trim() || null,
          city_id: cityId || null,
          username: username.trim().replace(/^@/, '') || null,
          lichess_username: lichessUsername.trim().replace(/^@/, '') || null,
          chesscom_username: chesscomUsername.trim().replace(/^@/, '') || null,
          fide_id: fideId.trim() || null,
        })
        .eq('id', user!.id);
      if (saveError) setError(saveError.message);
      else {
        await refreshProfile();
        setSuccess(true);
      }
    } catch (caught) {
      setError(authError(caught));
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const extensions: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
    };
    if (!extensions[file.type] || file.size > 5 * 1024 * 1024) {
      setError(
        t('Choose a JPEG, PNG, WebP, or GIF image no larger than 5 MB.')
      );
      return;
    }

    setUploadingAvatar(true);
    setError(null);
    setSuccess(false);
    try {
      const path = `${user!.id}/avatar.${extensions[file.type]}`;
      const { error: uploadError } = await supabase.storage
        .from('profile-avatars')
        .upload(path, file, {
          cacheControl: '3600',
          contentType: file.type,
          upsert: true,
        });
      if (uploadError) {
        setError(uploadError.message);
        return;
      }
      const { data } = supabase.storage
        .from('profile-avatars')
        .getPublicUrl(path);
      const avatarUrl = `${data.publicUrl}?v=${Date.now()}`;
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', user!.id);
      if (updateError) setError(updateError.message);
      else {
        await refreshProfile();
        setSuccess(true);
      }
    } catch (caught) {
      setError(authError(caught));
    } finally {
      setUploadingAvatar(false);
    }
  }

  const dirty =
    fullName !== (profile.full_name ?? '') ||
    phone !== (profile.phone ?? '') ||
    bio !== (profile.bio ?? '') ||
    cityId !== (profile.city_id ?? '') ||
    username !== (profile.username ?? '') ||
    lichessUsername !== (profile.lichess_username ?? '') ||
    chesscomUsername !== (profile.chesscom_username ?? '') ||
    fideId !== (profile.fide_id ?? '');
  return (
    <div className="v2-container account-profile">
      <header className="security-heading">
        <p className="auth-eyebrow">{t('Account settings')}</p>
        <h1>{t('Make it yours.')}</h1>
        <p>{t('Every detail here is optional. Add what helps you connect.')}</p>
        <Link to={{ name: 'security' }} className="text-link">
          {t('Sign-in & security')}
          <ArrowRight size={16} className="direction-arrow" />
        </Link>
      </header>
      <section className="profile-photo-row">
        {profile.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt=""
            width={72}
            height={72}
            className="profile-avatar"
          />
        ) : (
          <span className="profile-avatar" aria-hidden="true">
            {profile.full_name?.charAt(0) ?? 'Q'}
          </span>
        )}
        <div>
          <h2>{t('Profile photo')}</h2>
          <p>{t('Choose a photo that helps people recognize you.')}</p>
          <label className="text-link profile-upload">
            <ImageUp size={16} />
            {t(uploadingAvatar ? 'Uploading...' : 'Upload photo')}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              aria-label={t('Upload profile photo')}
              disabled={uploadingAvatar}
              onChange={handleAvatarUpload}
            />
          </label>
          <p className="auth-field-hint">
            {t('JPEG, PNG, WebP or GIF - up to 5 MB')}
          </p>
        </div>
      </section>
      <AuthMessage message={error} />
      <AuthMessage
        success
        message={success && !dirty ? 'Profile updated successfully!' : null}
      />
      <form className="profile-form" onSubmit={handleSave} aria-busy={saving}>
        <section aria-labelledby="public-profile-heading">
          <h2 id="public-profile-heading">{t('Your public profile')}</h2>
          <p className="profile-section-description">
            {t('These details help other players find and recognize you.')}
          </p>
          <div className="profile-fields">
            <div className="auth-field">
              <label htmlFor="profile-name">{t('Display name')}</label>
              <input
                id="profile-name"
                className="auth-input"
                maxLength={100}
                autoComplete="nickname"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div className="auth-field">
              <label htmlFor="profile-username">{t('Player username')}</label>
              <input
                id="profile-username"
                className="auth-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={24}
                pattern="[a-zA-Z0-9_]{3,24}"
                aria-describedby="username-hint"
                autoCapitalize="none"
                spellCheck={false}
              />
              <p id="username-hint" className="auth-field-hint">
                {t('3–24 letters, numbers, or underscores')}
              </p>
            </div>
            <div className="auth-field profile-field-wide">
              <label htmlFor="profile-city">{t('City')}</label>
              <select
                id="profile-city"
                className="auth-input"
                value={cityId}
                onChange={(e) => setCityId(e.target.value)}
              >
                <option value="">{t('Select city')}</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="auth-field profile-field-wide">
              <label htmlFor="profile-bio">{t('Bio')}</label>
              <textarea
                id="profile-bio"
                className="auth-input"
                rows={3}
                maxLength={1000}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder={t('Tell the community about yourself...')}
              />
            </div>
          </div>
        </section>
        <details className="profile-disclosure">
          <summary>
            <span>
              {t('Chess profiles')}
              <small>{t('Optional - add whenever you want')}</small>
            </span>
            <ChevronDown size={20} />
          </summary>
          <p className="profile-section-description">
            {t(
              'These usernames are profile links only; ratings are not verified or synchronized.'
            )}
          </p>
          <div className="profile-fields">
            <div className="auth-field">
              <label htmlFor="profile-lichess">Lichess</label>
              <input
                id="profile-lichess"
                className="auth-input"
                maxLength={50}
                value={lichessUsername}
                onChange={(e) => setLichessUsername(e.target.value)}
                autoCapitalize="none"
                spellCheck={false}
              />
            </div>
            <div className="auth-field">
              <label htmlFor="profile-chesscom">Chess.com</label>
              <input
                id="profile-chesscom"
                className="auth-input"
                maxLength={50}
                value={chesscomUsername}
                onChange={(e) => setChesscomUsername(e.target.value)}
                autoCapitalize="none"
                spellCheck={false}
              />
            </div>
            <div className="auth-field">
              <label htmlFor="profile-fide">{t('FIDE ID')}</label>
              <input
                id="profile-fide"
                className="auth-input"
                maxLength={20}
                value={fideId}
                onChange={(e) => setFideId(e.target.value)}
              />
            </div>
          </div>
        </details>
        <details className="profile-disclosure">
          <summary>
            <span>
              {t('Public contact number')}
              <small>{t('Optional - visible to other users')}</small>
            </span>
            <ChevronDown size={20} />
          </summary>
          <div className="auth-field">
            <label htmlFor="profile-phone">{t('Phone')}</label>
            <input
              id="profile-phone"
              className="auth-input"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+212 ..."
            />
          </div>
        </details>
        <div className="profile-save-bar">
          <p role="status">
            {t(
              dirty
                ? 'You have unsaved changes.'
                : success
                  ? 'All changes saved.'
                  : 'Add only what you want to share.'
            )}
          </p>
          <Button type="submit" disabled={saving || uploadingAvatar || !dirty}>
            <Save size={17} />
            {t(saving ? 'Saving...' : 'Save Changes')}
          </Button>
        </div>
      </form>
    </div>
  );
}
