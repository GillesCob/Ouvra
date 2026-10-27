import type { BrowserContext, Page } from "playwright-core";

export type TAppareil = "laptop" | "mobile";

/** OK : toutes les assertions passent. KO : une assertion echoue (defaut probable de l'application). ERR : le script a plante, cause non etablie, a ne pas lire comme un defaut de l'application. N/A : le test n'existe pas sur cet appareil. */
export type TStatut = "OK" | "KO" | "ERR" | "N/A";

export interface IControle {
  libelle: string;
  ok: boolean;
  observe: string;
  /** Vrai pour une assertion volontairement non jouee (fonctionnalite masquee dans l'application) : compte comme reussie mais figure dans le detail. */
  saute?: boolean;
}

export interface IResultatAppareil {
  statut: TStatut;
  controles: IControle[];
  /** Cause courte du premier echec (KO ou ERR), vide si OK. */
  cause: string;
  dureeMs: number;
}

/** Appel `/api/*` intercepte par le harnais : jamais envoye au vrai relais. */
export interface IAppelApi {
  chemin: string;
  corps: unknown;
  simule: boolean;
}

export type TReponseApi = Record<string, unknown>;
export type TSimulateurApi = (corps: Record<string, unknown>) => TReponseApi | Promise<TReponseApi>;

export interface IVerificateur {
  /** Enregistre une assertion. `observe` est la valeur lue dans le DOM ou le reseau, ecrite dans le rapport en cas d'echec. */
  controle(libelle: string, ok: boolean, observe?: unknown): void;
  /** Assertion non jouee parce que la fonctionnalite n'existe pas dans la version testee (ex. bouton masque par un interrupteur). Jamais un OK deguise : la raison est consignee. */
  saute(libelle: string, raison: string): void;
}

export interface IPageSuivie extends Page {
  erreursPage: string[];
}

export interface IContexteTest {
  appareil: TAppareil;
  /** URL de base de l'application (version construite ou serveur indique par --url), toujours terminee par « / ». */
  urlBase: string;
  contexte: BrowserContext;
  verif: IVerificateur;
  /** Ouvre une page neuve sur l'application (`hash` : « #viewer », « #quantitatif »...) et attend la fin du chargement. */
  ouvrir(hash?: string): Promise<IPageSuivie>;
  /** Declare la reponse simulee d'un endpoint `/api/...`. Sans simulateur, l'appel rend « ia_indisponible » et est journalise comme non simule. */
  simulerApi(chemin: string, simulateur: TSimulateurApi): void;
  appelsApi: IAppelApi[];
  /** Modifie la reponse d'un HEAD sur les maquettes .xkt (ETag), pour tester l'obsolescence sans toucher aux fichiers. */
  simulerEtag(valeurs: { mecanique: string; architecture: string }): void;
  /** Dossier temporaire du test pour les telechargements. */
  dossierTelechargements: string;
}

export type TFonctionTest = (ctx: IContexteTest) => Promise<void>;

export interface ITestDef {
  /** Numero de seance (Test 1, 2, 3...), pas l'identifiant R-xx du plan complet. */
  numero: number;
  nom: string;
  /** Identifiants du plan complet couverts par les assertions de ce test, tels que Projets/Ouvra/recette-2026-10-27.md. */
  couvre: string[];
  laptop?: TFonctionTest;
  mobile?: TFonctionTest;
}

export interface INonAutomatisable {
  numero: number | null;
  libelle: string;
  raison: string;
  categorie: "tactile" | "rendu" | "ia-payante" | "fichier-reel" | "dictee" | "subjectif" | "masque";
}

export interface IResultatTest {
  numero: number;
  nom: string;
  laptop: IResultatAppareil;
  mobile: IResultatAppareil;
}
