import { describe, expect, it } from 'vitest'
import { findMatches, htmlToText, previewText, snippet } from './text'

describe('htmlToText', () => {
  it('macht aus dem gespeicherten HTML lesbaren Text', () => {
    const html = '<div><b>Offene Punkte</b> für Dienstag:</div><ul><li>Fristen</li><li><span class="r">Rückfragen</span></li></ul><div>Danach &amp; so</div>'
    expect(htmlToText(html)).toBe('Offene Punkte für Dienstag:\n• Fristen\n• Rückfragen\nDanach & so')
    expect(previewText(html)).toBe('Offene Punkte für Dienstag:, Fristen, Rückfragen Danach & so')
  })

  it('kommt mit leerem Text und Zeilenumbrüchen zurecht', () => {
    expect(htmlToText('')).toBe('')
    expect(htmlToText('<div>a<br>b</div><div><br></div>')).toBe('a\nb')
  })
})

describe('Suche', () => {
  it('findet ohne Groß und Klein und ohne Umlautpunkte', () => {
    expect(findMatches('Herr Müller kommt', 'muller')).toEqual([[5, 11]])
    expect(findMatches('Herr Müller kommt', 'mueller')).toEqual([[5, 11]])
    expect(findMatches('Straße', 'strasse')).toEqual([[0, 6]])
    expect(findMatches('Meldefrist und Frist', 'FRIST')).toEqual([
      [5, 10],
      [15, 20],
    ])
  })

  it('schneidet einen Ausschnitt um die Fundstelle aus', () => {
    const text = 'Viel Text davor, der nicht in die Vorschau passt, und dann kommt die Meldefrist von sieben Tagen und noch mehr Text danach.'
    const s = snippet(text, 'frist', 20, 50)
    expect(s.text.startsWith('… ')).toBe(true)
    expect(s.text.endsWith(' …')).toBe(true)
    const [start, end] = s.ranges[0]
    expect(s.text.slice(start, end).toLowerCase()).toBe('frist')
  })
})
