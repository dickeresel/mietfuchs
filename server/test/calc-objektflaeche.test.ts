// Gesamtfläche des Objekts (gewerbliche Abrechnung, Pilot): Referenzfall „Gaglower Str.“ aus der Tabelle des Vermieters.
// Objekt 3.334,81 m², ein Mieter mit 1.064,67 m², der Rest ohne Mietverhältnis. Die Kosten gehen nach Fläche; die
// erwarteten Anteile sind die Werte der Tabelle (Rechnung × 1.064,67 / 3.334,81, auf den Cent), die Beträge pro m² die
// Spalte „Betrag pro Einheit“ des Formulars.
//
// Gebaut wird unmittelbar ein Schnappschuss wie in calc-verteilbasis.test.ts.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calendarPeriod } from '../../shared/period.ts'
import { computeSettlement, type ComputedSettlement } from '../src/calc.ts'
import { snapshotOf, type SnapshotCostItem, type SnapshotProperty, type SnapshotSource, type SnapshotTenancy, type SnapshotUnit } from '../src/snapshot.ts'
import { settlementExportCsv, settlementExportJson, type ExportableSettlement } from '../src/settlementExport.ts'

const OBJECT_AREA = 3334.81
const TENANT_AREA = 1064.67

const tenancy: SnapshotTenancy = {
  id: 't-gewerbe', unitId: 'mieteinheit', tenantName: 'Gewerbemieter', persons: 1, personHistory: [{ from: '2025-01-01', persons: 1 }],
  start: '2025-01-01', end: null,
  // Strom 1.366,33 €, Heizung 1.091,29 €, Wasser 24,30 € je Monat laut Mietvertrag, heute in einem Topf.
  prepayments: [{ from: '2025-01', monthlyCents: 136633 + 109129 + 2430 }], prepaymentOverrides: {}, baseRents: [],
}
const unit = (id: string, areaM2: number): SnapshotUnit => ({ id, name: id, areaM2, participates: true })
// Strom und Heizung als „Sonstige Betriebskosten“: Für beides hat Mietfuchs noch keine passende Kostenart nach Fläche
// (Beleuchtung/Allgemeinstrom trägt die Regeln des Betriebsstroms, Heizung die der HeizkostenV). Hier zählt nur die Fläche.
const item = (id: string, category: string, description: string, amountCents: number): SnapshotCostItem => ({
  id, period: calendarPeriod(2025), category, description, amountCents, key: 'area',
})
const COSTS: SnapshotCostItem[] = [
  item('strom', 'Sonstige Betriebskosten', 'Strom', 2313747),
  item('heizung', 'Sonstige Betriebskosten', 'Heizung', 3989307),
  item('wasser', 'Wasser/Abwasser', 'Wasser', 93829),
  item('aufzug', 'Aufzug', 'Wartung Fahrstuhl', 271155),
  item('treppe', 'Gebäudereinigung', 'Treppenhausreinigung', 1833590),
]
const source = (units: SnapshotUnit[]): SnapshotSource => ({
  units, tenancies: [tenancy], costItems: COSTS, meters: [], readings: [], payments: [], closedSettlements: [],
})
const property = (totalAreaM2?: number): SnapshotProperty => ({ kind: 'sonstiges', cableBuiltBeforeDec2021: null, ...(totalAreaM2 !== undefined ? { totalAreaM2 } : {}) })
const settle = (units: SnapshotUnit[], totalAreaM2?: number): ComputedSettlement =>
  computeSettlement({ ...snapshotOf(source(units), 2025), property: property(totalAreaM2) })
// Die Fläche ohne Mietverhältnis: das Objekt abzüglich der Mieteinheit, als Leerstand beim Vermieter.
const GAGLOWER = [unit('mieteinheit', TENANT_AREA), unit('leerstand', 2270.14)]

const shareOf = (s: ComputedSettlement, itemId: string): number =>
  s.statements[0]?.rows.find((r) => r.costItemId === itemId)?.shareCents ?? assert.fail(`keine Zeile ${itemId}`)

