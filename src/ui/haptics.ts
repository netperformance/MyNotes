import * as Haptics from 'expo-haptics'

/**
 * Kurze spürbare Rückmeldung über die Haptik von Android (wie bei der Tastatur).
 * Braucht im Gegensatz zum Vibrationsmotor keine Berechtigung. Ist die Rückmeldung
 * in den Systemeinstellungen aus, passiert nichts.
 */
export function haptic(kind: 'tick' | 'press' | 'success' = 'tick'): void {
  const type =
    kind === 'tick' ? Haptics.AndroidHaptics.Context_Click : kind === 'press' ? Haptics.AndroidHaptics.Long_Press : Haptics.AndroidHaptics.Confirm
  Haptics.performAndroidHapticsAsync(type).catch(() => {})
}
