import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useCallback, useMemo, useRef, useState } from 'react'
import { Animated, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { COLORS, type Priority } from '../domain/model'
import { previewText } from '../domain/text'
import { haptic } from './haptics'
import { useT } from './i18n'
import { NoteEditor, type EditorTarget } from './NoteEditor'
import { NoteList, type ListNote } from './NoteList'
import { NoteSheet } from './NoteSheet'
import { FONT_STEPS, type Prefs } from './prefs'
import { SearchScreen } from './SearchScreen'
import { SettingsSheet } from './SettingsSheet'
import { SITE_URL } from './site'
import { SnackbarHost, useSnackbar } from './Snackbar'
import { useColors, useFont } from './theme'
import { useNotesStore, useSnapshot } from './useStore'

interface Props {
  prefs: Prefs
  onPref: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void
  keepOnReset: string[]
}

/** Startseite (Screens 1a und 1b). */
export function MainScreen({ prefs, onPref, keepOnReset }: Props) {
  const c = useColors()
  const f = useFont()
  const t = useT()
  const insets = useSafeAreaInsets()
  const store = useNotesStore()
  const snapshot = useSnapshot()
  const snack = useSnackbar()

  const [editor, setEditor] = useState<{ target: EditorTarget; session: number } | null>(null)
  const [arrangeId, setArrangeId] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [scrollEnabled, setScrollEnabled] = useState(true)
  const [titleHeight, setTitleHeight] = useState(60)
  const scrollY = useRef(new Animated.Value(0)).current
  const session = useRef(0)

  const { categories } = snapshot
  const filter = prefs.filter !== 'all' && categories.some((x) => x.id === prefs.filter) ? prefs.filter : 'all'
  const catById = useMemo(() => new Map(categories.map((x) => [x.id, x])), [categories])
  const scope = filter === 'all' ? null : catById.get(filter)!

  const notes: ListNote[] = useMemo(
    () =>
      (prefs.priorities ? snapshot.notes : snapshot.flatNotes)
        .filter((n) => filter === 'all' || n.fields.categoryId === filter)
        .map((n) => {
          const cat = catById.get(n.fields.categoryId) ?? categories[0]
          return {
            id: n.id,
            title: n.fields.title.trim(),
            preview: previewText(n.fields.body),
            priority: n.fields.priority,
            color: cat.color,
            categoryName: filter === 'all' ? cat.name : undefined,
          }
        }),
    [snapshot.notes, snapshot.flatNotes, prefs.priorities, filter, catById, categories],
  )
  const total = snapshot.notes.length
  const title = prefs.homeTitle.trim() || t.defaultTitle

  const openEditor = useCallback((target: EditorTarget) => setEditor({ target, session: ++session.current }), [])
  const open = useCallback((id: string) => openEditor({ kind: 'edit', id }), [openEditor])
  const newNote = () => {
    haptic('tick')
    openEditor({ kind: 'new', categoryId: filter === 'all' ? store.firstCategoryId : filter })
  }

  const remove = useCallback(
    (id: string) => {
      const note = store.getNote(id)
      store.removeNotes([id])
      snack({ message: t.noteDeleted(note?.fields.title.trim() || t.untitled), action: { label: t.undo, run: () => store.restoreNotes([id]) } })
    },
    [store, snack, t],
  )
  const reorder = useCallback(
    (priority: Priority | null, ids: string[]) => (priority ? store.arrangeSection(priority, ids) : store.arrangeFlat(ids)),
    [store],
  )
  const gesture = useCallback((active: boolean) => setScrollEnabled(!active), [])

  const font = (delta: number) => {
    const step = Math.max(0, Math.min(FONT_STEPS.length - 1, prefs.fontStep + delta))
    if (step === prefs.fontStep) return
    haptic('tick')
    onPref('fontStep', step)
    snack({ message: t.fontSize(Math.round(FONT_STEPS[step] * 100)) })
  }

  const arranged = arrangeId ? store.getNote(arrangeId) : undefined
  const topBar = insets.top + 56
  const titleOpacity = scrollY.interpolate({ inputRange: [titleHeight * 0.6, titleHeight], outputRange: [0, 1], extrapolate: 'clamp' })

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <Animated.ScrollView
        style={{ marginTop: topBar }}
        scrollEnabled={scrollEnabled}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
      >
        <View style={styles.titleBlock} onLayout={(e) => setTitleHeight(e.nativeEvent.layout.height)}>
          <Text style={[styles.title, { color: c.text, fontSize: f(34) }]} numberOfLines={2} accessibilityRole="header">
            {title}
          </Text>
          <Text style={[styles.subtitle, { color: c.text2, fontSize: f(15) }]}>
            {scope ? scope.name : t.all} · {t.noteCount(scope ? scope.count : total)}
          </Text>
        </View>

        <View style={styles.addRow}>
          <Pressable
            onPress={() => setSearchOpen(true)}
            style={[styles.search, { backgroundColor: c.card }]}
            android_ripple={{ color: c.ripple }}
            accessibilityRole="search"
            accessibilityLabel={t.search}
          >
            <MaterialIcons name="search" size={20} color={c.text3} />
            <Text style={{ color: c.text3, fontSize: f(16) }}>{t.search}</Text>
          </Pressable>
          <Pressable
            onPress={newNote}
            style={[styles.fab, { backgroundColor: c.accent }]}
            android_ripple={{ color: c.ripple, borderless: true, radius: 26 }}
            accessibilityRole="button"
            accessibilityLabel={t.newNote}
          >
            <MaterialIcons name="add" size={30} color={c.onAccent} />
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityRole="tablist">
          <Chip label={t.all} active={filter === 'all'} onPress={() => onPref('filter', 'all')} />
          {categories.map((cat) => (
            <Chip
              key={cat.id}
              label={cat.name}
              color={COLORS[cat.color]}
              active={filter === cat.id}
              onPress={() => onPref('filter', cat.id)}
              a11y={t.filterNamed(cat.name)}
            />
          ))}
        </ScrollView>

        {total === 0 ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: c.accentSoft }]}>
              <MaterialIcons name="edit-note" size={44} color={c.accent} />
            </View>
            <Text style={[styles.emptyTitle, { color: c.text, fontSize: f(20) }]}>{t.emptyTitle}</Text>
            <Text style={[styles.emptyText, { color: c.text2, fontSize: f(15) }]}>{t.emptyText}</Text>
            <Text style={[styles.signature, { color: c.text3, fontSize: f(14) }]}>
              {t.appBy}{' '}
              <Text style={{ color: c.accent, fontWeight: '500' }} onPress={() => Linking.openURL(SITE_URL).catch(() => {})} accessibilityRole="link">
                aaron.de
              </Text>
            </Text>
          </View>
        ) : notes.length === 0 ? (
          <Text style={[styles.emptyCategory, { color: c.text2, fontSize: f(15) }]}>{t.emptyCategory}</Text>
        ) : (
          <NoteList notes={notes} sections={prefs.priorities} onOpen={open} onArrange={setArrangeId} onDelete={remove} onReorder={reorder} onGesture={gesture} />
        )}
      </Animated.ScrollView>

      <View style={[styles.topBar, { height: topBar, paddingTop: insets.top, backgroundColor: c.bg }]} pointerEvents="box-none">
        <Animated.View style={[styles.topTitleWrap, { opacity: titleOpacity }]} pointerEvents="none">
          <Text style={[styles.topTitle, { color: c.text, fontSize: f(20) }]} numberOfLines={1}>
            {title}
          </Text>
        </Animated.View>
        <IconButton label={t.fontSmaller} disabled={prefs.fontStep === 0} onPress={() => font(-1)}>
          <Text style={[styles.fontIcon, { fontSize: 15, color: prefs.fontStep === 0 ? c.text3 : c.text }]}>A−</Text>
        </IconButton>
        <IconButton label={t.fontLarger} disabled={prefs.fontStep === FONT_STEPS.length - 1} onPress={() => font(1)}>
          <Text style={[styles.fontIcon, { fontSize: 21, color: prefs.fontStep === FONT_STEPS.length - 1 ? c.text3 : c.text }]}>A+</Text>
        </IconButton>
        <IconButton label={t.settings} onPress={() => setSettingsOpen(true)}>
          <MaterialIcons name="more-vert" size={24} color={c.text} />
        </IconButton>
      </View>

      <SnackbarHost bottom={insets.bottom + 16} />

      <NoteSheet
        open={!!arranged && !arranged.fields.deleted}
        title={arranged?.fields.title.trim() ?? ''}
        categoryId={arranged?.fields.categoryId ?? store.firstCategoryId}
        priority={arranged?.fields.priority ?? 'normal'}
        showPriority={prefs.priorities}
        onCategory={(id) => arrangeId && store.setCategory(arrangeId, id, prefs.newOnTop)}
        onPriority={(p) => arrangeId && store.setPriority(arrangeId, p, prefs.newOnTop)}
        onDelete={() => {
          if (arrangeId) remove(arrangeId)
          setArrangeId(null)
        }}
        onClose={() => setArrangeId(null)}
      />
      <SearchScreen open={searchOpen} onClose={() => setSearchOpen(false)} onOpenNote={open} />
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} prefs={prefs} onPref={onPref} keepOnReset={keepOnReset} />
      {editor && <NoteEditor key={editor.session} target={editor.target} newOnTop={prefs.newOnTop} priorities={prefs.priorities} onClose={() => setEditor(null)} />}
    </View>
  )
}