test('Referenzfall Gaglower Str.: Anteile nach Fläche centgenau wie die Tabelle des Vermieters', () => {
  const s = settle(GAGLOWER, OBJECT_AREA)
  assert.equal(shareOf(s, 'strom'), 738686) // 7.386,86 €
  assert.equal(shareOf(s, 'heizung'), 1273624) // 12.736,24 €
  assert.equal(shareOf(s, 'wasser'), 29956) // 299,56 €
  assert.equal(shareOf(s, 'aufzug'), 86569)
  assert.equal(shareOf(s, 'treppe'), 585391)
  // Mieteranteile + Vermieteranteil = Gesamtkosten.
  const tenant = s.statements.reduce((a, st) => a + st.totalShareCents, 0)
  assert.equal(tenant + s.landlord.totalCents, s.totalCostsCents)
  // Die Vorauszahlung steht heute in einem Topf: 12 × 2.481,92 €.
  assert.equal(s.statements[0]?.prepaymentCents, 12 * 248192)
})

test('Gesamtfläche gleich der Summe der Einheiten: kein Hinweis, die Fläche steht in der Abrechnung', () => {
  const s = settle(GAGLOWER, OBJECT_AREA)
  assert.equal(s.objectAreaM2, OBJECT_AREA)
  assert.ok(!s.notices.some((n) => n.code === 'property.area-mismatch'))
})

test('Ohne Gesamtfläche: kein Feld, kein Hinweis, dieselben Zahlen', () => {
  const s = settle(GAGLOWER)
  assert.ok(!('objectAreaM2' in s))
  assert.ok(!s.notices.some((n) => n.code === 'property.area-mismatch'))
  assert.equal(shareOf(s, 'strom'), shareOf(settle(GAGLOWER, OBJECT_AREA), 'strom'))
})

test('Gesamtfläche weicht von der Summe der Einheiten ab: Hinweis mit beiden Zahlen, verteilt wird über die Einheiten', () => {
  // Nur die Mieteinheit angelegt: Die Abrechnung teilt über 1.064,67 m², der Mieter trägt alles.
  const s = settle([unit('mieteinheit', TENANT_AREA)], OBJECT_AREA)
  const notice = s.notices.find((n) => n.code === 'property.area-mismatch') ?? assert.fail('Hinweis fehlt')
  assert.equal(notice.level, 'hint')
  assert.match(notice.text, /3\.334,81 m²/)
  assert.match(notice.text, /1\.064,67 m²/)
  assert.equal(shareOf(s, 'strom'), 2313747)
})

test('Gesamtfläche innerhalb eines Hundertstels: kein Hinweis (Rundung der Eingabe)', () => {
  const s = settle(GAGLOWER, OBJECT_AREA + 0.005)
  assert.ok(!s.notices.some((n) => n.code === 'property.area-mismatch'))
})

// ---------- Export ----------

const exportable = (s: ComputedSettlement): ExportableSettlement => ({ ...s, closed: null })

test('Export JSON: Gesamtfläche am Objekt und Betrag pro m² je Zeile nach Fläche, wie die Spalte des Formulars', () => {
  const json = settlementExportJson(exportable(settle(GAGLOWER, OBJECT_AREA)), { id: 'p', name: 'Gaglower Str.' })
  assert.equal(json.property.totalAreaM2, OBJECT_AREA)
  const perM2 = (id: string) => json.statements[0]?.rows.find((r) => r.costItemId === id)?.centsPerM2
  assert.equal(perM2('aufzug'), 81.31) // 0,8131 €/m²
  assert.equal(perM2('treppe'), 549.83) // 5,4983 €/m²
  assert.equal(perM2('strom'), 693.82)
  // Die Zeilen des Vermieters führen keinen Schlüssel (SettlementRow) und damit keinen Betrag pro m².
  assert.equal(json.landlord.rows.find((r) => r.costItemId === 'aufzug')?.centsPerM2, null)
})

test('Export JSON ohne Gesamtfläche: Felder da, aber null', () => {
  const json = settlementExportJson(exportable(settle(GAGLOWER)), { id: 'p', name: 'Gaglower Str.' })
  assert.equal(json.property.totalAreaM2, null)
  assert.ok(json.statements[0]?.rows.every((r) => r.centsPerM2 === null))
})

test('Export JSON: kein Betrag pro m² bei anderem Schlüssel', () => {
  const s = computeSettlement({ ...snapshotOf({ ...source(GAGLOWER), costItems: [{ ...item('e', 'Aufzug', 'Aufzug', 271155), key: 'units' }] }, 2025), property: property(OBJECT_AREA) })
  const json = settlementExportJson(exportable(s), { id: 'p', name: 'H' })
  assert.equal(json.statements[0]?.rows[0]?.centsPerM2, null)
})

