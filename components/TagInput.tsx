'use client'
import { useEffect, useRef, useState } from 'react'

type Props = {
  value: string[]
  onChange: (tags: string[]) => void
  /** Previously-used tags, offered as you type. */
  suggestions?: string[]
  placeholder?: string
  id?: string
}

/**
 * SoundCloud-style tag entry: type a tag, commit it with Enter/Tab/comma, and
 * it becomes a removable chip. Backspace on an empty box deletes the last one.
 * Free-text by design - the agency should be able to coin a genre on the spot
 * rather than pick from a fixed list.
 */
export default function TagInput({ value, onChange, suggestions = [], placeholder, id }: Props) {
  const [draft, setDraft] = useState('')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)

  const trimmed = draft.trim()
  const matches = trimmed
    ? suggestions
        .filter(s => s.toLowerCase().includes(trimmed.toLowerCase()))
        .filter(s => !value.some(v => v.toLowerCase() === s.toLowerCase()))
        .slice(0, 6)
    : []

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  function addTag(raw: string) {
    const tag = raw.trim().replace(/^#/, '')
    if (!tag) return
    // case-insensitive dedupe, keeping whatever casing was typed first
    if (!value.some(v => v.toLowerCase() === tag.toLowerCase())) {
      onChange([...value, tag])
    }
    setDraft('')
    setOpen(false)
    setHighlight(0)
  }

  function removeTag(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === 'Tab' || e.key === ',') {
      if (!trimmed) return
      // Enter/Tab would otherwise submit the form or move focus
      e.preventDefault()
      addTag(matches.length && open ? matches[highlight] : draft)
      return
    }
    if (e.key === 'Backspace' && !draft && value.length) {
      removeTag(value.length - 1)
      return
    }
    if (e.key === 'ArrowDown' && matches.length) {
      e.preventDefault()
      setOpen(true)
      setHighlight(h => (h + 1) % matches.length)
      return
    }
    if (e.key === 'ArrowUp' && matches.length) {
      e.preventDefault()
      setHighlight(h => (h - 1 + matches.length) % matches.length)
      return
    }
    if (e.key === 'Escape') setOpen(false)
  }

  return (
    <div ref={wrapRef} className="relative">
      <div
        onClick={() => wrapRef.current?.querySelector('input')?.focus()}
        className="w-full bg-secondary border border-border rounded-lg px-2 py-1.5 flex flex-wrap gap-1.5 items-center cursor-text focus-within:border-primary transition-colors min-h-[42px]"
      >
        {value.map((tag, i) => (
          <span
            key={tag + i}
            className="inline-flex items-center gap-1.5 bg-primary/15 text-primary text-xs font-medium pl-2.5 pr-1.5 py-1 rounded"
          >
            {tag}
            <button
              type="button"
              aria-label={'Remove ' + tag}
              onClick={e => { e.stopPropagation(); removeTag(i) }}
              className="text-primary/70 hover:text-primary leading-none text-sm"
            >
              &times;
            </button>
          </span>
        ))}
        <input
          id={id}
          type="text"
          value={draft}
          onChange={e => { setDraft(e.target.value); setOpen(true); setHighlight(0) }}
          onKeyDown={onKeyDown}
          onBlur={() => { if (trimmed) addTag(draft) }}
          placeholder={value.length === 0 ? (placeholder || 'Add a genre and press Enter') : ''}
          className="flex-1 min-w-[120px] bg-transparent border-none outline-none text-foreground text-sm px-1.5 py-1 placeholder:text-muted-foreground/60"
        />
      </div>

      {open && matches.length > 0 && (
        <div className="absolute z-20 mt-1 w-full bg-card border border-border rounded-lg overflow-hidden shadow-lg">
          {matches.map((s, i) => (
            <button
              key={s}
              type="button"
              onMouseEnter={() => setHighlight(i)}
              onClick={() => addTag(s)}
              className={
                'w-full text-left px-3 py-2 text-sm transition-colors ' +
                (i === highlight ? 'bg-secondary text-foreground' : 'text-muted-foreground/80 hover:bg-secondary')
              }
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
