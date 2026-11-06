import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native'
import { useColors, useFont } from './theme'

export interface SnackOptions {
  message: string
  action?: { label: string; run: () => void }
  duration?: number
}
type Snack = SnackOptions & { id: number }

const SnackContext = createContext<{ show: (s: SnackOptions) => void; snack: Snack | null; dismiss: () => void }>({
  show: () => {},
  snack: null,
  dismiss: () => {},
})
export const useSnackbar = () => useContext(SnackContext).show

/** Hält die aktuelle Meldung. Angezeigt wird sie von SnackbarHost. */
export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [snack, setSnack] = useState<Snack | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const show = useCallback((s: SnackOptions) => {
    clearTimeout(timer.current)
    const id = Date.now()
    setSnack({ ...s, id })
    timer.current = setTimeout(() => setSnack((cur) => (cur?.id === id ? null : cur)), s.duration ?? (s.action ? 5000 : 2200))
  }, [])
  const dismiss = useCallback(() => setSnack(null), [])
  useEffect(() => () => clearTimeout(timer.current), [])
  const value = useMemo(() => ({ show, snack, dismiss }), [show, snack, dismiss])
  return <SnackContext.Provider value={value}>{children}</SnackContext.Provider>
}

/** Kurze Meldung am unteren Rand, auf Wunsch mit "Rückgängig". */
export function SnackbarHost({ bottom }: { bottom: number }) {
  const c = useColors()
  const f = useFont()
  const { snack, dismiss } = useContext(SnackContext)
  const anim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!snack) return
    anim.setValue(0)
    Animated.timing(anim, { toValue: 1, duration: 180, useNativeDriver: true }).start()
  }, [snack, anim])

  if (!snack) return null
  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { bottom, opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] },
      ]}
    >
      <View style={[styles.snack, { backgroundColor: c.snackbar }]} accessibilityLiveRegion="polite">
        <Text style={[styles.text, { color: c.snackbarText, fontSize: f(15) }]} numberOfLines={2}>
          {snack.message}
        </Text>
        {snack.action && (
          <Pressable
            hitSlop={8}
            style={styles.action}
            onPress={() => {
              snack.action!.run()
              dismiss()
            }}
          >
            <Text style={[styles.actionText, { color: c.snackbarAction, fontSize: f(15) }]}>{snack.action.label}</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 12, right: 12 },
  snack: { flexDirection: 'row', alignItems: 'center', minHeight: 48, paddingLeft: 16, paddingRight: 8, borderRadius: 12, elevation: 6 },
  text: { flex: 1, fontSize: 15, paddingVertical: 12 },
  action: { paddingHorizontal: 12, paddingVertical: 10 },
  actionText: { fontSize: 15, fontWeight: '600' },
})