test('Export CSV: mit Gesamtfläche die Spalte „Betrag pro m² der Gesamtfläche“ in Euro mit vier Stellen', () => {
  const lines = settlementExportCsv(exportable(settle(GAGLOWER, OBJECT_AREA))).replace(/^﻿/, '').split('\r\n')
  assert.ok(lines[0]?.endsWith(';davon Lohnanteil § 35a;Betrag pro m² der Gesamtfläche'))
  const aufzug = lines.find((l) => l.includes('Wartung Fahrstuhl')) ?? assert.fail('keine Zeile Aufzug')
  assert.equal(aufzug.split(';').at(-1), '0,8131')
  // Jede Zeile hat gleich viele Spalten wie der Kopf.
  const width = lines[0]?.split(';').length
  assert.ok(lines.filter((l) => l !== '' && l.includes(';')).every((l) => l.split(';').length === width))
})

test('Export CSV ohne Gesamtfläche: Kopfzeile wie bisher', () => {
  const head = settlementExportCsv(exportable(settle(GAGLOWER))).replace(/^﻿/, '').split('\r\n')[0]
  assert.equal(head, 'Mieter;Wohnung;Zeitraum von;Zeitraum bis;Zeile;Kostenart;Beschreibung;Gesamtkosten;Schlüssel;Basis;Anteil;davon Lohnanteil § 35a')
})

// ---------- Vorauszahlung je Sparte (gewerbliche Abrechnung) ----------
// Die Tabelle des Vermieters: Strom 1.366,33 €, Heizung 1.091,29 €, Wasser 24,30 € je Monat; dazu hier 500,00 € übrige
// Nebenkosten. Die Gesamtvorauszahlung bleibt die Summe, die Sparten teilen sie nur auf.
const SPARTEN = [
  { kind: 'strom' as const, from: '2025-01', monthlyCents: 136633 },
  { kind: 'heizung' as const, from: '2025-01', monthlyCents: 109129 },
  { kind: 'wasser' as const, from: '2025-01', monthlyCents: 2430 },
]
const settleSparten = (utilityPrepayments = SPARTEN, totalMonthly = 136633 + 109129 + 2430 + 50000): ComputedSettlement => {
  const t: SnapshotTenancy = { ...tenancy, prepayments: [{ from: '2025-01', monthlyCents: totalMonthly }], utilityPrepayments }
  const src: SnapshotSource = { ...source(GAGLOWER), tenancies: [t], costItems: [
    { ...item('strom', 'Sonstige Betriebskosten', 'Strom', 2313747), costTypeId: 'kt-strom' },
    { ...item('heizung', 'Sonstige Betriebskosten', 'Heizung', 3989307), costTypeId: 'kt-heizung' },
    item('wasser', 'Wasser/Abwasser', 'Wasser', 93829),
    item('aufzug', 'Aufzug', 'Wartung Fahrstuhl', 271155),
  ] }
  return computeSettlement({
    ...snapshotOf(src, 2025), property: property(OBJECT_AREA),
    costTypeNames: { 'kt-strom': 'Strom', 'kt-heizung': 'Heizung' },
    costTypeUtilities: { 'kt-strom': 'strom', 'kt-heizung': 'heizung' },
  })
}

test('Sparten: Kosten, Vorauszahlung und Ergebnis je Sparte wie die Tabelle des Vermieters; Summe = Abrechnung', () => {
  const st = settleSparten().statements[0] ?? assert.fail('keine Abrechnung')
  const u = st.utilities ?? assert.fail('keine Aufteilung')
  assert.deepEqual(u.map((l) => [l.kind, l.costCents, l.prepaymentCents, l.balanceCents]), [
    ['strom', 738686, 12 * 136633, 12 * 136633 - 738686], // Gutschrift 9.009,10 € (Tabelle mit Jahreswert: 9.009,06 €)
    ['heizung', 1273624, 12 * 109129, 12 * 109129 - 1273624], // Gutschrift 359,24 €
    ['wasser', 29956, 12 * 2430, 12 * 2430 - 29956], // Nachzahlung 7,96 €
    ['sonstige', 86569, 12 * 50000, 12 * 50000 - 86569],
  ])
  assert.equal(u.reduce((a, l) => a + l.costCents, 0), st.totalShareCents)
  assert.equal(u.reduce((a, l) => a + l.prepaymentCents, 0), st.prepaymentCents)
  assert.equal(u.reduce((a, l) => a + l.balanceCents, 0), st.balanceCents)
})

test('Sparten: ohne Anteile keine Aufteilung und dieselben Zahlen', () => {
  const mit = settleSparten()
  const ohne = settleSparten([])
  assert.equal(ohne.statements[0]?.utilities, undefined)
  assert.equal(ohne.statements[0]?.balanceCents, mit.statements[0]?.balanceCents)
})

