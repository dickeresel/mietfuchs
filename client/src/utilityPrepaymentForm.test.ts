// Vorauszahlung je Sparte (gewerbliche Abrechnung): Formular hin und zurück, Meldungen am Feld, Ergebnis in Worten.
import { expect, test } from 'vitest'
import { buildUtilityPrepayments, utilityResultText, utilityRowsOf } from './utilityPrepaymentForm'
import { fmtEuro } from './api'

test('Anteile hin und zurück: Monat deutsch, leer heißt ab Einzug, Betrag in Cent', () => {
  const built = buildUtilityPrepayments([
    { kind: 'strom', from: '', amount: '1.366,33' },
    { kind: 'heizung', from: '7.2025', amount: '1091,29' },
  ], '2025-01-15')
  if (!('value' in built)) return expect.fail('soll gelingen')
  expect(built.value).toEqual([
    { kind: 'strom', from: '2025-01', monthlyCents: 136633 },
    { kind: 'heizung', from: '2025-07', monthlyCents: 109129 },
  ])
  expect(utilityRowsOf({ utilityPrepayments: built.value })).toEqual([
    { kind: 'strom', from: '01.2025', amount: '1.366,33' },
    { kind: 'heizung', from: '07.2025', amount: '1.091,29' },
  ])
  expect(utilityRowsOf({})).toEqual([])
})

test('Meldungen: Betrag fehlt oder negativ, Monat unlesbar, ohne Einzug kein leerer Monat', () => {
  const r = buildUtilityPrepayments([
    { kind: 'wasser', from: 'März', amount: '' },
    { kind: 'strom', from: '', amount: '-5' },
  ], '')
  if (!('problems' in r)) return expect.fail('soll scheitern')
  expect(r.problems.map((p) => p.field)).toEqual(['utility.0.from', 'utility.0.amount', 'utility.1.from', 'utility.1.amount'])
})

test('Ergebnis in Worten', () => {
  expect(utilityResultText(900910)).toBe(`Guthaben ${fmtEuro(900910)}`)
  expect(utilityResultText(-796)).toBe(`Nachzahlung ${fmtEuro(796)}`)
  expect(utilityResultText(0)).toBe('ausgeglichen')
})
