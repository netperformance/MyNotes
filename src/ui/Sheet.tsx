import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Animated, Dimensions, KeyboardAvoidingView, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SnackbarHost } from './Snackbar'
import { useT } from './i18n'
import { useColors, useFont } from './theme'
import { useKeyboardHeight } from './useKeyboard'

/**
 * Blatt von unten. Schließt über "Fertig", Tippen daneben, Herunterziehen am Griff
 * und die Zurück-Taste von Android. Ist `onBack` gesetzt, führt die Zurück-Taste
 * stattdessen dorthin (eine Ebene zurück innerhalb des Blatts).
 */
export function Sheet({
  open,
  title,
  onClose,
  onBack,
  scrollEnabled = true,
  children,
}: {
  open: boolean
  title: string
  onClose: () => void
  onBack?: () => void
  scrollEnabled?: boolean
  children: ReactNode
}) {
  const c = useColors()
  const t = useT()
  const f = useFont()
  const insets = useSafeAreaInsets()
  const keyboard = useKeyboardHeight()
  const [visible, setVisible] = useState(open)
  const height = Dimensions.get('window').height
  const y = useRef(new Animated.Value(height)).current
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (open) {
      setVisible(true)
      y.setValue(height)
      Animated.spring(y, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220, mass: 0.9 }).start()
    } else if (visible) {
      Animated.timing(y, { toValue: height, duration: 200, useNativeDriver: true }).start(({ finished }) => finished && setVisible(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => g.dy > 4,
      onPanResponderMove: (_e, g) => y.setValue(Math.max(0, g.dy)),
      onPanResponderRelease: (_e, g) => {
        if (g.dy > 100 || g.vy > 1.2) onCloseRef.current()
        else Animated.spring(y, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 220 }).start()
      },
    }),
  ).current

  if (!visible) return null

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onBack ?? onClose}>
      <KeyboardAvoidingView behavior="padding" style={styles.fill}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.backdrop }]} onPress={onClose} accessibilityLabel={t.close} />
      <Animated.View
        style={[
          styles.sheet,
          {
            backgroundColor: c.bg,
            marginTop: insets.top + 24,
            flexShrink: 1,
            transform: [{ translateY: y }],
          },
        ]}
      >
        <View {...pan.panHandlers}>
          <View style={styles.grip}>
            <View style={[styles.gripBar, { backgroundColor: c.text3 }]} />
          </View>
          <View style={styles.head}>
            <View style={styles.side} />
            <Text style={[styles.title, { color: c.text, fontSize: f(18) }]} numberOfLines={1} accessibilityRole="header">
              {title}
            </Text>
            <Pressable style={[styles.side, styles.done]} onPress={onClose} hitSlop={8}>
              <Text style={[styles.doneText, { color: c.accent, fontSize: f(16) }]}>{t.done}</Text>
            </Pressable>
          </View>
        </View>
        <ScrollView
          style={styles.scroll}
          scrollEnabled={scrollEnabled}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 24 + (keyboard ? 0 : insets.bottom) }}
        >
          {children}
        </ScrollView>
      </Animated.View>
      {/* Meldungen mit "Rückgängig" auch über dem Blatt zeigen, sonst lägen sie dahinter */}
      <SnackbarHost bottom={keyboard ? 8 : insets.bottom + 16} />
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    elevation: 12,
  },
  scroll: { flexShrink: 1 },
  grip: { alignItems: 'center', paddingTop: 10, paddingBottom: 4 },
  gripBar: { width: 36, height: 4, borderRadius: 2, opacity: 0.6 },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 8 },
  side: { flex: 1 },
  title: { fontSize: 18, fontWeight: '600', flexShrink: 1, maxWidth: '64%', textAlign: 'center' },
  done: { alignItems: 'flex-end' },
  doneText: { fontSize: 16, fontWeight: '600', paddingHorizontal: 10, paddingVertical: 8 },
})
