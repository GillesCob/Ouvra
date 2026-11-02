// Logique pure de la page « Mon espace » (02/11) : quels widgets sont affiches, que montre le journal.
// L'etat est un ensemble d'identifiants affiches, dans l'ordre ou ils ont ete ajoutes ; aucun acces au DOM ici (testable sous Node).

export const MESSAGES_ESPACE = {
  annulee: "Dernière instruction annulée.",
  retire: "Widget retiré.",
  vueRetiree: "Vue retirée."
};
export const DELAI_ANNULATION_MS = 8000; // le bouton « Annuler » qui suit un retrait reste affiche 8 secondes

// Une vue de « Mes points de vue » se masque comme un widget : son identifiant est prefixe pour ne jamais coincider avec celui d'un widget.
export const idVue = (id) => "vue:" + id;

// Annule un retrait (le meme ensemble moins l'identifiant) sans toucher a l'ancien.
export function restaurer(masques, id) {
  const suivant = new Set(masques);
  suivant.delete(id);
  return suivant;
}

export const widgetsAffiches = (widgets, masques) => widgets.filter((w) => !masques.has(w.id));

// Journal : une ligne par widget affiche (dans l'ordre de la page) ; seule la derniere porte « Annuler ».
export function lignesJournal(widgets, masques) {
  const actifs = widgetsAffiches(widgets, masques);
  return actifs.map((w, i) => ({ id: w.id, phrase: "« " + w.phrase + " »", annulable: i === actifs.length - 1 }));
}

export function retirerWidget(masques, id, message = MESSAGES_ESPACE.retire) {
  return { masques: new Set(masques).add(id), message };
}

// Cible d'un element (tache, echeance, alerte, vue) : { type: "message", convId, sujetId, texte }, { type: "collision", clashId }, { type: "collisions", filtre } ou { type: "vue3d", camera: { eye, look, up } }, ou null. L'identifiant est celui de l'element.
export function trouverCible(widgets, id) {
  for (const w of widgets) {
    const item = (w.items || []).find((i) => i.id === id && i.cible);
    if (item) return item.cible;
  }
  return null;
}

// Retour a Mon espace : la position de defilement memorisee a l'ouverture est rendue a la prochaine arrivee sur la page, une seule fois (sinon la page s'ouvre en haut).
export function creerMemoireDefilement() {
  let enAttente = null;
  return {
    memoriser: (position) => { enAttente = Number.isFinite(position) && position > 0 ? position : null; },
    consommer() { const p = enAttente; enAttente = null; return p === null ? 0 : p; }
  };
}
