// Flou de la demande IA (29/10, decision de Gilles) : tant que le bandeau « Est-ce bien votre demande ? » (Oui / Non) n'a pas recu de reponse, TOUT LE RESTE de la page
// (barre de navigation comprise) est flou et inaccessible ; seul le bandeau reste net et actif. Un seul mecanisme pour le Viewer, Discussions, Quantitatif et le plan 2D → 3D.
//
// Un calque plein ecran (#flouDemande, backdrop-filter, bloque clics et defilement) se place sous le bandeau et au-dessus du reste (regles dans src/commandesIA.css) ; le focus clavier
// est ramene sur le bandeau. Le flou est pose par chaque bandeau a son affichage (poser) et leve a sa disparition (lever) : Oui, Non, erreur, expiration. Filet de securite : si un bandeau
// disparait sans appeler lever (changement de vue, element retire ou masque par un autre chemin), l'observateur du DOM le detecte et leve le flou : jamais de page bloquee.

const CLASSE = "flou-demande-actif";

// Coeur pur (sans DOM, teste a part) : les bandeaux qui demandent le flou, par cle. Le flou est actif tant qu'au moins un bandeau est enregistre.
export function creerCoeurFlou() {
  const bandeaux = new Map();
  return {
    poser(cle, element) { bandeaux.set(cle, element || null); return true; },
    lever(cle) { return bandeaux.delete(cle); },
    // Retire les bandeaux dont estVisible(element) est faux ; renvoie les cles retirees.
    purger(estVisible) {
      const retirees = [];
      for (const [cle, element] of bandeaux) if (element && !estVisible(element)) { bandeaux.delete(cle); retirees.push(cle); }
      return retirees;
    },
    actif: () => bandeaux.size > 0,
    elements: () => [...bandeaux.values()].filter(Boolean)
  };
}

const coeur = creerCoeurFlou();
let calque = null;
let observateur = null;

function visible(el) {
  if (!el.isConnected || el.hidden) return false;
  if (typeof el.checkVisibility === "function") return el.checkVisibility();
  return el.getClientRects().length > 0;
}

function appliquer() {
  const actif = coeur.actif();
  if (actif && !calque) {
    calque = document.createElement("div");
    calque.id = "flouDemande";
    calque.setAttribute("aria-hidden", "true");
    document.body.appendChild(calque);
  }
  document.body.classList.toggle(CLASSE, actif);
  if (calque) calque.hidden = !actif;
  if (actif && !observateur && typeof MutationObserver === "function") {
    observateur = new MutationObserver(() => { if (coeur.purger(visible).length) appliquer(); });
    observateur.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["hidden", "style", "class"] });
  } else if (!actif && observateur) { observateur.disconnect(); observateur = null; }
}

// Le clavier ne quitte pas le bandeau : Tab ne peut pas atteindre le reste de la page floutee.
if (typeof document !== "undefined") document.addEventListener("focusin", (e) => {
  if (!coeur.actif()) return;
  const cible = e.target;
  if (coeur.elements().some((el) => el.contains(cible))) return;
  const bandeau = coeur.elements()[0];
  const oui = bandeau && bandeau.querySelector('[data-act="oui"]');
  if (oui) oui.focus({ preventScroll: true });
}, true);

export function poserFlou(cle, element) { coeur.poser(cle, element); appliquer(); }
export function leverFlou(cle) { if (coeur.lever(cle)) appliquer(); }
export function flouActif() { return coeur.actif(); }
