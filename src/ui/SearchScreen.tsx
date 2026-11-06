import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useMemo, useState } from 'react'
import { FlatList, KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { COLORS } from '../domain/model'
import { findMatches, snippet, type Range } from '../domain/text'
import { dayLabel } from './format'
import { useLang, useT } from './i18n'
import { Input } from './Input'
import { useColors, useFont } from './theme'
import { SnackbarHost } from './Snackbar'
import { useNotesStore, useSnapshot } from './useStore'

interface Props {
  open: boolean
  onClose: () => void
  onOpenNote: (id: string) => void
}

/** Volltextsuche über Titel und Text aller Notizen (Screen 5). */
export function SearchScreen({ open, onClose, onOpenNote }: Props) {
  const c = useColors()
  const t = useT()
  const f = useFont()
  const lang = useLang()
  const insets = useSafeAreaInsets()
  const store = useNotesStore()
  const { notes, categories } = useSnapshot()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<string>('all')

  const results = useMemo(() => {
    if (!query.trim()) return []
    return notes
      .map((n) => {
        const text = store.textOf(n)
        const inTitle = findMatches(n.fields.title, query)
        const body = snippet(text, query)
        return inTitle.length || body.ranges.length ? { note: n, inTitle, body } : null
      })
      .filter((r): r is NonNullable<typeof r> => !!r)
      .sort((a, b) => b.note.fields.editedAt - a.note.fields.editedAt)
  }, [notes, query, store])

  const counts = new Map<string, number>()
  for (const r of results) counts.set(r.note.fields.categoryId, (counts.get(r.note.fields.categoryId) ?? 0) + 1)
  // Hat die gewählte Kategorie nach einer neuen Eingabe keine Treffer mehr, gilt wieder "Alle".
  const active = filter !== 'all' && !counts.has(filter) ? 'all' : filter
  const shown = active === 'all' ? results : results.filter((r) => r.note.fields.categoryId === active)
  const catById = new Map(categories.map((x) => [x.id, x]))
  const mark = c.dark ? 'rgba(255,214,10,0.35)' : '#ffe58a'

  const close = () => {
    setQuery('')
    setFilter('all')
    onClose()
  }

  const highlight = (text: string, ranges: Range[], color: string) => {
    if (ranges.length === 0) return text
    const parts: React.ReactNode[] = []
    let at = 0
    ranges.forEach(([s, e], i) => {
      if (s > at) parts.push(text.slice(at, s))
      parts.push(
        <Text key={i} style={{ backgroundColor: mark, color }}>
          {text.slice(s, e)}
        </Text>,
      )
      at = e
    })
    if (at < text.length) parts.push(text.slice(at))
    return parts
  }

  if (!open) return null

  return (
    <Modal visible animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={close}>
      <KeyboardAvoidingView behavior="padding" style={[styles.fill, { backgroundColor: c.bg, paddingTop: insets.top + 8 }]}>
        <View style={styles.bar}>
          <Pressable onPress={close} style={styles.back} android_ripple={{ color: c.ripple, borderless: true, radius: 22 }} accessibilityRole="button" accessibilityLabel={t.back}>
            <MaterialIcons name="arrow-back" size={24} color={c.text} />
          </Pressable>
          <View style={[styles.field, { backgroundColor: c.card, borderColor: c.accent }]}>
            <MaterialIcons name="search" size={20} color={c.text3} />
            <Input
              value={query}
              onChangeText={setQuery}
              placeholder={t.searchPlaceholder}
              placeholderTextColor={c.text3}
              cursorColor={c.accent}
              style={[styles.input, { color: c.text, fontSize: f(16) }]}
              autoFocus
              autoCorrect={false}
              returnKeyType="search"
            />
            {!!query && (
              <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel={t.clearSearch}>
                <MaterialIcons name="close" size={20} color={c.text3} />
              </Pressable>
            )}
          </View>
        </View>

        {results.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled" style={styles.chipRow}>
            <Chip label={`${t.all} · ${results.length}`} active={active === 'all'} onPress={() => setFilter('all')} />
            {categories
              .filter((x) => counts.has(x.id))
              .map((x) => (
                <Chip key={x.id} label={`${x.name} · ${counts.get(x.id)}`} color={COLORS[x.color]} active={active === x.id} onPress={() => setFilter(x.id)} />
              ))}
          </ScrollView>
        )}

        <FlatList
          data={shown}
          keyExtractor={(r) => r.note.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
          ListEmptyComponent={
            query.trim() ? <Text style={[styles.empty, { color: c.text2, fontSize: f(15) }]}>{t.noResults}</Text> : undefined
          }
          renderItem={({ item, index }) => {
            const cat = catById.get(item.note.fields.categoryId) ?? categories[0]
            const first = index === 0
            const last = index === shown.length - 1
            return (
              <Pressable
                onPress={() => onOpenNote(item.note.id)}
                android_ripple={{ color: c.ripple }}
                style={[
                  styles.row,
                  { backgroundColor: c.card },
                  first && styles.firstRow,
                  last && styles.lastRow,
                  !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.sep },
                ]}
                accessibilityRole="button"
              >
                <View style={[styles.stripe, { backgroundColor: COLORS[cat.color] }]} />
                <View style={styles.main}>
                  <Text style={[styles.title, { color: c.text, fontSize: f(16) }]} numberOfLines={2}>
                    {highlight(item.note.fields.title || t.untitled, item.inTitle, c.text)}
                  </Text>
                  {!!item.body.text && (
                    <Text style={[styles.preview, { color: c.text2, fontSize: f(14) }]} numberOfLines={3}>
                      {highlight(item.body.text, item.body.ranges, c.text)}
                    </Text>
                  )}
                  <Text style={[styles.meta, { color: c.text3, fontSize: f(12) }]}>
                    {cat.name} · {dayLabel(item.note.fields.editedAt, lang, t)}
                  </Text>
                </View>
              </Pressable>
            )
          }}
        />
        {/* Meldungen mit "Rückgängig" auch über der Suche zeigen, sonst lägen sie dahinter */}
        <SnackbarHost bottom={insets.bottom + 16} />
      </KeyboardAvoidingView>
    </Modal>
  )
}

function Chip({ label, color, active, onPress }: { label: string; color?: string; active: boolean; onPress: () => void }) {
  const c = useColors()
  const f = useFont()
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { backgroundColor: active ? c.text : c.card }]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      {color && <View style={[styles.dot, { backgroundColor: color }]} />}
      <Text style={{ color: active ? c.bg : c.text, fontWeight: '600', fontSize: f(14) }}>{label}</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingLeft: 4, paddingRight: 16, paddingBottom: 10 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  field: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 46, borderRadius: 23, paddingHorizontal: 14, borderWidth: 1.5 },
  input: { flex: 1, paddingVertical: 8 },
  chipRow: { flexGrow: 0 },
  chips: { gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 36, paddingHorizontal: 14, borderRadius: 18 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  row: { flexDirection: 'row', alignItems: 'stretch', overflow: 'hidden' },
  firstRow: { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  lastRow: { borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
  stripe: { width: 4 },
  main: { flex: 1, paddingHorizontal: 14, paddingVertical: 11 },
  title: { fontWeight: '600' },
  preview: { marginTop: 2 },
  meta: { marginTop: 4 },
  empty: { textAlign: 'center', marginTop: 40 },
})
