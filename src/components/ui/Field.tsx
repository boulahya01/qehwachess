import {
  cloneElement,
  ReactElement,
  useState,
  FormEvent,
  InputHTMLAttributes,
  useId,
} from 'react';
import { fieldError } from '@/lib/formValidation';
import { useLanguage } from '@/context/LanguageContext';

/** Reuses native constraints; validation appears after interaction, never on mount. */
export function Field({
  children,
  hint,
  error: externalError,
  validate: customValidate,
}: {
  children: ReactElement<InputHTMLAttributes<HTMLInputElement>>;
  hint?: string;
  error?: string | null;
  validate?: (value: string) => string | null;
}) {
  const { t } = useLanguage();
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generatedId = useId();
  const id = children.props.id ?? generatedId;
  const message = externalError || error;
  const describedBy =
    [
      children.props['aria-describedby'],
      hint && !message && `${id}-hint`,
      message && `${id}-error`,
    ]
      .filter(Boolean)
      .join(' ') || undefined;
  function validate(event: FormEvent<HTMLInputElement>) {
    setError(
      fieldError(event.currentTarget.validity, children.props.type) ||
        customValidate?.(event.currentTarget.value) ||
        null
    );
  }
  return (
    <>
      {cloneElement(children, {
        id,
        dir:
          children.props.dir ??
          (['email', 'url', 'tel'].includes(children.props.type ?? '')
            ? 'ltr'
            : undefined),
        'aria-invalid': Boolean(message),
        'aria-describedby': describedBy,
        onBlur: (event) => {
          setTouched(true);
          validate(event);
          children.props.onBlur?.(event);
        },
        onChange: (event) => {
          if (touched) validate(event);
          children.props.onChange?.(event);
        },
        onInvalid: (event) => {
          event.preventDefault();
          setTouched(true);
          validate(event);
          const first =
            event.currentTarget.form?.querySelector<HTMLInputElement>(
              ':invalid'
            );
          let parent = first?.parentElement;
          while (parent) {
            if (parent instanceof HTMLDetailsElement) parent.open = true;
            parent = parent.parentElement;
          }
          first?.focus();
          children.props.onInvalid?.(event);
        },
      })}
      {hint && !message && (
        <p id={`${id}-hint`} className="field-hint">
          {t(hint)}
        </p>
      )}
      {message && (
        <p id={`${id}-error`} className="field-error" role="status">
          {t(message)}
        </p>
      )}
    </>
  );
}
