const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
      }
    });
  },
  { threshold: 0.12 },
);

document
  .querySelectorAll(".reveal, .reveal-stagger")
  .forEach((el) => observer.observe(el));

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    const target = document.querySelector(link.getAttribute("href"));
    if (target) {
      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      document.getElementById("nav-links")?.classList.remove("open");
      document.getElementById("hamburger")?.classList.remove("open");
      document.getElementById("hamburger")?.setAttribute("aria-expanded", "false");
    }
  });
});

const hamburger = document.getElementById("hamburger");
const navLinks = document.getElementById("nav-links");
hamburger?.addEventListener("click", () => {
  const isOpen = navLinks?.classList.toggle("open") ?? false;
  hamburger.classList.toggle("open");
  hamburger.setAttribute("aria-expanded", isOpen ? "true" : "false");
});
