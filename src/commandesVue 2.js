// Viewer par commande (24/10) : la VUE COURANTE cumulative. Une commande ne remplace plus la precedente : elle s'ajoute a une PILE d'etapes, et la vue
// est recalculee depuis la pile. Calculs purs, sans DOM ni scene (la scene est rendue par src/commandesFlux.js).
//
// FACETTES : un critere par selecteur (maquettes, niveaux, typesIfc, noms, elements, zones). Une facette = { valeurs, exclues } ; la vue visible est
// l'INTERSECTION de toutes les facettes actives (valeurs non vides = l'element doit en satisfaire une ; exclues = il ne doit satisfaire aucune).
// Une commande ne touche que les facettes qu'elle MENTIONNE ; les autres persistent. Par facette mentionnee, un MODE :
//   remplacer (defaut) : « uniquement la maquette structure » remplace la facette maquettes, les niveaux restent ;
//   ajouter : union avec les valeurs de la facette (une valeur exclue est d'abord reintegree) ; sur une facette inactive il n'y a rien a ajouter (tout est deja
//     visible pour ce critere) : la commande est refusee comme sans effet ;
//   retirer : enleve la valeur de la facette ; sur une facette inactive, elle devient une exclusion (« tout sauf le niveau 2 ») ; si la facette n'avait que
//     cette valeur, elle redevient inactive.
// COMPOSITION des presentations (voir src/commandesPresentations.js) : « restreint » (isoler, niveau_repere, zone) met a jour les facettes et le style de la vue ;
// « couche » (evidence, transparence, masquer) agit sur ce qui est visible, les couches s'empilent ; « focus » est temporaire : une commande acceptee ensuite
// le fait tomber, un nouveau focus le remplace. `repartir` efface facettes, couches et focus avant la commande.
// Module sans dependance a main.js ni au DOM.

import { normaliser } from "./reglesCollision.js";
import { SELECTEURS, FILTRES_CONTEXTE, nomMode } from "./commandesSelecteurs.js";
import { PRESENTATIONS, presentationEffective } from "./commandesPresentations.js";

const STYLES_VUE = ["isoler", "niveau_repere", "zone"];
const cle = (valeur) => normaliser(valeur).trim();

// Les criteres du CONTEXTE (maquettes, types gardes autour de la selection) sont des facettes comme les autres, avec leurs modes ; `sansContexte` (aucun
// contexte du tout) est un drapeau : « avec la structure en contexte » ou « ajoute l'architecture au contexte » le leve.
const nomsSelection = () => SELECTEURS.noms();
const nomsContexte = () => FILTRES_CONTEXTE.noms();
const toutesLesFacettes = () => [...nomsSelection(), ...nomsContexte()];

function etatVide() {
  const facettes = {};
  for (const nom of toutesLesFacettes()) facettes[nom] = { valeurs: [], exclues: [] };
  return { facettes, sansContexte: false, style: "isoler", couches: [], focus: null };
}

const copie = (etat) => ({
  facettes: Object.fromEntries(Object.entries(etat.facettes).map(([nom, f]) => [nom, { valeurs: f.valeurs.slice(), exclues: f.exclues.slice() }])),
  sansContexte: etat.sansContexte,
  style: etat.style,
  couches: etat.couches.slice(),
  focus: etat.focus
});

function appliquerMode(facette, mode, valeurs) {
  const cles = valeurs.map(cle);
  const sans = (liste) => liste.filter((v) => !cles.includes(cle(v)));
  if (mode === "ajouter") {
    // Rien a ajouter sur une facette inactive : tout est deja visible pour ce critere.
    if (!facette.valeurs.length && !facette.exclues.length) return facette;
    const reintegrees = facette.exclues.filter((v) => cles.includes(cle(v)));
    const nouvelles = valeurs.filter((v) => !facette.valeurs.some((x) => cle(x) === cle(v)) && !reintegrees.some((x) => cle(x) === cle(v)));
    return { valeurs: facette.valeurs.length ? [...facette.valeurs, ...nouvelles] : facette.valeurs, exclues: sans(facette.exclues) };
  }
  if (mode === "retirer") {
    if (facette.valeurs.length) return { valeurs: sans(facette.valeurs), exclues: facette.exclues };
    return { valeurs: [], exclues: [...facette.exclues, ...valeurs.filter((v) => !facette.exclues.some((x) => cle(x) === cle(v)))] };
  }
  return { valeurs: valeurs.slice(), exclues: [] }; // remplacer
}

export const compositionDe = (parametres) => {
  const presentation = PRESENTATIONS.trouver(presentationEffective(parametres));
  return presentation ? presentation.composition || "restreint" : "restreint";
};

