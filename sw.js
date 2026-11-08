"use strict";
/* Сгенерировано tools/build.js — не редактировать */
const PREFIX = "russian-academy-" + registration.scope + "-";
const CACHE = PREFIX + "49fc39f284";
const PAGE = "index.49fc39f284.html";
const ASSETS = ["index.49fc39f284.html","manifest.webmanifest","js/engine.b66b8e8a3d.js","js/data.de761c36ba.js","css/style.c0a448f8c5.css","images/icons/apple-touch-icon.png","images/icons/icon-192.png","images/icons/icon-512.png","images/icons/icon-maskable-512.png","images/kremlin-1600.jpg","images/kremlin-800.jpg"];

self.addEventListener("install", e => {
    e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS.map(u => new Request(u, { cache: "reload" })))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
    e.waitUntil(caches.keys()
        .then(keys => Promise.all(keys.filter(k => k.startsWith(PREFIX) && k !== CACHE).map(k => caches.delete(k))))
        .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
    const url = new URL(e.request.url);
    if (e.request.method !== "GET" || url.origin !== location.origin) return;
    if (e.request.mode === "navigate") {
        const clean = url.origin + url.pathname;
        /* Страницы уроков для поиска берём из сети; без интернета открываем тот же урок в приложении */
        if (clean !== registration.scope && clean !== registration.scope + "index.html") {
            let rel = clean.slice(registration.scope.length);
            if (rel.endsWith("/")) rel = rel.slice(0, -1);
            if (rel === "slovar") rel = "glossary";
            e.respondWith(fetch(e.request).catch(() => Response.redirect(registration.scope + "#/" + rel, 302)));
            return;
        }
    }
    /* Приложение всегда отдаётся из кэша: страница ссылается на файлы этой же сборки */
    const key = e.request.mode === "navigate" ? PAGE : e.request;
    e.respondWith(caches.open(CACHE).then(c => c.match(key))
        .then(hit => hit || fetch(e.request)));
});
