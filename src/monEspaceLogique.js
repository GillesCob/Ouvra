// Logique pure de la page « Mon espace » (02/11) : quels widgets sont affiches, que fait une instruction, que montre le journal.
// L'etat est un ensemble d'identifiants affiches, dans l'ordre ou ils ont ete ajoutes ; aucun acces au DOM ici (testable sous Node).

export const MESSAGES_ESPACE = {
  vide: "Écris ou dicte une instruction.",
  inconnue: "Instruction reçue (démonstration : seules les phrases du journal sont jouées).",
  annulee: "Dernière instruction annulée.",
  retire: "Widget retiré.",
  ecoute: "J'écoute…",
  vueRetiree: "Vue retirée."
};
export const DELAI_ANNULATION_MS = 8000; // le bouton « Annuler » qui suit un retrait reste affiche 8 secondes

// Une vue de « Mes points de vue » se masque comme un widget : son identifiant est prefixe pour ne jamais coincider avec celui d'un widget.
export const idVue = (id) => "vue:" + id;

// Le stylo ne modifie rien lui-meme : il prepare la phrase a dire ou a ecrire dans la barre d'instruction.
export const phraseModifier = (nom, estVue = false) => (estVue ? "Modifie la vue " : "Modifie ") + nom + " : ";

// Annule un retrait (le meme ensemble moins l'identifiant) sans toucher a l'ancien.
export function restaurer(masques, id) {
  const suivant = new Set(masques);
  suivant.delete(id);
  return suivant;
}
export const messageFait = (phrase) => "Fait : " + phrase;

export const widgetsAffiches = (widgets, masques) => widgets.filter((w) => !masques.has(w.id));

// Widget qui correspond exactement a la phrase retapee (apres suppression des espaces autour), ou null.
export function widgetDeLaPhrase(widgets, texte) {
  const phrase = String(texte || "").trim();
  if (!phrase) return null;
  return widgets.find((w) => w.phrase === phrase) || null;
}

// Journal : une ligne par widget affiche (dans l'ordre de la page) ; seule la derniere porte « Annuler ».
export function lignesJournal(widgets, masques) {
  const actifs = widgetsAffiches(widgets, masques);
  return actifs.map((w, i) => ({ id: w.id, phrase: "« " + w.phrase + " »", annulable: i === actifs.length - 1 }));
}

// Applique une instruction. Rend { masques, message } ; masques est un nouvel ensemble, l'ancien n'est jamais modifie.
export function appliquerInstruction(widgets, masques, texte) {
  const phrase = String(texte || "").trim();
  if (!phrase) return { masques, message: MESSAGES_ESPACE.vide, vider: false };
  const cible = widgetDeLaPhrase(widgets, phrase);
  if (!cible) return { masques, message: MESSAGES_ESPACE.inconnue, vider: true };
  const suivant = new Set(masques);
  suivant.delete(cible.id);
  return { masques: suivant, message: messageFait(phrase), vider: true };
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
