import type { Lang } from '../domain/lang'
import { LOCALES, type Strings } from './i18n'

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

function shortDate(d: Date, lang: Lang, now: Date): string {
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  if (d.getFullYear() !== now.getFullYear()) options.year = 'numeric'
  return d.toLocaleDateString(LOCALES[lang], options)
}

/** "Geändert heute, 08:14" oder "Geändert 2. Nov., 14:03". */
export function editedLabel(ms: number, lang: Lang, t: Strings, now = new Date()): string {
  const d = new Date(ms)
  const time = d.toLocaleTimeString(LOCALES[lang], { hour: '2-digit', minute: '2-digit' })
  return sameDay(d, now) ? t.editedToday(time) : t.editedOn(`${shortDate(d, lang, now)}, ${time}`)
}

/** "heute" oder "2. Nov." für die Trefferliste der Suche. */
export function dayLabel(ms: number, lang: Lang, t: Strings, now = new Date()): string {
  const d = new Date(ms)
  return sameDay(d, now) ? t.today : shortDate(d, lang, now)
}
