import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import Constants from 'expo-constants'
import * as DocumentPicker from 'expo-document-picker'
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { useEffect, useRef, useState } from 'react'
import { Alert, Animated, Linking, PanResponder, Pressable, StyleSheet, Switch, Text, View } from 'react-native'
import { LANGS, type Lang } from '../domain/lang'
import { COLORS } from '../domain/model'
import { BackupError, type CategoryInfo } from '../store/store'
import { CategoryEditor } from './CategoryEditor'
import { haptic } from './haptics'
import { Input } from './Input'
import type { Prefs } from './prefs'
import { REPO_URL, SITE_URL } from './site'
import { Sheet } from './Sheet'
import { useSnackbar } from './Snackbar'
import { useT } from './i18n'
import { useColors, useFont } from './theme'
import { useNotesStore, useSnapshot } from './useStore'

interface Props {
  open: boolean
  onClose: () => void
  prefs: Prefs
  onPref: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void
  /** Einstellungen, die "Alle Daten löschen" stehen lässt. */
  keepOnReset: string[]
}

type View_ = { kind: 'main' } | { kind: 'category'; id: string | null }

/** Einstellungen (Screen 6) mit Unterseite für eine Kategorie (Screens 4 und 4b). */
export function SettingsSheet({ open, onClose, prefs, onPref, keepOnReset }: Props) {
  const c = useColors()
  const f = useFont()
  const store = useNotesStore()
  const snapshot = useSnapshot()
  const snack = useSnackbar()
  const t = useT()
  const [dragging, setDragging] = useState(false)
  const [view, setView] = useState<View_>({ kind: 'main' })
  const [title, setTitle] = useState(prefs.homeTitle)
  const commitEditor = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!open) setView({ kind: 'main' })
    else setTitle(prefs.homeTitle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const saveTitle = () => {
    const clean = title.trim()
    if (clean !== prefs.homeTitle) onPref('homeTitle', clean)
  }

  /** Verlässt eine Unterseite. Änderungen an einer Kategorie werden dabei übernommen. */
  const back = () => {
    commitEditor.current?.()
    commitEditor.current = null
    setView({ kind: 'main' })
  }
  const close = () => {
    commitEditor.current?.()
    commitEditor.current = null
    saveTitle()
    onClose()
  }

  const exportBackup = async () => {
    try {
      const name = `${t.backupFileName}-${new Date().toISOString().slice(0, 10)}.json`
      const file = new File(Paths.cache, name)
      file.create({ overwrite: true })
      await file.write(JSON.stringify(store.exportBackup(), null, 1))
      if (!(await Sharing.isAvailableAsync())) throw new Error(t.shareUnavailable)
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: t.saveBackup })
    } catch (error) {
      snack({ message: t.backupFailed((error as Error).message) })
    }
  }

  const importBackup = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true })
      if (result.canceled || !result.assets[0]) return
      const text = await new File(result.assets[0].uri).text()
      const count = store.importBackup(JSON.parse(text))
      haptic('success')
      snack({ message: t.backupImported(count) })
    } catch (error) {
      const message =
        error instanceof SyntaxError
          ? t.invalidBackup
          : error instanceof BackupError
            ? error.code === 'damaged'
              ? t.damagedBackup
              : t.notABackup
            : (error as Error).message
      snack({ message })
    }
  }

  const confirmReset = () =>
    Alert.alert(t.resetTitle, t.resetText, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.deleteForever,
        style: 'destructive',
        onPress: async () => {
          await store.reset({ keepMeta: keepOnReset })
          onClose()
          snack({ message: t.allDataDeleted })
        },
      },
    ])

  if (view.kind === 'category') {
    return (
      <Sheet open={open} title={view.id ? t.editCategory : t.newCategory} onClose={close} onBack={back}>
        <BackLink onPress={back} />
        <CategoryEditor key={view.id ?? 'neu'} id={view.id} commitRef={commitEditor} onDone={() => setView({ kind: 'main' })} />
      </Sheet>
    )
  }

  const label = [styles.label, { color: c.text2, fontSize: f(12) }]
  const segmented = <T extends string | boolean>(options: readonly (readonly [T, string])[], value: T, onChange: (v: T) => void) => (
    <View style={[styles.segmented, { backgroundColor: c.card }]} accessibilityRole="radiogroup">
      {options.map(([v, text]) => {
        const active = value === v
        return (
          <Pressable
            key={String(v)}
            onPress={() => onChange(v)}
            style={[styles.segment, active && { backgroundColor: c.accent }]}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
          >
            <Text style={{ color: active ? c.onAccent : c.text2, fontWeight: '600', fontSize: f(15) }} numberOfLines={1}>
              {text}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )

  return (
    <Sheet open={open} title={t.settings} onClose={close} scrollEnabled={!dragging}>
      <Text style={label}>{t.language}</Text>
      {segmented(
        LANGS.map((l) => [l, LANGUAGE_NAMES[l]] as const),
        prefs.language,
        (v) => onPref('language', v),
      )}

      <Text style={label}>{t.appearance}</Text>
      {segmented(
        [
          ['system', t.themeSystem],
          ['light', t.themeLight],
          ['dark', t.themeDark],
        ] as const,
        prefs.theme,
        (v) => onPref('theme', v),
      )}

      <Text style={label}>{t.newEntries}</Text>
      {segmented(
        [
          [true, t.top],
          [false, t.bottom],
        ] as const,
        prefs.newOnTop,
        (v) => onPref('newOnTop', v),
      )}

      <Text style={label}>{t.prioritiesLabel}</Text>
      <Pressable
        style={[styles.card, styles.row, { backgroundColor: c.card }]}
        onPress={() => onPref('priorities', !prefs.priorities)}
        android_ripple={{ color: c.ripple }}
        accessibilityRole="switch"
        accessibilityState={{ checked: prefs.priorities }}
      >
        <MaterialIcons name="flag" size={22} color={c.accent} />
        <Text style={{ flex: 1, fontSize: f(16), color: c.text }}>{t.usePriorities}</Text>
        <Switch
          value={prefs.priorities}
          onValueChange={(v) => onPref('priorities', v)}
          trackColor={{ false: c.sep, true: c.accentSoft }}
          thumbColor={prefs.priorities ? c.accent : c.text3}
        />
      </Pressable>

      <Text style={label}>{t.homeTitle}</Text>
      <View style={[styles.field, { backgroundColor: c.card }]}>
        <Input
          style={[styles.input, { color: c.text, fontSize: f(16) }]}
          value={title}
          onChangeText={setTitle}
          onEndEditing={saveTitle}
          onSubmitEditing={saveTitle}
          placeholder={t.defaultTitle}
          placeholderTextColor={c.text3}
          cursorColor={c.accent}
          autoCapitalize="sentences"
          returnKeyType="done"
          maxLength={40}
          accessibilityLabel={t.homeTitle}
        />
        <MaterialIcons name="edit" size={18} color={c.text3} />
      </View>

      <Text style={label}>{t.categories}</Text>
      <CategoryOrder
        categories={snapshot.categories}
        onChange={(o) => store.setCategoryOrder(o)}
        onDragChange={setDragging}
        onEdit={(id) => setView({ kind: 'category', id })}
      />
      <View style={[styles.card, { backgroundColor: c.card, marginTop: 8 }]}>
        <Row icon="add" label={t.newCategory} onPress={() => setView({ kind: 'category', id: null })} last />
      </View>

      <Text style={label}>{t.data}</Text>
      <View style={[styles.card, { backgroundColor: c.card }]}>
        <Row icon="ios-share" label={t.saveBackup} onPress={exportBackup} />
        <Row icon="file-download" label={t.importBackup} onPress={importBackup} />
        <Row icon="delete-forever" label={t.deleteAllData} danger onPress={confirmReset} last />
      </View>

      <Text style={[styles.about, { color: c.text2, fontSize: f(13) }]}>
        {t.appName} {Constants.expoConfig?.version ?? ''} · {t.about}
      </Text>
      <Text style={[styles.about, styles.signature, { color: c.text2, fontSize: f(13) }]}>
        {t.madeBy}{' '}
        <Text style={{ color: c.accent, fontWeight: '500' }} onPress={() => Linking.openURL(SITE_URL).catch(() => {})} accessibilityRole="link">
          aaron.de
        </Text>
      </Text>
      <Text
        style={[styles.about, styles.openSource, { color: c.accent, fontSize: f(13) }]}
        onPress={() => Linking.openURL(REPO_URL).catch(() => {})}
        accessibilityRole="link"
      >
        {t.openSource}
      </Text>
    </Sheet>
  )
}

function BackLink({ onPress }: { onPress: () => void }) {
  const c = useColors()
  const f = useFont()
  const t = useT()
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.back} accessibilityRole="button" accessibilityLabel={t.backToSettings}>
      <MaterialIcons name="chevron-left" size={24} color={c.accent} />
      <Text style={{ color: c.accent, fontSize: f(16), fontWeight: '600' }}>{t.settings}</Text>
    </Pressable>
  )
}

function Row({
  icon,
  label,
  detail,
  danger,
  disabled,
  last,
  chevron,
  onPress,
}: {
  icon: keyof typeof MaterialIcons.glyphMap
  label: string
  detail?: string
  chevron?: boolean
  danger?: boolean
  disabled?: boolean
  last?: boolean
  onPress: () => void
}) {
  const c = useColors()
  const f = useFont()
  const color = danger ? c.danger : c.accent
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      android_ripple={{ color: c.ripple }}
      style={[styles.row, { opacity: disabled ? 0.4 : 1 }, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.sep }]}
      accessibilityRole="button"
    >
      <MaterialIcons name={icon} size={22} color={color} />
      <Text style={{ flex: 1, fontSize: f(16), color: danger ? c.danger : c.text }}>{label}</Text>
      {detail !== undefined && <Text style={{ color: c.text2, fontSize: f(15) }}>{detail}</Text>}
      {chevron && <MaterialIcons name="chevron-right" size={22} color={c.text3} style={{ marginRight: -6 }} />}
    </Pressable>
  )
}

