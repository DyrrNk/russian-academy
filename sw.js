"use strict";
/* Сгенерировано tools/build.js — не редактировать */
const PREFIX = "russian-academy-" + registration.scope + "-";
const CACHE = PREFIX + "c4425e659c";
const PAGE = "index.c4425e659c.html";
const ASSETS = ["index.c4425e659c.html","manifest.webmanifest","js/engine.a30ac2c782.js","js/data.de761c36ba.js","css/style.5fd6fc048d.css","images/icons/apple-touch-icon.png","images/icons/icon-192.png","images/icons/icon-512.png","images/icons/icon-maskable-512.png","images/kremlin-1600.jpg","images/kremlin-800.jpg"];

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
    /* Страница всегда отдаётся из кэша: она ссылается на файлы этой же сборки */
    const key = e.request.mode === "navigate" ? PAGE : e.request;
    e.respondWith(caches.open(CACHE).then(c => c.match(key))
        .then(hit => hit || fetch(e.request)));
});
