import { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { Field } from './Field';

export function PasswordInput({
  id,
  value,
  onChange,
  newPassword = false,
  error,
  match,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  newPassword?: boolean;
  error?: string | null;
  match?: string;
}) {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Lock
        className="absolute start-3.5 top-[25px] -translate-y-1/2 w-5 h-5 text-gray-500"
        aria-hidden="true"
      />
      <Field
        validate={
          match === undefined
            ? undefined
            : (value) => (value === match ? null : 'Passwords do not match.')
        }
        error={error}
        hint={newPassword ? 'Use at least 8 characters.' : undefined}
      >
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          required
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={newPassword ? 'new-password' : 'current-password'}
          minLength={newPassword ? 8 : undefined}
          className="auth-input auth-password-input"
        />
      </Field>
      <button
        type="button"
        className="icon-button absolute end-1 top-[25px] -translate-y-1/2"
        aria-label={t(visible ? 'Hide password' : 'Show password')}
        aria-pressed={visible}
        onClick={() => setVisible(!visible)}
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}