// Rejoue la pile (etapes = commandes validees { action: "afficher", parametres }). Rend { ok: true, etat }, ou { ok: false, message, etat } quand la DERNIERE etape
// ne change rien a la vue (l'etat est rendu quand meme). Les etapes anterieures ne sont jamais refusees (elles ont ete acceptees telles quelles).
export function reduire(pile) {
  let etat = etatVide();
  let changement = true;
  pile.forEach((etape) => {
    const p = etape.parametres;
    const avant = etat;
    if (p.repartir) etat = etatVide();
    etat = copie(etat);
    etat.focus = null; // le focus est temporaire : toute etape suivante le fait tomber
    const composition = compositionDe(p);
    if (composition === "focus") {
      etat.focus = etape;
      changement = true;
    } else if (composition === "couche") {
      etat.couches.push(etape);
      changement = true;
    } else {
      for (const nom of nomsSelection()) {
        const valeurs = p[nom];
        if (Array.isArray(valeurs) && valeurs.length) etat.facettes[nom] = appliquerMode(etat.facettes[nom], p[nomMode(nom)] || "remplacer", valeurs);
      }
      if (p.sansContexte) {
        for (const nom of nomsContexte()) etat.facettes[nom] = { valeurs: [], exclues: [] };
        etat.sansContexte = true;
      }
      for (const nom of nomsContexte()) {
        const valeurs = p[nom];
        if (!Array.isArray(valeurs) || !valeurs.length) continue;
        // Apres « sans contexte », le contexte est un ensemble VIDE (et non inactif) : y ajouter une valeur revient a le definir.
        const mode = etat.sansContexte && p[nomMode(nom)] === "ajouter" ? "remplacer" : p[nomMode(nom)] || "remplacer";
        etat.facettes[nom] = appliquerMode(etat.facettes[nom], mode, valeurs);
        if (mode !== "retirer") etat.sansContexte = false;
      }
      // Le style ne change que si la commande parle de la selection ou choisit une autre presentation : « sans contexte » seul laisse le style de la vue.
      const parleDeSelection = nomsSelection().some((nom) => Array.isArray(p[nom]) && p[nom].length);
      const style = presentationEffective(p);
      if (parleDeSelection || style !== "isoler") etat.style = STYLES_VUE.includes(style) ? style : "isoler";
      changement = p.repartir || JSON.stringify([etat.facettes, etat.sansContexte]) !== JSON.stringify([avant.facettes, avant.sansContexte]) || etat.style !== avant.style;
    }
  });
  if (!changement) return { ok: false, message: "Cette demande ne change rien à la vue actuelle.", etat };
  return { ok: true, etat };
}

// Criteres a envoyer au moteur pour la vue de fond : inclusions, exclusions et style. Le style « zone » exige une zone active, sinon il retombe sur « isoler ».
export function criteresDeLaVue(etat) {
  const inclusions = {};
  const exclusions = {};
  for (const [nom, f] of Object.entries(etat.facettes)) {
    if (f.valeurs.length) inclusions[nom] = f.valeurs;
    if (f.exclues.length) exclusions[nom] = f.exclues;
  }
  const style = etat.style === "zone" && !inclusions.zones ? "isoler" : etat.style;
  const selection = (nom) => nomsSelection().includes(nom);
  const reste = Object.keys(inclusions).filter(selection).length + Object.keys(exclusions).filter(selection).length;
  return { inclusions, exclusions, style, sansContexte: etat.sansContexte, actif: reste > 0 };
}

// Resume de la vue actuelle EN MOTS pour l'IA (listes bornees, rien d'autre que du texte) : facettes actives, exclusions, couches, nombre d'etapes.
export const BORNE_VALEURS = 12;
export const BORNE_COUCHES = 6;

export function resumerVue(pile) {
  const { etat } = reduire(pile);
  const facettes = {};
  const exclues = {};
  for (const [nom, f] of Object.entries(etat.facettes)) {
    if (f.valeurs.length) facettes[nom] = f.valeurs.slice(0, BORNE_VALEURS);
    if (f.exclues.length) exclues[nom] = f.exclues.slice(0, BORNE_VALEURS);
  }
  return {
    etapes: pile.length,
    facettes,
    exclues,
    sansContexte: !!etat.sansContexte,
    couches: etat.couches.slice(0, BORNE_COUCHES).map((e) => String(e.relecture || "").slice(0, 160)).filter(Boolean),
    focus: etat.focus ? String(etat.focus.relecture || "").slice(0, 160) : ""
  };
}
