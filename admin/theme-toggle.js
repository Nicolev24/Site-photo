// Bouton soleil / lune des deux administrations (site et galeries clients).
// Le choix est mémorisé dans ce navigateur et partagé entre les deux admins.
// Le thème est aussi posé tout de suite dans <head> (petit script en ligne)
// pour éviter le flash de la mauvaise palette au chargement.
(function () {
  var KEY = "admin-theme";

  function lire() {
    try {
      return localStorage.getItem(KEY) === "dark" ? "dark" : "light";
    } catch (e) {
      return "light";
    }
  }

  function appliquer(theme) {
    var nuit = theme === "dark";
    if (nuit) document.documentElement.setAttribute("data-theme", "dark");
    else document.documentElement.removeAttribute("data-theme");
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", nuit ? "#0e1013" : "#14171c");
    document.querySelectorAll(".theme-toggle").forEach(function (b) {
      b.setAttribute("aria-pressed", String(nuit));
      b.setAttribute("aria-label", nuit ? "Passer en mode jour" : "Passer en mode nuit");
      b.setAttribute("title", nuit ? "Mode jour" : "Mode nuit");
    });
  }

  appliquer(lire());

  document.addEventListener("click", function (e) {
    var bouton = e.target.closest && e.target.closest(".theme-toggle");
    if (!bouton) return;
    var suivant = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(KEY, suivant);
    } catch (err) {}
    appliquer(suivant);
  });
})();
