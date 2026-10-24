// Les deux « univers » du site : particuliers et commerces.
//
// Le visiteur choisit son univers sur l'accueil (l'appareil photo) ou avec
// le sélecteur en haut des autres pages ; ensuite tarifs, portfolio et
// contact n'affichent que ce qui le concerne. Le choix est retenu
// (localStorage) et écrit dans l'adresse (?pour=commerces) pour qu'un lien
// partagé ouvre le bon univers.
//
// Chargé dans le <head>, avant l'affichage : il pose data-univers et
// data-page sur <html> pour que la page s'affiche directement dans le bon
// état, sans clignotement.

(function () {
  const LISTE = [
    { id: "particuliers", label: "Particulier", mode: "particulier" },
    { id: "commerces", label: "Commerce", mode: "commerce" },
  ];
  const CLE = "site-photo-univers";
  const PAR_DEFAUT = "particuliers";

  // Accepte « commerces », « commerce », « #commerces »… (anciens liens).
  function normaliser(valeur) {
    const v = String(valeur || "").toLowerCase().replace(/^#/, "");
    if (!v) return null;
    const u = LISTE.find((x) => x.id === v || x.mode === v);
    return u ? u.id : null;
  }

  function depuisAdresse(url) {
    const u = url || window.location;
    const params = new URLSearchParams(u.search);
    return normaliser(params.get("pour")) || normaliser(u.hash);
  }

  function memorise() {
    try {
      return normaliser(window.localStorage.getItem(CLE));
    } catch (e) {
      return null;
    }
  }

  function pageDepuisAdresse(url) {
    const fichier = (url || window.location).pathname.split("/").pop();
    return !fichier ? "index" : fichier.replace(/\.html$/, "");
  }

  let courant = PAR_DEFAUT;

  function definir(id) {
    const v = normaliser(id);
    if (!v) return courant;
    courant = v;
    try {
      window.localStorage.setItem(CLE, v);
    } catch (e) {
      // navigation privée : le choix vaut pour cette page seulement
    }
    document.documentElement.dataset.univers = v;
    return v;
  }

  const initial = depuisAdresse();
  if (initial) definir(initial);
  else {
    courant = memorise() || PAR_DEFAUT;
    document.documentElement.dataset.univers = courant;
  }
  document.documentElement.dataset.page = pageDepuisAdresse();

  window.Univers = {
    liste: LISTE,
    courant: () => courant,
    definir,
    normaliser,
    depuisAdresse,
    pageDepuisAdresse,
    // « particulier » / « commerce » (vocabulaire de l'appareil photo)
    mode: () => LISTE.find((u) => u.id === courant).mode,
    depuisMode: (mode) => (LISTE.find((u) => u.mode === mode) || LISTE[0]).id,
  };
})();
