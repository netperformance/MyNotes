import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useEffect, useState, type RefObject } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { COLOR_KEYS, COLORS, type ColorKey } from '../domain/model'
import { haptic } from './haptics'
import { Input } from './Input'
import { useSnackbar } from './Snackbar'
import { useT } from './i18n'
import { useColors, useFont } from './theme'
import { useNotesStore, useSnapshot } from './useStore'

interface Props {
  /** ID der Kategorie, die bearbeitet wird. null: neue Kategorie anlegen. */
  id: string | null
  /** Hier hinterlegt der Editor, wie seine Änderungen übernommen werden (beim Verlassen). */
  commitRef: RefObject<(() => void) | null>
  /** Zurück zur Übersicht. */
  onDone: () => void
}

/**
 * Kategorie anlegen oder bearbeiten: Name, Farbe, Vorschau, Löschen (Screens 4 und 4b).
 * Änderungen an einer vorhandenen Kategorie werden beim Verlassen übernommen.
 */
export function CategoryEditor({ id, commitRef, onDone }: Props) {
  const c = useColors()
  const f = useFont()
  const store = useNotesStore()
  const snapshot = useSnapshot()
  const snack = useSnackbar()
  const t = useT()
  const current = id ? snapshot.categories.find((x) => x.id === id) : undefined

  const [name, setName] = useState(current?.name ?? '')
  const [color, setColor] = useState<ColorKey>(current?.color ?? unusedColor(snapshot.categories.map((x) => x.color)))
  const duplicate = name.trim() ? store.findCategoryByName(name, id ?? undefined) : undefined

  /** Übernimmt Änderungen an einer vorhandenen Kategorie. Eine neue entsteht nur über den Knopf "Kategorie anlegen". */
  const commit = () => {
    if (!id) return
    if (duplicate) {
      // Der Name ist vergeben: die Farbe trotzdem übernehmen, den Namen nicht.
      store.updateCategory(id, { color })
      snack({ message: t.exists(duplicate.name) })
      return
    }
    store.updateCategory(id, { name: name.trim() || current?.name, color })
  }
  const create = () => {
    const clean = name.trim()
    if (!clean || duplicate) return
    store.createCategory(clean, color)
    haptic('success')
    snack({ message: t.categoryCreated(clean) })
  }

  useEffect(() => {
    commitRef.current = commit
    return () => {
      commitRef.current = null
    }
  })

  const confirmDelete = () => {
    if (!id || !current) return
    const count = current.count
    Alert.alert(t.deleteCategoryTitle(current.name), t.deleteCategoryText(count), [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: () => {
          const ids = store.deleteCategory(id)
          if (!ids) return
          haptic('press')
          snack({ message: t.categoryDeleted(current.name, ids.length), action: { label: t.undo, run: () => store.restoreCategory(id, ids) } })
          commitRef.current = null
          onDone()
        },
      },
    ])
  }

  const label = [styles.label, { color: c.text2, fontSize: f(12) }]
  const canCreate = !!name.trim() && !duplicate

  return (
    <>
      <Text style={label}>{t.name}</Text>
      <View style={[styles.field, { backgroundColor: c.card }]}>
        <View style={[styles.dot, { backgroundColor: COLORS[color] }]} />
        <Input
          style={[styles.input, { color: c.text, fontSize: f(17) }]}
          value={name}
          onChangeText={setName}
          placeholder={t.categoryPlaceholder}
          placeholderTextColor={c.text3}
          cursorColor={c.accent}
          autoFocus={!id}
          autoCapitalize="sentences"
          autoCorrect={false}
          returnKeyType="done"
        />
      </View>
      {duplicate && <Text style={[styles.foot, { color: c.danger, fontSize: f(13) }]}>{t.existsHint(duplicate.name)}</Text>}

      <Text style={label}>{t.color}</Text>
      <View style={[styles.colors, { backgroundColor: c.card }]} accessibilityRole="radiogroup">
        {COLOR_KEYS.map((key) => {
          const active = key === color
          return (
            <Pressable
              key={key}
              onPress={() => {
                setColor(key)
                haptic('tick')
              }}
              style={styles.cell}
              accessibilityRole="radio"
              accessibilityLabel={t.colors[key]}
              accessibilityState={{ checked: active }}
            >
              <View style={[styles.ring, active && { borderColor: COLORS[key] }]}>
                <View style={[styles.swatch, { backgroundColor: COLORS[key] }]}>
                  {active && <MaterialIcons name="check" size={20} color="#fff" />}
                </View>
              </View>
            </Pressable>
          )
        })}
      </View>

      {/* Vorschau nur beim Bearbeiten, beim Anlegen nicht */}
      {id && (
        <>
      <Text style={label}>{t.preview}</Text>
      <View style={[styles.preview, { backgroundColor: c.card }]}>
        <View style={[styles.stripe, { backgroundColor: COLORS[color] }]} />
        <View style={styles.previewMain}>
          <Text style={{ color: c.text, fontWeight: '600', fontSize: f(16) }} numberOfLines={1}>
            {t.previewTitle}
          </Text>
          <Text style={{ color: c.text2, fontSize: f(14), marginTop: 2 }} numberOfLines={1}>
            {t.previewText}
          </Text>
          <Text style={{ color: COLORS[color], fontWeight: '600', fontSize: f(12), marginTop: 4 }} numberOfLines={1}>
            {name.trim() || t.categoryPlaceholder}
          </Text>
        </View>
      </View>
        </>
      )}

      {!id && (
        <Pressable
          style={[styles.button, { backgroundColor: canCreate ? c.accent : c.card }]}
          android_ripple={{ color: c.ripple }}
          disabled={!canCreate}
          onPress={() => {
            create()
            commitRef.current = null
            onDone()
          }}
          accessibilityRole="button"
        >
          <Text style={{ color: canCreate ? c.onAccent : c.text3, fontSize: f(16), fontWeight: '600' }}>{t.createCategory}</Text>
        </Pressable>
      )}

      {id && (
        <Pressable style={[styles.delete, { backgroundColor: c.card }]} android_ripple={{ color: c.ripple }} onPress={confirmDelete} accessibilityRole="button">
          <MaterialIcons name="delete-outline" size={22} color={c.danger} />
          <Text style={{ color: c.danger, fontSize: f(16), fontWeight: '500' }}>{t.deleteCategory}</Text>
        </Pressable>
      )}
    </>
  )
}

