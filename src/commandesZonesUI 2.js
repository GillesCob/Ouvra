// Viewer par commande (24/10) : le bouton « Zone » du Viewer et sa fenetre « Zones nommees ». Une zone est un volume (boite englobante) auquel
// l'utilisateur donne un nom ; « Affiche la zone Bloc operatoire » l'isole ensuite (src/commandesZones.js). Deux facons de la definir :
//  - « Depuis l'element selectionne » : la boite de l'element, agrandie de la marge choisie ;
//  - « Cliquer dans la maquette » : la fenetre se ferme, le clic suivant dans la 3D pose un cube de demi-cote egal a la marge, puis la fenetre revient.
// La liste des zones existantes est dans la fenetre, chacune avec « Supprimer ». Les zones sont sauvegardees par src/commandesZones.js (localStorage).
// Modale accessible : role dialog, focus dans la fenetre, Tab qui boucle, Echap qui ferme, focus rendu au bouton.
// Module sans dependance a main.js : tout passe par les parametres de creerZonesUI.
//   bouton : le bouton « Zone » (index.html) ; zones : creerZones() ; elementSelectionne() : boite [6 nombres] de l'element selectionne, ou null
//   armerClic(rappel) : le prochain clic dans la 3D appelle rappel([x, y, z]) (ou rappel(null) si rien n'est touche) ; annulerClic() : desarme
//   fermerAutres() : ferme les menus voisins ; surChangement() : appele quand la liste des zones change

import "./reglesIA.css";
import "./commandesIA.css";
import { aabbAutourDeLaBoite, aabbAutourDuPoint, MARGE_DEFAUT_M, NOM_MAX } from "./commandesZones.js";

function creer(tag, classe, texte) {
  const el = document.createElement(tag);
  if (classe) el.className = classe;
  if (texte != null) el.textContent = texte;
  return el;
}

