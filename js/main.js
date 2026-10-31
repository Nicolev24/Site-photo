// Mobile nav toggle
const navToggle = document.querySelector(".nav-toggle");
const navLinks = document.querySelector(".nav-links");

if (navToggle && navLinks) {
  navToggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("open");
    navToggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
  });

  // Délégation : les liens sont injectés après coup par render.js, donc on
  // écoute les clics sur le conteneur plutôt que sur chaque <a> individuel.
  navLinks.addEventListener("click", (e) => {
    if (e.target.tagName === "A") {
      navLinks.classList.remove("open");
      navToggle.setAttribute("aria-expanded", "false");
    }
  });
}

// Apparition douce des sections au scroll (léger, sans librairie) — appelée
// par js/sections-renderer.js une fois toutes les sections injectées.
function initScrollReveal() {
  const sections = Array.from(document.querySelectorAll("#sections-root > *")).slice(1); // le hero reste visible immédiatement
  if (!sections.length || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  sections.forEach((section) => {
    // Déjà à l'écran (arrivée sur la page, retour arrière) : affichée tout
    // de suite, sinon elle clignoterait pendant la transition de page.
    if (section.getBoundingClientRect().top < window.innerHeight * 0.92) return;
    section.classList.add("reveal-on-scroll");
    observer.observe(section);
  });
}

window.initScrollReveal = initScrollReveal;
