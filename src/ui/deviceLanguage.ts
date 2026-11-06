import { I18nManager } from 'react-native'
import { languageFromLocale, type Lang } from '../domain/lang'

/**
 * Sprache des Handys: Deutsch bei jeder deutschen Systemsprache, sonst Englisch.
 * Liest die Einstellung von Android über React Native, ohne zusätzliche Bibliothek und ohne Berechtigung.
 */
export function deviceLanguage(): Lang {
  let locale: string | undefined
  try {
    locale = I18nManager.getConstants().localeIdentifier ?? undefined
  } catch {
    /* ohne Angabe von Android: weiter mit Intl */
  }
  if (!locale) {
    try {
      locale = Intl.DateTimeFormat().resolvedOptions().locale
    } catch {
      /* keine Angabe: Englisch */
    }
  }
  return languageFromLocale(locale)
}
