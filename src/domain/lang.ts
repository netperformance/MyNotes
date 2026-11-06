/** Sprachen der App. Deutsch für Handys mit deutscher Systemsprache, sonst Englisch. */
export type Lang = 'de' | 'en'

export const LANGS: Lang[] = ['de', 'en']

export const isLang = (value: unknown): value is Lang => value === 'de' || value === 'en'

/**
 * Leitet die Sprache aus der Systemsprache des Handys ab, z. B. "de_DE", "de-AT" oder "en_US".
 * Deutsch für jede deutsche Einstellung, Englisch für alle anderen Sprachen.
 */
export function languageFromLocale(locale: string | undefined | null): Lang {
  return /^de([-_]|$)/i.test((locale ?? '').trim()) ? 'de' : 'en'
}

/** Vergleich für alphabetisches Sortieren in der jeweiligen Sprache. */
export const compareText = (lang: Lang) => (a: string, b: string): number => a.localeCompare(b, lang)
