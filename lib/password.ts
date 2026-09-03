/**
 * Password policy: 8+ characters, one capital, one number, one special.
 *
 * Every form that sets a password checks through here, and so does the
 * registration API - a client-side check alone is decoration, since the
 * endpoint can be called directly.
 *
 * Note the limit of this: supabase.auth.updateUser() talks to Supabase from
 * the browser, so our check guards our own UI but cannot stop a crafted call.
 * The matching policy in the Supabase dashboard (Auth → Providers → Email →
 * minimum length + required characters) is what makes it unbypassable.
 */

export type Rule = { key: string; label: string; test: (pw: string) => boolean }

export const PASSWORD_RULES: Rule[] = [
  { key: 'length', label: 'At least 8 characters', test: pw => pw.length >= 8 },
  { key: 'upper', label: 'One capital letter', test: pw => /[A-Z]/.test(pw) },
  { key: 'number', label: 'One number', test: pw => /[0-9]/.test(pw) },
  {
    key: 'special',
    label: 'One special character',
    // Anything that is not a letter, digit or whitespace. Broad on purpose:
    // rejecting a character someone's password manager generated is worse
    // than accepting an unusual one.
    test: pw => /[^A-Za-z0-9\s]/.test(pw),
  },
]

export function passwordFailures(pw: string) {
  return PASSWORD_RULES.filter(r => !r.test(pw))
}

export function isStrongPassword(pw: string) {
  return passwordFailures(pw).length === 0
}

/** One sentence naming what is still missing, for a form error. */
export function passwordError(pw: string): string | null {
  const missing = passwordFailures(pw)
  if (missing.length === 0) return null
  const parts = missing.map(m => m.label.toLowerCase())
  const list =
    parts.length === 1
      ? parts[0]
      : parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1]
  return 'Password needs ' + list + '.'
}
