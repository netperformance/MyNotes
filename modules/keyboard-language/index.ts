import { requireOptionalNativeModule } from 'expo'

type KeyboardLanguageModule = { apply(viewTag: number, languageTag: string): Promise<boolean> }

const native = requireOptionalNativeModule<KeyboardLanguageModule>('KeyboardLanguage')

/**
 * Gibt der Tastatur den Hinweis, in welcher Sprache im Feld mit dieser Nummer geschrieben wird.
 * Ohne das native Modul (z. B. in Tests) passiert nichts.
 */
export function applyKeyboardLanguage(viewTag: number | null | undefined, languageTag: string): void {
  if (!native || typeof viewTag !== 'number') return
  native.apply(viewTag, languageTag).catch(() => {})
}
