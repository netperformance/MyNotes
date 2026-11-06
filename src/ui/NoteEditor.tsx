import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AppState, Keyboard, KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, View, type TextInputInstance } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { WebView as RNWebView, type WebViewMessageEvent, type WebViewProps } from 'react-native-webview'
import { COLORS, type Priority } from '../domain/model'
import { commandScript, editorHtml, themeScript, type EditorCommand, type EditorMessage, type EditorTheme } from './editorHtml'
import { editedLabel } from './format'
import { haptic } from './haptics'
import { LOCALES, useLang, useT } from './i18n'
import { Input } from './Input'
import { NoteSheet } from './NoteSheet'
import { useSnackbar } from './Snackbar'
import { useColors, useFont } from './theme'
import { useKeyboardHeight } from './useKeyboard'
import { useNotesStore, useSnapshot } from './useStore'

/** Was die App von der Webansicht braucht. Die Typen der Bibliothek kennen den ref nicht. */
type WebViewHandle = { injectJavaScript(script: string): void; requestFocus(): void }
const WebView = RNWebView as unknown as React.ComponentType<WebViewProps & { ref?: React.Ref<WebViewHandle> }>

export type EditorTarget = { kind: 'new'; categoryId: string } | { kind: 'edit'; id: string }

interface Props {
  target: EditorTarget
  /** Neue Notizen und umsortierte Notizen oben in ihren Abschnitt. */
  newOnTop: boolean
  /** Prioritäten verwenden. Aus: keine Auswahl im Editor, neue Notizen bekommen Normal. */
  priorities: boolean
  onClose: () => void
}

const SAVE_DELAY = 400

/**
 * Notiz schreiben (Screens 2a bis 2c). Speichert von selbst, eine neue Notiz entsteht mit dem
 * ersten Zeichen. Bleiben Titel und Text leer, wird nichts gespeichert.
 */
