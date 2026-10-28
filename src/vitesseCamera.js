// Vitesse de navigation de la camera du Viewer (curseur #cameraSpeedSlider, 10 a 100 %).
// Defaut 50 % pour tous (28/10 : usage au pave tactile pendant la demo). Avant : 30 % sur mobile, 100 % sur ordinateur.
export const VITESSE_CAMERA_DEFAUT = 50;
export const VITESSE_CAMERA_MIN = 10;
export const VITESSE_CAMERA_MAX = 100;

// memorisee : texte lu dans localStorage (ou null). Une valeur memorisee lisible reste prioritaire.
export function vitesseCameraInitiale(memorisee) {
  const valeur = parseInt(memorisee, 10);
  if (!Number.isFinite(valeur)) return VITESSE_CAMERA_DEFAUT;
  return Math.max(VITESSE_CAMERA_MIN, Math.min(VITESSE_CAMERA_MAX, valeur));
}
