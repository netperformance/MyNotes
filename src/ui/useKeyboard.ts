import { useEffect, useState } from 'react'
import { Keyboard } from 'react-native'

/**
 * Höhe der Bildschirmtastatur. Android-Apps laufen bis unter die Systemleisten
 * (edge-to-edge), deshalb schiebt das System die Ansicht nicht mehr selbst hoch.
 * Die Komponenten setzen den Abstand mit diesem Wert selbst.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0)
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => setHeight(e.endCoordinates.height))
    const hide = Keyboard.addListener('keyboardDidHide', () => setHeight(0))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])
  return height
}

/** Oberkante der Bildschirmtastatur in Bildschirmpunkten, oder null, wenn sie zu ist. */
export function useKeyboardTop(): number | null {
  const [top, setTop] = useState<number | null>(null)
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => setTop(e.endCoordinates.screenY))
    const hide = Keyboard.addListener('keyboardDidHide', () => setTop(null))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])
  return top
}
