// HACCP — refroidissement rapide.
//
// Réglementation FR / paquet hygiène : la température à cœur doit passer
// de +63 °C à +10 °C en moins de 2 heures, puis stockage à 0..+3 °C, DLC
// maximale 3 jours.

export const COOLING_MAX_DURATION_MS = 2 * 60 * 60 * 1000;
export const COOLING_MAX_END_TEMP = 10;
export const COOLING_DLC_DAYS = 3;

export interface CoolingCycle {
  startedAt: number;
  finishedAt: number;
  tempStart: number;
  tempEnd: number;
}

export function validateCoolingCycle(cycle: Partial<CoolingCycle>): string[] {
  const errors: string[] = [];
  const { startedAt, finishedAt, tempStart, tempEnd } = cycle;

  if (
    startedAt === undefined ||
    finishedAt === undefined ||
    tempStart === undefined ||
    tempEnd === undefined ||
    Number.isNaN(startedAt) ||
    Number.isNaN(finishedAt) ||
    Number.isNaN(tempStart) ||
    Number.isNaN(tempEnd)
  ) {
    errors.push('Renseigne heure début, heure fin, T° début et T° fin.');
    return errors;
  }

  const duration = finishedAt - startedAt;
  if (duration <= 0) {
    errors.push("L'heure de fin doit être après l'heure de début.");
  } else if (duration > COOLING_MAX_DURATION_MS) {
    const mins = Math.round(duration / 60_000);
    errors.push(`Durée de refroidissement ${mins} min — la règle HACCP est 2 h max (63 °C → 10 °C).`);
  }

  if (tempEnd > COOLING_MAX_END_TEMP) {
    errors.push(`T° de fin ${tempEnd} °C — doit être ≤ 10 °C pour valider le refroidissement.`);
  }

  return errors;
}

export function computeCoolingDlc(finishedAt: number): number {
  return finishedAt + COOLING_DLC_DAYS * 24 * 60 * 60 * 1000;
}
