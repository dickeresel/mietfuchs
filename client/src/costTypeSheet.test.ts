// Aufteilung der Gesamtkosten nach Kostenarten (Anforderung 9): Referenzfall Gaglower Str. wie im Formular des Vermieters.
import { expect, test } from 'vitest'
import { costTypeSheet, perUnitText, showsCostTypeSheet } from './costTypeSheet'

const row = (category: string, totalCents: number, shareCents: number, extra: { costType?: string; key?: 'area' | 'units'; keyLabel?: string } = {}) =>
  ({ category, totalCents, shareCents, key: extra.key ?? 'area', keyLabel: extra.keyLabel ?? 'Wohnfläche', ...(extra.costType ? { costType: extra.costType } : {}) }) as const

test('Gaglower Str.: je Kostenart eine Zeile, eigene zuerst, auch ohne Kosten; Betrag pro m² wie Spalte E des Formulars', () => {
  const sheet = costTypeSheet({
    rows: [
      row('Sonstige Betriebskosten', 101782, 32495, { costType: 'Sicherheitsdienst' }),
      row('Aufzug', 271155, 86569),
      row('Gebäudereinigung', 1550011, 494852, { costType: 'Treppenhausreinigung' }),
      row('Gebäudereinigung', 283579, 90539, { costType: 'Treppenhausreinigung' }),
    ],
    costTypes: [{ name: 'Treppenhausreinigung', position: 1 }, { name: 'Sicherheitsdienst', position: 0 }, { name: 'Glasreinigung', position: 2 }],
    objectAreaM2: 3334.81,
    unitAreaM2: 1064.67,
  })
  expect(sheet.rows.map((r) => [r.name, r.totalCents, r.shareCents])).toEqual([
    ['Sicherheitsdienst', 101782, 32495],
    ['Treppenhausreinigung', 1833590, 585391],
    ['Glasreinigung', 0, 0],
    ['Aufzug', 271155, 86569],
  ])
  const aufzug = sheet.rows.find((r) => r.name === 'Aufzug')
  expect([aufzug?.unitsM2, aufzug?.yourM2, perUnitText(aufzug?.perUnitCents ?? null)]).toEqual([3334.81, 1064.67, '0,8131 €'])
  expect(perUnitText(sheet.rows[1]?.perUnitCents ?? null)).toBe('5,4983 €')
  // Die Summe der Anteile ist die der Abrechnung.
  expect(sheet.shareCents).toBe(32495 + 585391 + 86569)
})

test('Anderer Schlüssel oder ohne Gesamtfläche: keine Einheiten und kein Betrag pro m²', () => {
  const sheet = costTypeSheet({ rows: [row('Aufzug', 1000, 500, { key: 'units', keyLabel: 'Wohneinheiten' })], costTypes: [], objectAreaM2: 3334.81, unitAreaM2: 100 })
  expect([sheet.rows[0]?.unitsM2, sheet.rows[0]?.perUnitCents, sheet.rows[0]?.keyLabel]).toEqual([null, null, 'Wohneinheiten'])
  const ohne = costTypeSheet({ rows: [row('Aufzug', 1000, 500)], costTypes: [], objectAreaM2: null, unitAreaM2: 100 })
  expect([ohne.rows[0]?.unitsM2, ohne.rows[0]?.perUnitCents, ohne.rows[0]?.yourM2]).toEqual([null, null, 100])
})

test('Nur in einer gewerblichen Abrechnung: mit Gesamtfläche, eigenen Kostenarten oder Zeilen mit Kostenart', () => {
  expect(showsCostTypeSheet(null, [], [])).toBe(false)
  expect(showsCostTypeSheet(3334.81, [], [])).toBe(true)
  expect(showsCostTypeSheet(undefined, [{ costType: 'X' }], [])).toBe(true)
  expect(showsCostTypeSheet(undefined, [], [{}])).toBe(true)
})
