// Recolte des vues 3D pour la messagerie (serveur de dev seulement, adresse http://localhost:5173/?vues=1).
//
// Un petit panneau fixe parcourt UNE PAR UNE les premieres collisions reelles de l'hopital : selection avec la fonction de la page
// Collision, attente de l'arrivee de la camera (callback existant du vol, pas de delai arbitraire), capture JPEG de la 3D, envoi au plugin
// Vite « recolteVues » (vite.config.js) qui ecrit public/images/vues/<id>.jpg et met a jour index.json.
//
// hooks (fournis par main.js) : { nombre, chargementTermine(), collisions(), ouvrirPageCollision(), sceneStable(), selectionner(collision, surArrivee),
//   capturer(largeurMax) -> Promise<dataUrl>, decrire(collision) -> metadonnees }
const LARGEUR_MAX = 640;
const DELAI_ARRIVEE_MS = 20000;
const DELAI_SCENE_MS = 60000;

const prochaineImage = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
async function laisserRendre() {
  // Deux images : la 3D se redessine avant toute capture ou toute collision suivante.
  await prochaineImage();
  await prochaineImage();
}

function attendre(condition, delaiMs, messageErreur) {
  return new Promise((resolve, reject) => {
    const debut = performance.now();
    const verifier = () => {
      if (condition()) resolve();
      else if (performance.now() - debut > delaiMs) reject(new Error(messageErreur));
      else setTimeout(verifier, 250);
    };
    verifier();
  });
}

function attendreArrivee(hooks, collision) {
  return new Promise((resolve, reject) => {
    const filet = setTimeout(() => reject(new Error("La caméra n'est pas arrivée à la collision " + collision.id + " (délai de " + DELAI_ARRIVEE_MS / 1000 + " s dépassé).")), DELAI_ARRIVEE_MS);
    hooks.selectionner(collision, () => {
      clearTimeout(filet);
      resolve();
    });
  });
}

async function envoyer(id, image, meta) {
  const reponse = await fetch("/__vues/" + encodeURIComponent(id), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image, meta })
  });
  if (!reponse.ok) throw new Error("Le serveur a refusé la vue " + id + " (" + reponse.status + ") : " + (await reponse.text()));
}

function creerPanneau() {
  const panneau = document.createElement("div");
  panneau.setAttribute("role", "region");
  panneau.setAttribute("aria-label", "Récolte des vues");
  panneau.style.cssText = "position:fixed;right:12px;bottom:12px;z-index:99990;width:min(320px,calc(100vw - 24px));padding:12px 14px;border-radius:10px;" +
    "background:#1f2822;color:#e4e1da;border:1px solid #7fae84;font:13px/1.4 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.5)";
  const titre = document.createElement("b");
  titre.textContent = "Récolte des vues";
  const message = document.createElement("p");
  message.setAttribute("role", "status");
  message.setAttribute("aria-live", "polite");
  message.style.cssText = "margin:6px 0 10px";
  const boutons = document.createElement("div");
  boutons.style.cssText = "display:flex;gap:8px";
  const demarrer = document.createElement("button");
  demarrer.type = "button";
  demarrer.textContent = "Démarrer";
  const annuler = document.createElement("button");
  annuler.type = "button";
  annuler.textContent = "Annuler";
  annuler.hidden = true;
  [demarrer, annuler].forEach((b) => {
    b.style.cssText = "min-height:40px;padding:6px 14px;border-radius:8px;border:1px solid #7fae84;background:none;color:inherit;font:inherit;font-weight:700;cursor:pointer";
  });
  demarrer.style.background = "#7fae84";
  demarrer.style.color = "#0f1612";
  boutons.append(demarrer, annuler);
  panneau.append(titre, message, boutons);
  document.body.appendChild(panneau);
  return { message, demarrer, annuler };
}

export function installerRecolteVues(hooks) {
  const { message, demarrer, annuler } = creerPanneau();
  let annulee = false;
  message.textContent = "Chargement des maquettes…";
  demarrer.disabled = true;

  attendre(hooks.chargementTermine, 10 * 60000, "Les maquettes ne se sont pas chargées.")
    .then(() => {
      message.textContent = "Maquettes chargées. Démarrer lance la récolte, une collision à la fois.";
      demarrer.disabled = false;
    })
    .catch((erreur) => { message.textContent = erreur.message; });

  annuler.addEventListener("click", () => {
    annulee = true;
    message.textContent = "Récolte annulée. Les vues déjà enregistrées sont conservées.";
    annuler.hidden = true;
  });

  demarrer.addEventListener("click", async () => {
    demarrer.hidden = true;
    annuler.hidden = false;
    const collisions = hooks.collisions().slice(0, hooks.nombre);
    try {
      message.textContent = "Ouverture de la page Collision…";
      hooks.ouvrirPageCollision();
      await attendre(hooks.sceneStable, DELAI_SCENE_MS, "La page Collision n'a pas fini de s'afficher.");
      for (let i = 0; i < collisions.length; i++) {
        if (annulee) return;
        message.textContent = "Vue " + (i + 1) + " sur " + collisions.length;
        await attendreArrivee(hooks, collisions[i]);
        await laisserRendre();
        if (annulee) return;
        const image = await hooks.capturer(LARGEUR_MAX);
        await envoyer(collisions[i].id, image, hooks.decrire(collisions[i]));
        await laisserRendre();
      }
      message.textContent = collisions.length + " vues enregistrées, tu peux fermer cet onglet.";
    } catch (erreur) {
      message.textContent = "Échec : " + erreur.message;
      console.error("[récolte des vues]", erreur);
    } finally {
      annuler.hidden = true;
    }
  });
}
