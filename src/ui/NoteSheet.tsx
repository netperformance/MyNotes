import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { COLORS, PRIORITY_CHOICES, type Priority } from '../domain/model'
import { haptic } from './haptics'
import { Sheet } from './Sheet'
import { useT } from './i18n'
import { useColors, useFont } from './theme'
import { useSnapshot } from './useStore'

interface Props {
  open: boolean
  /** Titel der Notiz für die Kopfzeile. */
  title: string
  categoryId: string
  priority: Priority
  /** Auswahl der Priorität zeigen (aus, wenn die Prioritäten ausgeschaltet sind). */
  showPriority: boolean
  onCategory: (id: string) => void
  onPriority: (priority: Priority) => void
  onDelete: () => void
  onClose: () => void
}

/**
 * Notiz einordnen: Kategorie, Priorität, Löschen. Öffnet sich aus der Liste (langes Drücken)
 * und aus dem Editor (Tipp auf Kategorie oder Priorität), auch bei einer neuen Notiz.
 * Änderungen gelten sofort.
 */
export function NoteSheet({ open, title, categoryId, priority, showPriority, onCategory, onPriority, onDelete, onClose }: Props) {
  const c = useColors()
  const t = useT()
  const f = useFont()
  const { categories } = useSnapshot()
  const label = [styles.label, { color: c.text2, fontSize: f(12) }]

  return (
    <Sheet open={open} title={title || t.untitled} onClose={onClose}>
      <Text style={label}>{t.category}</Text>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {categories.map((cat) => {
          const active = cat.id === categoryId
          return (
            <Pressable
              key={cat.id}
              onPress={() => {
                haptic('tick')
                onCategory(cat.id)
              }}
              style={[styles.chip, { backgroundColor: active ? c.text : c.card }]}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={cat.name}
            >
              <View style={[styles.dot, { backgroundColor: COLORS[cat.color] }]} />
              <Text style={{ color: active ? c.bg : c.text, fontWeight: '600', fontSize: f(14) }} numberOfLines={1}>
                {cat.name}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {showPriority && <Text style={label}>{t.priorityLabel}</Text>}
      {showPriority && (
      <View style={[styles.segmented, { backgroundColor: c.card }]} accessibilityRole="radiogroup">
        {PRIORITY_CHOICES.map((p) => {
          const active = p === priority
          return (
            <Pressable
              key={p}
              onPress={() => {
                haptic('tick')
                onPriority(p)
              }}
              style={[styles.segment, active && { backgroundColor: c.accent }]}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
            >
              <Text style={{ color: active ? c.onAccent : c.text2, fontWeight: '600', fontSize: f(15) }}>{t.priority[p]}</Text>
            </Pressable>
          )
        })}
      </View>
      )}

      <Pressable
        style={[styles.delete, { backgroundColor: c.card }]}
        android_ripple={{ color: c.ripple }}
        onPress={() => {
          haptic('press')
          onDelete()
        }}
        accessibilityRole="button"
      >
        <MaterialIcons name="delete-outline" size={22} color={c.danger} />
        <Text style={{ color: c.danger, fontSize: f(16), fontWeight: '500' }}>{t.deleteNote}</Text>
      </Pressable>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  label: { fontWeight: '700', letterSpacing: 0.6, marginTop: 14, marginBottom: 8, marginLeft: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 40, paddingHorizontal: 14, borderRadius: 20, maxWidth: '100%' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  segmented: { flexDirection: 'row', padding: 3, borderRadius: 12, gap: 3 },
  segment: { flex: 1, minHeight: 40, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  delete: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 16, borderRadius: 12, marginTop: 24, overflow: 'hidden' },
})
