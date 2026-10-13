import { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';

export function PasswordInput({
  id,
  value,
  onChange,
  newPassword = false,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  newPassword?: boolean;
}) {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Lock
        className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500"
        aria-hidden="true"
      />
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={newPassword ? 'new-password' : 'current-password'}
        minLength={newPassword ? 6 : undefined}
        className="w-full ps-11 pe-14 py-3 bg-surface-800 border border-surface-700 rounded-xl text-white"
        placeholder={newPassword ? t('At least 6 characters') : undefined}
      />
      <button
        type="button"
        className="icon-button absolute end-1 top-1/2 -translate-y-1/2"
        aria-label={t(visible ? 'Hide password' : 'Show password')}
        aria-pressed={visible}
        onClick={() => setVisible(!visible)}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