/** Jede Sprache steht in ihrer eigenen Sprache, damit man sie auch findet, wenn man die andere nicht liest. */
const LANGUAGE_NAMES: Record<Lang, string> = { de: 'Deutsch', en: 'English' }

const ROW_H = 52

/** Kategorien per Ziehen am Griff umsortieren, antippen zum Bearbeiten. */
function CategoryOrder({
  categories,
  onChange,
  onDragChange,
  onEdit,
}: {
  categories: CategoryInfo[]
  onChange: (order: string[]) => void
  onDragChange: (dragging: boolean) => void
  onEdit: (id: string) => void
}) {
  const c = useColors()
  const f = useFont()
  const t = useT()
  const order = categories.map((x) => x.id)
  const byId = new Map(categories.map((x) => [x.id, x]))
  const [local, setLocal] = useState(order)
  const [dragId, setDragId] = useState<string | null>(null)
  const offset = useRef(new Animated.Value(0)).current
  const state = useRef({ local: order, dragId: null as string | null, startIndex: 0, index: 0 })
  state.current.local = local
  const callbacks = useRef({ onChange, onDragChange })
  callbacks.current = { onChange, onDragChange }

  const key = order.join('|')
  useEffect(() => {
    if (!state.current.dragId) setLocal(order)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const responders = useRef(new Map<string, ReturnType<typeof PanResponder.create>>()).current
  const responderFor = (id: string) => {
    let r = responders.get(id)
    if (r) return r
    r = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        const index = state.current.local.indexOf(id)
        state.current = { ...state.current, dragId: id, startIndex: index, index }
        offset.setValue(0)
        setDragId(id)
        callbacks.current.onDragChange(true)
        haptic('press')
      },
      onPanResponderMove: (_e, g) => {
        const s = state.current
        const target = Math.max(0, Math.min(s.local.length - 1, s.startIndex + Math.round(g.dy / ROW_H)))
        if (target !== s.index) {
          const next = s.local.filter((x) => x !== id)
          next.splice(target, 0, id)
          s.index = target
          s.local = next
          setLocal(next)
          haptic('tick')
        }
        offset.setValue(g.dy - (s.index - s.startIndex) * ROW_H)
      },
      onPanResponderRelease: () => finish(),
      onPanResponderTerminate: () => finish(),
    })
    responders.set(id, r)
    return r
  }

  const finish = () => {
    const s = state.current
    s.dragId = null
    offset.setValue(0)
    setDragId(null)
    callbacks.current.onDragChange(false)
    callbacks.current.onChange(s.local)
  }

  return (
    <View style={[styles.card, { backgroundColor: c.card, overflow: 'visible' }]}>
      {local.filter((id) => byId.has(id)).map((id, i, all) => {
        const cat = byId.get(id)!
        const lifted = dragId === id
        return (
          <Animated.View
            key={id}
            style={[
              styles.orderRow,
              { backgroundColor: c.card },
              i < all.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.sep },
              lifted && { zIndex: 2, elevation: 8, borderRadius: 12, transform: [{ translateY: offset }, { scale: 1.02 }] },
              i === 0 && { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
              i === all.length - 1 && { borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
            ]}
          >
            <Pressable
              style={styles.orderLabel}
              onPress={() => onEdit(id)}
              android_ripple={{ color: c.ripple }}
              accessibilityRole="button"
              accessibilityLabel={t.editNamed(cat.name)}
            >
              <View style={[styles.catDot, { backgroundColor: COLORS[cat.color] }]} />
              <Text style={{ flex: 1, fontSize: f(16), color: c.text }} numberOfLines={1}>
                {cat.name}
              </Text>
            </Pressable>
            <View {...responderFor(id).panHandlers} style={styles.grip} accessibilityLabel={t.moveNamed(cat.name)}>
              <MaterialIcons name="drag-handle" size={24} color={c.text3} />
            </View>
          </Animated.View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  label: { fontWeight: '700', letterSpacing: 0.6, marginTop: 18, marginBottom: 8, marginLeft: 4 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, borderRadius: 12, paddingHorizontal: 16 },
  input: { flex: 1, paddingVertical: 10 },
  segmented: { flexDirection: 'row', padding: 3, borderRadius: 12, gap: 3 },
  segment: { flex: 1, minHeight: 38, paddingHorizontal: 4, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  card: { borderRadius: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 54, paddingHorizontal: 16 },
  orderRow: { flexDirection: 'row', alignItems: 'center', height: ROW_H },
  orderLabel: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, height: ROW_H, paddingLeft: 16 },
  back: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginLeft: -6, marginTop: 2 },
  catDot: { width: 14, height: 14, borderRadius: 7 },
  grip: { width: 56, height: ROW_H, alignItems: 'center', justifyContent: 'center' },
  footRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  foot: { fontSize: 13, marginTop: 8, marginLeft: 4, lineHeight: 18 },
  about: { textAlign: 'center', fontSize: 13, marginTop: 28, lineHeight: 19 },
  signature: { marginTop: 14 },
  openSource: { marginTop: 6, fontWeight: '500' },
})