/** Für eine neue Kategorie die erste Farbe, die noch keine andere Kategorie hat. */
function unusedColor(used: ColorKey[]): ColorKey {
  const order: ColorKey[] = ['blue', 'green', 'violet', 'orange', 'teal', 'pink', 'red', 'amber', 'indigo', 'lime', 'brown', 'gray']
  return order.find((k) => !used.includes(k)) ?? 'blue'
}

const styles = StyleSheet.create({
  label: { fontWeight: '700', letterSpacing: 0.6, marginTop: 18, marginBottom: 8, marginLeft: 4 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 50, borderRadius: 12, paddingHorizontal: 16 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  input: { flex: 1, paddingVertical: 10 },
  colors: { flexDirection: 'row', flexWrap: 'wrap', padding: 8, borderRadius: 16 },
  cell: { width: '16.66%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  ring: { width: 46, height: 46, borderRadius: 23, borderWidth: 2.5, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  preview: { flexDirection: 'row', borderRadius: 16, overflow: 'hidden' },
  stripe: { width: 4 },
  previewMain: { flex: 1, paddingHorizontal: 14, paddingVertical: 11 },
  button: { minHeight: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 24, overflow: 'hidden' },
  delete: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 16, borderRadius: 12, marginTop: 24, overflow: 'hidden' },
  foot: { marginTop: 8, marginLeft: 4, lineHeight: 18 },
})
