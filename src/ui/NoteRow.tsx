import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { memo, useRef } from 'react'
import { Animated, PanResponder, Pressable, StyleSheet, Text, View, type GestureResponderHandlers } from 'react-native'
import { COLORS, type ColorKey } from '../domain/model'
import { haptic } from './haptics'
import { useT } from './i18n'
import { useColors, useFont } from './theme'

interface Props {
  id: string
  title: string
  preview: string
  color: ColorKey
  /** Name der Kategorie, nur unter "Alle" gezeigt. */
  categoryName?: string
  first: boolean
  last: boolean
  onOpen: (id: string) => void
  onArrange: (id: string) => void
  onDelete: (id: string) => void
  onSwipeStart: () => void
  onSwipeEnd: () => void
  dragHandlers?: GestureResponderHandlers
}

const DELETE_SHARE = 0.35

/**
 * Eine Notiz in der Liste: Farbstreifen der Kategorie, Titel, zwei Zeilen Vorschau.
 * Tippen öffnet, langes Drücken ordnet ein, nach links wischen löscht, am Griff ziehen verschiebt.
 */
export const NoteRow = memo(function NoteRow(props: Props) {
  const { id, title, preview, color, categoryName, first, last, onOpen, onArrange, dragHandlers } = props
  const c = useColors()
  const t = useT()
  const f = useFont()
  const x = useRef(new Animated.Value(0)).current
  const width = useRef(360)
  const latest = useRef(props)
  latest.current = props

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => g.dx < -10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderGrant: () => latest.current.onSwipeStart(),
      onPanResponderMove: (_e, g) => x.setValue(Math.min(0, g.dx)),
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_e, g) => {
        latest.current.onSwipeEnd()
        if (-g.dx > width.current * DELETE_SHARE || g.vx < -1.2) {
          haptic('press')
          Animated.timing(x, { toValue: -width.current, duration: 160, useNativeDriver: true }).start(() => {
            latest.current.onDelete(latest.current.id)
            x.setValue(0)
          })
        } else {
          Animated.spring(x, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 260 }).start()
        }
      },
      onPanResponderTerminate: () => {
        latest.current.onSwipeEnd()
        Animated.spring(x, { toValue: 0, useNativeDriver: true }).start()
      },
    }),
  ).current

  const name = title || t.untitled
  const corners = { borderTopLeftRadius: first ? 16 : 0, borderTopRightRadius: first ? 16 : 0, borderBottomLeftRadius: last ? 16 : 0, borderBottomRightRadius: last ? 16 : 0 }

  return (
    <View style={[styles.wrap, corners]} onLayout={(e) => (width.current = e.nativeEvent.layout.width)}>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.delete,
          { backgroundColor: c.danger, opacity: x.interpolate({ inputRange: [-2, 0], outputRange: [1, 0], extrapolate: 'clamp' }) },
        ]}
      >
        <MaterialIcons name="delete-outline" size={22} color="#fff" />
        <Text style={[styles.deleteText, { fontSize: f(15) }]}>{t.delete}</Text>
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX: x }], backgroundColor: c.card }} {...pan.panHandlers}>
        <Pressable
          onPress={() => onOpen(id)}
          onLongPress={() => {
            haptic('press')
            onArrange(id)
          }}
          delayLongPress={380}
          android_ripple={{ color: c.ripple }}
          style={styles.row}
          accessibilityRole="button"
          accessibilityLabel={[name, categoryName, preview].filter(Boolean).join(', ')}
          accessibilityHint={t.noteHint}
        >
          <View style={[styles.stripe, { backgroundColor: COLORS[color] }]} />
          <View style={styles.main}>
            <Text style={[styles.title, { color: title ? c.text : c.text3, fontSize: f(16) }]} numberOfLines={2}>
              {name}
            </Text>
            {!!preview && (
              <Text style={[styles.preview, { color: c.text2, fontSize: f(14) }]} numberOfLines={2}>
                {preview}
              </Text>
            )}
            {!!categoryName && (
              <Text style={[styles.category, { color: COLORS[color], fontSize: f(12) }]} numberOfLines={1}>
                {categoryName}
              </Text>
            )}
          </View>
          {dragHandlers && (
            <View {...dragHandlers} style={styles.grip} accessibilityLabel={t.moveNamed(name)}>
              <MaterialIcons name="drag-handle" size={24} color={c.text3} />
            </View>
          )}
        </Pressable>
      </Animated.View>
      {!last && <View style={[styles.sep, { backgroundColor: c.sep }]} />}
    </View>
  )
})

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
  delete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 22, gap: 6 },
  deleteText: { color: '#fff', fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'stretch', minHeight: 60 },
  stripe: { width: 4 },
  main: { flex: 1, minWidth: 0, paddingLeft: 14, paddingRight: 4, paddingVertical: 11 },
  title: { fontWeight: '600' },
  preview: { marginTop: 2, lineHeight: undefined },
  category: { fontWeight: '600', marginTop: 4 },
  grip: { width: 48, alignItems: 'center', justifyContent: 'center' },
  sep: { position: 'absolute', left: 18, right: 0, bottom: 0, height: StyleSheet.hairlineWidth },
})
