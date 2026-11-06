import { useRef, useState } from 'react'
import { Animated, PanResponder, StyleSheet, Text, View } from 'react-native'
import { PRIORITY_SECTIONS, type ColorKey, type Priority } from '../domain/model'
import { haptic } from './haptics'
import { useT } from './i18n'
import { NoteRow } from './NoteRow'
import { useColors, useFont } from './theme'

export interface ListNote {
  id: string
  title: string
  preview: string
  priority: Priority
  color: ColorKey
  categoryName?: string
}

interface Props {
  notes: ListNote[]
  /** Abschnitte nach Priorität zeigen. Aus: eine Liste ohne Überschriften. */
  sections: boolean
  onOpen: (id: string) => void
  onArrange: (id: string) => void
  onDelete: (id: string) => void
  /** Neue Reihenfolge nach dem Loslassen: eines Abschnitts, oder ohne Abschnitte (null) der ganzen Liste. */
  onReorder: (priority: Priority | null, ids: string[]) => void
  /** Während des Ziehens oder Wischens darf die Liste nicht scrollen. */
  onGesture: (active: boolean) => void
}

type Entry = { key: string; header: Priority } | { key: string; note: ListNote }

const headerKey = (p: Priority) => `#${p}`
const DEFAULT_HEIGHT = 64

/**
 * Notizen in drei Abschnitten (Hoch, Normal, Niedrig). Am Griff lässt sich eine Notiz innerhalb
 * ihres Abschnitts verschieben oder in einen anderen Abschnitt ziehen, dann ändert sich ihre Priorität.
 * Die Überschriften stehen auch bei leeren Abschnitten da, damit man dorthin ziehen kann.
 */
