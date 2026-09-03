'use client'
import { PASSWORD_RULES } from '@/lib/password'

/**
 * Live checklist under a password field.
 *
 * Ticks are not carried by colour alone - the symbol changes too - so the
 * state is still readable without colour perception (WCAG 1.4.1).
 */
export default function PasswordRequirements({ value }: { value: string }) {
  return (
    <ul className="mt-2 space-y-1" aria-live="polite">
      {PASSWORD_RULES.map(r => {
        const met = r.test(value)
        return (
          <li
            key={r.key}
            className={'flex items-center gap-2 text-xs ' + (met ? 'text-success' : 'text-subtle-foreground')}
          >
            <span aria-hidden="true" className="w-3 flex-shrink-0">{met ? '✓' : '○'}</span>
            <span>{r.label}</span>
            <span className="sr-only">{met ? '— met' : '— not met yet'}</span>
          </li>
        )
      })}
    </ul>
  )
}
