// Service Worker PayLoop — Étape 1 : mise en cache de l'appli pour un chargement hors-ligne.
// Ne gère pas encore les données (factures, clients...) hors-ligne : ça viendra dans une étape suivante.

const CACHE_NAME = 'payloop-shell-v1';

// Fichiers indispensables pour que l'appli s'affiche même sans réseau.
const PRECACHE_URLS = [
  '/dashboard.html',
  '/login.html',
  '/manifest.json',
  '/images/logo.png',
  '/images/logo-ht.png',
  '/images/logo st.png',
  '/images/logo-payloop-sidebar-white%20(1).svg',
  '/images/icon-192.png',
  '/images/icon-512.png',
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
