'use client'

// Gigs always start on a quarter hour, so the time field is a fixed list
// rather than a free-text clock - it removes the "07:03" class of typo and
// makes the picker one tap on mobile.
const OPTIONS: string[] = []
for (let h = 0; h < 24; h++) {
  for (const m of [0, 15, 30, 45]) {
    OPTIONS.push(String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0'))
  }
}

type Props = {
  value: string
  onChange: (value: string) => void
  className?: string
  required?: boolean
  'aria-label'?: string
}

export default function TimeSelect({ value, onChange, className = '', required, ...rest }: Props) {
  // Tolerate values already stored off-grid (e.g. an older 04:33 booking) by
  // showing them rather than silently snapping to something else.
  const offGrid = value && !OPTIONS.includes(value)

  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      required={required}
      className={className}
      {...rest}
    >
      <option value="">--:--</option>
      {offGrid && <option value={value}>{value} (existing)</option>}
      {OPTIONS.map(t => (
        <option key={t} value={t}>{t}</option>
      ))}
    </select>
  )
}
