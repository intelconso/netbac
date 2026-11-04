// Validation for back-dating "Utilisé" on a (typically expired) product.
//
// The chosen date must lie in the valid window:
//   addedAt  <=  usedAt  <  dlc          (strictly before DLC)
//   usedAt   <=  now                     (no future-dating)

export interface UsedAtCheck {
  usedAt: number;
  dlc: number;
  addedAt: number;
  now: number;
}

export function validateUsedAt({ usedAt, dlc, addedAt, now }: UsedAtCheck): string[] {
  const errors: string[] = [];

  if (usedAt === undefined || usedAt === null || Number.isNaN(usedAt)) {
    errors.push("Renseigne la date d'utilisation.");
    return errors;
  }

  if (usedAt < addedAt) {
    errors.push("La date d'utilisation est avant la date d'ajout du produit.");
  }
  if (usedAt >= dlc) {
    errors.push("La date d'utilisation doit être avant la DLC (date de péremption).");
  }
  if (usedAt > now) {
    errors.push("La date d'utilisation ne peut pas être dans le futur.");
  }

  return errors;
}

// Clôture automatique : une étiquette encore active 24 h après sa DLC passe en
// « Utilisé » sans que personne ne la touche — sinon les oublis s'accumulent
// dans les bacs et noient les vraies alertes.
//
// Pur, calculé depuis `dlc` : tous les appareils s'accordent sans se parler.
export const AUTO_USE_GRACE_MS = 24 * 60 * 60 * 1000;

export function staleLabelIds(
  products: Array<{ id: string; status: string; dlc: number; deletedAt?: number }>,
  now: number,
): string[] {
  return products
    .filter((p) => p.status === 'active' && !p.deletedAt && now >= p.dlc + AUTO_USE_GRACE_MS)
    .map((p) => p.id);
}
