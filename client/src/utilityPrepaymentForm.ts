// Vorauszahlung je Sparte (gewerbliche Abrechnung): die Anteile von Strom, Heizung und Wasser an der Gesamtvorauszahlung,
// je ab einem Monat. Ohne DOM prüfbar; die Seite Stammdaten rendert nur. Dieselbe Prüfung wie der Server
// (readUtilityPrepayments in server/src/db/repository.ts).
import type { Tenancy, UtilityKind, UtilityPrepayment } from './types'
import { parseEuro } from './api'
import { parseMonthText } from './monthText'
import { scheduleMonthText } from './tenancyModel'
import type { Problem } from './formProblems'
import { fmtEuro } from './api'

export const UTILITY_LABELS: Record<UtilityKind | 'sonstige', string> = { strom: 'Strom', heizung: 'Heizung', wasser: 'Wasser', sonstige: 'Übrige Nebenkosten' }
export const UTILITY_KINDS: readonly UtilityKind[] = ['strom', 'heizung', 'wasser']
export type UtilityRow = { kind: UtilityKind; from: string; amount: string }
export type UtilityField = `utility.${number}.${'from' | 'amount'}`

const centsText = (cents: number): string => (cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2 })

export const utilityRowsOf = (t: Pick<Tenancy, 'utilityPrepayments'>): UtilityRow[] =>
  (t.utilityPrepayments ?? []).map((p) => ({ kind: p.kind, from: scheduleMonthText(p.from), amount: centsText(p.monthlyCents) }))

// Ein Monat leer heißt „ab Einzug“ (der Monat des Einzugs); Betrag Pflicht, ab 0 €.
export function buildUtilityPrepayments(rows: readonly UtilityRow[], start: string): { value: UtilityPrepayment[] } | { problems: Problem<UtilityField>[] } {
  const problems: Problem<UtilityField>[] = []
  const value: UtilityPrepayment[] = []
  rows.forEach((r, i) => {
    const label = `Vorauszahlung ${UTILITY_LABELS[r.kind]}`
    let from: string | null = null
    if (r.from.trim() === '') {
      if (/^\d{4}-\d{2}/.test(start)) from = start.slice(0, 7)
      else problems.push({ field: `utility.${i}.from`, short: 'Monat fehlt', text: `${label}: Bitte den Monat angeben, ab dem der Betrag gilt.` })
    } else {
      const parsed = parseMonthText(r.from)
      if (parsed.kind === 'month') from = parsed.key
      else if (parsed.kind === 'invalid') problems.push({ field: `utility.${i}.from`, short: parsed.short, text: `${label}: ${parsed.text}` })
    }
    const cents = parseEuro(r.amount)
    if (r.amount.trim() === '' || cents === null || cents < 0) {
      problems.push({ field: `utility.${i}.amount`, short: 'Kein Betrag', text: `${label}: Bitte den Betrag je Monat angeben, etwa 1.366,33.` })
    } else if (from !== null) {
      value.push({ kind: r.kind, from, monthlyCents: cents })
    }
  })
  return problems.length > 0 ? { problems } : { value }
}

// Das Ergebnis einer Sparte in Worten wie auf der Abrechnung: positiv Guthaben, negativ Nachzahlung.
export const utilityResultText = (balanceCents: number): string =>
  balanceCents > 0 ? `Guthaben ${fmtEuro(balanceCents)}` : balanceCents < 0 ? `Nachzahlung ${fmtEuro(-balanceCents)}` : 'ausgeglichen'
