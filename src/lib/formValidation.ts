export function fieldError(
  validity: ValidityState,
  type = 'email'
): string | null {
  if (validity.valueMissing) return 'Please fill in this field.';
  if (validity.typeMismatch)
    return type === 'email'
      ? 'Enter a valid email address.'
      : 'Check the format of this field.';
  if (validity.tooShort) return 'Use at least 8 characters.';
  if (validity.patternMismatch) return 'Check the format of this field.';
  if (
    validity.rangeUnderflow ||
    validity.rangeOverflow ||
    validity.stepMismatch
  )
    return 'Choose a value within the allowed range.';
  return validity.valid ? null : 'Check this field before continuing.';
}
