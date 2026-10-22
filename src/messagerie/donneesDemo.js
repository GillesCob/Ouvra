// ============================================================================
// DONNEES DE DEMONSTRATION DE LA MESSAGERIE : FICTIVES, A RETIRER AVANT TOUTE DEMONSTRATION PUBLIQUE
// ----------------------------------------------------------------------------
// Tout ce qui est fictif vit ici et dans ./corpus/*.json : les 7 personnes, les conversations, les textes ecrits a la main, les
// horodatages calcules par rapport a l'instant present, les non lus, les sujets et leur journal. Reprise de la section « Donnees de
// demonstration » du mockup Projets/Ouvra/mockups/ouvra-discussions-messagerie.html.
//
// Pour retirer la demonstration : supprimer ce fichier et le dossier corpus, puis faire renvoyer a messagerie.js un tableau de
// conversations vide (voir chargerDemo()). Aucun autre fichier ne contient de donnee de test.
// ============================================================================
import corpusDm from "./corpus/dm.json";
import corpusGroupes from "./corpus/groupes.json";
import corpusSujets from "./corpus/sujets.json";
import corpusCoordination from "./corpus/coordination.json";
import { creerFil, insererParDate, MOI } from "./messagerieDonnees.js";
import { aleatoire } from "./vuesMessagerie.js";

// teinte : angle de couleur de l'avatar (HSL).
export const PERSONNES = {
  me: { nom: "Vous", role: "BIM Manager", teinte: 140 },
  claire: { nom: "Claire Martin", role: "Architecte", teinte: 210 },
  karim: { nom: "Karim Benali", role: "BET Structure", teinte: 30 },
  sophie: { nom: "Sophie Lambert", role: "BET Fluides", teinte: 280 },
  julien: { nom: "Julien Roux", role: "Conducteur de travaux", teinte: 55 },
  marc: { nom: "Marc Dubois", role: "Projeteur", teinte: 175 },
  nadia: { nom: "Nadia Faure", role: "Maître d'ouvrage", teinte: 330 }
};

// Prises de vue de demonstration : le niveau et les maquettes ne sont qu'une legende, sans lien avec le texte du message.
const NIVEAUX_VUES = ["R-1", "R+0", "R+1", "R+2", "R+3"];
const JEUX_MAQUETTES = ["Architecture + Structure", "Structure + Mécanique", "Architecture + Mécanique", "Mécanique + Électricité", "Structure seule"];
const MOTS_AVEC_VUE = /coupe|maquette|collision|poutre|gaine|plan de|réservation|trémie|V4|axe/i;

// Associe des prises de vue a quelques messages. Le « seed » sert a la fois au schema de repli et au choix deterministe d'une image
// de la banque (voir attribuerBanque dans vuesMessagerie.js).
function ajouterVues(messages, graine, forcerPremier, max, indice) {
  const r = aleatoire(graine + 900);
  let n = 0;
  messages.forEach((m, i) => {
    const veut = (forcerPremier && i === 0) || (n < max && MOTS_AVEC_VUE.test(m.texte) && r() < 0.22);
    if (!veut) return;
    const niveauTrouve = /R[-+]\d/.exec((indice || "") + " " + m.texte);
    const niveau = niveauTrouve ? niveauTrouve[0] : NIVEAUX_VUES[Math.floor(r() * 5)];
    m.vue = { seed: graine * 31 + i, niveau, modeles: JEUX_MAQUETTES[Math.floor(r() * JEUX_MAQUETTES.length)] };
    n++;
  });
}

