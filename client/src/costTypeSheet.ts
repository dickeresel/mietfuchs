// Aufteilung der Gesamtkosten nach Kostenarten (gewerbliche Abrechnung, Anforderung 9): je Kostenart eine Zeile wie im
// Formular des Vermieters, mit Umlageschlüssel, Gesamtkosten, Gesamteinheiten, Betrag pro Einheit, Ihren Einheiten und
// Ihrem Kostenanteil, auch für eigene Kostenarten ohne Kosten (0 €). Ohne DOM prüfbar; die Seite Abrechnung rendert nur.
//
// **Der Kostenanteil ist der der Abrechnung**, nicht Betrag pro Einheit × Ihre Einheiten: Bei Einzug oder Auszug im
// Zeitraum, bei Teilnehmern oder einem anderen Schlüssel als Fläche weichen beide ab. Gesamteinheiten und Betrag pro Einheit
// stehen nur beim Flächenschlüssel und eingetragener Gesamtfläche des Objekts; sonst bleiben die Zellen leer.
import type { CostType, SettlementRow } from './types'
import { CATEGORIES } from './types'
import { rowCategory } from './costTypeForm'

export type SheetRow = {
  name: string
  keyLabel: string | null
  totalCents: number
  unitsM2: number | null
  // Cent je m², ungerundet (für die Anzeige auf vier Nachkommastellen in Euro)
  perUnitCents: number | null
  yourM2: number | null
  shareCents: number
}

export type SheetInput = {
  rows: readonly Pick<SettlementRow, 'category' | 'costType' | 'key' | 'keyLabel' | 'totalCents' | 'shareCents' | 'kind'>[]
  costTypes: readonly Pick<CostType, 'name' | 'position'>[]
  objectAreaM2: number | null
  unitAreaM2: number | null
}

// Die Aufstellung erscheint nur in einer gewerblichen Abrechnung: mit Gesamtfläche des Objekts oder eigenen Kostenarten.
export const showsCostTypeSheet = (objectAreaM2: number | null | undefined, rows: readonly Pick<SettlementRow, 'costType'>[], costTypes: readonly unknown[]): boolean =>
  (objectAreaM2 ?? 0) > 0 || costTypes.length > 0 || rows.some((r) => r.costType !== undefined)

export function costTypeSheet(input: SheetInput): { rows: SheetRow[]; totalCents: number; shareCents: number } {
  const groups = new Map<string, SheetInput['rows'][number][]>()
  for (const r of input.rows) {
    const name = rowCategory(r)
    groups.set(name, [...(groups.get(name) ?? []), r])
  }
  // Reihenfolge: eigene Kostenarten wie in ihrer Liste, dann die Kostenarten von Mietfuchs in ihrer Reihenfolge, zuletzt
  // alles Übrige (Sonderzeilen) in der Reihenfolge der Abrechnung.
  const ownNames = [...input.costTypes].sort((a, b) => a.position - b.position).map((t) => t.name)
  const names = [
    ...ownNames,
    ...CATEGORIES.filter((c) => groups.has(c) && !ownNames.includes(c)),
    ...[...groups.keys()].filter((n) => !ownNames.includes(n) && !CATEGORIES.includes(n)),
  ]
  const area = input.objectAreaM2 !== null && input.objectAreaM2 > 0 ? input.objectAreaM2 : null
  const rows = names.map((name): SheetRow => {
    const members = groups.get(name) ?? []
    const keys = [...new Set(members.filter((m) => !m.kind).map((m) => m.keyLabel))]
    const byArea = members.length > 0 && members.every((m) => m.kind || m.key === 'area')
    const totalCents = members.filter((m) => !m.kind).reduce((a, m) => a + m.totalCents, 0)
    return {
      name,
      keyLabel: keys.length === 1 ? keys[0] ?? null : keys.length > 1 ? 'verschieden' : null,
      totalCents,
      unitsM2: byArea && area !== null ? area : null,
      perUnitCents: byArea && area !== null ? totalCents / area : null,
      yourM2: byArea ? input.unitAreaM2 : null,
      shareCents: members.reduce((a, m) => a + m.shareCents, 0),
    }
  })
  return { rows, totalCents: rows.reduce((a, r) => a + r.totalCents, 0), shareCents: rows.reduce((a, r) => a + r.shareCents, 0) }
}

// Euro je m² mit vier Nachkommastellen, deutsch (0,8131 €), wie die Spalte „Betrag pro Einheit“ des Formulars.
export const perUnitText = (cents: number | null): string =>
  cents === null ? '' : `${(cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 4, maximumFractionDigits: 4 })} €`
// Ohne Einheit: Der Satz unter der Tabelle nennt m², damit die Spalten schmal bleiben.
export const areaText = (m2: number | null): string => (m2 === null ? '' : m2.toLocaleString('de-DE', { maximumFractionDigits: 2 }))
