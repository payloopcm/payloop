// Service Worker PayLoop — Étape 1 : mise en cache de l'appli pour un chargement hors-ligne.
// Étape 2 : les données (factures, clients...) sont maintenant aussi gardées en copie locale,
// via offline-store.js — ce fichier doit donc lui aussi être mis en cache.
// Étape 3 : offline-store.js a changé (nouvelle version avec la file d'attente) — on augmente
// le numéro de cache pour forcer tous les navigateurs à récupérer la nouvelle version plutôt
// que de garder l'ancienne indéfiniment. À refaire à chaque fois qu'un des fichiers listés
// ci-dessous (autre que dashboard.html/login.html, toujours récupérés en priorité sur le réseau) change.
// Étape 4 : ajout de la police Plus Jakarta Sans (hébergée sur le site plutôt que via Google Fonts,
// pour qu'elle continue de s'afficher correctement même hors-ligne) — cache encore augmenté.
// Étape 5 : nouvelle icône d'onglet (sans carré blanc) et système de traduction FR/EN de la page
// d'accueil — cache encore augmenté.
// Étape 6 : traduction FR/EN de la page de connexion — cache encore augmenté.
// Étape 7 : police Plus Jakarta Sans et traduction FR/EN du tableau de bord (menu, barre du
// haut, page d'accueil) — cache encore augmenté.
// Étape 8 : traduction FR/EN de la section Factures (tableau, formulaire, facture imprimable)
// — cache encore augmenté.
// Étape 9 : traduction FR/EN de la section Clients (tableau, formulaire), et "Client" devient
// "Customer" en anglais partout sur le site — cache encore augmenté.
// Étape 10 : traduction FR/EN de la section Stock & Produits (tableau, formulaire produit,
// formulaire d'ajustement de stock), et correction d'un bug préexistant où les colonnes du
// tableau des produits ne correspondaient pas aux bons en-têtes — cache encore augmenté.
// Étape 11 : traduction du libellé de catégorie affiché dans la section Stock & Produits
// (Produits/Formation/Autre) — la valeur enregistrée reste en français, seul l'affichage
// change selon la langue, et le filtre par catégorie a été sécurisé pour continuer à
// fonctionner correctement en anglais — cache encore augmenté.
// Étape 12 : traduction FR/EN de la section Paiements (tableau, formulaire "Enregistrer
// paiement") — la méthode de paiement (Espèces/Virement/Chèque) reste enregistrée en
// français, seul le libellé affiché change selon la langue — cache encore augmenté.
// Étape 13 : correction d'anciens paiements enregistrés sans accent et en minuscules
// ("especes" au lieu de "Espèces") qui n'étaient pas reconnus pour la traduction — cache
// encore augmenté.
// Étape 14 : traduction FR/EN de la section Migration (page, fenêtre d'import, historique,
// notifications, confirmations de suppression), et le fichier modèle Excel téléchargeable
// suit désormais lui aussi la langue active (en-têtes, exemples, noms d'onglets) — la
// reconnaissance des feuilles à l'import a été mise à jour pour accepter les noms français
// et anglais — cache encore augmenté.

const CACHE_NAME = 'payloop-shell-v14';

// Fichiers indispensables pour que l'appli s'affiche même sans réseau.
const PRECACHE_URLS = [
  '/dashboard.html',
  '/login.html',
  '/manifest.json',
  '/offline-store.js',
  '/images/logo.png',
  '/images/logo-ht.png',
  '/images/logo st.png',
  '/images/logo-payloop-sidebar-white%20(1).svg',
  '/images/icon-192.png',
  '/images/icon-512.png',
  '/images/icon-favicon-192.png',
  '/i18n.js',
  '/i18n-home.js',
  '/i18n-login.js',
  '/i18n-dashboard.js',
  '/fonts/plus-jakarta-sans/plus-jakarta-sans.css',
  '/fonts/plus-jakarta-sans/plus-jakarta-sans-latin-400-normal.woff2',
  '/fonts/plus-jakarta-sans/plus-jakarta-sans-latin-500-normal.woff2',
  '/fonts/plus-jakarta-sans/plus-jakarta-sans-latin-600-normal.woff2',
  '/fonts/plus-jakarta-sans/plus-jakarta-sans-latin-700-normal.woff2',
  '/fonts/plus-jakarta-sans/plus-jakarta-sans-latin-ext-400-normal.woff2',
  '/fonts/plus-jakarta-sans/plus-jakarta-sans-latin-ext-500-normal.woff2',
  '/fonts/plus-jakarta-sans/plus-jakarta-sans-latin-ext-600-normal.woff2',
  '/fonts/plus-jakarta-sans/plus-jakarta-sans-latin-ext-700-normal.woff2',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // On ne touche qu'aux requêtes de notre propre site (jamais aux appels vers payloop-api
  // ou vers des services externes) — ceux-ci continuent de fonctionner normalement.
  if (new URL(request.url).origin !== self.location.origin) return;
  if (request.method !== 'GET') return;

  // Pages (navigation) : on essaie le réseau en premier pour avoir la version la plus
  // récente, et on retombe sur la version en cache uniquement si le réseau échoue (hors-ligne).
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/dashboard.html')))
    );
    return;
  }

  // Fichiers statiques (images, manifest...) : on sert le cache en priorité (rapide,
  // fonctionne hors-ligne), et on va au réseau seulement si ce n'est pas déjà en cache.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      });
    })
  );
});
