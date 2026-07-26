'use client'
import { THEMES, useTheme } from '@/lib/use-theme'

export default function ThemePicker() {
  const { theme, setTheme } = useTheme()

  return (
    <div>
      <p className="text-muted-foreground text-sm mb-4">
        Choose how the portal looks. Every scheme is checked against WCAG AA contrast, so text stays
        readable whichever you pick.
      </p>

      {/* radiogroup rather than clickable divs so it is keyboard and screen-reader operable */}
      <div className="grid grid-cols-1 gap-3" role="radiogroup" aria-label="Colour scheme">
        {THEMES.map(({ id, label, desc, swatch }) => {
          const active = theme === id
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setTheme(id)}
              className={
                'flex items-center gap-4 p-4 rounded-xl border text-left transition-all w-full ' +
                (active ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50')
              }
            >
              <div className="flex gap-1.5 flex-shrink-0" aria-hidden="true">
                {swatch.map((c, i) => (
                  <div
                    key={i}
                    style={{ background: c }}
                    className="w-5 h-8 rounded border border-border"
                  />
                ))}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-foreground text-sm font-semibold">{label}</div>
                <div className="text-muted-foreground text-xs mt-0.5">{desc}</div>
              </div>
              {/* Not colour alone: a tick plus a text label carries the state (WCAG 1.4.1) */}
              {active && (
                <span className="text-primary text-xs font-bold uppercase tracking-wider flex-shrink-0">
                  ✓ Active
                </span>
              )}
            </button>
          )
        })}
      </div>

      <p className="text-subtle-foreground text-xs mt-4">
        Saved to this browser. Your device&rsquo;s &ldquo;reduce motion&rdquo; setting is respected
        automatically.
      </p>
    </div>
  )
}