export function NoteList({ notes, sections, onOpen, onArrange, onDelete, onReorder, onGesture }: Props) {
  const c = useColors()
  const t = useT()
  const f = useFont()

  const base = (): string[] =>
    sections ? PRIORITY_SECTIONS.flatMap((p) => [headerKey(p), ...notes.filter((n) => n.priority === p).map((n) => n.id)]) : notes.map((n) => n.id)
  // Reihenfolge während des Ziehens. Sonst gilt immer die Reihenfolge aus dem Speicher.
  const [dragOrder, setDragOrder] = useState<string[] | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const offset = useRef(new Animated.Value(0)).current
  const heights = useRef(new Map<string, number>()).current
  const drag = useRef({ id: null as string | null, order: [] as string[], startTop: 0, startOrder: '', moved: false })
  const callbacks = useRef({ onReorder, onGesture })
  const sectionsRef = useRef(sections)
  sectionsRef.current = sections
  callbacks.current = { onReorder, onGesture }

  const byId = new Map(notes.map((n) => [n.id, n]))
  const visible = dragOrder ? dragOrder.filter((k) => k.startsWith('#') || byId.has(k)) : base()
  const orderRef = useRef(visible)
  orderRef.current = visible

  const top = (list: string[], key: string) => {
    let y = 0
    for (const k of list) {
      if (k === key) return y
      y += heights.get(k) ?? DEFAULT_HEIGHT
    }
    return y
  }

  const finish = () => {
    const d = drag.current
    const id = d.id
    d.id = null
    offset.setValue(0)
    setDragId(null)
    setDragOrder(null)
    callbacks.current.onGesture(false)
    if (!id || d.order.join('|') === d.startOrder) return
    if (!sections) return callbacks.current.onReorder(null, d.order)
    // Abschnitt bestimmen, in dem die Notiz gelandet ist, und dessen Reihenfolge melden.
    let section: Priority = 'high'
    let ids: string[] = []
    let target: Priority | null = null
    for (const k of d.order) {
      if (k.startsWith('#')) {
        if (target) break
        section = k.slice(1) as Priority
        ids = []
        continue
      }
      ids.push(k)
      if (k === id) target = section
    }
    if (target) callbacks.current.onReorder(target, ids)
  }
  const finishRef = useRef(finish)
  finishRef.current = finish

  const responders = useRef(new Map<string, ReturnType<typeof PanResponder.create>>()).current
  const responderFor = (id: string) => {
    let r = responders.get(id)
    if (r) return r
    r = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        const list = orderRef.current
        setDragOrder(list)
        drag.current = { id, order: list, startTop: top(list, id), startOrder: list.join('|'), moved: false }
        offset.setValue(0)
        setDragId(id)
        callbacks.current.onGesture(true)
        haptic('press')
      },
      onPanResponderMove: (_e, g) => {
        const d = drag.current
        // Kleine Bewegungen beim Antippen des Griffs verschieben nichts.
        if (!d.moved && Math.abs(g.dy) < 8) return
        d.moved = true
        // Oberkante der gezogenen Notiz, gemessen in der Liste ohne sie: Sie rückt hinter jede
        // Zeile, deren Mitte sie überschritten hat.
        const pos = d.startTop + g.dy
        const others = d.order.filter((k) => k !== id)
        let index = 0
        let y = 0
        for (const k of others) {
          const kh = heights.get(k) ?? DEFAULT_HEIGHT
          if (y + kh / 2 < pos) index++
          y += kh
        }
        // Nie über die erste Überschrift hinaus.
        if (sectionsRef.current) index = Math.max(1, index)
        const next = [...others.slice(0, index), id, ...others.slice(index)]
        if (next.join('|') !== d.order.join('|')) {
          d.order = next
          setDragOrder(next)
          haptic('tick')
        }
        offset.setValue(d.startTop + g.dy - top(d.order, id))
      },
      onPanResponderRelease: () => finishRef.current(),
      onPanResponderTerminate: () => finishRef.current(),
    })
    responders.set(id, r)
    return r
  }

  const entries: Entry[] = visible.map((k) => (k.startsWith('#') ? { key: k, header: k.slice(1) as Priority } : { key: k, note: byId.get(k)! }))
  const count = (p: Priority) => entries.filter((e) => 'note' in e && sectionOf(entries, e.key) === p).length

  return (
    <View>
      {entries.map((entry, i) => {
        if ('header' in entry) {
          const p = entry.header
          return (
            <View key={entry.key} onLayout={(e) => heights.set(entry.key, e.nativeEvent.layout.height)} style={[styles.head, i === 0 && styles.firstHead]}>
              <Text style={[styles.headText, { color: p === 'high' ? c.high : c.text2, fontSize: f(12) }]} accessibilityRole="header">
                {t.priority[p].toLocaleUpperCase()} · {count(p)}
              </Text>
            </View>
          )
        }
        const n = entry.note
        const first = i === 0 || 'header' in entries[i - 1]
        const last = i === entries.length - 1 || 'header' in entries[i + 1]
        const lifted = dragId === n.id
        return (
          <Animated.View
            key={n.id}
            onLayout={(e) => heights.set(n.id, e.nativeEvent.layout.height)}
            style={[styles.card, lifted && { zIndex: 2, elevation: 8, borderRadius: 16, transform: [{ translateY: offset }, { scale: 1.02 }] }]}
          >
            <NoteRow
              id={n.id}
              title={n.title}
              preview={n.preview}
              color={n.color}
              categoryName={n.categoryName}
              first={first || lifted}
              last={last || lifted}
              onOpen={onOpen}
              onArrange={onArrange}
              onDelete={onDelete}
              onSwipeStart={() => callbacks.current.onGesture(true)}
              onSwipeEnd={() => callbacks.current.onGesture(false)}
              dragHandlers={responderFor(n.id).panHandlers}
            />
          </Animated.View>
        )
      })}
    </View>
  )
}

function sectionOf(entries: Entry[], key: string): Priority | null {
  let section: Priority | null = null
  for (const e of entries) {
    if ('header' in e) section = e.header
    else if (e.key === key) return section
  }
  return null
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8 },
  firstHead: { paddingTop: 6 },
  headText: { fontWeight: '700', letterSpacing: 0.7 },
  card: { marginHorizontal: 16 },
})