function IconButton({ label, disabled, onPress, children }: { label: string; disabled?: boolean; onPress: () => void; children: React.ReactNode }) {
  const c = useColors()
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={styles.menu}
      android_ripple={{ color: c.ripple, borderless: true, radius: 22 }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
    >
      {children}
    </Pressable>
  )
}

function Chip({ label, color, active, onPress, a11y }: { label: string; color?: string; active: boolean; onPress: () => void; a11y?: string }) {
  const c = useColors()
  const f = useFont()
  return (
    <Pressable
      onPress={() => {
        haptic('tick')
        onPress()
      }}
      style={[styles.chip, { backgroundColor: active ? c.text : c.card }]}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={a11y ?? label}
    >
      {color && <View style={[styles.dot, { backgroundColor: color }]} />}
      <Text style={{ color: active ? c.bg : c.text, fontWeight: '600', fontSize: f(14) }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  topTitleWrap: { flex: 1, marginLeft: 16 },
  topTitle: { fontWeight: '600' },
  menu: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  fontIcon: { fontWeight: '700', letterSpacing: -0.5 },
  titleBlock: { paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { marginTop: 2 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 50, borderRadius: 25, paddingHorizontal: 16, overflow: 'hidden' },
  fab: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', elevation: 2 },
  chips: { gap: 8, paddingHorizontal: 16, paddingBottom: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 38, paddingHorizontal: 14, borderRadius: 19, maxWidth: 220 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  empty: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 24 },
  emptyIcon: { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontWeight: '600', marginBottom: 6 },
  emptyText: { textAlign: 'center' },
  signature: { marginTop: 8 },
  emptyCategory: { textAlign: 'center', marginTop: 40, paddingHorizontal: 24 },
})
