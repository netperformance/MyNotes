import { forwardRef, useImperativeHandle, useRef } from 'react'
import { findNodeHandle, TextInput, type TextInputInstance, type TextInputProps } from 'react-native'
import { applyKeyboardLanguage } from '../../modules/keyboard-language'
import { LOCALES, useLang } from './i18n'

/**
 * Eingabefeld, das der Tastatur beim Antippen die Sprache der App mitteilt.
 * Steht die App auf Englisch, bekommt die Tastatur den Hinweis "Englisch" (QWERTY,
 * englische Wortvorschläge), sonst "Deutsch". Die Tastatur folgt dem Hinweis, wenn die
 * Sprache in ihr eingerichtet ist.
 */
export const Input = forwardRef<TextInputInstance, TextInputProps>(function Input({ onFocus, ...props }, ref) {
  const inner = useRef<TextInputInstance>(null)
  const lang = useLang()
  useImperativeHandle(ref, () => inner.current as TextInputInstance)
  return (
    <TextInput
      ref={inner}
      {...props}
      onFocus={(e) => {
        let tag: number | null = null
        try {
          tag = findNodeHandle(inner.current) ?? null
        } catch {
          tag = null
        }
        applyKeyboardLanguage(tag ?? (e.nativeEvent as { target?: number }).target ?? null, LOCALES[lang])
        onFocus?.(e)
      }}
    />
  )
})
