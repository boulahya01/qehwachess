import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { afterEach, expect, it, vi } from 'vitest';
import { Field } from '@/components/ui/Field';
vi.mock('@/context/LanguageContext', () => ({
  useLanguage: () => ({ t: (value: string) => value }),
}));
let renderer: ReactTestRenderer;
afterEach(() => {
  act(() => renderer?.unmount());
});
function event(valid: boolean, value = '') {
  return {
    currentTarget: { value, validity: { valid, typeMismatch: !valid } },
    target: { value },
  };
}
it('waits for blur, then clears the field error during correction', () => {
  act(() => {
    renderer = create(
      <Field hint="Use your email">
        <input id="email" type="email" />
      </Field>
    );
  });
  act(() =>
    renderer.root.findByType('input').props.onChange(event(false, 'unfinished'))
  );
  expect(renderer.root.findByType('input').props['aria-invalid']).toBe(false);
  act(() =>
    renderer.root.findByType('input').props.onBlur(event(false, 'unfinished'))
  );
  expect(renderer.root.findByType('input').props['aria-invalid']).toBe(true);
  expect(renderer.root.findByType('input').props['aria-describedby']).toContain(
    'email-error'
  );
  act(() =>
    renderer.root
      .findByType('input')
      .props.onChange(event(true, 'player@example.com'))
  );
  expect(renderer.root.findByType('input').props['aria-invalid']).toBe(false);
  expect(renderer.root.findByType('input').props['aria-describedby']).toBe(
    'email-hint'
  );
});
it('validates password confirmation after interaction without exposing secret values', () => {
  act(() => {
    renderer = create(
      <Field
        validate={(value) =>
          value === 'same-passphrase' ? null : 'Passwords do not match.'
        }
      >
        <input id="confirm" type="password" />
      </Field>
    );
  });
  expect(JSON.stringify(renderer.toJSON())).not.toContain(
    'Passwords do not match.'
  );
  act(() =>
    renderer.root
      .findByType('input')
      .props.onBlur(event(true, 'other-passphrase'))
  );
  expect(JSON.stringify(renderer.toJSON())).toContain(
    'Passwords do not match.'
  );
  act(() =>
    renderer.root
      .findByType('input')
      .props.onChange(event(true, 'same-passphrase'))
  );
  expect(JSON.stringify(renderer.toJSON())).not.toContain(
    'Passwords do not match.'
  );
});