test('Sparten: Anteile über der Gesamtvorauszahlung ergeben eine Warnung und negative übrige Vorauszahlung', () => {
  const s = settleSparten(SPARTEN, 100000)
  assert.ok(s.notices.some((n) => n.code === 'prepayment.utilities-exceed'))
  const sonstige = s.statements[0]?.utilities?.find((l) => l.kind === 'sonstige')
  assert.ok((sonstige?.prepaymentCents ?? 0) < 0)
})

// ---------- Flächenwechsel im Jahr (Anforderung 6) ----------
// Zwei Einheiten mit je 100 m²; B wächst ab 01.07.2025 auf 200 m². 3.650,00 € nach Fläche, gleichmäßig über 365 Tage:
// 01.01.–30.06. (181 Tage, 1.810,00 €) je zur Hälfte, 01.07.–31.12. (184 Tage, 1.840,00 €) im Verhältnis 100 : 200.
// A: 905,00 + 613,33… = 1.518,33 €, B: 905,00 + 1.226,66… = 2.131,67 €.
test('Flächenwechsel: verteilt je Abschnitt mit der Fläche des Abschnitts, Summe genau die Rechnung', () => {
  const ta: SnapshotTenancy = { ...tenancy, id: 't-a', unitId: 'a', tenantName: 'A', prepayments: [] }
  const tb: SnapshotTenancy = { ...tenancy, id: 't-b', unitId: 'b', tenantName: 'B', prepayments: [] }
  const src: SnapshotSource = {
    units: [unit('a', 100), { ...unit('b', 100), areaChanges: [{ from: '2025-07-01', areaM2: 200 }] }],
    tenancies: [ta, tb], costItems: [item('x', 'Gebäudereinigung', 'Reinigung', 365000)], meters: [], readings: [], payments: [], closedSettlements: [],
  }
  const s = computeSettlement({ ...snapshotOf(src, 2025), property: property() })
  const share = (id: string) => s.statements.find((st) => st.tenancyId === id)?.totalShareCents
  assert.deepEqual([share('t-a'), share('t-b')], [151833, 213167])
  assert.equal(s.landlord.totalCents, 0)
  const text = s.statements.find((st) => st.tenancyId === 't-b')?.rows[0]?.basisText ?? ''
  assert.match(text, /100 von 200 m² 01\.01\.–30\.06\.2025/)
  assert.match(text, /200 von 300 m² 01\.07\.–31\.12\.2025/)
})

test('Flächenwechsel: ohne Wechsel im Zeitraum dieselben Zahlen wie ohne Staffel', () => {
  const ta: SnapshotTenancy = { ...tenancy, id: 't-a', unitId: 'a', prepayments: [] }
  const tb: SnapshotTenancy = { ...tenancy, id: 't-b', unitId: 'b', prepayments: [] }
  const base: SnapshotSource = { units: [unit('a', 100), unit('b', 100)], tenancies: [ta, tb], costItems: [item('x', 'Gebäudereinigung', 'Reinigung', 365000)], meters: [], readings: [], payments: [], closedSettlements: [] }
  const later: SnapshotSource = { ...base, units: [unit('a', 100), { ...unit('b', 100), areaChanges: [{ from: '2026-03-01', areaM2: 200 }] }] }
  const shares = (src: SnapshotSource) => computeSettlement({ ...snapshotOf(src, 2025), property: property() }).statements.map((st) => st.totalShareCents)
  assert.deepEqual(shares(later), shares(base))
})

test('Flächenwechsel vor dem Zeitraum: die neue Fläche gilt den ganzen Zeitraum', () => {
  const ta: SnapshotTenancy = { ...tenancy, id: 't-a', unitId: 'a', prepayments: [] }
  const tb: SnapshotTenancy = { ...tenancy, id: 't-b', unitId: 'b', prepayments: [] }
  const src: SnapshotSource = {
    units: [unit('a', 100), { ...unit('b', 100), areaChanges: [{ from: '2024-07-01', areaM2: 200 }] }],
    tenancies: [ta, tb], costItems: [item('x', 'Gebäudereinigung', 'Reinigung', 365000)], meters: [], readings: [], payments: [], closedSettlements: [],
  }
  const s = computeSettlement({ ...snapshotOf(src, 2025), property: property() })
  assert.deepEqual(s.statements.map((st) => st.totalShareCents), [121667, 243333])
})
