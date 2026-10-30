// Encart « Demande à l'IA » du rapport de Discussions (30/10) : un clic COPIE la phrase exacte validee dans la synthese.
// Le retour se voit DANS l'encart (data-etat : copier / copie / echec, libelles empiles dans une meme cellule de grille pour ne jamais changer sa taille),
// pendant DUREE_COPIE_MS, puis retour a « copier ». Annonce lecteur d'ecran par un role=status. Aucune bulle ni tooltip.
// Module sans dependance a la page : le document, le presse-papiers et le minuteur sont injectes (testable sans navigateur).

export const DUREE_COPIE_MS = 2000;
export const LIBELLES_COPIE = { copier: "Copier", copie: "Copié ✓", echec: "Non copié" };

export function creerEncartDemande({ doc = document, demande, zone, ecrire, planifier = setTimeout, annuler = clearTimeout }) {
  const creer = (tag, classe, texte) => {
    const el = doc.createElement(tag);
    if (classe) el.className = classe;
    if (texte != null) el.textContent = texte;
    return el;
  };
  const groupe = creer("div", "disc-rapport-demande-groupe");
  groupe.dataset.bloc = "demande-ia";
  const bouton = creer("button", "disc-rapport-demande");
  bouton.type = "button";
  bouton.dataset.etat = "copier";
  bouton.setAttribute("aria-label", "Demande à l'IA, à coller dans " + zone + " : " + demande.phrase + ". Copier la demande"); // commence par le texte visible (WCAG 2.5.3)
  const etat = creer("span", "disc-rapport-demande-etat");
  etat.setAttribute("aria-hidden", "true"); // l'etat est annonce par le role=status, le nom accessible reste stable
  for (const [cle, texte] of Object.entries(LIBELLES_COPIE)) {
    const libelle = creer("span", null, texte);
    libelle.dataset.libelle = cle;
    etat.append(libelle);
  }
  const tete = creer("span", "disc-rapport-demande-tete");
  tete.append(creer("span", "disc-rapport-demande-zone", "Demande à l'IA, à coller dans " + zone), etat);
  bouton.append(tete, creer("span", "disc-rapport-demande-phrase", "« " + demande.phrase + " »"));
  const annonce = creer("span", "disc-rapport-sr");
  annonce.setAttribute("role", "status");
  annonce.setAttribute("aria-live", "polite");

  let minuteur = null;
  const montrer = (cle, message) => {
    bouton.dataset.etat = cle;
    annonce.textContent = message;
    if (minuteur !== null) annuler(minuteur);
    minuteur = planifier(() => {
      minuteur = null;
      bouton.dataset.etat = "copier";
      annonce.textContent = "";
    }, DUREE_COPIE_MS);
  };
  bouton.addEventListener("click", async () => {
    try {
      await ecrire(demande.phrase);
      montrer("copie", "Demande copiée");
    } catch {
      montrer("echec", "Copie impossible"); // contexte non securise ou autorisation refusee : la phrase reste lisible a l'ecran
    }
  });
  groupe.append(bouton, annonce);
  return groupe;
}