export function construireDemo(maintenant) {
  const NOW = maintenant;

  // Ramene une heure « il y a N minutes » dans la journee de travail (8 h a 19 h).
  function ilYaDansLaJournee(minutes, graine) {
    const r = aleatoire(graine * 7 + 3);
    const d = new Date(NOW.getTime() - minutes * 60000);
    if (d.getHours() < 8) {
      d.setDate(d.getDate() - 1);
      d.setHours(16, Math.floor(r() * 50), 0, 0);
    } else if (d.getHours() >= 19) {
      d.setHours(17, Math.floor(r() * 50), 0, 0);
    }
    return Math.max(0, (NOW.getTime() - d.getTime()) / 60000);
  }

  // [[auteur, texte], ...] -> messages horodates, le dernier « il y a finMinutes minutes ».
  function horodater(brut, finMinutes, graine) {
    const r = aleatoire(graine);
    let t = new Date(NOW.getTime() - finMinutes * 60000);
    const sortie = [];
    for (let i = brut.length - 1; i >= 0; i--) {
      sortie.unshift({ auteur: brut[i][0], quand: new Date(t.getTime()), texte: brut[i][1] });
      t = new Date(t.getTime() - (r() < 0.05 ? 120 + r() * 240 : 1 + r() * 14) * 60000);
    }
    return sortie;
  }

  // Liste d'echanges -> historique : chaque echange est decale de quelques heures a 2 jours.
  function horodaterEchanges(echanges, finMinutes, graine) {
    const r = aleatoire(graine);
    let sortie = [];
    let curseur = finMinutes;
    for (let e = echanges.length - 1; e >= 0; e--) {
      const ex = horodater(echanges[e], curseur, graine + e);
      sortie = ex.concat(sortie);
      const duree = (ex[ex.length - 1].quand - ex[0].quand) / 60000;
      curseur = ilYaDansLaJournee(curseur + duree + 300 + r() * 2300, graine + e + 50);
    }
    return sortie;
  }

  // 22/10 : non lus limites a 8 sur l'ensemble de la demonstration (demande de Gilles), le reste est marque comme lu.
  // Non lus : messages recus depuis ma derniere reponse, plafonnes.
  function nonLusDepuis(messages, plafond) {
    let n = 0;
    for (let i = messages.length - 1; i >= 0 && messages[i].auteur !== MOI && n < plafond; i--) n++;
    return n;
  }

  function filPrincipal(echanges, finMinutes, graine, plafond, mentions) {
    const messages = horodaterEchanges(echanges, finMinutes, graine);
    ajouterVues(messages, graine, false, 8);
    return creerFil(messages, nonLusDepuis(messages, plafond), mentions || 0);
  }

  // id : [titre, tagues, non lus, minutes depuis le dernier message, statut]
  const META_SUJETS = {
    c1: ["Cloison coupe-feu niveau 2", ["claire"], 0, 40, "encours"],
    c2: ["Plan de repérage des réservations", ["claire"], 0, 2900, "clos"],
    c3: ["Maquette V3 : retours", ["claire"], 0, 6200, "clos"],
    s1: ["Collision gaine DN200 / poutre axe C", ["sophie"], 2, 12, "attente"],
    s2: ["Passages en dalle", ["sophie"], 0, 4300, "clos"],
    k1: ["Poutre axe C : reprise de section", ["karim"], 0, 700, "encours"],
    j1: ["Accès grue semaine 44", ["julien"], 0, 5000, "clos"],
    gg1: ["Planning synthèse du 28/10", ["sophie", "karim", "claire"], 1, 30, "encours"],
    gg2: ["Remise des maquettes V4", ["karim", "sophie", "marc"], 0, 3100, "clos"],
    gg3: ["Accès chantier et plan d'installation", ["julien", "claire"], 0, 7800, "clos"],
    gc1: ["Réservations décalées R+2", ["julien", "marc"], 0, 150, "ouvert"],
    gc2: ["Réception du lot cloisons", ["julien"], 0, 6200, "clos"],
    gf1: ["Nomenclature des équipements", ["sophie", "marc"], 0, 900, "ouvert"],
    gx0: ["Réservations de la salle technique", ["karim", "sophie"], 0, 9000, "clos"],
    gx1: ["Cotes de la cage d'ascenseur", ["karim", "sophie"], 0, 10800, "clos"],
    gx2: ["Type de faux plafond du couloir", ["karim", "sophie"], 0, 12600, "clos"],
    gx3: ["Reprise du plan de coffrage R+1", ["karim", "sophie"], 0, 14400, "clos"],
    gx4: ["Local de stockage chantier", ["karim", "sophie"], 0, 16200, "clos"],
    gx5: ["Nomenclature des portes", ["karim", "sophie"], 0, 18000, "clos"],
    gx6: ["Trémies du noyau nord", ["karim", "sophie"], 0, 19800, "clos"]
  };

  function creerSujetDemo(id, graine) {
    const m = META_SUJETS[id];
    const messages = horodater(corpusSujets[id], ilYaDansLaJournee(m[3], graine), graine);
    ajouterVues(messages, graine, true, 3, m[0]);
    return Object.assign(creerFil(messages, Math.min(m[2], messages.length), 0), { id, titre: m[0], tagues: m[1], statut: m[4], urgent: false });
  }
  const sujetsDe = (ids, graine) => ids.map((id, i) => creerSujetDemo(id, graine + i * 3));

  // Coordination tous lots : de tres nombreux sujets en parallele.
  const sujetsCoordination = corpusCoordination.subjects.map((s, i) => {
    const messages = horodater(s.msgs, ilYaDansLaJournee(s.status === "clos" ? 4000 + i * 700 : 40 + i * 160, 900 + i), 900 + i);
    ajouterVues(messages, 900 + i, true, 2, s.title);
    return Object.assign(creerFil(messages, 0, 0), { id: s.id, titre: s.title, tagues: s.tagged, statut: s.status, urgent: false });
  });

  const TOUS = ["me", "claire", "karim", "sophie", "julien", "marc", "nadia"];
  const conv = (id, type, nom, membres, sousTitre, principal, sujets) => ({ id, type, nom, membres, sousTitre, principal, sujets });
  const conversations = [
    conv("claire", "individuel", "Claire Martin", ["me", "claire"], "Architecte", filPrincipal(corpusDm.claire, 95, 11, 0), sujetsDe(["c1", "c2", "c3"], 120)),
    conv("sophie", "individuel", "Sophie Lambert", ["me", "sophie"], "BET Fluides", filPrincipal(corpusDm.sophie, 12, 21, 2), sujetsDe(["s1", "s2"], 220)),
    conv("karim", "individuel", "Karim Benali", ["me", "karim"], "BET Structure", filPrincipal(corpusDm.karim, 1500, 31, 0), sujetsDe(["k1"], 320)),
    conv("julien", "individuel", "Julien Roux", ["me", "julien"], "Conducteur de travaux", filPrincipal(corpusDm.julien, 2900, 51, 0), sujetsDe(["j1"], 420)),

    conv("g-general", "groupe", "Projet Hôpital : général", TOUS, "7 participants", filPrincipal(corpusGroupes["g-general"], 25, 71, 2, 2),
      sujetsDe(["gg1", "gg2", "gg3", "gx0", "gx1", "gx2", "gx3", "gx4", "gx5", "gx6"], 520)),
    conv("g-coord", "groupe", "Coordination tous lots", TOUS, "7 participants", filPrincipal(corpusCoordination.main, 55, 81, 0), sujetsCoordination),
    conv("g-chantier", "groupe", "Chantier : terrain", ["me", "julien", "claire", "marc"], "4 participants", filPrincipal(corpusGroupes["g-chantier"], 140, 91, 1),
      sujetsDe(["gc1", "gc2"], 620)),
    conv("g-structure", "groupe", "Lot Structure", ["me", "karim", "claire", "marc"], "4 participants", filPrincipal(corpusGroupes["g-structure"], 410, 101, 0), []),
    conv("g-fluides", "groupe", "Lots fluides", ["me", "sophie", "marc", "julien"], "4 participants", filPrincipal(corpusGroupes["g-fluides"], 1700, 111, 0),
      sujetsDe(["gf1"], 720)),
    conv("g-synthese", "groupe", "Synthèse hebdomadaire", ["me", "claire", "karim", "sophie"], "4 participants", filPrincipal(corpusGroupes["g-synthese"], 5400, 121, 0), [])
  ];

  // Deux sujets non clos marques urgents (un en 1 a 1, un dans la coordination).
  conversations.find((c) => c.id === "sophie").sujets.find((s) => s.id === "s1").urgent = true;
  conversations.find((c) => c.id === "g-coord").sujets.find((s) => s.statut !== "clos").urgent = true;

  // « general » : conversation proposee par defaut pour un sujet cree depuis le Viewer.
  conversations.find((c) => c.id === "g-general").general = true;

  // Le principal garde la trace des sujets ouverts / clos ; chaque sujet garde son journal de statuts.
  conversations.forEach((c) => {
    c.sujets.forEach((s) => {
      const ancre = s.messages[0].quand;
      insererParDate(c.principal.messages, {
        systeme: true, genre: "ouverture", sujetId: s.id, quand: new Date(ancre.getTime() - 60000),
        auteur: s.messages[0].auteur, titre: s.titre, tagues: s.tagues
      });
      if (s.statut === "encours" || s.statut === "attente") {
        const i = Math.max(1, s.messages.length - 4);
        s.messages.splice(i, 0, {
          systeme: true, genre: "statut", statut: s.statut, auteur: s.tagues[0], quand: new Date(s.messages[i - 1].quand.getTime() + 1000)
        });
      }
      if (s.statut === "clos") {
        s.closPar = s.tagues[0];
        s.closLe = new Date(s.messages[s.messages.length - 1].quand.getTime() + 5 * 60000);
        s.messages.push({ systeme: true, genre: "cloture", auteur: s.closPar, quand: s.closLe });
        insererParDate(c.principal.messages, { systeme: true, genre: "cloture", sujetId: s.id, quand: s.closLe, auteur: s.closPar, titre: s.titre, tagues: [] });
      }
    });
  });

  return { personnes: PERSONNES, conversations };
}