export function creerZonesUI({ bouton, zones, elementSelectionne, armerClic, annulerClic, fermerAutres = () => {}, surChangement = () => {} }) {
  bouton.setAttribute("aria-haspopup", "dialog");

  const fond = creer("div", "regles-ia-fond");
  fond.id = "commandesZonesFond";
  fond.hidden = true;
  const carte = creer("div", "regles-ia-carte commandes-zones-carte");
  carte.setAttribute("role", "dialog");
  carte.setAttribute("aria-modal", "true");
  carte.setAttribute("aria-labelledby", "commandesZonesTitre");
  fond.appendChild(carte);

  const titre = creer("h3", "commandes-zones-titre", "Zones nommées");
  titre.id = "commandesZonesTitre";
  const aide = creer("p", "commandes-zones-aide", "Un volume que tu nommes. Ensuite : « Affiche la zone Bloc opératoire ».");

  const champNom = creer("input");
  champNom.type = "text";
  champNom.maxLength = NOM_MAX;
  champNom.autocomplete = "off";
  champNom.placeholder = "Nom de la zone, ex. : Bloc opératoire";
  champNom.setAttribute("aria-label", "Nom de la zone");

  const champMarge = creer("input");
  champMarge.type = "number";
  champMarge.min = "0.5";
  champMarge.max = "50";
  champMarge.step = "0.5";
  champMarge.value = String(MARGE_DEFAUT_M);
  champMarge.setAttribute("aria-label", "Marge autour de l'élément ou demi-côté de la zone, en mètres");
  const ligneMarge = creer("label", "commandes-zones-marge");
  ligneMarge.append(creer("span", null, "Marge ou demi-côté (m)"), champMarge);

  const depuisSelection = creer("button", "commandes-zones-action", "Depuis l'élément sélectionné");
  depuisSelection.type = "button";
  const parClic = creer("button", "commandes-zones-action", "Cliquer dans la maquette");
  parClic.type = "button";
  const actions = creer("div", "commandes-zones-actions");
  actions.append(depuisSelection, parClic);

  const etat = creer("p", "regles-ia-etat");
  etat.setAttribute("role", "status");
  etat.hidden = true;
  const liste = creer("ul", "commandes-zones-liste");
  const fermer = creer("button", "commandes-zones-fermer", "Fermer");
  fermer.type = "button";
  carte.append(titre, aide, champNom, ligneMarge, actions, etat, liste, fermer);
  document.body.appendChild(fond);

  const ouverte = () => !fond.hidden;
  let attenteClic = false;

  function afficherEtat(texte, erreur) {
    etat.textContent = texte || "";
    etat.hidden = !texte;
    etat.classList.toggle("erreur", !!erreur);
  }

  function marge() {
    const valeur = Number(champMarge.value);
    return Number.isFinite(valeur) && valeur >= 0.5 && valeur <= 50 ? valeur : MARGE_DEFAUT_M;
  }

  function dessinerListe() {
    liste.textContent = "";
    const toutes = zones.lister();
    if (!toutes.length) {
      liste.appendChild(creer("li", "commandes-zones-vide", "Aucune zone pour l'instant."));
      return;
    }
    toutes.forEach((zone) => {
      const li = creer("li");
      li.appendChild(creer("span", "commandes-zones-nom", zone.nom));
      const supprimer = creer("button", "commandes-zones-supprimer", "Supprimer");
      supprimer.type = "button";
      supprimer.setAttribute("aria-label", "Supprimer la zone " + zone.nom);
      supprimer.addEventListener("click", () => {
        zones.supprimer(zone.nom);
        dessinerListe();
        afficherEtat("Zone « " + zone.nom + " » supprimée.", false);
        surChangement();
      });
      li.appendChild(supprimer);
      liste.appendChild(li);
    });
  }

  function enregistrer(aabb) {
    const resultat = zones.ajouter(champNom.value, aabb);
    if (!resultat.ok) {
      afficherEtat(resultat.message, true);
      champNom.focus({ preventScroll: true });
      return;
    }
    champNom.value = "";
    dessinerListe();
    afficherEtat("Zone « " + resultat.nom + " » enregistrée. Dis par exemple : Affiche la zone " + resultat.nom + ".", false);
    surChangement();
  }

  function ouvrir() {
    fermerAutres();
    fond.hidden = false;
    dessinerListe();
    afficherEtat("", false);
    champNom.focus({ preventScroll: true });
  }

  function fermerFenetre(rendreFocus) {
    if (attenteClic) { attenteClic = false; annulerClic(); }
    if (!ouverte()) return;
    fond.hidden = true;
    if (rendreFocus) bouton.focus({ preventScroll: true });
  }

  depuisSelection.addEventListener("click", () => {
    const boite = aabbAutourDeLaBoite(elementSelectionne(), marge());
    if (!boite) { afficherEtat("Sélectionne d'abord un élément dans la maquette, ou clique dans la maquette.", true); return; }
    enregistrer(boite);
  });

  // Le nom est verifie AVANT de fermer la fenetre : pas de clic dans la 3D pour une zone qui sera refusee.
  parClic.addEventListener("click", () => {
    if (!champNom.value.trim()) { afficherEtat("Donne d'abord un nom à la zone.", true); champNom.focus({ preventScroll: true }); return; }
    attenteClic = true;
    fond.hidden = true;
    armerClic((point) => {
      attenteClic = false;
      fond.hidden = false;
      const boite = aabbAutourDuPoint(point, marge());
      if (!boite) { afficherEtat("Rien n'a été touché dans la maquette. Réessaie.", true); champNom.focus({ preventScroll: true }); return; }
      enregistrer(boite);
    });
  });

  champNom.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); depuisSelection.click(); } });
  fermer.addEventListener("click", () => fermerFenetre(true));
  fond.addEventListener("click", (e) => { if (e.target === fond) fermerFenetre(true); });
  carte.addEventListener("click", (e) => e.stopPropagation());
  bouton.addEventListener("click", (e) => { e.stopPropagation(); if (ouverte()) fermerFenetre(true); else ouvrir(); });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && attenteClic) { e.preventDefault(); attenteClic = false; annulerClic(); fond.hidden = false; champNom.focus({ preventScroll: true }); return; }
    if (!ouverte()) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); fermerFenetre(true); return; }
    if (e.key !== "Tab") return;
    const cibles = [...carte.querySelectorAll("button, input")].filter((el) => !el.disabled && el.offsetParent !== null);
    if (!cibles.length) return;
    const premier = cibles[0];
    const dernier = cibles[cibles.length - 1];
    if (e.shiftKey && (document.activeElement === premier || !carte.contains(document.activeElement))) { e.preventDefault(); dernier.focus(); }
    else if (!e.shiftKey && document.activeElement === dernier) { e.preventDefault(); premier.focus(); }
  }, true);

  return { fermer: () => fermerFenetre(false), ouverte };
}
