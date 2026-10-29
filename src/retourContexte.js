// Bandeau « ← Retour a ... » generique (24/10), pose par une page qui envoie l'utilisateur voir autre chose dans le Viewer (Quantitatif : « Voir »).
// Meme composant visuel et meme placement que #msgBandeauRetour (« ← Retour a la conversation ») et #reglesBandeauRetour (« ← Retour a la regle »).
// Le bandeau ne sait RIEN de la page d'origine : celle-ci lui donne, au moment de l'envoi, un rappel `{ libelle, surRetour }`. Un clic appelle ce rappel
// une seule fois, c'est tout : si la page evolue demain, le retour continue de fonctionner (c'est la page qui sait se rouvrir).
//  - un seul bandeau de retour a la fois, le plus recent gagne (montrer() remplace) ; il disparait au clic, ou sur effacer() (changement de page),
//    ou des qu'un autre bandeau de retour (classes de corps `autresClasses`) s'affiche ;
//  - le corps recoit `classeCorps` tant qu'il est visible : la feuille de style y decale la barre d'outils du Viewer sous le bandeau.
// Deux couches : creerCoeurRetour (etat, pur, teste sans DOM) et creerRetourContexte (DOM).

export function creerCoeurRetour() {
  let courant = null; // { libelle, surRetour } ou null
  let abonnes = [];
  const notifier = () => abonnes.forEach((f) => f(courant));
  return {
    contexte: () => courant,
    actif: () => courant !== null,
    surChangement: (f) => { abonnes.push(f); },
    // Le plus recent gagne. Un contexte sans libelle ou sans rappel est refuse (rien n'est affiche).
    montrer(contexte) {
      if (!contexte || typeof contexte.libelle !== "string" || !contexte.libelle || typeof contexte.surRetour !== "function") return false;
      courant = { libelle: contexte.libelle, surRetour: contexte.surRetour };
      notifier();
      return true;
    },
    effacer() {
      if (courant === null) return false;
      courant = null;
      notifier();
      return true;
    },
    // Clic : le bandeau disparait d'abord, puis le rappel est appele UNE fois. Rend vrai si un rappel a ete appele.
    declencher() {
      if (courant === null) return false;
      const { surRetour } = courant;
      courant = null;
      notifier();
      surRetour();
      return true;
    }
  };
}

// Retour du systeme (geste, bouton arriere) : une entree d'historique est posee a l'ouverture du bandeau et consommee a sa fermeture, meme principe que
// « ← Retour au rapport » des Discussions. `surRetourSysteme` est appele quand l'utilisateur recule ; `liberer` rend l'entree (retour par le bandeau, changement
// de page) et ignore le popstate que ce recul provoque. win : window (injecte pour les tests).
export function creerEntreeHistorique(win, surRetourSysteme) {
  let posee = false;
  let ignorer = false;
  if (win && win.addEventListener) {
    win.addEventListener("popstate", () => {
      if (ignorer) { ignorer = false; return; }
      if (!posee) return;
      posee = false;
      surRetourSysteme();
    });
  }
  return {
    poser() {
      if (posee || !win || !win.history || !win.history.pushState) return;
      win.history.pushState({ ouvraRetourContexte: true }, "");
      posee = true;
    },
    liberer() {
      if (!posee) return;
      posee = false;
      ignorer = true;
      win.history.back();
    }
  };
}

// doc : document ; id : identifiant du bandeau ; classeCorps : classe posee sur body tant qu'il est visible ; ariaLabel : nom accessible de la region.
export function creerRetourContexte({ doc = document, id, classeCorps, ariaLabel = "Retour", autresClasses = [], retourSysteme = false }) {
  const coeur = creerCoeurRetour();
  // retourSysteme : le geste ou le bouton arriere du systeme declenchent le meme retour que le bandeau.
  const historique = retourSysteme && typeof window !== "undefined" ? creerEntreeHistorique(window, () => coeur.declencher()) : null;
  let bandeau = null;
  let bouton = null;

  function construire() {
    bandeau = doc.createElement("div");
    bandeau.id = id;
    bandeau.setAttribute("role", "region");
    bandeau.setAttribute("aria-label", ariaLabel);
    bandeau.hidden = true;
    bouton = doc.createElement("button");
    bouton.type = "button";
    bandeau.appendChild(bouton);
    bandeau.addEventListener("click", (e) => { if (e.target && e.target.closest && e.target.closest("button")) coeur.declencher(); });
    doc.body.appendChild(bandeau);
  }

  coeur.surChangement((contexte) => {
    if (historique) { if (contexte) historique.poser(); else historique.liberer(); }
    if (contexte && !bandeau) construire();
    if (!bandeau) return;
    if (contexte) bouton.textContent = "← " + contexte.libelle;
    bandeau.hidden = !contexte;
    doc.body.classList.toggle(classeCorps, !!contexte);
  });

  // Un autre bandeau de retour qui apparait prend la place : celui-ci s'efface (le plus recent gagne).
  if (autresClasses.length && typeof MutationObserver === "function") {
    new MutationObserver(() => { if (coeur.actif() && autresClasses.some((c) => doc.body.classList.contains(c))) coeur.effacer(); })
      .observe(doc.body, { attributes: true, attributeFilter: ["class"] });
  }

  return { montrer: coeur.montrer, effacer: coeur.effacer, actif: coeur.actif, contexte: coeur.contexte, declencher: coeur.declencher };
}
