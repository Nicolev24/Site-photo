// Mode jour / nuit, commun à tout le site (même choix que sur l'accueil).
// Chargé dans le <head> : le bon mode est posé avant l'affichage, sans flash.
(function () {
  "use strict";
  var R = document.documentElement;
  var mode = "jour";
  try {
    mode = localStorage.getItem("theme") === "nuit" ? "nuit" : "jour";
  } catch (e) {}
  R.setAttribute("data-theme", mode);

  function changer() {
    var t = R.getAttribute("data-theme") === "nuit" ? "jour" : "nuit";
    R.setAttribute("data-theme", t);
    try {
      localStorage.setItem("theme", t);
    } catch (e) {}
    maj();
  }
  function maj() {
    var nuit = R.getAttribute("data-theme") === "nuit";
    document.querySelectorAll(".bouton-theme").forEach(function (b) {
      b.setAttribute("aria-label", nuit ? "Passer en mode jour" : "Passer en mode nuit");
    });
    document.querySelectorAll(".menu-theme").forEach(function (b) {
      b.textContent = nuit ? "Mode jour" : "Mode nuit";
    });
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", nuit ? "#1c1c1f" : "#ededf0");
  }

  // le bouton lune / soleil, à côté de « Réserver » dans l'en-tête
  document.addEventListener("DOMContentLoaded", function () {
    var place = document.querySelector(".site-header .header-nav");
    if (!place || place.querySelector(".bouton-theme")) return;
    var b = document.createElement("button");
    b.type = "button";
    b.className = "bouton-theme";
    b.innerHTML =
      '<svg class="ic-lune" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.6A8.2 8.2 0 1 1 9.4 4a6.6 6.6 0 0 0 10.6 10.6z" /></svg>' +
      '<svg class="ic-soleil" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2" /><path d="M12 2.6v2.3M12 19.1v2.3M2.6 12h2.3M19.1 12h2.3M5.4 5.4 7 7M17 17l1.6 1.6M5.4 18.6 7 17M17 7l1.6-1.6" /></svg>';
    b.addEventListener("click", changer);
    var cta = place.querySelector("#header-cta");
    place.insertBefore(b, cta || null);
    // sur téléphone, comme sur l'accueil : « Mode nuit » en bas du menu ouvert
    var liens = place.querySelector(".nav-links");
    if (liens) {
      var m = document.createElement("button");
      m.type = "button";
      m.className = "menu-theme";
      m.addEventListener("click", changer);
      liens.after(m);
    }
    maj();
  });
})();
