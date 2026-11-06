/**
 * Zeitstempel für Änderungen (hybride logische Uhr).
 *
 * Jede Änderung an einem Feld bekommt einen Zeitstempel. Wenn später zwei Geräte
 * dasselbe Feld geändert haben, gewinnt der größere Zeitstempel. Damit das auch bei
 * falsch gehenden Handyuhren funktioniert, zählt die Uhr nie rückwärts und übernimmt
 * beim Empfang fremder Änderungen deren Zeit, falls sie weiter vorn liegt.
 *
 * Format: "<Millisekunden, 15 Stellen>-<Zähler, 4 Stellen>-<Geräte-ID>"
 * Die feste Breite sorgt dafür, dass ein einfacher Textvergleich richtig sortiert.
 */
export type Stamp = string

export const ZERO_STAMP: Stamp = '000000000000000-0000-'

const pad = (n: number, width: number) => n.toString().padStart(width, '0')

export function formatStamp(wall: number, counter: number, deviceId: string): Stamp {
  return `${pad(wall, 15)}-${pad(counter, 4)}-${deviceId}`
}

export function parseStamp(stamp: Stamp): { wall: number; counter: number; deviceId: string } {
  const [wall, counter, ...rest] = stamp.split('-')
  return { wall: Number(wall), counter: Number(counter), deviceId: rest.join('-') }
}

export function compareStamps(a: Stamp, b: Stamp): number {
  return a < b ? -1 : a > b ? 1 : 0
}

export const maxStamp = (a: Stamp, b: Stamp): Stamp => (compareStamps(a, b) >= 0 ? a : b)

export class Clock {
  private wall = 0
  private counter = 0

  constructor(
    readonly deviceId: string,
    last?: Stamp,
    private readonly now: () => number = Date.now,
  ) {
    if (last) this.receive(last)
  }

  /** Neuer Zeitstempel für eine lokale Änderung. */
  tick(): Stamp {
    const physical = this.now()
    if (physical > this.wall) {
      this.wall = physical
      this.counter = 0
    } else {
      this.counter += 1
    }
    return formatStamp(this.wall, this.counter, this.deviceId)
  }

  /** Fremden Zeitstempel berücksichtigen, damit die eigene Uhr nicht zurückliegt. */
  receive(remote: Stamp): void {
    const { wall, counter } = parseStamp(remote)
    if (wall > this.wall || (wall === this.wall && counter > this.counter)) {
      this.wall = wall
      this.counter = counter
    }
  }

  /** Letzter vergebener Stand, zum Speichern. */
  last(): Stamp {
    return formatStamp(this.wall, this.counter, this.deviceId)
  }
}