export function NoteEditor({ target, newOnTop, priorities, onClose }: Props) {
  const c = useColors()
  const t = useT()
  const f = useFont()
  const lang = useLang()
  const insets = useSafeAreaInsets()
  const keyboard = useKeyboardHeight()
  const store = useNotesStore()
  const snapshot = useSnapshot()
  const snack = useSnackbar()

  // Stand beim Öffnen, einmal festgehalten (für Titel in Meldungen und die Anfangswerte).
  const initial = useRef(target.kind === 'edit' ? store.getNote(target.id) : undefined).current
  const idRef = useRef<string | null>(initial?.id ?? null)
  const titleRef = useRef(initial?.fields.title ?? '')
  const bodyRef = useRef(initial?.fields.body ?? '')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const [title, setTitle] = useState(titleRef.current)
  const [categoryId, setCategoryId] = useState(initial?.fields.categoryId ?? (target.kind === 'new' ? target.categoryId : store.firstCategoryId))
  const [priority, setPriority] = useState<Priority>(initial?.fields.priority ?? 'normal')
  const [bodyFocused, setBodyFocused] = useState(false)
  const [format, setFormat] = useState({ bold: false, red: false, list: false })
  const [sheetOpen, setSheetOpen] = useState(false)
  const lastFocus = useRef<'title' | 'body' | null>(null)
  const meta = useRef({ categoryId, priority })
  meta.current = { categoryId, priority }

  const titleInput = useRef<TextInputInstance>(null)
  const web = useRef<WebViewHandle>(null)

  // Die Kategorie kann inzwischen gelöscht sein: dann die erste nehmen.
  const category = snapshot.categories.find((x) => x.id === categoryId) ?? snapshot.categories[0]
  const live = idRef.current ? store.getNote(idRef.current) : undefined

  const isEmpty = () => !titleRef.current.trim() && !bodyRef.current

  /** Speichert sofort. Legt die Notiz an, sobald es etwas zu speichern gibt. */
  const flush = () => {
    clearTimeout(timer.current)
    if (idRef.current) {
      // Ganz geleert: den letzten Stand mit Inhalt behalten, damit "Rückgängig" ihn zurückholt.
      if (isEmpty()) return
      store.updateNote(idRef.current, { title: titleRef.current, body: bodyRef.current })
    } else if (!isEmpty()) {
      idRef.current = store.createNote(
        { categoryId: meta.current.categoryId, priority: meta.current.priority, title: titleRef.current, body: bodyRef.current },
        newOnTop,
      )
    }
  }
  const schedule = () => {
    if (!idRef.current) return flush()
    clearTimeout(timer.current)
    timer.current = setTimeout(flush, SAVE_DELAY)
  }

  // Neue Notiz: gleich im Titel schreiben. Erst nach dem Einblenden, sonst öffnet Android die Tastatur nicht.
  useEffect(() => {
    if (target.kind !== 'new') return
    const timer = setTimeout(() => titleInput.current?.focus(), 350)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Beim Wechsel in den Hintergrund sofort speichern, Android kann die App danach beenden.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => state !== 'active' && flush())
    return () => {
      sub.remove()
      clearTimeout(timer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const close = () => {
    flush()
    const id = idRef.current
    if (id && isEmpty()) {
      // Eine vorhandene Notiz wurde ganz geleert: löschen, aber mit "Rückgängig".
      store.removeNotes([id])
      if (target.kind === 'edit') snack({ message: t.noteDeleted(initial?.fields.title || t.untitled), action: { label: t.undo, run: () => store.restoreNotes([id]) } })
    }
    Keyboard.dismiss()
    onClose()
  }

  const remove = () => {
    clearTimeout(timer.current)
    const id = idRef.current
    setSheetOpen(false)
    if (id) {
      flush()
      store.removeNotes([id])
      snack({ message: t.noteDeleted(titleRef.current.trim() || t.untitled), action: { label: t.undo, run: () => store.restoreNotes([id]) } })
    }
    Keyboard.dismiss()
    onClose()
  }

  const changeCategory = (id: string) => {
    setCategoryId(id)
    if (idRef.current) store.setCategory(idRef.current, id, newOnTop)
  }
  const changePriority = (p: Priority) => {
    setPriority(p)
    if (idRef.current) store.setPriority(idRef.current, p, newOnTop)
  }

  const run = (cmd: EditorCommand) => web.current?.injectJavaScript(commandScript(cmd))
  const focusBody = () => {
    web.current?.requestFocus()
    run('focus')
  }

  const openSheet = () => {
    lastFocus.current = titleInput.current?.isFocused() ? 'title' : bodyFocused ? 'body' : null
    titleInput.current?.blur()
    if (bodyFocused) run('blur')
    Keyboard.dismiss()
    setSheetOpen(true)
  }
  const closeSheet = () => {
    setSheetOpen(false)
    // Danach weiterschreiben, wo man war.
    setTimeout(() => {
      if (lastFocus.current === 'title') titleInput.current?.focus()
      else if (lastFocus.current === 'body') focusBody()
    }, 250)
  }

  const editorTheme: EditorTheme = { text: c.text, red: c.noteRed, placeholder: c.text3, background: c.bg, accent: c.accent, fontSize: f(17) }
  // Die Seite des Editors entsteht nur einmal. Farben und Schriftgröße werden danach nachgereicht.
  const source = useMemo(
    () => ({ html: editorHtml({ html: bodyRef.current, lang: LOCALES[lang], placeholder: t.bodyPlaceholder, theme: editorTheme }) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const themeKey = JSON.stringify(editorTheme)
  const firstTheme = useRef(themeKey)
  useEffect(() => {
    if (themeKey !== firstTheme.current) web.current?.injectJavaScript(themeScript(editorTheme))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeKey])

  const onMessage = (e: WebViewMessageEvent) => {
    let msg: EditorMessage
    try {
      msg = JSON.parse(e.nativeEvent.data) as EditorMessage
    } catch {
      return
    }
    if (msg.type === 'change') {
      bodyRef.current = msg.html
      schedule()
    } else if (msg.type === 'state') {
      setFormat({ bold: msg.bold, red: msg.red, list: msg.list })
    } else if (msg.type === 'focus') {
      setBodyFocused(true)
    } else if (msg.type === 'blur') {
      setBodyFocused(false)
    }
  }

  const tool = (cmd: EditorCommand) => {
    haptic('tick')
    run(cmd)
  }

  const pill = [styles.pill, { backgroundColor: c.card }]
  const showToolbar = bodyFocused && !sheetOpen

  return (
    <Modal visible animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={close}>
      <KeyboardAvoidingView behavior="padding" style={[styles.fill, { backgroundColor: c.bg }]}>
        <View style={[styles.bar, { paddingTop: insets.top + 6 }]}>
          <Pressable
            onPress={close}
            style={styles.back}
            android_ripple={{ color: c.ripple, borderless: true, radius: 22 }}
            accessibilityRole="button"
            accessibilityLabel={t.back}
          >
            <MaterialIcons name="arrow-back" size={24} color={c.text} />
          </Pressable>
          <Pressable
            onPress={openSheet}
            style={[pill, styles.shrink]}
            android_ripple={{ color: c.ripple }}
            accessibilityRole="button"
            accessibilityLabel={t.categoryButton(category.name)}
          >
            <View style={[styles.dot, { backgroundColor: COLORS[category.color] }]} />
            <Text style={{ color: c.text, fontWeight: '600', fontSize: f(14), flexShrink: 1 }} numberOfLines={1}>
              {category.name}
            </Text>
            <MaterialIcons name="arrow-drop-down" size={20} color={c.text2} style={styles.caret} />
          </Pressable>
          {priorities && (
          <Pressable
            onPress={openSheet}
            style={pill}
            android_ripple={{ color: c.ripple }}
            accessibilityRole="button"
            accessibilityLabel={t.priorityButton(t.priority[priority])}
          >
            <MaterialIcons name="flag" size={16} color={priority === 'high' ? c.high : c.text2} />
            <Text style={{ color: priority === 'high' ? c.high : c.text2, fontWeight: '600', fontSize: f(14) }}>{t.priority[priority]}</Text>
            <MaterialIcons name="arrow-drop-down" size={20} color={c.text2} style={styles.caret} />
          </Pressable>
          )}
        </View>

        <Input
          ref={titleInput}
          value={title}
          onChangeText={(v) => {
            titleRef.current = v
            setTitle(v)
            schedule()
          }}
          placeholder={t.titlePlaceholder}
          placeholderTextColor={c.text3}
          cursorColor={c.accent}
          selectionColor={c.accentSoft}
          style={[styles.title, { color: c.text, fontSize: f(24) }]}
          multiline
          submitBehavior="submit"
          returnKeyType="next"
          onSubmitEditing={focusBody}
          autoCapitalize="sentences"
          accessibilityLabel={t.titlePlaceholder}
        />
        <Text style={[styles.date, { color: c.text3, fontSize: f(12.5) }]}>{live ? editedLabel(live.fields.editedAt, lang, t) : ' '}</Text>

        <WebView
          ref={web}
          source={source}
          originWhitelist={['*']}
          onMessage={onMessage}
          style={[styles.fill, { backgroundColor: c.bg }]}
          containerStyle={{ backgroundColor: c.bg }}
          javaScriptEnabled
          domStorageEnabled={false}
          allowFileAccess={false}
          allowsLinkPreview={false}
          setSupportMultipleWindows={false}
          cacheEnabled={false}
          incognito
          overScrollMode="never"
          keyboardDisplayRequiresUserAction={false}
          hideKeyboardAccessoryView
          onShouldStartLoadWithRequest={(req: { url: string }) => req.url === 'about:blank' || req.url.startsWith('data:')}
          accessibilityLabel={t.bodyPlaceholder}
        />

        {showToolbar && (
          <View style={[styles.toolbar, { backgroundColor: c.card, borderTopColor: c.sep }]}>
            <Tool label={t.bold} active={format.bold} onPress={() => tool('bold')}>
              <Text style={{ fontWeight: '800', fontSize: 17, color: format.bold ? c.accent : c.text }}>B</Text>
            </Tool>
            <View style={[styles.sep, { backgroundColor: c.sep }]} />
            <Tool label={t.black} active={!format.red} onPress={() => tool('black')}>
              <View style={[styles.swatch, { backgroundColor: c.text }]} />
            </Tool>
            <Tool label={t.red} active={format.red} onPress={() => tool('red')}>
              <View style={[styles.swatch, { backgroundColor: c.noteRed }]} />
            </Tool>
            <View style={[styles.sep, { backgroundColor: c.sep }]} />
            <Tool label={t.bullets} active={format.list} onPress={() => tool('list')}>
              <MaterialIcons name="format-list-bulleted" size={22} color={format.list ? c.accent : c.text} />
            </Tool>
            <View style={styles.spacer} />
            <Tool label={t.undoEdit} onPress={() => tool('undo')}>
              <MaterialIcons name="undo" size={22} color={c.text2} />
            </Tool>
          </View>
        )}
        <View style={{ height: keyboard ? 0 : insets.bottom }} />
      </KeyboardAvoidingView>

      <NoteSheet
        open={sheetOpen}
        title={title.trim()}
        categoryId={category.id}
        priority={priority}
        showPriority={priorities}
        onCategory={changeCategory}
        onPriority={changePriority}
        onDelete={remove}
        onClose={closeSheet}
      />
    </Modal>
  )
}

function Tool({ label, active, onPress, children }: { label: string; active?: boolean; onPress: () => void; children: React.ReactNode }) {
  const c = useColors()
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tool, active && { backgroundColor: c.accentSoft }]}
      android_ripple={{ color: c.ripple, borderless: false }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={active === undefined ? undefined : { selected: active }}
    >
      {children}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingBottom: 6 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingLeft: 12, paddingRight: 6, borderRadius: 18, overflow: 'hidden' },
  shrink: { flexShrink: 1 },
  caret: { marginLeft: -4 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  title: { fontWeight: '700', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 2 },
  date: { paddingHorizontal: 20, paddingBottom: 8 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth },
  tool: { minWidth: 46, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, overflow: 'hidden' },
  swatch: { width: 18, height: 18, borderRadius: 9 },
  sep: { width: StyleSheet.hairlineWidth, height: 24, marginHorizontal: 4 },
  spacer: { flex: 1 },
})
