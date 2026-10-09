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

// Portfolio category filter — called by js/render.js once the gallery items
// have been built from content/portfolio.json (they don't exist in the raw HTML).
function initPortfolioFilters() {
  const filterButtons = document.querySelectorAll(".filter-btn");
  const galleryItems = document.querySelectorAll(".gallery-item");

  if (!filterButtons.length || !galleryItems.length) return;

  filterButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      filterButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      const category = btn.dataset.filter;

      galleryItems.forEach((item) => {
        const matches = category === "all" || item.dataset.category === category;
        item.classList.toggle("hidden", !matches);
      });
    });
  });

  // Apply filter from URL hash (e.g. portfolio.html#couples)
  const hash = window.location.hash.replace("#", "");
  if (hash) {
    const target = document.querySelector(`.filter-btn[data-filter="${hash}"]`);
    if (target) target.click();
  }
}

window.initPortfolioFilters = initPortfolioFilters;

// Apparition douce des sections au scroll (léger, sans librairie) — appelée
// par js/sections-renderer.js une fois toutes les sections injectées
// (même mécanisme que window.initPortfolioFilters ci-dessus).
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
    section.classList.add("reveal-on-scroll");
    observer.observe(section);
  });
}

window.initScrollReveal = initScrollReveal;
