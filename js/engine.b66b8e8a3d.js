"use strict";window.RA_BUILD="19129b3cf4";
"use strict";

/* ==========================================================
   Russian Academy — ядро
   Реестр курсов, хранение прогресса, утилиты.
   Файлы в js/data/ вызывают RA.addCourse(...) и RA.addGameData(...).
========================================================== */

const RA = {

    version: "2.0.0",

    /* Направления обучения (порядок = порядок в интерфейсе) */
    tracks: [
        { id: "start",     icon: "🌱", title: "Русский с нуля",       desc: "От алфавита до свободного владения: уровни A0 → C1 по шкале CEFR / ТРКИ." },
        { id: "theory",    icon: "📚", title: "Справочник",           desc: "Вся грамматика русского языка: фонетика, лексика, морфология, синтаксис, орфография, пунктуация, стилистика." },
        { id: "school",    icon: "🏫", title: "Школьная программа",   desc: "Русский язык по классам: 1–4, 5–9, 10–11. Темы, правила, разборы." },
        { id: "speaking",  icon: "💬", title: "Разговорная речь",     desc: "Живые диалоги и фразы для жизненных ситуаций, речевой этикет, идиомы." },
        { id: "cert",      icon: "🎓", title: "Сертификаты",          desc: "Национальный сертификат Узбекистана, ТРКИ в РГПУ им. Герцена и РУДН, экзамен для мигрантов." },
        { id: "admission", icon: "🎯", title: "Поступление",          desc: "Подготовка к вступительным тестам и экзаменам в вузы Узбекистана и России." }
    ],

    courses: [],
    courseById: Object.create(null),
    gameData: { stress: [], letters: [], forms: [], order: [], tf: [], idioms: [], tips: [] },

    addCourse(course) {
        if (!course || !course.id) return;
        if (this.courseById[course.id]) {
            console.warn("Курс уже зарегистрирован:", course.id);
            return;
        }
        course.modules = course.modules || [];
        course.order = course.order || 100;
        this.courses.push(course);
        this.courseById[course.id] = course;
    },

    /* Добавить уроки в модуль существующего курса (модуль создаётся при необходимости) */
    addLessons(courseId, moduleTitle, lessons) {
        const course = this.courseById[courseId];
        if (!course) {
            console.warn("Нет курса для новых уроков:", courseId);
            return;
        }
        let module = course.modules.find(m => m.title === moduleTitle);
        if (!module) {
            module = { title: moduleTitle, lessons: [] };
            course.modules.push(module);
        }
        module.lessons.push(...lessons);
    },

    /* Сделать секции готового экзамена звучащими */
    setAudio(courseId, lessonId, sectionIndexes, opts) {
        const found = this.findLesson(courseId, lessonId);
        if (!found) {
            console.warn("Нет экзамена для озвучки:", courseId, lessonId);
            return;
        }
        const clean = s => s.replace(/\s*\(по расшифровке\)/g, "").replace(/\s*по расшифровкам/g, "");
        found.lesson.title = clean(found.lesson.title);
        if (found.lesson.desc) found.lesson.desc = clean(found.lesson.desc);
        sectionIndexes.forEach(i => {
            const sec = found.lesson.sections[i];
            if (!sec) return;
            sec.audio = true;
            sec.plays = (opts && opts.plays) || 2;
            sec.title = clean(sec.title);
            sec.info = "Прослушайте текст и ответьте на вопросы.";
        });
    },

    /* Узбекские переводы (накладываются на русские уроки) */
    uzLessons: {},
    uzCourses: {},
    addUz(courseId, lessonId, data) { this.uzLessons[courseId + "/" + lessonId] = data; },
    addUzCourse(courseId, data) { this.uzCourses[courseId] = { ...(this.uzCourses[courseId] || {}), ...data }; },

    addGameData(data) {
        /* Одно и то же задание может прийти из разных файлов — храним один раз */
        const idOf = { stress: x => x.w, letters: x => x.w, forms: x => x.s, order: x => x.s, tf: x => x.s, idioms: x => x.i, tips: x => x };
        Object.keys(data || {}).forEach(key => {
            if (!this.gameData[key]) this.gameData[key] = [];
            const id = idOf[key] || (x => JSON.stringify(x));
            const seen = new Set(this.gameData[key].map(id));
            data[key].forEach(item => {
                if (!seen.has(id(item))) {
                    seen.add(id(item));
                    this.gameData[key].push(item);
                }
            });
        });
    },

    coursesOf(trackId) {
        return this.courses
            .filter(c => c.track === trackId)
            .sort((a, b) => a.order - b.order);
    },

    lessonsOf(course) {
        const list = [];
        course.modules.forEach(m => m.lessons.forEach(l => list.push(l)));
        return list;
    },

    findLesson(courseId, lessonId) {
        const course = this.courseById[courseId];
        if (!course) return null;
        const lessons = this.lessonsOf(course);
        const index = lessons.findIndex(l => l.id === lessonId);
        if (index < 0) return null;
        return { course, lesson: lessons[index], index, lessons };
    },

    /* Все термины платформы: из уроков + отдельный словарь */
    allTerms() {
        if (this._terms) return this._terms;
        const map = new Map();
        this.courses.forEach(course => {
            this.lessonsOf(course).forEach(lesson => {
                (lesson.terms || []).forEach((t, idx) => {
                    const key = t.term.toLowerCase().trim();
                    if (!map.has(key)) {
                        map.set(key, { ...t, idx, course: course.id, lesson: lesson.id, track: course.track, where: course.title + " → " + lesson.title });
                    }
                });
            });
        });
        this._terms = [...map.values()].sort((a, b) => a.term.localeCompare(b.term, "ru"));
        return this._terms;
    },

    /* Устойчивый ключ вопроса: не зависит от порядка вариантов и языка */
    qKey(q) {
        if (q._k) return q._k;
        const s = q.q + "|" + [...q.o].map(String).sort().join("|");
        let h = 5381;
        for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
        return "q:" + h.toString(36);
    },

    /* Все вопросы (включая экзамены) по ключу — для повторения */
    questionIndex() {
        if (this._qIndex) return this._qIndex;
        const map = Object.create(null);
        this.courses.forEach(c => this.lessonsOf(c).forEach(l => {
            (l.quiz || []).forEach((q, i) => { map[this.qKey(q)] = { q, c: c.id, l: l.id, i }; });
            (l.sections || []).forEach(s => s.questions.forEach(q => { map[this.qKey(q)] = { q, c: c.id, l: l.id, i: -1 }; }));
        }));
        this._qIndex = map;
        return map;
    },

    /* Есть ли такой элемент очереди повторения (вопрос могли изменить или удалить) */
    srsKnown(key) {
        if (key.startsWith("q:")) return !!this.questionIndex()[key];
        if (key.startsWith("t:")) {
            if (!this._termSet) this._termSet = new Set(this.allTerms().map(t => t.term));
            return this._termSet.has(key.slice(2));
        }
        return false;
    },

    /* Все вопросы тестов платформы */
    allQuestions() {
        if (this._questions) return this._questions;
        const list = [];
        this.courses.forEach(course => {
            this.lessonsOf(course).forEach(lesson => {
                (lesson.quiz || []).forEach(q => list.push({ ...q, course: course.id, lesson: lesson.id, track: course.track }));
            });
        });
        this._questions = list;
        return list;
    }
};

/* ==========================================================
   Утилиты
========================================================== */

RA.util = {

    esc(text) {
        return String(text ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    },

    /* Убрать HTML-теги (для поиска и сравнения) */
    plain(html) {
        return String(html ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
    },

    shuffle(array) {
        const a = [...array];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    },

    pick(array, n) {
        return this.shuffle(array).slice(0, n);
    },

    /* Копия вопроса с перемешанными вариантами. Варианты вида «оба ответа»,
       «все перечисленные», «А и Б» ссылаются на порядок — такие вопросы не трогаем. */
    shuffleOptions(q) {
        const fixed = /(^|[\s,.;:!?(«])(оба|обе|все|всё|ни один|ни одна|никакой|нет верного|нет правильного|[а-г] и [а-г]|\d и \d)([\s,.;:!?)»]|$)|^[а-г1-4][).]/i;
        if (q.o.some(o => fixed.test(this.plain(o)))) return q;
        const order = this.shuffle(q.o.map((_, i) => i));
        return { ...q, o: order.map(i => q.o[i]), a: order.indexOf(q.a) };
    },

    today() {
        const d = new Date();
        return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    },

    /* Нормализация ответа: регистр, ё/е, пробелы, знаки ударения */
    norm(text) {
        return String(text ?? "")
            .toLowerCase()
            .replace(/ё/g, "е")
            .replace(/[́̀]/g, "")
            .replace(/[.,!?;:«»"'()\-–—]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    },

    /* Озвучивание через Web Speech API (если доступно в браузере) */
    speak(text) {
        try {
            if (!("speechSynthesis" in window)) return;
            const clean = RA.util.plain(text).replace(/́/g, "");
            if (clean.length > 180) {
                const ruVoice = speechSynthesis.getVoices().find(v => v.lang && v.lang.startsWith("ru"));
                RA.audio.play(clean, ruVoice || null);
                return;
            }
            const u = new SpeechSynthesisUtterance(clean);
            u.lang = "ru-RU";
            u.rate = RA.store.data.settings.speechRate || 0.9;
            const ru = speechSynthesis.getVoices().find(v => v.lang && v.lang.startsWith("ru"));
            if (ru) u.voice = ru;
            speechSynthesis.cancel();
            speechSynthesis.speak(u);
        } catch (e) { /* озвучка необязательна */ }
    }
};

/* ==========================================================
   Хранение прогресса (localStorage)
========================================================== */

RA.store = {

    key: "russianAcademy.v2",

    defaults() {
        return {
            name: "Гость",
            avatar: "👨‍🎓",
            goal: null,
            xp: 0,            // опыт на текущем уровне
            totalXp: 0,
            level: 1,
            coins: 0,
            lessons: {},      // "courseId/lessonId" -> { score, date }
            exams: {},        // "courseId/lessonId" -> лучший процент
            games: {},        // gameId -> { played, best }
            gamesPlayed: 0,
            learnedTerms: {}, // термин -> true
            streak: 0,
            lastDay: null,
            daily: { day: null, xp: 0 },
            owned: ["👨‍🎓"],
            achievements: {},
            srs: {},          // "q:…" или "t:…" -> { box, due }
            placement: null,  // { level, course, date }
            settings: { theme: "dark", particles: window.innerWidth >= 860, speechRate: 0.9, lang: "ru" }
        };
    },

    data: null,

    load() {
        let saved = null;
        try { saved = JSON.parse(localStorage.getItem(this.key) || "null"); } catch (e) { saved = null; }
        try {
            this.data = this.sanitize(saved);
        } catch (e) {
            this.data = this.defaults();
        }
        this.expireStreak();
    },

    /* Данные из localStorage и из импортируемого файла считаем недоверенными:
       оставляем только известные поля нужного типа. */
    sanitize(raw) {
        const base = this.defaults();
        const obj = v => (v && typeof v === "object" && !Array.isArray(v)) ? v : {};
        const num = (v, d) => Number.isFinite(v) ? Math.min(Math.max(v, 0), 1e7) : d;
        const date = v => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) ? v : null;
        const map = (v, f) => Object.fromEntries(
            Object.entries(obj(v)).map(([k, x]) => [k, f(x)]).filter(([, x]) => x !== undefined)
        );
        const isItem = a => RA.shopItems.some(i => i.a === a);
        const r = obj(raw), s = obj(r.settings), daily = obj(r.daily);
        return {
            ...base,
            name: typeof r.name === "string" ? r.name.slice(0, 30) : base.name,
            avatar: isItem(r.avatar) ? r.avatar : base.avatar,
            owned: Array.isArray(r.owned) ? r.owned.filter(isItem) : base.owned,
            goal: RA.goals.some(g => g.id === r.goal) ? r.goal : null,
            xp: num(r.xp, 0),
            totalXp: num(r.totalXp, 0),
            level: Math.max(1, Math.floor(num(r.level, 1))),
            coins: num(r.coins, 0),
            gamesPlayed: num(r.gamesPlayed, 0),
            streak: num(r.streak, 0),
            lastDay: date(r.lastDay),
            daily: { day: date(daily.day), xp: num(daily.xp, 0) },
            lessons: map(r.lessons, x => Number.isFinite(x && x.score) ? { score: num(x.score, 0), date: date(x.date) } : undefined),
            exams: map(r.exams, x => Number.isFinite(x) ? num(x, 0) : undefined),
            games: map(r.games, x => (x && typeof x === "object") ? { played: num(x.played, 0), best: num(x.best, 0) } : undefined),
            learnedTerms: map(r.learnedTerms, x => x === true ? true : undefined),
            achievements: map(r.achievements, x => date(x) || undefined),
            srs: Object.fromEntries(Object.entries(obj(r.srs))
                .filter(([k, x]) => RA.srsKnown(k) && x && Number.isFinite(x.box) && date(x.due))
                .map(([k, x]) => [k, { box: Math.min(4, Math.max(1, Math.floor(x.box))), due: date(x.due) }])),
            placement: (typeof obj(r.placement).course === "string" && RA.courseById[r.placement.course]) ? {
                level: ["A0", "A1", "A2", "B1", "B2", "C1"].includes(r.placement.level) ? r.placement.level : "A0",
                course: r.placement.course,
                date: date(r.placement.date)
            } : null,
            settings: {
                lang: s.lang === "uz" ? "uz" : "ru",
                theme: s.theme === "light" ? "light" : "dark",
                particles: typeof s.particles === "boolean" ? s.particles : base.settings.particles,
                speechRate: Number.isFinite(s.speechRate) ? Math.min(1.3, Math.max(0.5, s.speechRate)) : base.settings.speechRate
            }
        };
    },

    save() {
        try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) { /* приватный режим */ }
    },

    reset() {
        try { localStorage.removeItem(this.key); } catch (e) { }
        const lang = this.data ? this.data.settings.lang : "ru";
        this.data = this.defaults();
        this.data.settings.lang = lang;
        try {
            Object.keys(localStorage).filter(k => k.startsWith("ra.draft.")).forEach(k => localStorage.removeItem(k));
        } catch (e) { /* хранилище недоступно */ }
        this.save();
    },

    /* Обновить данные на месте: открытые страницы держат ссылки на эти объекты */
    syncFrom(raw) {
        const fresh = this.sanitize(raw);
        const d = this.data;
        Object.keys(fresh).forEach(k => {
            const v = fresh[k];
            if (v && d[k] && typeof v === "object" && typeof d[k] === "object" && !Array.isArray(v)) {
                Object.keys(d[k]).forEach(x => delete d[k][x]);
                Object.assign(d[k], v);
            } else {
                d[k] = v;
            }
        });
    },

    xpForLevel(level) {
        return 100 + (level - 1) * 25;
    },

    yesterday() {
        const y = new Date();
        y.setDate(y.getDate() - 1);
        return y.getFullYear() + "-" + String(y.getMonth() + 1).padStart(2, "0") + "-" + String(y.getDate()).padStart(2, "0");
    },

    /* Вызывается при получении опыта: день засчитывается, только если человек занимался */
    touchStreak() {
        const d = this.data;
        const today = RA.util.today();
        if (d.lastDay === today) return;
        d.streak = d.lastDay === this.yesterday() ? d.streak + 1 : 1;
        d.lastDay = today;
    },

    /* При открытии сайта: если день пропущен, серия прервалась */
    expireStreak() {
        const d = this.data;
        if (d.lastDay !== RA.util.today() && d.lastDay !== this.yesterday()) d.streak = 0;
    },

    addXP(amount) {
        const d = this.data;
        this.touchStreak();
        if (d.daily.day !== RA.util.today()) d.daily = { day: RA.util.today(), xp: 0 };
        d.xp += amount;
        d.totalXp += amount;
        d.daily.xp += amount;
        let leveled = false;
        while (d.xp >= this.xpForLevel(d.level)) {
            d.xp -= this.xpForLevel(d.level);
            d.level++;
            d.coins += 25;
            leveled = true;
        }
        this.save();
        if (leveled && RA.ui) RA.ui.toast("🎉 Новый уровень: " + d.level + "! +25 монет");
        RA.ui && RA.ui.refresh();
    },

    addCoins(amount) {
        this.data.coins += amount;
        this.save();
        RA.ui && RA.ui.refresh();
    },

    lessonDone(courseId, lessonId) {
        return !!this.data.lessons[courseId + "/" + lessonId];
    },

    completeLesson(courseId, lessonId, score) {
        const key = courseId + "/" + lessonId;
        const first = !this.data.lessons[key];
        const prev = this.data.lessons[key] ? this.data.lessons[key].score : 0;
        this.data.lessons[key] = { score: Math.max(prev, score), date: RA.util.today() };
        this.save();
        return first;
    },

    courseProgress(course) {
        const lessons = RA.lessonsOf(course);
        if (!lessons.length) return 0;
        const done = lessons.filter(l => this.lessonDone(course.id, l.id)).length;
        return Math.round(done / lessons.length * 100);
    },

    /* ---------- Интервальное повторение: 1, 3, 7, 14 дней ---------- */
    dayPlus(days) {
        const d = new Date();
        d.setDate(d.getDate() + days);
        return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    },

    /* Ошибка: вернуть в начало очереди, повторить можно уже сегодня */
    srsWrong(key) {
        this.data.srs[key] = { box: 1, due: RA.util.today() };
        this.save();
        RA.ui && RA.ui.refresh();
    },

    /* Новый выученный термин: первое повторение завтра */
    srsLearned(key) {
        if (!this.data.srs[key]) {
            this.data.srs[key] = { box: 1, due: this.dayPlus(1) };
            this.save();
        }
    },

    /* Ответ при повторении. После 14 дней элемент считается усвоенным. */
    srsAnswer(key, ok) {
        const days = [1, 3, 7, 14];
        const item = this.data.srs[key] || { box: 1, due: RA.util.today() };
        if (!ok) {
            this.data.srs[key] = { box: 1, due: RA.util.today() };
        } else if (item.box >= days.length) {
            delete this.data.srs[key];
        } else {
            this.data.srs[key] = { box: item.box + 1, due: this.dayPlus(days[item.box]) };
        }
        this.save();
        RA.ui && RA.ui.refresh();
    },

    srsDueKeys() {
        const today = RA.util.today();
        return Object.keys(this.data.srs).filter(k => this.data.srs[k].due <= today);
    },

    recordGame(gameId, score) {
        const g = this.data.games[gameId] || { played: 0, best: 0 };
        g.played++;
        g.best = Math.max(g.best, score);
        this.data.games[gameId] = g;
        this.data.gamesPlayed++;
        this.save();
    }
};

/* ==========================================================
   Локализация содержимого: узбекский текст поверх русского урока.
   В русском режиме функции возвращают исходные объекты.
========================================================== */

RA.loc = {

    isUz() {
        return RA.store.data && RA.store.data.settings.lang === "uz";
    },

    course(course) {
        if (!course || !this.isUz()) return course;
        const d = RA.uzCourses[course.id] || {};
        return {
            ...course,
            title: d.title || course.title,
            desc: d.desc || course.desc,
            about: d.about || course.about,
            modules: course.modules.map((m, i) => ({
                ...m,
                title: (d.modules && d.modules[i]) || m.title,
                lessons: m.lessons.map(l => {
                    const u = RA.uzLessons[course.id + "/" + l.id];
                    return u ? { ...l, title: u.title || l.title, desc: u.desc || l.desc } : l;
                })
            }))
        };
    },

    hasLesson(courseId, lessonId) {
        return !!RA.uzLessons[courseId + "/" + lessonId];
    },

    lesson(courseId, lesson) {
        const d = this.isUz() ? RA.uzLessons[courseId + "/" + lesson.id] : null;
        if (!d) return lesson;
        return {
            ...lesson,
            title: d.title || lesson.title,
            desc: d.desc || lesson.desc,
            blocks: d.blocks ? d.blocks.map(b => b.t === "same" ? (lesson.blocks || [])[b.i] : b).filter(Boolean) : lesson.blocks,
            terms: (lesson.terms || []).map((t, i) => (d.terms && d.terms[i]) ? { ...t, def: d.terms[i] } : t),
            quiz: (lesson.quiz || []).map((q, i) => ({ ...q, _k: RA.qKey(q), ...((d.quiz && d.quiz[i]) || {}) }))
        };
    },

    /* Термин из общего словаря */
    term(t) {
        const d = (this.isUz() && t.idx !== undefined) ? RA.uzLessons[t.course + "/" + t.lesson] : null;
        return (d && d.terms && d.terms[t.idx]) ? { ...t, def: d.terms[t.idx] } : t;
    },

    /* Вопрос из очереди повторения */
    question(found) {
        const d = this.isUz() ? RA.uzLessons[found.c + "/" + found.l] : null;
        const u = d && d.quiz && d.quiz[found.i];
        return u ? { ...found.q, _k: RA.qKey(found.q), ...u } : found.q;
    }
};

/* Пока js/i18n.js не загружен, перевод не меняет текст */
RA.t = text => text;

/* ==========================================================
   Озвучка длинного текста для аудирования.
   Читаем по предложениям: браузеры обрывают длинные фразы.
========================================================== */

RA.audio = {

    token: 0,

    chunks(text) {
        return RA.util.plain(String(text).replace(/\n+/g, " ¶ "))
            .replace(/[́̀]/g, "")
            .replace(/([.!?…])\s+/g, "$1¶")
            .split("¶")
            .map(s => s.replace(/^[\s—–-]+/, "").trim())
            .filter(Boolean);
    },

    /* Русский голос: список голосов загружается асинхронно */
    async ruVoice() {
        if (!("speechSynthesis" in window)) return null;
        const find = () => speechSynthesis.getVoices().find(v => v.lang && v.lang.toLowerCase().startsWith("ru"));
        let voice = find();
        for (let i = 0; !voice && i < 30; i++) {
            await new Promise(r => setTimeout(r, 100));
            voice = find();
        }
        return voice || null;
    },

    stop() {
        this.token++;
        try { if ("speechSynthesis" in window) speechSynthesis.cancel(); } catch (e) { /* нет озвучки */ }
    },

    /* Прочитать текст. onEnd — конец, onProgress — доля 0…1,
       onFail — ни одна фраза не прозвучала (голос есть, но не работает). */
    play(text, voice, onEnd, onProgress, onFail) {
        this.stop();
        const token = this.token;
        const parts = this.chunks(text);
        const rate = RA.store.data.settings.speechRate || 0.9;
        let i = 0, played = 0;
        const next = () => {
            if (token !== this.token) return;
            onProgress && onProgress(parts.length ? i / parts.length : 1);
            if (i >= parts.length) {
                if (!played && onFail) onFail();
                else if (onEnd) onEnd();
                return;
            }
            const u = new SpeechSynthesisUtterance(parts[i]);
            u.lang = "ru-RU";
            u.rate = rate;
            u.voice = voice;
            /* onend иногда не приходит: страхуемся таймером по длине фразы */
            let moved = false;
            const go = () => { if (moved) return; moved = true; clearTimeout(guard); i++; next(); };
            const guard = setTimeout(go, 4000 + parts[i].length * 160 / rate);
            u.onend = () => { played++; go(); };
            u.onerror = go;
            speechSynthesis.speak(u);
        };
        next();
    }
};

;
"use strict";

/* ==========================================================
   Язык интерфейса: русский (исходный) и узбекский.
   Интерфейс написан по-русски; в узбекском режиме подписи заменяются
   в DOM по словарю. Содержимое уроков здесь не трогается:
   оно приходит из js/data/uz_*.js через RA.loc.
========================================================== */

RA.i18n = {

    /* Что не переводим: тексты уроков, задания, варианты ответов */
    skip: "#secTheory,.promptText,.critText,.box,.task,.examples,.dialog,.userName,.term,.q,.readText,.prompt,.opt,.explain,.flashFace,.tile,.letter,.wordChip,.answerLine,.speech,.searchResult,.logo,#playerName",

    dict: {
        /* Общее */
        "Образовательная платформа по русскому языку": "Rus tili bo‘yicha ta’lim platformasi", "Не знаете, с чего начать? Пройдите тест на уровень": "Nimadan boshlashni bilmaysizmi? Daraja testini topshiring",
        "ТРКИ": "TRKI", "РУДН": "RUDN", "РГПУ им. Герцена": "Gertsen universiteti", "Мигранты": "Migrantlar", "Комплексный экзамен": "Kompleks imtihon", "ТРКИ (РГПУ им. Герцена или РУДН)": "TRKI (Gertsen universiteti yoki RUDN)",
        "— для поступления и выпуска в Узбекистане.": "— O‘zbekistonda oliygohga kirish va maktabni bitirish uchun.", "— государственный сертификат РФ: для учёбы и работы в России, гражданства.": "— Rossiya davlat sertifikati: Rossiyada o‘qish, ishlash va fuqarolik uchun.", "— для патента, РВП и ВНЖ в России.": "— Rossiyada patent, RVP va VNJ uchun.",
        "Выучено всего": "Jami o‘rganildi", "с": "son", "Результат сохранён": "Natija saqlandi", "Новый лучший результат": "Yangi eng yaxshi natija", "Нужно 60% и больше, чтобы засчитать урок. Повторите теорию и попробуйте ещё раз!": "Dars hisoblanishi uchun kamida 60% kerak. Nazariyani takrorlab, yana urinib ko‘ring!", "Покупка совершена!": "Xarid qilindi!", "Урок отмечен как изученный": "Dars o‘rganildi deb belgilandi", "Не удалось прочитать файл прогресса": "Natija faylini o‘qib bo‘lmadi", "Удалить весь прогресс, монеты и достижения? Это действие нельзя отменить.": "Barcha natija, tanga va yutuqlar o‘chirilsinmi? Buni qaytarib bo‘lmaydi.",
        "Пример": "Misol", "Правило": "Qoida", "Заметка": "Eslatma", "Внимание": "Diqqat", "Совет": "Maslahat", "Послушать": "Tinglash",
        "Где это?": "Bu qayerda?", "В аудитории": "Auditoriyada", "Примеры в предложениях": "Gaplardagi misollar", "Примеры": "Misollar", "Кто вы?": "Siz kimsiz?", "В аэропорту": "Aeroportda", "Договариваемся о встрече": "Uchrashuvni kelishamiz", "После выходных": "Dam olish kunlaridan keyin", "На улице": "Ko‘chada", "Предлог «о» (перед гласной — «об»)": "«о» predlogi (unlidan oldin — «об»)", "Где ты живёшь?": "Qayerda yashaysan?", "Слова в предложениях": "Gaplardagi so‘zlar", "Моя семья": "Mening oilam", "В университете": "Universitetda", "Покупаем продукты": "Oziq-ovqat sotib olamiz", "Заказываем обед": "Tushlik buyurtma qilamiz",
        "Смена языка прервёт тест, результат не сохранится. Продолжить?": "Tilni almashtirish testni to‘xtatadi, natija saqlanmaydi. Davom etasizmi?",
        "Вопросов": "Savollar", "Время": "Vaqt", "Порог прохождения": "O‘tish chegarasi", "Ваш лучший результат": "Eng yaxshi natijangiz", "мин": "daqiqa", "Правильно": "To‘g‘ri",
        "Слушать": "Tinglash", "Осталось прослушиваний": "Qolgan tinglashlar", "Текст записи": "Yozuv matni", "На этом устройстве нет русского голоса, поэтому текст показан для чтения.": "Bu qurilmada rus tilidagi ovoz yo‘q, shuning uchun matn o‘qish uchun ko‘rsatildi.",
        "Письмо": "Yozish", "Говорение": "Gapirish", "Напишите ответ здесь…": "Javobni shu yerga yozing…", "Слов": "So‘zlar", "Запустить таймер": "Taymerni ishga tushirish", "Проверить себя": "O‘zingizni tekshiring",
        "Подготовка": "Tayyorgarlik", "Ответ": "Javob", "Начать подготовку": "Tayyorgarlikni boshlash", "Проверить себя без записи": "Yozuvsiz o‘zingizni tekshiring", "Запись остаётся только на этом устройстве и не сохраняется после ухода со страницы.": "Yozuv faqat shu qurilmada qoladi va sahifadan chiqqach saqlanmaydi.",
        "Ваша запись": "Yozuvingiz", "Говорите!": "Gapiring!", "Закончить": "Tugatish", "Микрофон недоступен: отвечайте вслух без записи.": "Mikrofon mavjud emas: yozuvsiz ovoz chiqarib javob bering.", "Начать отвечать": "Javob berishni boshlash",
        "Образец ответа": "Javob namunasi", "Отметьте, что получилось": "Nima uddalanganini belgilang", "Сохранить оценку": "Bahoni saqlash", "Самопроверка завершена": "O‘z-o‘zini tekshirish yakunlandi", "Практика засчитана": "Mashq hisoblandi", "Это ваша собственная оценка, а не экзаменационный балл.": "Bu sizning shaxsiy bahoyingiz, imtihon bali emas.", "Прослушайте текст и ответьте на вопросы.": "Matnni tinglang va savollarga javob bering.",
        "Сначала закончите текущее задание": "Avval joriy topshiriqni tugating",
        "Приложение и работа без интернета": "Ilova va internetsiz ishlash", "Работа без интернета включится, когда сайт будет опубликован.": "Internetsiz ishlash sayt e’lon qilingach yoqiladi.", "Сайт сохранён на устройстве и работает без интернета.": "Sayt qurilmaga saqlandi va internetsiz ishlaydi.", "Сохраняем сайт на устройство…": "Sayt qurilmaga saqlanmoqda…", "Установить на устройство": "Qurilmaga o‘rnatish", "Приложение установлено": "Ilova o‘rnatildi", "Сайт обновлён. Новая версия откроется при следующем запуске.": "Sayt yangilandi. Yangi versiya keyingi ochilishda ishlaydi.", "На iPhone: откройте сайт в Safari, нажмите «Поделиться» и выберите «На экран Домой». Приложение хранит прогресс отдельно от Safari, поэтому сначала скачайте прогресс здесь, а затем загрузите его в приложении.": "iPhone’da: saytni Safari’da oching, «Ulashish»ni bosing va «Bosh ekranga»ni tanlang. Ilova natijani Safari’dan alohida saqlaydi, shuning uchun avval natijani shu yerda yuklab oling, keyin ilovaga yuklang.", "Не удалось сохранить сайт на устройство. Попробуем снова при подключении к интернету.": "Saytni qurilmaga saqlab bo‘lmadi. Internet ulanganda yana urinib ko‘ramiz.",
        /* Меню */
        "Главная": "Bosh sahifa", "Обучение": "O‘qish", "Русский с нуля": "Rus tili noldan", "Справочник": "Ma’lumotnoma",
        "Школьная программа": "Maktab dasturi", "Разговорная речь": "So‘zlashuv nutqi", "Экзамены": "Imtihonlar",
        "Сертификаты": "Sertifikatlar", "Поступление": "Oliygohga kirish", "Практика": "Mashq", "Словарь терминов": "Atamalar lug‘ati",
        "Игры": "O‘yinlar", "Достижения": "Yutuqlar", "Магазин": "Do‘kon", "Профиль": "Profil", "Настройки": "Sozlamalar",
        "Повторение": "Takrorlash", "Тест на уровень": "Daraja testi", "Гость": "Mehmon", "Уровень": "Daraja",
        /* Правая панель */
        "Цель на сегодня": "Bugungi maqsad", "Тренироваться": "Mashq qilish", "Статистика": "Statistika", "Серия дней": "Kunlar seriyasi",
        "Уроков пройдено": "O‘tilgan darslar", "Игр сыграно": "O‘ynalgan o‘yinlar", "Всего опыта": "Jami tajriba",
        "Совет профессора": "Professor maslahati", "Ещё совет": "Yana maslahat",
        /* Главная */
        "Добро пожаловать в Russian Academy!": "Russian Academy’ga xush kelibsiz!", "Выбрать цель обучения": "O‘qish maqsadini tanlash",
        "Начать с алфавита": "Alifbodan boshlash", "Сменить цель": "Maqsadni o‘zgartirish", "Направления": "Yo‘nalishlar", "Термины дня": "Kun atamalari",
        "Учитесь играя": "O‘ynab o‘rganing", "Мой путь": "Mening yo‘lim", "Какая у вас цель?": "Maqsadingiz qanday?",
        "Мы составим путь обучения. Цель можно сменить в любой момент.": "O‘qish yo‘lini tuzamiz. Maqsadni istalgan vaqtda o‘zgartirish mumkin.",
        "Язык интерфейса": "Interfeys tili", "Сегодня нужно повторить": "Bugun takrorlash kerak",
        /* Направления */
        "От алфавита до свободного владения: уровни A0 → C1 по шкале CEFR / ТРКИ.": "Alifbodan erkin bilishgacha: CEFR / TRKI bo‘yicha A0 → C1 darajalari.",
        "Вся грамматика русского языка: фонетика, лексика, морфология, синтаксис, орфография, пунктуация, стилистика.": "Rus tili grammatikasi: fonetika, leksika, morfologiya, sintaksis, imlo, tinish belgilari, stilistika.",
        "Русский язык по классам: 1–4, 5–9, 10–11. Темы, правила, разборы.": "Rus tili sinflar bo‘yicha: 1–4, 5–9, 10–11. Mavzular, qoidalar, tahlillar.",
        "Живые диалоги и фразы для жизненных ситуаций, речевой этикет, идиомы.": "Hayotiy vaziyatlar uchun dialog va iboralar, nutq odobi, idiomalar.",
        "Национальный сертификат Узбекистана, ТРКИ в РГПУ им. Герцена и РУДН, экзамен для мигрантов.": "O‘zbekiston Milliy sertifikati, Gertsen universiteti va RUDNda TRKI, migrantlar imtihoni.",
        "Подготовка к вступительным тестам и экзаменам в вузы Узбекистана и России.": "O‘zbekiston va Rossiya oliygohlariga kirish testlari va imtihonlariga tayyorgarlik.",
        "Как выбрать сертификат?": "Sertifikatni qanday tanlash kerak?", "Как выбрать сертификат": "Sertifikatni qanday tanlash kerak", "Курсы этого направления скоро появятся.": "Bu yo‘nalish kurslari tez orada qo‘shiladi.",
        /* Цели */
        "Национальный сертификат": "Milliy sertifikat", "Сертификат РГПУ им. Герцена": "Gertsen universiteti sertifikati", "Сертификат РУДН": "RUDN sertifikati",
        "Экзамен для мигрантов": "Migrantlar imtihoni", "Поступление в вуз": "Oliygohga kirish", "Говорить свободно": "Erkin gapirish", "1–11 классы": "1–11-sinflar",
        "Тесты, собеседование, сочинение": "Testlar, suhbat, insho", "Milliy sertifikat по русскому языку": "Rus tilidan Milliy sertifikat",
        "ТРКИ через центр Герцена": "Gertsen markazi orqali TRKI", "ТРКИ через центр РУДН": "RUDN markazi orqali TRKI", "Патент, РВП, ВНЖ": "Patent, RVP, VNJ",
        /* Курс и урок */
        "Пройдено": "O‘tildi", "Начать": "Boshlash", "Продолжить": "Davom etish", "Курс пройден": "Kurs tugatildi", "терминов": "ta atama",
        "Теория": "Nazariya", "Термины": "Atamalar", "Тест": "Test", "Термины урока": "Dars atamalari", "Проверьте себя": "O‘zingizni tekshiring",
        "Урок пройден": "Dars o‘tildi", "К курсу": "Kursga", "Отметить как изученное": "O‘rganildi deb belgilash", "Изучено": "O‘rganildi",
        "Пройти заново": "Qaytadan o‘tish", "Правильно": "To‘g‘ri", "Верно": "To‘g‘ri", "Неверно": "Noto‘g‘ri", "Показать ответ": "Javobni ko‘rsatish", "Скрыть ответ": "Javobni yashirish",
        "Правильный ответ": "To‘g‘ri javob", "Страница не найдена": "Sahifa topilmadi", "Возможно, раздел ещё не готов.": "Bo‘lim hali tayyor bo‘lmasligi mumkin.", "На главную": "Bosh sahifaga",
        "Этот урок пока только на русском языке.": "Bu dars hozircha faqat rus tilida.",
        /* Экзамен */
        "Пробный экзамен": "Sinov imtihoni", "Начать экзамен": "Imtihonni boshlash", "Завершить": "Yakunlash", "Завершить экзамен": "Imtihonni yakunlash", "Отвечено": "Javob berildi",
        "Время вышло!": "Vaqt tugadi!", "Экзамен завершён": "Imtihon yakunlandi", "Раздел": "Bo‘lim", "Результат": "Natija", "Ниже показаны правильные ответы и объяснения.": "Quyida to‘g‘ri javoblar va izohlar berilgan.",
        "Вы ответили не на все вопросы. Завершить экзамен?": "Barcha savollarga javob bermadingiz. Imtihonni yakunlaysizmi?",
        /* Словарь и поиск */
        "Все": "Hammasi", "Учить на карточках": "Kartochkalarda o‘rganish", "Найти термин или слово в определении…": "Atama yoki ta’rifdagi so‘zni qidirish…", "Ничего не найдено.": "Hech narsa topilmadi.",
        "Поиск: термин, правило, тема…": "Qidiruv: atama, qoida, mavzu…", "Поиск": "Qidiruv", "Уроки": "Darslar", "Совпадений в уроках нет.": "Darslarda mos natija yo‘q.", "Введите минимум 2 символа.": "Kamida 2 ta belgi kiriting.",
        /* Игры */
        "Тренируйте термины, ударения, орфографию и грамматику. За игры начисляются опыт и монеты.": "Atamalar, urg‘u, imlo va grammatikani mashq qiling. O‘yinlar uchun tajriba va tangalar beriladi.",
        "Карточки терминов": "Atama kartochkalari", "Переворачивайте карточки и запоминайте термины с определениями.": "Kartochkalarni ag‘daring va atamalarni ta’riflari bilan yodlang.",
        "Найди пару": "Juftini top", "Соедините термин с его определением.": "Atamani ta’rifi bilan bog‘lang.", "Угадай термин": "Atamani top", "По определению отгадайте слово по буквам. 6 жизней.": "Ta’rifga qarab so‘zni harfma-harf toping. 6 ta jon.",
        "Микс-викторина": "Aralash viktorina", "10 случайных вопросов из тестов всех уроков.": "Barcha dars testlaridan 10 ta tasodifiy savol.", "Ударение": "Urg‘u", "Вставь букву": "Harfni qo‘y", "Орфография: выберите пропущенную букву.": "Imlo: tushib qolgan harfni tanlang.",
        "Падежи и формы": "Kelishiklar va shakllar", "Выберите правильную грамматическую форму слова.": "So‘zning to‘g‘ri grammatik shaklini tanlang.", "Собери предложение": "Gap tuz", "Расставьте слова в правильном порядке.": "So‘zlarni to‘g‘ri tartibda joylashtiring.",
        "Верно или неверно": "To‘g‘ri yoki noto‘g‘ri", "Блиц на 60 секунд: оцените утверждения о языке.": "60 soniyalik blits: til haqidagi fikrlarni baholang.", "Фразеологизмы": "Frazeologizmlar", "Выберите значение устойчивого выражения.": "Turg‘un iboraning ma’nosini tanlang.",
        "Нажмите на ударную гласную: звонИт, тОрты, красИвее…": "Urg‘uli unlini bosing: звонИт, тОрты, красИвее…",
        "Все темы": "Barcha mavzular", "Ещё раз": "Yana bir marta", "Все игры": "Barcha o‘yinlar", "Дальше": "Keyingisi", "Проверить": "Tekshirish", "Знаю": "Bilaman", "Повторить позже": "Keyinroq takrorlash",
        "Нажмите, чтобы перевернуть": "Ag‘darish uchun bosing", "Сначала переверните карточку": "Avval kartochkani ag‘daring", "Нажмите на ударную гласную": "Urg‘uli unlini bosing", "Великолепно!": "Ajoyib!", "Отлично!": "A’lo!", "Хорошо, но можно лучше": "Yaxshi, lekin yanada yaxshiroq bo‘lishi mumkin", "Нужно ещё потренироваться": "Yana mashq qilish kerak",
        "Разбор ошибок": "Xatolar tahlili", "Угадано!": "Topildi!", "Клавиши: ← неверно, → верно": "Tugmalar: ← noto‘g‘ri, → to‘g‘ri", "Пробел — перевернуть, → — знаю, ← — повторить": "Probel — ag‘darish, → — bilaman, ← — takrorlash",
        "Нажимайте на слова по порядку. Нажмите на слово в строке, чтобы вернуть его.": "So‘zlarni tartib bilan bosing. Qaytarish uchun qatordagi so‘zni bosing.",
        /* Достижения, магазин, профиль, настройки */
        "Сохранить имя": "Ismni saqlash", "Ваше имя": "Ismingiz", "Цель": "Maqsad", "Не выбрана": "Tanlanmagan", "Выбрать цель": "Maqsadni tanlash", "Экзаменов сдано": "Topshirilgan imtihonlar", "Терминов выучено": "O‘rganilgan atamalar",
        "Прогресс по курсам": "Kurslar bo‘yicha natija", "Курс": "Kurs", "Прогресс": "Natija", "Пока нет начатых курсов.": "Hali boshlangan kurslar yo‘q.", "Имя сохранено": "Ism saqlandi",
        "Бесплатно": "Bepul", "Выбран": "Tanlangan", "Выбрать": "Tanlash", "Купить": "Sotib olish", "Тема оформления": "Mavzu", "Тёмная": "Qorong‘i", "Светлая": "Yorug‘", "Анимированный фон (частицы)": "Jonli fon (zarrachalar)",
        "Скорость озвучки": "Ovoz tezligi", "Проверить озвучку": "Ovozni tekshirish", "Прогресс хранится только в этом браузере на этом устройстве.": "Natijalar faqat shu qurilmadagi brauzerda saqlanadi.", "Скачать прогресс": "Natijani yuklab olish", "Загрузить прогресс": "Natijani yuklash", "Сбросить весь прогресс": "Barcha natijani o‘chirish", "Прогресс загружен": "Natija yuklandi", "Прогресс сброшен": "Natija o‘chirildi",
        "Первый шаг": "Birinchi qadam", "Пройдите первый урок": "Birinchi darsni o‘ting", "Прилежный ученик": "Tirishqoq o‘quvchi", "Пройдите 10 уроков": "10 ta darsni o‘ting", "Знаток": "Bilimdon", "Пройдите 50 уроков": "50 ta darsni o‘ting", "Академик": "Akademik", "Пройдите 100 уроков": "100 ta darsni o‘ting",
        "Без единой ошибки": "Bitta ham xatosiz", "Наберите 100% в тесте или экзамене": "Test yoki imtihonda 100% oling", "Экзамен сдан": "Imtihon topshirildi", "Сдайте пробный экзамен": "Sinov imtihonini topshiring", "Отличник": "A’lochi", "Пробный экзамен на 90% и выше": "Sinov imtihoni 90% va undan yuqori",
        "Три дня подряд": "Ketma-ket uch kun", "Занимайтесь 3 дня подряд": "3 kun ketma-ket shug‘ullaning", "Неделя без пропусков": "Bo‘shliqsiz hafta", "Занимайтесь 7 дней подряд": "7 kun ketma-ket shug‘ullaning", "Уровень 5": "5-daraja", "Достигните 5 уровня": "5-darajaga yeting", "Уровень 10": "10-daraja", "Достигните 10 уровня": "10-darajaga yeting",
        "Игрок": "O‘yinchi", "Сыграйте 10 игр": "10 ta o‘yin o‘ynang", "Чемпион игр": "O‘yinlar chempioni", "Сыграйте 50 игр": "50 ta o‘yin o‘ynang", "Словарный запас": "So‘z boyligi", "Выучите 50 терминов на карточках": "Kartochkalarda 50 ta atama o‘rganing", "Ходячий словарь": "Yurar lug‘at", "Выучите 200 терминов": "200 ta atama o‘rganing", "Азбука освоена": "Alifbo o‘zlashtirildi", "Пройдите курс A0 полностью": "A0 kursini to‘liq o‘ting", "Покупатель": "Xaridor", "Купите аватар в магазине": "Do‘kondan avatar sotib oling",
        /* Повторение */
        "Работа над ошибками и повторение": "Xatolar ustida ishlash va takrorlash", "Вопросы, в которых вы ошиблись, и выученные термины возвращаются через 1, 3, 7 и 14 дней.": "Xato qilgan savollaringiz va o‘rgangan atamalaringiz 1, 3, 7 va 14 kundan keyin qaytadi.",
        "Сегодня": "Bugun", "В очереди всего": "Navbatda jami", "Начать повторение": "Takrorlashni boshlash", "Сегодня повторять нечего": "Bugun takrorlash uchun hech narsa yo‘q", "Ошибки из тестов и термины с карточек появятся здесь.": "Testlardagi xatolar va kartochkalardagi atamalar shu yerda paydo bo‘ladi.", "Не помню": "Eslay olmayman", "Повторение завершено": "Takrorlash yakunlandi", "Открыть урок": "Darsni ochish", "Показать значение": "Ma’nosini ko‘rsatish", "К повторению": "Takrorlashga",
        /* Тест на уровень */
        "Определите свой уровень": "Darajangizni aniqlang", "Вопросы становятся сложнее от A1 до C1. Если на уровне меньше 4 верных ответов из 6, тест остановится. Это займёт 5–15 минут.": "Savollar A1 dan C1 gacha qiyinlashadi. Agar darajada 6 tadan 4 tadan kam to‘g‘ri javob bo‘lsa, test to‘xtaydi. Bu 5–15 daqiqa oladi.",
        "Начать тест": "Testni boshlash", "Я не читаю по-русски — начать с алфавита": "Men ruscha o‘qiy olmayman — alifbodan boshlash", "Ваш уровень": "Darajangiz", "Рекомендуем начать": "Boshlashni tavsiya qilamiz", "Начать курс": "Kursni boshlash", "Пройти тест ещё раз": "Testni qayta topshirish", "Разбор ваших ошибок": "Xatolaringiz tahlili", "Ваш ответ": "Javobingiz", "Ещё не изучали русский": "Hali rus tilini o‘rganmagansiz", "Основы уже знакомы": "Asoslar tanish", "Определить уровень": "Darajani aniqlash", "Не знаете, с чего начать? Пройдите тест на уровень.": "Nimadan boshlashni bilmaysizmi? Daraja testini topshiring."
    },

    patterns: [
        [/Повторите задания, чтобы набрать (\d+)%/, "$1% to‘plash uchun topshiriqlarni takrorlang"],
        [/^Правильно (\d+) из (\d+)$/, "To‘g‘ri: $1 / $2"],
        [/^Русский язык от первой буквы до сертификата: (\d+) курсов, (\d+) уроков, (\d+) терминов с примерами, пробные экзамены с таймером и игры для тренировки\.$/, "Rus tili birinchi harfdan sertifikatgacha: $1 ta kurs, $2 ta dars, misollar bilan $3 ta atama, taymerli sinov imtihonlari va o‘yinlar."],
        [/© (\d+) Russian Academy · .+$/, "© $1 Russian Academy · Rus tili: alifbodan sertifikatgacha"],
        [/Мой путь: (.+)$/, (_, a) => "Mening yo‘lim: " + RA.t(a)],
        [/Цель выбрана: (.+)$/, (_, a) => "Maqsad tanlandi: " + RA.t(a)],
        [/^(.*)Начать: (.+)$/, "$1Boshlash: $2"],
        [/^(.*)Продолжить: (.+)$/, "$1Davom etish: $2"],
        [/Все термины платформы с определениями и примерами — (\d+) шт\. .+$/, "Platformaning barcha atamalari ta’rif va misollar bilan — $1 ta. Darsni ochish uchun manbani bosing."],
        [/^Найдено: (\d+)( \(показаны первые 300 — уточните поиск\))?$/, (_, a, b) => "Topildi: " + a + (b ? " (dastlabki 300 tasi ko‘rsatildi — qidiruvni aniqlashtiring)" : "")],
        [/Открыто (\d+) из (\d+)\. За каждое — (\d+) монет\.$/, "Ochildi: $1 / $2. Har biri uchun $3 tanga."],
        [/Покупайте аватары за монеты\. У вас (.+)\.$/, "Avatarlarni tangaga sotib oling. Sizda $1."],
        [/Уровень (\d+) · всего (\d+) XP/, "Daraja $1 · jami $2 XP"],
        [/^🔍 Поиск: (.+)$/, "🔍 Qidiruv: $1"],
        [/Цель выполнена! (\d+) XP сегодня/, "Maqsad bajarildi! Bugun $1 XP"],
        [/Новый уровень: (\d+)! \+25 монет/, "Yangi daraja: $1! +25 tanga"],
        [/Достижение: (.+) \(\+20 монет\)/, (_, a) => "Yutuq: " + RA.t(a) + " (+20 tanga)"],
        [/^Урок (\d+) из (\d+)$/, "Dars $1 / $2"],
        [/^Вопрос (\d+) \/ (\d+)$/, "Savol $1 / $2"],
        [/^Карточка (\d+) \/ (\d+)$/, "Kartochka $1 / $2"],
        [/^Слово (\d+) \/ (\d+)$/, "So‘z $1 / $2"],
        [/^Раунд (\d+) \/ (\d+)$/, "Raund $1 / $2"],
        [/^Задание (\d+) \/ (\d+)$/, "Topshiriq $1 / $2"],
        [/^Предложение (\d+) \/ (\d+)$/, "Gap $1 / $2"],
        [/^(\d+) (урок|урока|уроков)$/, "$1 ta dars"],
        [/^(\d+) (курс|курса|курсов)$/, "$1 ta kurs"],
        [/^(\d+) терминов$/, "$1 ta atama"],
        [/^Наберите 50 XP: (.+)$/, "50 XP to‘plang: $1"],
        [/^Сыграно: (\d+) · рекорд: (\d+)$/, "O‘ynaldi: $1 · rekord: $2"],
        [/^Знаю: (\d+)$/, "Bilaman: $1"],
                [/^Ответов: (\d+)$/, "Javoblar: $1"]
    ],

    t(text) {
        if (RA.i18n.lang() !== "uz" || !text) return text;
        const full = String(text).trim();
        const d = RA.i18n.dict;
        if (d[full]) return String(text).replace(full, d[full]);
        const m = full.match(/^([^А-Яа-яЁё]*)([\s\S]*?)([^А-Яа-яЁё]*)$/);
        if (!m || !m[2]) return text;
        let core = d[m[2]];
        if (!core) {
            const p = RA.i18n.patterns.find(x => x[0].test(full));
            if (p) return String(text).replace(full, full.replace(p[0], p[1]));
            const pc = RA.i18n.patterns.find(x => x[0].test(m[2]));
            if (pc) core = m[2].replace(pc[0], pc[1]);
        }
        return core ? String(text).replace(full, m[1] + core + m[3]) : text;
    },

    lang() {
        return (RA.store.data && RA.store.data.settings.lang) || "ru";
    },

    translateNode(node) {
        if (node.nodeType === 3) {
            if (!/[А-Яа-яЁё]/.test(node.nodeValue)) return;
            const parent = node.parentElement;
            if (!parent || parent.closest(RA.i18n.skip)) return;
            const out = RA.i18n.t(node.nodeValue);
            if (out !== node.nodeValue) node.nodeValue = out;
            return;
        }
        if (node.nodeType !== 1 || node.closest(RA.i18n.skip)) return;
        ["placeholder", "title", "aria-label"].forEach(a => {
            if (node.hasAttribute(a)) node.setAttribute(a, RA.i18n.t(node.getAttribute(a)));
        });
        node.childNodes.forEach(c => RA.i18n.translateNode(c));
    },

    start() {
        document.documentElement.lang = this.lang() === "uz" ? "uz" : "ru";
        if (this.lang() !== "uz") return;
        this.translateNode(document.body);
        new MutationObserver(list => list.forEach(m => m.addedNodes.forEach(n => this.translateNode(n))))
            .observe(document.body, { childList: true, subtree: true });
    },

    /* Смена языка: страница перезагружается, русский текст возвращается сам */
    setLang(lang) {
        if ((RA.Exam && RA.Exam.timerId) || RA.busy || (RA.Practice && (RA.Practice.activeCard || RA.Practice.timers.length))) {
            if (!confirm(RA.t("Смена языка прервёт тест, результат не сохранится. Продолжить?"))) return;
        }
        RA.store.data.settings.lang = lang === "uz" ? "uz" : "ru";
        RA.store.save();
        location.reload();
    }
};

RA.t = RA.i18n.t;

/* Названия и описания курсов, для которых нет полного перевода уроков */
[
    ["a2", "A2 — Bazaviy daraja (TBU)", "Barcha oltita kelishik, fe’l turi, buyruq mayli, harakat fe’llari, qiyoslash, sonlar va vaqt."],
    ["b1", "B1 — Birinchi daraja (TRKI-1)", "Sifatdosh va ravishdosh, majhul nisbat, «который», shart mayli, o‘zlashtirma gap, fe’l boshqaruvi."],
    ["b2", "B2 — Ikkinchi daraja (TRKI-2)", "Funksional uslublar, murakkab sintaksis, paronimlar, dalilli insho, ish hujjatlari, TRKI-2 strategiyalari."],
    ["c1", "C1 — Erkin bilish (TRKI-3)", "Uslub, ritorika, matn tahlili, troplar, akademik yozuv, til madaniyati."],
    ["th_phonetics", "Fonetika, grafika, orfoepiya", "Tovush va harflar, urg‘u, fonetik jarayonlar, transkripsiya va talaffuz me’yorlari."],
    ["th_lexicon", "Leksika va frazeologiya", "So‘z ma’nosi, omonim, sinonim, antonim, paronim, frazeologizmlar, lug‘atlar."],
    ["th_morphemics", "Morfemika va so‘z yasalishi", "So‘z tarkibi, morfem tahlil, o‘zakdagi almashinuvlar, so‘z yasash usullari."],
    ["th_morphology", "Morfologiya: so‘z turkumlari", "Barcha so‘z turkumlari: ma’nosi, turlari, turlanish va tuslanish jadvallari, tahlil."],
    ["th_syntax", "Sintaksis", "So‘z birikmasidan qo‘shma gapgacha: gap bo‘laklari, gap turlari, sintaktik tahlil."],
    ["th_punctuation", "Tinish belgilari", "Tinish belgilarining asosiy qoidalari: tire, vergul, kirish so‘zlar, ko‘chirma gap."],
    ["th_spelling", "Imlo", "Rus imlosining asosiy qoidalari: unli va undoshlar, old qo‘shimcha va qo‘shimchalar, Н/НН, НЕ va НИ."],
    ["th_style", "Stilistika va nutq madaniyati", "Nutq uslublari va turlari, matn tuzilishi, til me’yorlari, nutq odobi."],
    ["school_1_4", "1–4-sinflar", "Alifbo, tovush va harflar, yozuv qoidalari, so‘z tarkibi, so‘z turkumlari, kelishiklar."],
    ["school_5_6", "5–6-sinflar", "Fonetika, morfemika, leksika, sintaksis asoslari, morfologiya, son va olmosh."],
    ["school_7_9", "7–9-sinflar", "Sifatdosh, ravishdosh, ravish, yordamchi so‘zlar; sodda va qo‘shma gap; yakuniy attestatsiya."],
    ["school_10_11", "10–11-sinflar", "Maktab kursini tizimlashtirish, stilistika, matn tahlili, insho, bitiruv imtihonlari."],
    ["sp_everyday", "So‘zlashuv: kundalik vaziyatlar", "Tanishuv, do‘kon, kafe, transport, shifokor, bank, ish, ijara: dialog va iboralar."],
    ["sp_live", "Jonli nutq: odob, ohang, idiomalar", "Nutq odobi, ИК-1…ИК-5 ohanglari, yuklamalar, qisqartmalar, idiomalar, jargon va muomala madaniyati."],
    ["cert_uz", "O‘zbekiston Milliy sertifikati (rus tili)", "Rus tili va adabiyoti bo‘yicha Milliy sertifikat imtihoniga tayyorgarlik: format, ballar, bo‘limlar va sinov testlari."],
    ["trki", "TRKI: umumiy tayyorgarlik (A1–C1)", "Darajalar, beshta subtest, strategiyalar va sinov imtihonlari."],
    ["herzen", "Gertsen universiteti sertifikati", "Gertsen universitetida TRKI topshirish: test markazi, tartib, reja, sinov testlari."],
    ["rudn", "RUDN sertifikati", "RUDNda TRKI topshirish: test markazi, tartib, reja, Gertsen bilan taqqoslash."],
    ["migrant", "Migrantlar uchun kompleks imtihon", "Patent, RVP va VNJ uchun rus tili, Rossiya tarixi va qonunchilik asoslari."],
    ["adm_uz", "O‘zbekiston oliygohlariga kirish testi (rus tili)", "Kirish testi tuzilishi, ko‘p tekshiriladigan mavzular va uchta sinov testi."],
    ["adm_ru", "Rossiya oliygohlari va Toshkentdagi filiallar", "Kvota, rus tili sinovi, filiallar, suhbat, motivatsion xat."],
    ["adm_writing", "Insho, bayon va matn tahlili", "Mulohaza inshosi tuzilishi, adabiy dalillar, qisqa bayon va baholash mezonlari."]
].forEach(([id, title, desc]) => RA.addUzCourse(id, { title, desc }));

;
"use strict";

/* ==========================================================
   Отрисовка уроков, терминов, тестов и экзаменов
   Тексты уроков — авторский контент (HTML разрешён);
   всё, что вводит пользователь, экранируется через esc().
========================================================== */

RA.render = {

    blocks(blocks) {
        return (blocks || []).map(b => this.block(b)).join("");
    },

    box(cls, icon, b) {
        const title = b.title ? `<div class="boxTitle">${icon} ${b.title}</div>` : `<div class="boxTitle">${icon}</div>`;
        return `<div class="box ${cls}">${title}<div>${b.text}</div></div>`;
    },

    block(b) {
        switch (b.t) {
            case "h": return `<h3>${b.text}</h3>`;
            case "p": return `<p>${b.text}</p>`;
            case "list": {
                const tag = b.ordered ? "ol" : "ul";
                return `<${tag}>${b.items.map(i => `<li>${i}</li>`).join("")}</${tag}>`;
            }
            case "table":
                return `<div class="tableWrap"><table><thead><tr>${b.head.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${b.rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
            case "rule": return this.box("rule", "📌" + (b.title ? "" : " " + RA.t("Правило")), b);
            case "note": return this.box("note", "📝" + (b.title ? "" : " " + RA.t("Заметка")), b);
            case "warn": return this.box("warn", "⚠️" + (b.title ? "" : " " + RA.t("Внимание")), b);
            case "tip":  return this.box("tip", "💡" + (b.title ? "" : " " + RA.t("Совет")), b);
            case "ex":
                return (b.title ? `<h3>${RA.t(b.title)}</h3>` : "") + `<ul class="examples">${b.items.map(i => {
                    if (typeof i === "string") return `<li>${i} ${this.speakBtn(i)}</li>`;
                    return `<li>${i.ru} ${this.speakBtn(i.ru)}${i.tr ? `<div class="tr">${i.tr}</div>` : ""}</li>`;
                }).join("")}</ul>`;
            case "dialog":
                return (b.title ? `<h3>${RA.t(b.title)}</h3>` : "") + `<div class="dialog">${b.lines.map(l =>
                    `<div class="line"><div class="who">${l[0]}</div><div class="say">${l[1]} ${this.speakBtn(l[1])}${l[2] ? `<span class="tr">${l[2]}</span>` : ""}</div></div>`
                ).join("")}</div>`;
            case "task":
                return `<div class="task"><div>✏️ ${b.text}</div><button class="btn ghost small" data-act="toggleTask" style="margin-top:10px">${RA.t("Показать ответ")}</button><div class="answer">✅ ${b.answer}</div></div>`;
            default:
                return "";
        }
    },

    speakBtn(text) {
        if (!("speechSynthesis" in window)) return "";
        return `<button class="speak" data-act="speak" data-text="${RA.util.esc(RA.util.plain(text))}" title="${RA.t("Послушать")}">🔊</button>`;
    },

    terms(terms) {
        if (!terms || !terms.length) return "";
        return `<div class="terms">${terms.map(t => this.term(t)).join("")}</div>`;
    },

    term(t0, withSource) {
        const t = RA.loc.term(t0);
        return `<div class="term">
            <b>${t.term} ${this.speakBtn(t.term)}</b>
            <div class="def">${t.def}</div>
            ${t.ex ? `<div class="ex">${RA.t("Пример")}: ${t.ex}</div>` : ""}
            ${t.uz ? `<div class="uz">🇺🇿 ${t.uz}</div>` : ""}
            ${withSource && t.where ? `<div class="small" style="margin-top:6px"><a href="#/lesson/${t.course}/${t.lesson}">${t.where}</a></div>` : ""}
        </div>`;
    }
};

/* ==========================================================
   Тест урока: все вопросы на одной странице,
   мгновенная проверка + объяснение.
========================================================== */

RA.Quiz = {

    mount(container, source, onFinish) {
        const questions = source.map(q => RA.util.shuffleOptions(q));
        const state = { answered: 0, correct: 0, total: questions.length };
        container.innerHTML = `<div class="quiz">${questions.map((q, qi) => `
            <div class="qBlock" data-qi="${qi}">
                <div class="q">${qi + 1}. ${q.q}</div>
                <div class="options">${q.o.map((o, oi) => `<button class="opt" data-oi="${oi}">${o}</button>`).join("")}</div>
                <div class="explainSlot"></div>
            </div>`).join("")}
            <div class="quizSummary"></div>
        </div>`;

        container.querySelectorAll(".qBlock").forEach(block => {
            const qi = Number(block.dataset.qi);
            const q = questions[qi];
            block.querySelectorAll(".opt").forEach(btn => {
                btn.addEventListener("click", () => {
                    const oi = Number(btn.dataset.oi);
                    block.querySelectorAll(".opt").forEach((b, i) => {
                        b.disabled = true;
                        if (i === q.a) b.classList.add("correct");
                    });
                    const right = oi === q.a;
                    if (!right) { btn.classList.add("wrong"); RA.store.srsWrong(RA.qKey(q)); }
                    state.answered++;
                    if (right) state.correct++;
                    block.querySelector(".explainSlot").innerHTML =
                        `<div class="explain">${right ? "✅ " + RA.t("Верно") + "." : "❌ " + RA.t("Неверно") + ". " + RA.t("Правильный ответ") + ": <b>" + q.o[q.a] + "</b>."} ${q.e || ""}</div>`;
                    if (state.answered === state.total) {
                        const percent = Math.round(state.correct / state.total * 100);
                        container.querySelector(".quizSummary").innerHTML = `
                            <div class="card result" style="margin-top:18px">
                                <div class="big">${percent}%</div>
                                <p>Правильно ${state.correct} из ${state.total}</p>
                                <div class="btnRow" style="justify-content:center">
                                    <button class="btn ghost" data-act="retryQuiz">🔄 Пройти заново</button>
                                </div>
                            </div>`;
                        container.querySelector("[data-act=retryQuiz]").onclick = () => RA.Quiz.mount(container, RA.util.shuffle(source), onFinish);
                        onFinish && onFinish(percent, state);
                    }
                });
            });
        });
    }
};

/* ==========================================================
   Экзамен: таймер, разделы, итог по разделам, порог прохождения
========================================================== */

RA.Exam = {

    timerId: null,
    attempt: 0,

    stop() {
        clearInterval(this.timerId);
        this.timerId = null;
        RA.audio.stop();
    },

    start(container, ctx) {
        const { course } = ctx;
        /* Варианты перемешиваются при каждой попытке; исходные данные не меняем */
        const lesson = {
            ...ctx.lesson,
            sections: ctx.lesson.sections.map(sec => ({ ...sec, questions: sec.questions.map(q => RA.util.shuffleOptions(q)) }))
        };
        const answers = {};
        const total = lesson.sections.reduce((s, sec) => s + sec.questions.length, 0);
        const deadline = Date.now() + lesson.time * 60000;
        const pass = lesson.pass || 66;

        container.innerHTML = `
            <div class="examBar">
                <div><b>${lesson.title}</b><div class="small">Отвечено: <span id="exAnswered">0</span> / ${total} · порог ${pass}%</div></div>
                <div class="timer" id="exTimer"></div>
                <button class="btn" id="exFinish">Завершить</button>
            </div>
            ${lesson.sections.map((sec, si) => `
                <div class="card" style="margin-bottom:16px">
                    <h2>${sec.title}</h2>
                    ${sec.info ? `<p>${sec.info}</p>` : ""}
                    ${sec.audio
                        ? `<div class="audioBox" data-si="${si}"><button class="btn small playAudio">🔊 <span>Слушать</span></button>
                            <span class="chip"><span>Осталось прослушиваний</span>: <b class="playsLeft">${sec.plays || 2}</b></span>
                            <div class="bar"><div class="audioFill" style="width:0"></div></div><div class="audioMsg small"></div></div>
                           <div class="transcript"></div>`
                        : sec.text ? `<div class="readText">${sec.text}</div>` : ""}
                    ${sec.questions.map((q, qi) => `
                        <div class="qBlock" data-key="${si}-${qi}">
                            <div class="q">${qi + 1}. ${q.q}</div>
                            <div class="options">${q.o.map((o, oi) => `<button class="opt" data-oi="${oi}">${o}</button>`).join("")}</div>
                            <div class="explainSlot"></div>
                        </div>`).join("")}
                </div>`).join("")}
            <div class="btnRow"><button class="btn" id="exFinish2">✅ Завершить экзамен</button></div>`;

        const timerEl = container.querySelector("#exTimer");
        const tick = () => {
            const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
            const m = Math.floor(left / 60), s = left % 60;
            timerEl.textContent = "⏱ " + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
            timerEl.classList.toggle("low", left <= 60);
            if (left <= 0) finish(true);
        };

        container.querySelectorAll(".qBlock").forEach(block => {
            block.querySelectorAll(".opt").forEach(btn => btn.addEventListener("click", () => {
                if (!RA.Exam.timerId) return;
                block.querySelectorAll(".opt").forEach(b => b.classList.remove("chosen"));
                btn.classList.add("chosen");
                answers[block.dataset.key] = Number(btn.dataset.oi);
                container.querySelector("#exAnswered").textContent = Object.keys(answers).length;
            }));
        });

        /* Аудирование: ограничение прослушиваний */
        const attempt = ++this.attempt;
        const active = () => this.timerId && attempt === this.attempt;
        const unlock = () => container.querySelectorAll(".playAudio").forEach(b => {
            b.disabled = Number(b.dataset.left) <= 0;
        });
        container.querySelectorAll(".audioBox").forEach(box => {
            const sec = lesson.sections[Number(box.dataset.si)];
            const btn = box.querySelector(".playAudio");
            const fill = box.querySelector(".audioFill");
            btn.dataset.left = sec.plays || 2;
            /* Без рабочего голоса слушать нечем: показываем текст, чтобы тест остался проходимым */
            const fallback = () => {
                box.querySelector(".audioMsg").textContent = RA.t("На этом устройстве нет русского голоса, поэтому текст показан для чтения.");
                box.nextElementSibling.innerHTML = `<div class="readText">${sec.text}</div>`;
                btn.remove();
                unlock();
            };
            btn.onclick = async () => {
                if (!active() || Number(btn.dataset.left) <= 0) return;
                container.querySelectorAll(".playAudio").forEach(b => { b.disabled = true; });
                const voice = await RA.audio.ruVoice();
                if (!active()) return;
                if (!voice) { fallback(); return; }
                btn.dataset.left = Number(btn.dataset.left) - 1;
                box.querySelector(".playsLeft").textContent = btn.dataset.left;
                RA.audio.play(sec.text, voice, () => {
                    fill.style.width = "100%";
                    unlock();
                }, p => { fill.style.width = Math.round(p * 100) + "%"; }, fallback);
            };
        });

        const finish = (timeout) => {
            if (!this.timerId) return;
            if (!timeout && Object.keys(answers).length < total &&
                !confirm(RA.t("Вы ответили не на все вопросы. Завершить экзамен?"))) return;
            this.stop();
            let correct = 0;
            const bySection = lesson.sections.map((sec, si) => {
                let ok = 0;
                sec.questions.forEach((q, qi) => {
                    const key = si + "-" + qi;
                    const block = container.querySelector(`[data-key="${key}"]`);
                    const chosen = answers[key];
                    block.querySelectorAll(".opt").forEach((b, i) => {
                        b.disabled = true;
                        b.classList.remove("chosen");
                        if (i === q.a) b.classList.add("correct");
                        else if (i === chosen) b.classList.add("wrong");
                    });
                    const right = chosen === q.a;
                    if (right) { ok++; correct++; } else { RA.store.srsWrong(RA.qKey(q)); }
                    block.querySelector(".explainSlot").innerHTML =
                        `<div class="explain">${chosen === undefined ? "⚪ Нет ответа." : right ? "✅ Верно." : "❌ Неверно."} ${q.e || ""}</div>`;
                });
                return { title: sec.title, ok, n: sec.questions.length };
            });
            const percent = Math.round(correct / total * 100);
            const passed = percent >= pass;
            const key = course.id + "/" + lesson.id;
            const prevBest = RA.store.data.exams[key] || 0;
            const improved = percent > prevBest;
            RA.store.data.exams[key] = Math.max(prevBest, percent);
            if (passed) {
                const first = RA.store.completeLesson(course.id, lesson.id, percent);
                if (first) { RA.store.addXP(60); RA.store.addCoins(30); }
                else if (improved) { RA.store.addXP(20); RA.store.addCoins(5); }
            } else if (improved) {
                RA.store.addXP(10);
            }
            RA.store.save();
            RA.achievements.check();

            /* После экзамена можно прочитать, что звучало */
            container.querySelectorAll(".audioBox").forEach(box => {
                const sec = lesson.sections[Number(box.dataset.si)];
                box.nextElementSibling.innerHTML = `<h3>📄 ${RA.t("Текст записи")}</h3><div class="readText">${sec.text}</div>`;
                const b = box.querySelector(".playAudio");
                if (b) b.disabled = true;
            });

            const summary = document.createElement("div");
            summary.className = "card result";
            summary.innerHTML = `
                <h2>${timeout ? "⏰ Время вышло!" : "Экзамен завершён"}</h2>
                <div class="big">${percent}%</div>
                <p>${correct} из ${total} · ${passed ? "<span style='color:var(--ok)'>✅ Порог " + pass + "% пройден</span>" : "<span style='color:var(--bad)'>❌ Порог " + pass + "% не пройден</span>"}</p>
                <div class="tableWrap lesson"><table><thead><tr><th>Раздел</th><th>Результат</th></tr></thead><tbody>
                    ${bySection.map(s => `<tr><td>${s.title}</td><td>${s.ok} / ${s.n} (${Math.round(s.ok / s.n * 100)}%)</td></tr>`).join("")}
                </tbody></table></div>
                <p class="small">Ниже показаны правильные ответы и объяснения.</p>
                <div class="btnRow" style="justify-content:center">
                    <button class="btn ghost" data-act="restartExam">🔄 Пройти заново</button>
                    <a class="btn" href="#/course/${course.id}">К курсу</a>
                </div>`;
            container.prepend(summary);
            summary.querySelector("[data-act=restartExam]").onclick = () => this.start(container, ctx);
            container.querySelectorAll("#exFinish,#exFinish2").forEach(b => b.disabled = true);
            window.scrollTo({ top: 0, behavior: "smooth" });
        };

        container.querySelector("#exFinish").onclick = () => finish(false);
        container.querySelector("#exFinish2").onclick = () => finish(false);
        this.stop();
        this.timerId = setInterval(tick, 1000);
        tick();
    }
};

;
"use strict";

/* ==========================================================
   Игры. Каждая игра: start(root, opts) → finish(score, max).
   Данные — термины и тесты уроков + RA.gameData.
========================================================== */

RA.Games = {

    list: [
        { id: "flash",  icon: "🃏", title: "Карточки терминов",   desc: "Переворачивайте карточки и запоминайте термины с определениями.", filter: true },
        { id: "match",  icon: "🧩", title: "Найди пару",          desc: "Соедините термин с его определением.", filter: true },
        { id: "guess",  icon: "🔠", title: "Угадай термин",       desc: "По определению отгадайте слово по буквам. 6 жизней.", filter: true },
        { id: "quiz",   icon: "❓", title: "Микс-викторина",      desc: "10 случайных вопросов из тестов всех уроков.", filter: true },
        { id: "stress", icon: "🎯", title: "Ударение",            desc: "Нажмите на ударную гласную: звонИт, тОрты, красИвее…" },
        { id: "letters",icon: "✏️", title: "Вставь букву",        desc: "Орфография: выберите пропущенную букву." },
        { id: "forms",  icon: "🔧", title: "Падежи и формы",      desc: "Выберите правильную грамматическую форму слова." },
        { id: "order",  icon: "🧱", title: "Собери предложение",  desc: "Расставьте слова в правильном порядке." },
        { id: "tf",     icon: "⚡", title: "Верно или неверно",   desc: "Блиц на 60 секунд: оцените утверждения о языке." },
        { id: "idioms", icon: "🗝", title: "Фразеологизмы",       desc: "Выберите значение устойчивого выражения." }
    ],

    timers: [],

    stop() {
        this.timers.forEach(t => { clearInterval(t); clearTimeout(t); });
        this.timers = [];
        document.onkeydown = null;
    },

    later(fn, ms) { this.timers.push(setTimeout(fn, ms)); },

    /* Клавиши игры: не при вводе текста, не с Ctrl/Alt/Cmd и не при удержании */
    gameKey(e) {
        return !(e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.target.closest("input,textarea,select"));
    },

    start(id, root, opts) {
        this.stop();
        opts = opts || { track: "" };
        const game = this.list.find(g => g.id === id);
        const fn = this["play_" + id];
        if (!fn) { root.innerHTML = "<p>Игра не найдена.</p>"; return; }
        this.current = { id, root, opts };
        fn.call(this, root, opts, game);
    },

    filterBar(opts) {
        return `<div class="tabs" style="justify-content:center">
            <button class="tab ${!opts.track ? "active" : ""}" data-gtrack="">Все темы</button>
            ${RA.tracks.map(t => `<button class="tab ${opts.track === t.id ? "active" : ""}" data-gtrack="${t.id}">${t.icon} ${t.title}</button>`).join("")}
        </div>`;
    },

    bindFilter(root) {
        root.querySelectorAll("[data-gtrack]").forEach(b => b.onclick = () => this.start(this.current.id, root, { track: b.dataset.gtrack }));
    },

    terms(opts) {
        return RA.allTerms().filter(t => !opts.track || t.track === opts.track).map(t => RA.loc.term(t));
    },

    empty(root, text) {
        root.innerHTML = `<p class="empty">${text || "Недостаточно данных для этой игры. Попробуйте другую тему."}</p>`;
    },

    stats(parts) {
        return `<div class="gameStats">${parts.map(p => `<span class="chip">${p}</span>`).join("")}</div>`;
    },

    finish(root, score, max, extra) {
        this.stop();
        const id = this.current.id;
        const xp = Math.round(score * 3);
        const coins = Math.round(score);
        if (score > 0) {
            RA.store.recordGame(id, score);
            RA.store.addXP(xp);
            RA.store.addCoins(coins);
            RA.achievements.check();
        }
        const stat = RA.store.data.games[id] || { best: 0 };
        const percent = max ? Math.round(score / max * 100) : 0;
        const msg = percent >= 90 ? "Великолепно! 🌟" : percent >= 70 ? "Отлично! 👏" : percent >= 50 ? "Хорошо, но можно лучше 💪" : "Нужно ещё потренироваться 📚";
        root.innerHTML = `<div class="result">
            <h2>${msg}</h2>
            <div class="big">${score}${max ? " / " + max : ""}</div>
            <p>+${xp} XP · +${coins} 💰 · рекорд: ${stat.best}</p>
            ${extra || ""}
            <div class="btnRow" style="justify-content:center">
                <button class="btn" id="again">🔄 Ещё раз</button>
                <a class="btn ghost" href="#/games">Все игры</a>
            </div></div>`;
        root.querySelector("#again").onclick = () => this.start(id, root, this.current.opts);
    },

    shortDef(def, n) {
        const t = RA.util.plain(def);
        return t.length > (n || 140) ? t.slice(0, n || 140) + "…" : t;
    },

    /* ---------- Карточки ---------- */
    play_flash(root, opts) {
        const all = this.terms(opts);
        if (!all.length) return this.empty(root);
        const learned = RA.store.data.learnedTerms;
        const pool = all.filter(t => !learned[t.term]);
        const cards = RA.util.pick(pool.length >= 5 ? pool : all, 20);
        let i = 0, know = 0;
        const retried = new Set();
        const draw = () => {
            if (i >= cards.length) return this.finish(root, know, cards.length, `<p class="small">Выучено терминов всего: ${Object.keys(learned).length} из ${RA.allTerms().length}</p>`);
            const t = cards[i];
            root.innerHTML = this.filterBar(opts) + this.stats([`Карточка ${i + 1} / ${cards.length}`, `✅ Знаю: ${know}`, `📚 Выучено всего: ${Object.keys(learned).length}`]) + `
                <div class="flash" id="flash"><div class="flashInner">
                    <div class="flashFace"><div class="word">${t.term}</div><div class="sub">${RA.t("Нажмите, чтобы перевернуть")}</div></div>
                    <div class="flashFace back"><div>${this.shortDef(t.def, 260)}</div>${t.ex ? `<div class="sub">${RA.t("Пример")}: ${RA.util.plain(t.ex)}</div>` : ""}${t.uz ? `<div class="sub">🇺🇿 ${t.uz}</div>` : ""}</div>
                </div></div>
                <div class="btnRow" style="justify-content:center">
                    <button class="btn ghost" id="again2">🔁 Повторить позже</button>
                    <button class="btn" id="know" disabled title="Сначала переверните карточку">✅ Знаю</button>
                </div><p class="small">Пробел — перевернуть, → — знаю, ← — повторить</p>`;
            this.bindFilter(root);
            const flash = root.querySelector("#flash");
            flash.onclick = () => {
                flash.classList.toggle("flipped");
                root.querySelector("#know").disabled = false;
                if (flash.classList.contains("flipped")) RA.util.speak(t.term);
            };
            root.querySelector("#know").onclick = () => {
                if (!retried.has(t.term)) know++; /* очко — только если знали с первого раза */
                learned[t.term] = true;
                RA.store.srsLearned("t:" + t.term);
                RA.store.save();
                i++;
                draw();
            };
            root.querySelector("#again2").onclick = () => {
                retried.add(t.term);
                RA.store.srsWrong("t:" + t.term);
                if (i < cards.length - 1) { cards.push(t); cards.splice(i, 1); }
                draw();
            };
            document.onkeydown = (e) => {
                if (!this.gameKey(e)) return;
                if (e.code === "Space") { e.preventDefault(); flash.click(); }
                if (e.key === "ArrowRight") root.querySelector("#know").click();
                if (e.key === "ArrowLeft") root.querySelector("#again2").click();
            };
        };
        draw();
    },

    /* ---------- Найди пару ---------- */
    play_match(root, opts) {
        const all = this.terms(opts);
        if (all.length < 6) return this.empty(root);
        let round = 0, score = 0, mistakes = 0;
        const rounds = 3;
        const drawRound = () => {
            if (round >= rounds) return this.finish(root, score, rounds * 6, `<p class="small">Ошибок: ${mistakes}</p>`);
            const set = RA.util.pick(all, 6);
            const left = RA.util.shuffle(set.map((t, k) => ({ k, text: t.term })));
            const right = RA.util.shuffle(set.map((t, k) => ({ k, text: this.shortDef(t.def, 110) })));
            let sel = null, found = 0;
            root.innerHTML = this.filterBar(opts) + this.stats([`Раунд ${round + 1} / ${rounds}`, `✅ ${score}`, `❌ ${mistakes}`]) + `
                <div class="matchGrid"><div class="col">${left.map(x => `<button class="tile" data-side="l" data-k="${x.k}"><b>${x.text}</b></button>`).join("")}</div>
                <div class="col">${right.map(x => `<button class="tile" data-side="r" data-k="${x.k}">${RA.util.esc(x.text)}</button>`).join("")}</div></div>`;
            this.bindFilter(root);
            root.querySelectorAll(".tile").forEach(tile => tile.onclick = () => {
                if (!sel || sel.dataset.side === tile.dataset.side) {
                    root.querySelectorAll(`.tile[data-side="${tile.dataset.side}"]`).forEach(t => t.classList.remove("sel"));
                    tile.classList.add("sel");
                    sel = tile;
                    return;
                }
                if (sel.dataset.k === tile.dataset.k) {
                    sel.classList.remove("sel");
                    sel.classList.add("ok"); tile.classList.add("ok");
                    sel.disabled = true; tile.disabled = true;
                    score++; found++;
                    sel = null;
                    if (found === 6) { round++; this.later(drawRound, 600); }
                } else {
                    mistakes++;
                    tile.classList.add("bad");
                    const s = sel;
                    this.later(() => { tile.classList.remove("bad"); s.classList.remove("sel"); }, 450);
                    sel = null;
                }
                const chips = root.querySelectorAll(".gameStats .chip");
                chips[1].textContent = "✅ " + score; chips[2].textContent = "❌ " + mistakes;
            });
        };
        drawRound();
    },

    /* ---------- Угадай термин ---------- */
    play_guess(root, opts) {
        const pool = this.terms(opts).filter(t => /^[А-Яа-яЁё]{4,14}$/.test(t.term.trim()));
        if (pool.length < 3) return this.empty(root);
        const words = RA.util.pick(pool, 5);
        let wi = 0, score = 0;
        const ABC = "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ".split("");
        const next = () => {
            if (wi >= words.length) return this.finish(root, score, words.length);
            const t = words[wi];
            const word = t.term.trim().toUpperCase();
            const open = new Set();
            let lives = 6;
            let over = false;
            const draw = () => {
                const solved = [...word].every(ch => open.has(ch));
                root.innerHTML = this.filterBar(opts) + this.stats([`Слово ${wi + 1} / ${words.length}`, `❤️ ${lives}`, `✅ ${score}`]) + `
                    <p class="prompt" style="font-size:18px;font-weight:500">${this.shortDef(t.def, 220)}</p>
                    <div class="letters">${[...word].map(ch => `<div class="letter ${solved ? "ok" : ""}">${open.has(ch) || lives <= 0 ? ch : ""}</div>`).join("")}</div>
                    <div class="keyboard">${ABC.map(ch => `<button class="key" data-ch="${ch}" ${open.has(ch) || solved || lives <= 0 ? "disabled" : ""}>${ch}</button>`).join("")}</div>
                    <div class="feedback ${solved ? "ok" : lives <= 0 ? "bad" : ""}">${solved ? "✅ Угадано!" : lives <= 0 ? "❌ Слово: " + word : ""}</div>`;
                this.bindFilter(root);
                if (solved || lives <= 0) {
                    over = true;
                    if (solved) score++;
                    wi++;
                    this.later(next, 1400);
                    return;
                }
                root.querySelectorAll(".key").forEach(k => k.onclick = () => press(k.dataset.ch));
            };
            const press = (ch) => {
                if (over || open.has(ch)) return;
                open.add(ch);
                if (ch === "Е") open.add("Ё");
                if (ch === "Ё") open.add("Е");
                const hit = word.includes(ch) || (ch === "Е" && word.includes("Ё")) || (ch === "Ё" && word.includes("Е"));
                if (!hit) lives--;
                draw();
            };
            document.onkeydown = (e) => { if (!this.gameKey(e)) return; const ch = e.key.toUpperCase(); if (ABC.includes(ch)) press(ch); };
            draw();
        };
        next();
    },

    /* ---------- Микс-викторина ---------- */
    play_quiz(root, opts) {
        const pool = RA.allQuestions().filter(q => !opts.track || q.track === opts.track);
        if (pool.length < 4) return this.empty(root);
        const qs = RA.util.pick(pool, 10).map(q => RA.util.shuffleOptions(q));
        let i = 0, score = 0;
        const draw = () => {
            if (i >= qs.length) return this.finish(root, score, qs.length);
            const q = qs[i];
            root.innerHTML = this.filterBar(opts) + this.stats([`Вопрос ${i + 1} / ${qs.length}`, `✅ ${score}`]) + `
                <p class="prompt" style="font-size:19px">${q.q}</p>
                <div class="options" style="text-align:left">${q.o.map((o, k) => `<button class="opt" data-k="${k}">${o}</button>`).join("")}</div>
                <div class="explainSlot" style="text-align:left"></div>`;
            this.bindFilter(root);
            root.querySelectorAll(".opt").forEach(b => b.onclick = () => {
                const k = Number(b.dataset.k);
                root.querySelectorAll(".opt").forEach((x, j) => { x.disabled = true; if (j === q.a) x.classList.add("correct"); });
                if (k === q.a) score++; else { b.classList.add("wrong"); RA.store.srsWrong(RA.qKey(q)); }
                root.querySelector(".explainSlot").innerHTML = `<div class="explain">${k === q.a ? "✅" : "❌"} ${q.e || ""}</div>
                    <div class="btnRow" style="justify-content:center"><button class="btn" id="nextQ">Дальше →</button></div>`;
                root.querySelector("#nextQ").onclick = () => { i++; draw(); };
            });
        };
        draw();
    },

    /* ---------- Ударение ---------- */
    play_stress(root) {
        const pool = RA.gameData.stress;
        if (pool.length < 3) return this.empty(root);
        const items = RA.util.pick(pool, 10);
        const VOW = "аеёиоуыэюяАЕЁИОУЫЭЮЯ";
        let i = 0, score = 0;
        const draw = () => {
            if (i >= items.length) return this.finish(root, score, items.length);
            const w = items[i].w;
            const letters = [...w];
            const right = letters.findIndex(ch => "АЕЁИОУЫЭЮЯ".includes(ch));
            const lower = w.toLowerCase();
            root.innerHTML = this.stats([`Слово ${i + 1} / ${items.length}`, `✅ ${score}`]) + `
                <p class="small">Нажмите на ударную гласную</p>
                <div class="letters">${[...lower].map((ch, k) => VOW.includes(ch) ? `<button class="letter" data-k="${k}">${ch}</button>` : `<div class="letter" style="border-color:transparent;background:none">${ch}</div>`).join("")}</div>
                <div class="feedback"></div>`;
            root.querySelectorAll("button.letter").forEach(b => b.onclick = () => {
                const k = Number(b.dataset.k);
                root.querySelectorAll("button.letter").forEach(x => x.disabled = true);
                const correctBtn = root.querySelector(`button.letter[data-k="${right}"]`);
                correctBtn.classList.add("ok");
                const fb = root.querySelector(".feedback");
                const shown = lower.slice(0, right) + lower[right].toUpperCase() + lower.slice(right + 1);
                if (k === right) { score++; fb.className = "feedback ok"; fb.textContent = "✅ Верно: " + shown; }
                else { b.classList.add("bad"); fb.className = "feedback bad"; fb.textContent = "❌ Правильно: " + shown; }
                RA.util.speak(lower.slice(0, right + 1) + "́" + lower.slice(right + 1));
                i++;
                this.later(draw, 1300);
            });
        };
        draw();
    },

    /* ---------- Общий шаблон «выбери вариант» ---------- */
    choice(root, items, render) {
        if (items.length < 3) return this.empty(root);
        let i = 0, score = 0;
        const draw = () => {
            if (i >= items.length) return this.finish(root, score, items.length);
            const it = render(items[i]);
            const opts = RA.util.shuffle(it.options);
            root.innerHTML = this.stats([`Задание ${i + 1} / ${items.length}`, `✅ ${score}`]) + `
                <p class="prompt">${it.prompt}</p>
                <div class="options" style="max-width:640px;margin:0 auto">${opts.map(o => `<button class="opt" data-v="${RA.util.esc(o)}">${RA.util.esc(o)}</button>`).join("")}</div>
                <div class="explainSlot" style="max-width:640px;margin:0 auto;text-align:left"></div>`;
            root.querySelectorAll(".opt").forEach(b => b.onclick = () => {
                const ok = b.dataset.v === it.answer;
                root.querySelectorAll(".opt").forEach(x => { x.disabled = true; if (x.dataset.v === it.answer) x.classList.add("correct"); });
                if (ok) score++; else b.classList.add("wrong");
                root.querySelector(".explainSlot").innerHTML = `<div class="explain">${ok ? "✅ Верно." : "❌ Правильно: <b>" + RA.util.esc(it.answer) + "</b>."} ${it.explain || ""}</div>
                    <div class="btnRow" style="justify-content:center"><button class="btn" id="nextQ">Дальше →</button></div>`;
                root.querySelector("#nextQ").onclick = () => { i++; draw(); };
                root.querySelector("#nextQ").focus();
            });
        };
        draw();
    },

    play_letters(root) {
        this.choice(root, RA.util.pick(RA.gameData.letters, 10), it => ({
            prompt: RA.util.esc(it.w).replace("_", "<u>&nbsp;?&nbsp;</u>"),
            options: it.o, answer: it.a,
            explain: (it.rule ? "Правило: " + RA.util.esc(it.rule) + ". " : "") + "Слово: <b>" + RA.util.esc(it.w.replace("_", it.a)) + "</b>"
        }));
    },

    play_forms(root) {
        this.choice(root, RA.util.pick(RA.gameData.forms, 10), it => ({
            prompt: RA.util.esc(it.s).replace("___", "<u>&nbsp;&nbsp;?&nbsp;&nbsp;</u>"),
            options: it.o, answer: it.a, explain: RA.util.esc(it.e || "")
        }));
    },

    play_idioms(root) {
        const all = RA.gameData.idioms;
        if (all.length < 4) return this.empty(root);
        this.choice(root, RA.util.pick(all, 10), it => {
            const wrong = RA.util.pick([...new Set(all.map(x => x.m))].filter(m => m !== it.m), 3);
            return {
                prompt: "«" + RA.util.esc(it.i) + "» — это…",
                options: [it.m, ...wrong], answer: it.m,
                explain: it.ex ? "Пример: <i>" + RA.util.esc(it.ex) + "</i>" : ""
            };
        });
    },

    /* ---------- Собери предложение ---------- */
    play_order(root) {
        const items = RA.util.pick(RA.gameData.order, 6);
        if (items.length < 3) return this.empty(root);
        let i = 0, score = 0;
        const draw = () => {
            if (i >= items.length) return this.finish(root, score, items.length);
            const target = items[i].s.trim().split(/\s+/);
            let bank = RA.util.shuffle(target.map((w, k) => ({ w, k })));
            if (bank.every((x, k) => x.k === k) && bank.length > 1) bank.reverse();
            const line = [];
            const paint = () => {
                root.innerHTML = this.stats([`Предложение ${i + 1} / ${items.length}`, `✅ ${score}`]) + `
                    ${items[i].tr ? `<p class="small">🇺🇿 ${RA.util.esc(items[i].tr)}</p>` : `<p class="small">Нажимайте на слова по порядку. Нажмите на слово в строке, чтобы вернуть его.</p>`}
                    <div class="answerLine">${line.map((x, k) => `<button class="wordChip" data-line="${k}">${RA.util.esc(x.w)}</button>`).join("")}</div>
                    <div class="wordBank">${bank.map((x, k) => `<button class="wordChip" data-bank="${k}">${RA.util.esc(x.w)}</button>`).join("")}</div>
                    <div class="btnRow" style="justify-content:center"><button class="btn" id="check" ${bank.length ? "disabled" : ""}>Проверить</button></div>
                    <div class="feedback"></div>`;
                root.querySelectorAll("[data-bank]").forEach(b => b.onclick = () => { line.push(bank.splice(Number(b.dataset.bank), 1)[0]); paint(); });
                root.querySelectorAll("[data-line]").forEach(b => b.onclick = () => { bank.push(line.splice(Number(b.dataset.line), 1)[0]); paint(); });
                root.querySelector("#check").onclick = () => {
                    const ok = line.map(x => x.w).join(" ") === target.join(" ");
                    const fb = root.querySelector(".feedback");
                    root.querySelector("#check").disabled = true;
                    root.querySelectorAll(".wordChip").forEach(x => x.disabled = true);
                    if (ok) { score++; fb.className = "feedback ok"; fb.textContent = "✅ Верно!"; }
                    else { fb.className = "feedback bad"; fb.textContent = "❌ Правильно: " + target.join(" ") + "."; }
                    i++;
                    this.later(draw, ok ? 1100 : 2400);
                };
            };
            paint();
        };
        draw();
    },

    /* ---------- Верно / неверно (60 секунд) ---------- */
    play_tf(root) {
        const pool = RA.util.shuffle(RA.gameData.tf);
        if (pool.length < 5) return this.empty(root);
        let i = 0, score = 0, answered = 0, left = 60;
        const log = [];
        const draw = () => {
            if (i >= pool.length) return end();
            const it = pool[i];
            root.innerHTML = this.stats([`⏱ <span id="tfTime">${left}</span> с`, `✅ ${score}`, `Ответов: ${answered}`]) + `
                <p class="prompt">${RA.util.esc(it.s)}</p>
                <div class="btnRow" style="justify-content:center">
                    <button class="btn" data-v="1" style="background:linear-gradient(90deg,#16a34a,#4ade80)">✔ Верно</button>
                    <button class="btn" data-v="0" style="background:linear-gradient(90deg,#dc2626,#f87171)">✖ Неверно</button>
                </div><p class="small">Клавиши: ← неверно, → верно</p>`;
            root.querySelectorAll("[data-v]").forEach(b => b.onclick = () => answer(b.dataset.v === "1"));
        };
        const answer = (v) => {
            const it = pool[i];
            const ok = v === it.a;
            if (ok) score++;
            answered++;
            log.push({ it, ok });
            i++;
            draw();
        };
        const end = () => {
            const wrong = log.filter(x => !x.ok);
            this.finish(root, score, answered, wrong.length ? `<div class="lesson" style="text-align:left;max-width:680px;margin:12px auto"><h3>Разбор ошибок</h3><ul>${wrong.map(x =>
                `<li>${RA.util.esc(x.it.s)} — <b>${x.it.a ? "верно" : "неверно"}</b>. ${RA.util.esc(x.it.e || "")}</li>`).join("")}</ul></div>` : "");
        };
        document.onkeydown = (e) => { if (!this.gameKey(e)) return; if (e.key === "ArrowRight") answer(true); if (e.key === "ArrowLeft") answer(false); };
        this.timers.push(setInterval(() => {
            left--;
            const el = document.getElementById("tfTime");
            if (el) el.textContent = left;
            if (left <= 0) end();
        }, 1000));
        draw();
    }
};

;
"use strict";

/* ==========================================================
   Страницы и маршрутизация (#/…)
========================================================== */

/* Цели обучения → рекомендованный путь курсов */
RA.goals = [
    { id: "zero",      icon: "🌱", title: "Русский с нуля",              desc: "Алфавит → A1 → … → C1",               path: ["a0", "a1", "a2", "b1", "b2", "c1"] },
    { id: "cert_uz",   icon: "🇺🇿", title: "Национальный сертификат",     desc: "Milliy sertifikat по русскому языку", path: ["cert_uz", "th_spelling", "th_punctuation", "th_morphology", "th_syntax", "th_lexicon"] },
    { id: "herzen",    icon: "🎓", title: "Сертификат РГПУ им. Герцена", desc: "ТРКИ через центр Герцена",            path: ["trki", "herzen", "a2", "b1", "b2"] },
    { id: "rudn",      icon: "🌍", title: "Сертификат РУДН",             desc: "ТРКИ через центр РУДН",               path: ["trki", "rudn", "a2", "b1", "b2"] },
    { id: "migrant",   icon: "🧳", title: "Экзамен для мигрантов",       desc: "Патент, РВП, ВНЖ",                    path: ["migrant", "a1", "a2", "sp_everyday"] },
    { id: "school",    icon: "🏫", title: "Школьная программа",          desc: "1–11 классы",                         path: ["school_1_4", "school_5_6", "school_7_9", "school_10_11"] },
    { id: "speaking",  icon: "💬", title: "Разговорная речь",            desc: "Говорить свободно",                   path: ["sp_everyday", "sp_live", "a1", "a2"] },
    { id: "admission", icon: "🎯", title: "Поступление в вуз",           desc: "Тесты, собеседование, сочинение",     path: ["adm_uz", "adm_ru", "adm_writing", "th_spelling", "th_punctuation"] }
];

RA.achievements = {
    list: [
        { id: "first_lesson", icon: "📗", title: "Первый шаг",       desc: "Пройдите первый урок",              test: d => Object.keys(d.lessons).length >= 1 },
        { id: "lessons10",    icon: "📚", title: "Прилежный ученик", desc: "Пройдите 10 уроков",                test: d => Object.keys(d.lessons).length >= 10 },
        { id: "lessons50",    icon: "🎓", title: "Знаток",           desc: "Пройдите 50 уроков",                test: d => Object.keys(d.lessons).length >= 50 },
        { id: "lessons100",   icon: "🏛",  title: "Академик",         desc: "Пройдите 100 уроков",               test: d => Object.keys(d.lessons).length >= 100 },
        { id: "perfect",      icon: "💯", title: "Без единой ошибки", desc: "Наберите 100% в тесте или экзамене", test: d => Object.values(d.lessons).some(l => l.score === 100) },
        { id: "exam",         icon: "📝", title: "Экзамен сдан",     desc: "Сдайте пробный экзамен",            test: d => Object.keys(d.exams).some(k => d.lessons[k]) },
        { id: "exam90",       icon: "🥇", title: "Отличник",         desc: "Пробный экзамен на 90% и выше",     test: d => Object.entries(d.exams).some(([k, p]) => p >= 90 && d.lessons[k]) },
        { id: "streak3",      icon: "🔥", title: "Три дня подряд",   desc: "Занимайтесь 3 дня подряд",          test: d => d.streak >= 3 },
        { id: "streak7",      icon: "☄️", title: "Неделя без пропусков", desc: "Занимайтесь 7 дней подряд",     test: d => d.streak >= 7 },
        { id: "level5",       icon: "⭐", title: "Уровень 5",        desc: "Достигните 5 уровня",               test: d => d.level >= 5 },
        { id: "level10",      icon: "🌟", title: "Уровень 10",       desc: "Достигните 10 уровня",              test: d => d.level >= 10 },
        { id: "games10",      icon: "🎮", title: "Игрок",            desc: "Сыграйте 10 игр",                   test: d => d.gamesPlayed >= 10 },
        { id: "games50",      icon: "🕹",  title: "Чемпион игр",      desc: "Сыграйте 50 игр",                   test: d => d.gamesPlayed >= 50 },
        { id: "terms50",      icon: "🧠", title: "Словарный запас",  desc: "Выучите 50 терминов на карточках",  test: d => Object.keys(d.learnedTerms).length >= 50 },
        { id: "terms200",     icon: "📖", title: "Ходячий словарь",  desc: "Выучите 200 терминов",              test: d => Object.keys(d.learnedTerms).length >= 200 },
        { id: "a0done",       icon: "🔤", title: "Азбука освоена",   desc: "Пройдите курс A0 полностью",        test: () => RA.courseById.a0 && RA.store.courseProgress(RA.courseById.a0) === 100 },
        { id: "shopper",      icon: "🛍",  title: "Покупатель",       desc: "Купите аватар в магазине",          test: d => d.owned.length > 1 }
    ],

    check() {
        const d = RA.store.data;
        this.list.forEach(a => {
            if (!d.achievements[a.id] && a.test(d)) {
                d.achievements[a.id] = RA.util.today();
                d.coins += 20;
                RA.store.save();
                RA.ui.toast(`🏆 Достижение: ${a.icon} ${a.title} (+20 монет)`);
            }
        });
        RA.ui.refresh();
    }
};

RA.shopItems = [
    { a: "👨‍🎓", price: 0 }, { a: "👩‍🎓", price: 0 }, { a: "🧑‍🏫", price: 60 }, { a: "🦉", price: 80 },
    { a: "🐱", price: 100 }, { a: "🦊", price: 120 }, { a: "🐻", price: 120 }, { a: "🐼", price: 150 },
    { a: "🐯", price: 180 }, { a: "🦁", price: 200 }, { a: "🚀", price: 220 }, { a: "🤖", price: 250 },
    { a: "🧙", price: 300 }, { a: "🦄", price: 350 }, { a: "🐉", price: 450 }, { a: "👑", price: 600 }
];

RA.pages = {

    el() { return document.getElementById("content"); },

    head(title, subtitle, crumbs) {
        const c = crumbs ? `<div class="crumbs">${crumbs.map(([t, h]) => h ? `<a href="${h}">${t}</a> ›` : `<span>${t}</span>`).join(" ")}</div>` : "";
        return `<div class="pageHead">${c}<h1>${title}</h1>${subtitle ? `<p>${subtitle}</p>` : ""}</div>`;
    },

    courseCard(c0) {
        const c = RA.loc.course(c0);
        const p = RA.store.courseProgress(c);
        const n = RA.lessonsOf(c).length;
        return `<a class="card" href="#/course/${c.id}">
            <div class="cardIcon">${c.icon || "📘"}</div>
            ${c.level ? `<span class="tag">${c.level}</span>` : ""}<span class="tag gold">${n} ${RA.ui.plural(n, "урок", "урока", "уроков")}</span>
            <h3>${c.title}</h3>
            <p>${c.desc || ""}</p>
            <div class="bar ok"><div style="width:${p}%"></div></div>
            <p class="small">Пройдено: ${p}%</p>
        </a>`;
    },

    /* Следующий непройденный урок в списке курсов */
    nextLesson(courseIds) {
        for (const id of courseIds) {
            const c = RA.loc.course(RA.courseById[id]);
            if (!c) continue;
            const l = RA.lessonsOf(c).find(x => !RA.store.lessonDone(c.id, x.id));
            if (l) return { course: c, lesson: l };
        }
        return null;
    },

    /* Путь обучения: тест на уровень позволяет не начинать «Русский с нуля» с алфавита */
    goalPath(goal) {
        const placed = RA.store.data.placement;
        if (goal.id === "zero" && placed) {
            const from = goal.path.indexOf(placed.course);
            if (from > 0) return goal.path.slice(from);
        }
        return goal.path;
    },

    /* ---------------- Главная ---------------- */
    home() {
        const d = RA.store.data;
        const goal = RA.goals.find(g => g.id === d.goal);
        const totalLessons = RA.courses.reduce((s, c) => s + RA.lessonsOf(c).length, 0);
        const totalTerms = RA.allTerms().length;
        let html = `<div class="hero">
            <h1>${d.name === "Гость" ? "Добро пожаловать в Russian Academy!" : "С возвращением, " + RA.util.esc(d.name) + "!"}</h1>
            <p>Русский язык от первой буквы до сертификата: ${RA.courses.length} курсов, ${totalLessons} уроков, ${totalTerms} терминов с примерами, пробные экзамены с таймером и игры для тренировки.</p>
            <div class="btnRow">`;
        if (goal) {
            const next = this.nextLesson(this.goalPath(goal));
            html += next
                ? `<a class="btn" href="#/lesson/${next.course.id}/${next.lesson.id}">▶ Продолжить: ${next.lesson.title}</a>`
                : `<span class="tag ok">🎉 Путь «${goal.title}» пройден!</span>`;
            html += `<button class="btn ghost" data-act="chooseGoal">🎯 Сменить цель</button>`;
        } else {
            html += `<button class="btn" data-act="chooseGoal">🎯 Выбрать цель обучения</button><a class="btn ghost" href="#/track/start">Начать с алфавита</a>`;
        }
        html += `</div></div>`;

        const dueNow = RA.store.srsDueKeys().length;
        if (dueNow) {
            html += `<div class="box tip"><div class="boxTitle">🔁 Сегодня нужно повторить: ${dueNow}</div><div class="btnRow"><a class="btn small" href="#/review">▶ Начать повторение</a></div></div>`;
        }
        if (!d.placement) {
            html += `<div class="box rule"><div class="boxTitle">🧭 Не знаете, с чего начать? Пройдите тест на уровень.</div><div class="btnRow"><a class="btn small" href="#/placement">Определить уровень</a></div></div>`;
        }

        if (goal) {
            html += `<h2 class="sectionTitle">${goal.icon} Мой путь: ${goal.title}</h2><div class="card">`;
            this.goalPath(goal).filter(id => RA.courseById[id]).forEach((id, i) => {
                const c = RA.loc.course(RA.courseById[id]);
                const p = RA.store.courseProgress(c);
                html += `<div class="pathStep ${p === 100 ? "done" : ""}"><div class="dot">${p === 100 ? "✓" : i + 1}</div>
                    <div style="flex:1"><a href="#/course/${c.id}"><b>${c.icon} ${c.title}</b></a><div class="bar ok" style="margin-top:6px"><div style="width:${p}%"></div></div><span class="small">${p}%</span></div></div>`;
            });
            html += `</div>`;
        }

        html += `<h2 class="sectionTitle">🧭 Направления</h2><div class="grid">`;
        RA.tracks.forEach(t => {
            const cs = RA.coursesOf(t.id);
            html += `<a class="card" href="#/track/${t.id}"><div class="cardIcon">${t.icon}</div><h3>${t.title}</h3><p>${t.desc}</p><p class="small" style="margin-top:8px">${cs.length} ${RA.ui.plural(cs.length, "курс", "курса", "курсов")}</p></a>`;
        });
        html += `</div>`;

        const terms = RA.util.pick(RA.allTerms(), 3);
        if (terms.length) {
            html += `<h2 class="sectionTitle">📖 Термины дня</h2>${RA.render.terms(terms)}`;
        }

        html += `<h2 class="sectionTitle">🎮 Учитесь играя</h2><div class="grid">${RA.Games.list.slice(0, 4).map(g =>
            `<a class="card" href="#/game/${g.id}"><div class="cardIcon">${g.icon}</div><h3>${g.title}</h3><p>${g.desc}</p></a>`).join("")}</div>`;
        return html;
    },

    chooseGoal() {
        const d = RA.store.data;
        RA.ui.modal(`<p class="small">🌐 Язык интерфейса</p><div class="tabs">
                <button class="tab ${RA.i18n.lang() === "ru" ? "active" : ""}" data-lang="ru">Русский</button>
                <button class="tab ${RA.i18n.lang() === "uz" ? "active" : ""}" data-lang="uz">O‘zbekcha</button></div>
            <h2>🎯 Какая у вас цель?</h2><p class="small" style="margin-bottom:12px">Мы составим путь обучения. Цель можно сменить в любой момент.</p>
            <div class="goalGrid">${RA.goals.map(g => `<button class="goal ${d.goal === g.id ? "active" : ""}" data-goal="${g.id}"><div class="gi">${g.icon}</div><b>${g.title}</b><div class="small">${g.desc}</div></button>`).join("")}</div>`);
        document.querySelectorAll("#modalContent [data-lang]").forEach(b => b.onclick = () => RA.i18n.setLang(b.dataset.lang));
        document.querySelectorAll("[data-goal]").forEach(b => b.onclick = () => {
            d.goal = b.dataset.goal;
            RA.store.save();
            RA.ui.closeModal();
            RA.ui.toast("Цель выбрана: " + RA.goals.find(g => g.id === d.goal).title);
            RA.router.render();
        });
    },

    /* ---------------- Направление ---------------- */
    track(id) {
        const t = RA.tracks.find(x => x.id === id);
        if (!t) return this.notFound();
        const cs = RA.coursesOf(id);
        let html = this.head(t.icon + " " + t.title, t.desc, [["Главная", "#/home"], [t.title]]);
        if (id === "cert") {
            html += `<div class="box tip"><div class="boxTitle">💡 Как выбрать сертификат?</div><div>
                <b>Национальный сертификат</b> — для поступления и выпуска в Узбекистане. <b>ТРКИ (РГПУ им. Герцена или РУДН)</b> — государственный сертификат РФ: для учёбы и работы в России, гражданства. <b>Комплексный экзамен</b> — для патента, РВП и ВНЖ в России.</div></div>`;
        }
        html += cs.length ? `<div class="grid wide">${cs.map(c => this.courseCard(c)).join("")}</div>`
            : `<div class="card empty">Курсы этого направления скоро появятся.</div>`;
        return html;
    },

    /* ---------------- Курс ---------------- */
    course(id) {
        const c = RA.loc.course(RA.courseById[id]);
        if (!c) return this.notFound();
        const t = RA.tracks.find(x => x.id === c.track);
        const lessons = RA.lessonsOf(c);
        const p = RA.store.courseProgress(c);
        const next = this.nextLesson([c.id]);
        let n = 0;
        let html = this.head(c.icon + " " + c.title, c.desc, [["Главная", "#/home"], [t.title, "#/track/" + t.id], [c.title]]);
        html += `<div class="card">
            ${c.level ? `<span class="tag">${c.level}</span>` : ""}<span class="tag gold">${lessons.length} ${RA.ui.plural(lessons.length, "урок", "урока", "уроков")}</span>
            <span class="tag ok">${RA.lessonsOf(c).reduce((s, l) => s + (l.terms || []).length, 0)} терминов</span>
            ${c.about ? `<div class="lesson" style="margin-top:8px">${c.about}</div>` : ""}
            <div class="bar ok"><div style="width:${p}%"></div></div><p class="small">Пройдено: ${p}%</p>
            <div class="btnRow">${next ? `<a class="btn" href="#/lesson/${c.id}/${next.lesson.id}">▶ ${p ? "Продолжить" : "Начать"}: ${next.lesson.title}</a>` : `<span class="tag ok">🎉 Курс пройден</span>`}</div>
        </div>`;
        c.modules.forEach(m => {
            html += `<div class="module card"><h3>${m.title}</h3><div class="lessonList">${m.lessons.map(l => {
                n++;
                const done = RA.store.lessonDone(c.id, l.id);
                const exam = l.kind === "exam";
                const best = RA.store.data.exams[c.id + "/" + l.id];
                return `<a class="lessonItem ${done ? "done" : ""}" href="#/lesson/${c.id}/${l.id}">
                    <div class="num">${done ? "✓" : exam ? "⏱" : l.kind === "practice" ? "✍" : n}</div>
                    <div class="info"><b>${l.title}</b><span>${l.desc || ""}${exam ? ` · ${l.time} мин` + (best !== undefined ? ` · лучший результат ${best}%` : "") : ""}</span></div>
                </a>`;
            }).join("")}</div></div>`;
        });
        return html;
    },

    /* ---------------- Урок ---------------- */
    lesson(courseId, lessonId) {
        const ctx = RA.findLesson(courseId, lessonId);
        if (!ctx) return this.notFound();
        const course = RA.loc.course(ctx.course);
        const { index } = ctx;
        const lessons = RA.lessonsOf(course);
        const lesson = RA.loc.lesson(course.id, ctx.lesson);
        ctx.lesson = lesson;
        const t = RA.tracks.find(x => x.id === course.track);
        const prev = lessons[index - 1], next = lessons[index + 1];
        const done = RA.store.lessonDone(course.id, lesson.id);

        let html = this.head(lesson.title, lesson.desc,
            [["Главная", "#/home"], [t.title, "#/track/" + t.id], [course.title, "#/course/" + course.id], ["Урок " + (index + 1) + " из " + lessons.length]]);

        if (RA.loc.hasLesson(course.id, lesson.id)) {
            html += `<div class="btnRow" style="margin:-6px 0 12px"><button class="btn ghost small" data-lang="${RA.loc.isUz() ? "ru" : "uz"}">🌐 ${RA.loc.isUz() ? "Читать по-русски" : "O‘zbek tilida o‘qish"}</button></div>`;
        } else if (RA.loc.isUz()) {
            html += `<p class="small" style="margin-bottom:10px">Этот урок пока только на русском языке.</p>`;
        }

        if (lesson.kind === "practice") {
            html += `${(lesson.blocks || []).length ? `<div class="card lesson" style="margin-bottom:16px">${RA.render.blocks(lesson.blocks)}</div>` : ""}<div id="practiceRoot"></div>`;
        } else if (lesson.kind === "exam") {
            const qn = lesson.sections.reduce((s, x) => s + x.questions.length, 0);
            const best = RA.store.data.exams[course.id + "/" + lesson.id];
            html += `<div id="examRoot"><div class="card lesson">
                <h2>⏱ Пробный экзамен</h2>
                <p>Вопросов: <b>${qn}</b> · Время: <b>${lesson.time} мин</b> · Порог прохождения: <b>${lesson.pass || 66}%</b>${best !== undefined ? ` · Ваш лучший результат: <b>${best}%</b>` : ""}</p>
                ${RA.render.blocks(lesson.blocks)}
                <ul>${lesson.sections.map(s => `<li>${s.title} — ${s.questions.length} вопр.</li>`).join("")}</ul>
                <div class="btnRow"><button class="btn" id="startExam">▶ Начать экзамен</button></div>
            </div></div>`;
        } else {
            const hasQuiz = lesson.quiz && lesson.quiz.length;
            const hasTerms = lesson.terms && lesson.terms.length;
            html += `<div class="tabs">
                <button class="tab active" data-act="scrollTo" data-target="secTheory">📖 Теория</button>
                ${hasTerms ? `<button class="tab" data-act="scrollTo" data-target="secTerms">🔤 Термины (${lesson.terms.length})</button>` : ""}
                ${hasQuiz ? `<button class="tab" data-act="scrollTo" data-target="secQuiz">✅ Тест (${lesson.quiz.length})</button>` : ""}
                ${done ? `<span class="tag ok" style="align-self:center">✓ Урок пройден</span>` : ""}
            </div>
            <div class="card lesson" id="secTheory">${RA.render.blocks(lesson.blocks)}</div>`;
            if (hasTerms) html += `<h2 class="sectionTitle" id="secTerms">🔤 Термины урока</h2>${RA.render.terms(lesson.terms)}`;
            if (hasQuiz) {
                html += `<h2 class="sectionTitle" id="secQuiz">✅ Проверьте себя</h2><div class="card" id="quizRoot"></div>`;
            } else {
                html += `<div class="btnRow"><button class="btn" id="markDone" ${done ? "disabled" : ""}>${done ? "✓ Изучено" : "✓ Отметить как изученное"}</button></div>`;
            }
        }

        html += `<div class="lessonNav">
            ${prev ? `<a class="btn ghost" href="#/lesson/${course.id}/${prev.id}">← ${prev.title}</a>` : `<span></span>`}
            ${next ? `<a class="btn" href="#/lesson/${course.id}/${next.id}">${next.title} →</a>` : `<a class="btn" href="#/course/${course.id}">К курсу ✓</a>`}
        </div>`;

        return { html, after: () => this.lessonAfter(ctx) };
    },

    lessonAfter(ctx) {
        const { course, lesson } = ctx;
        if (lesson.kind === "practice") {
            RA.Practice.start(document.getElementById("practiceRoot"), ctx);
            return;
        }
        if (lesson.kind === "exam") {
            document.getElementById("startExam").onclick = () => RA.Exam.start(document.getElementById("examRoot"), ctx);
            return;
        }
        const quizRoot = document.getElementById("quizRoot");
        if (quizRoot) {
            RA.Quiz.mount(quizRoot, lesson.quiz, (percent) => {
                if (percent >= 60) {
                    const prev = (RA.store.data.lessons[course.id + "/" + lesson.id] || { score: 0 }).score;
                    const first = RA.store.completeLesson(course.id, lesson.id, percent);
                    if (first) {
                        RA.store.addXP(30 + Math.round(percent / 10));
                        RA.store.addCoins(10);
                        RA.ui.toast(`✅ Урок пройден! +${30 + Math.round(percent / 10)} XP`);
                    } else if (percent > prev) {
                        RA.store.addXP(5);
                        RA.store.addCoins(1);
                        RA.ui.toast("Новый лучший результат! +5 XP");
                    } else {
                        RA.ui.toast("Результат сохранён");
                    }
                } else {
                    RA.ui.toast("Нужно 60% и больше, чтобы засчитать урок. Повторите теорию и попробуйте ещё раз!");
                }
                RA.achievements.check();
            });
        }
        const mark = document.getElementById("markDone");
        if (mark) mark.onclick = () => {
            RA.store.completeLesson(course.id, lesson.id, 0); /* без теста: не считается за 100% */
            RA.store.addXP(20);
            RA.store.addCoins(5);
            mark.disabled = true;
            mark.textContent = "✓ Изучено";
            RA.ui.toast("✅ Урок отмечен как изученный. +20 XP");
            RA.achievements.check();
        };
    },

    /* ---------------- Словарь терминов ---------------- */
    glossary() {
        const terms = RA.allTerms();
        const html = this.head("📖 Словарь терминов", `Все термины платформы с определениями и примерами — ${terms.length} шт. Нажмите на источник, чтобы открыть урок.`, [["Главная", "#/home"], ["Словарь терминов"]])
            + `<div class="card" style="margin-bottom:16px">
                <div class="field"><input id="glossQ" type="search" placeholder="Найти термин или слово в определении…"></div>
                <div class="tabs" id="glossTracks"><button class="tab active" data-track="">Все</button>${RA.tracks.map(t => `<button class="tab" data-track="${t.id}">${t.icon} ${t.title}</button>`).join("")}</div>
                <div class="tabs" id="glossLetters"></div>
                <div class="btnRow"><a class="btn small" href="#/game/flash">🃏 Учить на карточках</a><a class="btn ghost small" href="#/game/match">🧩 Найди пару</a></div>
              </div><div id="glossList"></div>`;
        return {
            html, after: () => {
                let track = "", letter = "";
                const q = document.getElementById("glossQ");
                const draw = () => {
                    const s = RA.util.norm(q.value);
                    let list = terms.filter(t => (!track || t.track === track));
                    const letters = [...new Set(list.map(t => t.term[0].toUpperCase()))].sort((a, b) => a.localeCompare(b, "ru"));
                    document.getElementById("glossLetters").innerHTML = `<button class="tab ${!letter ? "active" : ""}" data-letter="">А–Я</button>` +
                        letters.map(l => `<button class="tab ${letter === l ? "active" : ""}" data-letter="${l}">${l}</button>`).join("");
                    document.querySelectorAll("#glossLetters [data-letter]").forEach(b => b.onclick = () => { letter = b.dataset.letter; draw(); });
                    if (letter) list = list.filter(t => t.term[0].toUpperCase() === letter);
                    if (s) list = list.filter(t => RA.util.norm(t.term + " " + RA.util.plain(t.def) + " " + (t.uz || "")).includes(s));
                    const shown = list.slice(0, 300);
                    document.getElementById("glossList").innerHTML = list.length
                        ? `<p class="small" style="margin-bottom:8px">Найдено: ${list.length}${list.length > 300 ? " (показаны первые 300 — уточните поиск)" : ""}</p><div class="terms">${shown.map(t => RA.render.term(t, true)).join("")}</div>`
                        : `<div class="card empty">Ничего не найдено.</div>`;
                };
                q.oninput = draw;
                document.querySelectorAll("#glossTracks [data-track]").forEach(b => b.onclick = () => {
                    document.querySelectorAll("#glossTracks .tab").forEach(x => x.classList.remove("active"));
                    b.classList.add("active");
                    track = b.dataset.track; letter = "";
                    draw();
                });
                draw();
            }
        };
    },

    /* ---------------- Поиск ---------------- */
    searchIndex() {
        if (this._index) return this._index;
        const idx = [];
        RA.courses.forEach(c => RA.lessonsOf(c).forEach(l => {
            const text = RA.util.plain([l.title, l.desc, ...(l.blocks || []).map(b => [b.title, b.text, ...(b.items || []).map(i => typeof i === "string" ? i : i.ru + " " + (i.tr || "")), ...(b.rows || []).flat(), ...(b.lines || []).map(x => x[1])].join(" "))].join(" "));
            idx.push({ c, l, text, ntext: RA.util.norm(text) });
        }));
        this._index = idx;
        return idx;
    },

    search(query) {
        const q = RA.util.norm(query);
        const head = this.head("🔍 Поиск: «" + RA.util.esc(query) + "»", "", [["Главная", "#/home"], ["Поиск"]]);
        if (q.length < 2) return head + `<div class="card empty">Введите минимум 2 символа.</div>`;
        const terms = RA.allTerms().filter(t => RA.util.norm(t.term).includes(q)).slice(0, 12);
        const lessons = this.searchIndex().filter(x => x.ntext.includes(q)).slice(0, 40);
        let html = head;
        if (terms.length) html += `<h2 class="sectionTitle">Термины</h2><div class="terms">${terms.map(t => RA.render.term(t, true)).join("")}</div>`;
        html += `<h2 class="sectionTitle">Уроки (${lessons.length})</h2>`;
        html += lessons.length ? lessons.map(x => {
            const pos = x.ntext.indexOf(q);
            const start = Math.max(0, pos - 70);
            const snip = RA.util.esc(x.text.substr(start, 200));
            return `<a class="searchResult" href="#/lesson/${x.c.id}/${x.l.id}"><b>${x.c.icon} ${x.l.title}</b><br><small>${x.c.title}</small><div class="small">${start ? "…" : ""}${snip}…</div></a>`;
        }).join("") : `<div class="card empty">Совпадений в уроках нет.</div>`;
        return html;
    },

    /* ---------------- Игры ---------------- */
    games() {
        return this.head("🎮 Игры", "Тренируйте термины, ударения, орфографию и грамматику. За игры начисляются опыт и монеты.", [["Главная", "#/home"], ["Игры"]])
            + `<div class="grid">${RA.Games.list.map(g => {
                const st = RA.store.data.games[g.id];
                return `<a class="card" href="#/game/${g.id}"><div class="cardIcon">${g.icon}</div><h3>${g.title}</h3><p>${g.desc}</p>${st ? `<p class="small" style="margin-top:8px">Сыграно: ${st.played} · рекорд: ${st.best}</p>` : ""}</a>`;
            }).join("")}</div>`;
    },

    game(id) {
        const g = RA.Games.list.find(x => x.id === id);
        if (!g) return this.notFound();
        const html = this.head(g.icon + " " + g.title, g.desc, [["Главная", "#/home"], ["Игры", "#/games"], [g.title]])
            + `<div class="card gameArea" id="gameRoot"></div>`;
        return { html, after: () => RA.Games.start(id, document.getElementById("gameRoot")) };
    },

    /* ---------------- Достижения ---------------- */
    achievementsPage() {
        const d = RA.store.data;
        const got = RA.achievements.list.filter(a => d.achievements[a.id]).length;
        return this.head("🏆 Достижения", `Открыто ${got} из ${RA.achievements.list.length}. За каждое — 20 монет.`, [["Главная", "#/home"], ["Достижения"]])
            + `<div class="grid">${RA.achievements.list.map(a => `<div class="card ach ${d.achievements[a.id] ? "got" : ""}"><div class="ic">${a.icon}</div><div><h3>${a.title}</h3><p>${a.desc}</p>${d.achievements[a.id] ? `<p class="small">✓ ${d.achievements[a.id]}</p>` : ""}</div></div>`).join("")}</div>`;
    },

    /* ---------------- Магазин ---------------- */
    shop() {
        const d = RA.store.data;
        const html = this.head("🛒 Магазин", `Покупайте аватары за монеты. У вас 💰 ${d.coins}.`, [["Главная", "#/home"], ["Магазин"]])
            + `<div class="grid">${RA.shopItems.map(it => {
                const own = d.owned.includes(it.a) || it.price === 0;
                const cur = d.avatar === it.a;
                return `<div class="card" style="text-align:center"><div style="font-size:56px">${it.a}</div>
                    <p>${it.price ? "💰 " + it.price : "Бесплатно"}</p>
                    <div class="btnRow" style="justify-content:center">${cur ? `<span class="tag ok">Выбран</span>` : own
                        ? `<button class="btn small" data-avatar="${it.a}">Выбрать</button>`
                        : `<button class="btn small" data-buy="${it.a}" data-price="${it.price}" ${d.coins < it.price ? "disabled" : ""}>Купить</button>`}</div></div>`;
            }).join("")}</div>`;
        return {
            html, after: () => {
                document.querySelectorAll("[data-avatar]").forEach(b => b.onclick = () => { d.avatar = b.dataset.avatar; RA.store.save(); RA.router.render(); RA.ui.refresh(); });
                document.querySelectorAll("[data-buy]").forEach(b => b.onclick = () => {
                    const price = Number(b.dataset.price);
                    if (d.coins < price) return;
                    d.coins -= price;
                    d.owned.push(b.dataset.buy);
                    d.avatar = b.dataset.buy;
                    RA.store.save();
                    RA.ui.toast("Покупка совершена! " + b.dataset.buy);
                    RA.achievements.check();
                    RA.router.render();
                });
            }
        };
    },

    /* ---------------- Профиль ---------------- */
    profile() {
        const d = RA.store.data;
        const goal = RA.goals.find(g => g.id === d.goal);
        const rows = RA.courses.filter(c => RA.store.courseProgress(c) > 0)
            .map(c => `<tr><td><a href="#/course/${c.id}">${c.icon} ${c.title}</a></td><td>${RA.store.courseProgress(c)}%</td></tr>`).join("");
        const html = this.head("👤 Профиль", "", [["Главная", "#/home"], ["Профиль"]])
            + `<div class="grid wide"><div class="card" style="text-align:center"><div style="font-size:64px">${d.avatar}</div><h2 class="userName">${RA.util.esc(d.name)}</h2>
                <p>⭐ Уровень ${d.level} · всего ${d.totalXp} XP · 💰 ${d.coins}</p>
                <div class="field"><input id="nameInput" maxlength="30" value="${RA.util.esc(d.name)}" placeholder="Ваше имя"></div>
                <button class="btn" id="saveName">Сохранить имя</button></div>
              <div class="card"><h3>🎯 Цель</h3><p>${goal ? goal.icon + " " + goal.title : "Не выбрана"}</p><div class="btnRow"><button class="btn ghost" data-act="chooseGoal">Выбрать цель</button></div>
                <h3 style="margin-top:16px">📊 Статистика</h3>
                <div class="statRow"><span>Уроков пройдено</span><b>${Object.keys(d.lessons).length}</b></div>
                <div class="statRow"><span>Экзаменов сдано</span><b>${Object.keys(d.exams).filter(k => d.lessons[k]).length}</b></div>
                <div class="statRow"><span>Игр сыграно</span><b>${d.gamesPlayed}</b></div>
                <div class="statRow"><span>Терминов выучено</span><b>${Object.keys(d.learnedTerms).length}</b></div>
                <div class="statRow"><span>Серия дней</span><b>${d.streak}</b></div></div></div>
              <h2 class="sectionTitle">📚 Прогресс по курсам</h2>
              <div class="card lesson">${rows ? `<div class="tableWrap"><table><thead><tr><th>Курс</th><th>Прогресс</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<p class="empty">Пока нет начатых курсов.</p>`}</div>`;
        return {
            html, after: () => {
                document.getElementById("saveName").onclick = () => {
                    const v = document.getElementById("nameInput").value.trim().slice(0, 30);
                    d.name = v || "Гость";
                    RA.store.save();
                    RA.ui.refresh();
                    RA.router.render();
                    RA.ui.toast("Имя сохранено");
                };
            }
        };
    },

    /* ---------------- Настройки ---------------- */
    settings() {
        const s = RA.store.data.settings;
        const html = this.head("⚙ Настройки", "", [["Главная", "#/home"], ["Настройки"]])
            + `<div class="card">
                <div class="field"><label>🌐 Язык интерфейса</label><select id="setLang"><option value="ru">Русский</option><option value="uz">O‘zbekcha</option></select></div>
                <div class="field"><label>Тема оформления</label><select id="setTheme"><option value="dark">Тёмная</option><option value="light">Светлая</option></select></div>
                <div class="field"><label><input type="checkbox" id="setParticles"> Анимированный фон (частицы)</label></div>
                <div class="field"><label>Скорость озвучки 🔊: <b id="rateVal">${s.speechRate}</b></label><input type="range" id="setRate" min="0.5" max="1.3" step="0.1" value="${s.speechRate}">
                    <button class="btn ghost small" data-act="speak" data-text="Здравствуйте! Добро пожаловать в Русскую академию.">Проверить озвучку</button></div>
                <div class="field" id="pwaBox"></div>
                <p class="small">Прогресс хранится только в этом браузере на этом устройстве.</p>
                <div class="btnRow"><button class="btn ghost" id="exportBtn">💾 Скачать прогресс</button><label class="btn ghost">📂 Загрузить прогресс<input type="file" id="importFile" accept=".json" hidden></label><button class="btn ghost" id="resetBtn" style="color:var(--bad)">🗑 Сбросить весь прогресс</button></div>
            </div>`;
        return {
            html, after: () => {
                RA.pwa.paint();
                const lang = document.getElementById("setLang");
                lang.value = s.lang;
                lang.onchange = () => RA.i18n.setLang(lang.value);
                const theme = document.getElementById("setTheme");
                theme.value = s.theme;
                theme.onchange = () => { s.theme = theme.value; RA.store.save(); RA.ui.applySettings(); };
                const part = document.getElementById("setParticles");
                part.checked = s.particles;
                part.onchange = () => { s.particles = part.checked; RA.store.save(); RA.ui.applySettings(); };
                const rate = document.getElementById("setRate");
                rate.oninput = () => { s.speechRate = Number(rate.value); document.getElementById("rateVal").textContent = rate.value; RA.store.save(); };
                document.getElementById("resetBtn").onclick = () => {
                    if (!confirm(RA.t("Удалить весь прогресс, монеты и достижения? Это действие нельзя отменить."))) return;
                    RA.store.reset();
                    RA.ui.applySettings();
                    RA.ui.refresh();
                    RA.ui.toast("Прогресс сброшен");
                    location.hash = "#/home";
                };
                document.getElementById("exportBtn").onclick = () => {
                    const blob = new Blob([JSON.stringify(RA.store.data, null, 2)], { type: "application/json" });
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = "russian-academy-progress.json";
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
                };
                document.getElementById("importFile").onchange = (e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    file.text().then(txt => {
                        const data = JSON.parse(txt);
                        if (typeof data !== "object" || data === null || typeof data.level !== "number") throw new Error("bad");
                        const langBefore = RA.i18n.lang();
                        RA.store.data = RA.store.sanitize(data);
                        RA.store.save();
                        if (RA.i18n.lang() !== langBefore) { location.reload(); return; }
                        RA.ui.applySettings();
                        RA.ui.refresh();
                        RA.ui.toast("Прогресс загружен");
                        RA.router.render();
                    }).catch(() => RA.ui.toast("Не удалось прочитать файл прогресса"));
                };
            }
        };
    },

    notFound() {
        return this.head("Страница не найдена", "Возможно, раздел ещё не готов.") + `<a class="btn" href="#/home">На главную</a>`;
    }
};

/* ==========================================================
   Маршрутизатор
========================================================== */

RA.router = {

    render() {
        RA.Exam.stop();
        RA.Games.stop();
        RA.Practice.stop();
        RA.busy = false;
        const hash = location.hash || "#/home";
        const [path, query] = hash.slice(2).split("?");
        const P = RA.pages;
        let parts;
        let out;
        try {
        parts = path.split("/").map(decodeURIComponent);
        switch (parts[0]) {
            case "": case "home": out = P.home(); break;
            case "track": out = P.track(parts[1]); break;
            case "course": out = P.course(parts[1]); break;
            case "lesson": out = P.lesson(parts[1], parts[2]); break;
            case "review": out = P.review(); break;
            case "placement": out = P.placement(); break;
            case "glossary": out = P.glossary(); break;
            case "games": out = P.games(); break;
            case "game": out = P.game(parts[1]); break;
            case "achievements": out = P.achievementsPage(); break;
            case "shop": out = P.shop(); break;
            case "profile": out = P.profile(); break;
            case "settings": out = P.settings(); break;
            case "search": out = P.search(new URLSearchParams(query || "").get("q") || ""); break;
            default: out = P.notFound();
        }
        } catch (e) {
            console.error(e);
            parts = parts || ["notfound"];
            out = P.notFound();
        }
        if (typeof out === "string") out = { html: out };
        const el = P.el();
        el.innerHTML = out.html;
        out.after && out.after();
        window.scrollTo(0, 0);
        document.body.classList.remove("menuOpen");

        const section = parts[0] === "course" || parts[0] === "lesson"
            ? "#/track/" + ((RA.courseById[parts[1]] || {}).track || "")
            : parts[0] === "game" ? "#/games" : "#/" + (parts[0] === "track" ? "track/" + parts[1] : parts[0] || "home");
        document.querySelectorAll(".menuButton").forEach(b => b.classList.toggle("active", b.dataset.go === section));
    }
};

;
"use strict";

/* ==========================================================
   Работа над ошибками (интервальное повторение) и тест на уровень
========================================================== */

RA.Review = {

    /* Найти содержимое элемента очереди. Устаревшие ключи пропускаем. */
    resolve(key) {
        if (key.startsWith("t:")) {
            const term = RA.allTerms().find(t => t.term === key.slice(2));
            return term ? { key, type: "term", term: RA.loc.term(term) } : null;
        }
        const found = RA.questionIndex()[key];
        if (!found) return null;
        const q = RA.loc.question(found);
        return { key, type: "q", q: RA.util.shuffleOptions(q), course: found.c, lesson: found.l };
    },

    due() {
        return RA.store.srsDueKeys().map(k => this.resolve(k)).filter(Boolean);
    },

    run(root) {
        const items = RA.util.shuffle(this.due()).slice(0, 20);
        let i = 0, score = 0;
        const answer = (item, ok) => {
            RA.store.srsAnswer(item.key, ok);
            if (ok) score++;
        };
        const finish = () => {
            if (score) { RA.store.addXP(score * 2); RA.store.addCoins(score); }
            RA.achievements.check();
            const left = this.due().length;
            root.innerHTML = `<div class="result"><h2>🎉 Повторение завершено</h2><div class="big">${score} / ${items.length}</div>
                <p>+${score * 2} XP · +${score} 💰</p>
                <div class="btnRow" style="justify-content:center">${left ? `<button class="btn" id="more">🔁 К повторению</button>` : ""}<a class="btn ghost" href="#/home">🏠 Главная</a></div></div>`;
            const more = root.querySelector("#more");
            if (more) more.onclick = () => this.run(root);
        };
        const next = () => { i++; draw(); };
        const draw = () => {
            if (i >= items.length) return finish();
            const it = items[i];
            const stat = RA.Games.stats([`${i + 1} / ${items.length}`, `✅ ${score}`]);
            if (it.type === "term") {
                root.innerHTML = stat + `<p class="prompt">${it.term.term} ${RA.render.speakBtn(it.term.term)}</p>
                    <div class="explainSlot" style="max-width:640px;margin:0 auto"></div>
                    <div class="btnRow" style="justify-content:center"><button class="btn" id="show">👁 Показать значение</button></div>`;
                root.querySelector("#show").onclick = () => {
                    root.querySelector(".explainSlot").innerHTML = `<div class="explain" style="text-align:left">${it.term.def}${it.term.ex ? `<br><i>${RA.util.plain(it.term.ex)}</i>` : ""}${it.term.uz ? `<br>🇺🇿 ${it.term.uz}` : ""}</div>`;
                    root.querySelector(".btnRow").innerHTML = `<button class="btn ghost" id="no">🔁 Не помню</button><button class="btn" id="yes">✅ Знаю</button>`;
                    root.querySelector("#no").onclick = () => { answer(it, false); next(); };
                    root.querySelector("#yes").onclick = () => { answer(it, true); next(); };
                };
                return;
            }
            root.innerHTML = stat + `<p class="prompt" style="font-size:19px">${it.q.q}</p>
                <div class="options" style="text-align:left">${it.q.o.map((o, k) => `<button class="opt" data-k="${k}">${o}</button>`).join("")}</div>
                <div class="explainSlot" style="text-align:left"></div>`;
            root.querySelectorAll(".opt").forEach(b => b.onclick = () => {
                const k = Number(b.dataset.k);
                const ok = k === it.q.a;
                root.querySelectorAll(".opt").forEach((x, j) => { x.disabled = true; if (j === it.q.a) x.classList.add("correct"); });
                if (!ok) b.classList.add("wrong");
                answer(it, ok);
                root.querySelector(".explainSlot").innerHTML = `<div class="explain">${ok ? "✅" : "❌"} ${it.q.e || ""}</div>
                    <div class="btnRow" style="justify-content:center"><a class="btn ghost" href="#/lesson/${it.course}/${it.lesson}">📖 Открыть урок</a><button class="btn" id="nextQ">Дальше →</button></div>`;
                root.querySelector("#nextQ").onclick = next;
            });
        };
        draw();
    }
};

RA.pages.review = function () {
    const due = RA.Review.due();
    const total = Object.keys(RA.store.data.srs).length;
    const html = this.head("🔁 Работа над ошибками и повторение", "Вопросы, в которых вы ошиблись, и выученные термины возвращаются через 1, 3, 7 и 14 дней.", [["Главная", "#/home"], ["Повторение"]])
        + `<div class="card gameArea" id="reviewRoot">
            ${this_reviewBody(due.length, total)}
        </div>`;
    return {
        html, after: () => {
            const start = document.getElementById("startReview");
            if (start) start.onclick = () => RA.Review.run(document.getElementById("reviewRoot"));
        }
    };
};

function this_reviewBody(due, total) {
    if (!due) {
        return `<div class="result"><div style="font-size:48px">🌿</div><h2>Сегодня повторять нечего</h2><p>Ошибки из тестов и термины с карточек появятся здесь.</p>
            <p class="small">В очереди всего: ${total}</p>
            <div class="btnRow" style="justify-content:center"><a class="btn" href="#/game/flash">🃏 Карточки терминов</a></div></div>`;
    }
    return `<div class="result"><div class="big">${due}</div><p>Сегодня нужно повторить</p>
        <p class="small">В очереди всего: ${total}</p>
        <div class="btnRow" style="justify-content:center"><button class="btn" id="startReview">▶ Начать повторение</button></div></div>`;
}

/* ---------------- Тест на уровень ---------------- */

/* Какой курс начинать после теста */
RA.placementCourse = function (passed, a1Correct) {
    const next = { none: a1Correct >= 2 ? "a1" : "a0", A1: "a2", A2: "b1", B1: "b2", B2: "c1", C1: "c1" };
    return next[passed];
};

RA.pages.placement = function () {
    const last = RA.store.data.placement;
    const html = this.head("🧭 Определите свой уровень", "", [["Главная", "#/home"], ["Тест на уровень"]])
        + `<div class="card gameArea" id="placeRoot"><div class="result">
            <p>Вопросы становятся сложнее от A1 до C1. Если на уровне меньше 4 верных ответов из 6, тест остановится. Это займёт 5–15 минут.</p>
            ${last ? `<p class="small"><span>Ваш уровень</span>: <b>${RA.util.esc(last.level)}</b> (${RA.util.esc(last.date || "")})</p>` : ""}
            <div class="btnRow" style="justify-content:center">
                <button class="btn" id="startPlace">▶ Начать тест</button>
                <a class="btn ghost" href="#/course/a0" id="placeZero">🔤 Я не читаю по-русски — начать с алфавита</a>
            </div></div></div>`;
    return {
        html, after: () => {
            document.getElementById("startPlace").onclick = () => runPlacement(document.getElementById("placeRoot"));
            document.getElementById("placeZero").onclick = () => savePlacement("A0", "a0");
        }
    };
};

function savePlacement(level, courseId) {
    const d = RA.store.data;
    d.placement = { level, course: courseId, date: RA.util.today() };
    if (!d.goal) d.goal = "zero";
    RA.store.save();
}

function runPlacement(root) {
    const levels = RA.placement;
    let li = 0, qi = 0, right = 0, passed = "none", a1Correct = 0;
    const perLevel = [], mistakes = [];
    let order = levels[0].questions.map(q => RA.util.shuffleOptions(q));
    RA.busy = true;

    const result = () => {
        RA.busy = false;
        const shown = passed === "none" ? (a1Correct >= 2 ? "A1" : "A0") : passed;
        const courseId = RA.placementCourse(passed, a1Correct);
        const course = RA.loc.course(RA.courseById[courseId]);
        savePlacement(shown, courseId);
        RA.achievements.check();
        root.innerHTML = `<div class="result">
            <h2>Ваш уровень</h2><div class="big">${shown}</div>
            <p><span>Рекомендуем начать</span>: <b>${course.icon} ${course.title}</b></p>
            <div class="tableWrap lesson"><table><thead><tr><th>Уровень</th><th>Правильно</th></tr></thead><tbody>
                ${perLevel.map(x => `<tr><td>${x.level}</td><td>${x.right} / ${x.n}</td></tr>`).join("")}</tbody></table></div>
            <div class="btnRow" style="justify-content:center"><a class="btn" href="#/course/${courseId}">▶ Начать курс</a><button class="btn ghost" id="placeAgain">🔄 Пройти тест ещё раз</button></div>
            ${mistakes.length ? `<h3 style="margin-top:20px">Разбор ваших ошибок</h3><div style="text-align:left">${mistakes.map(m =>
                `<div class="explain"><b>${m.q.q}</b><br>❌ ${m.chosen}<br>✅ ${m.q.o[m.q.a]}<br>${m.q.e || ""}</div>`).join("")}</div>` : ""}
        </div>`;
        root.querySelector("#placeAgain").onclick = () => runPlacement(root);
    };

    const draw = () => {
        const level = levels[li];
        const q = order[qi];
        root.innerHTML = RA.Games.stats([level.level, `${qi + 1} / ${level.questions.length}`]) + `
            <p class="prompt" style="font-size:19px">${q.q}</p>
            <div class="options" style="max-width:640px;margin:0 auto;text-align:left">${q.o.map((o, k) => `<button class="opt" data-k="${k}">${o}</button>`).join("")}</div>`;
        root.querySelectorAll(".opt").forEach(b => b.onclick = () => {
            const k = Number(b.dataset.k);
            if (k === q.a) right++;
            else mistakes.push({ q, chosen: q.o[k] });
            qi++;
            if (qi < order.length) return draw();
            perLevel.push({ level: level.level, right, n: order.length });
            if (level.level === "A1") a1Correct = right;
            if (right >= 4) passed = level.level;
            if (right < 4 || li === levels.length - 1) return result();
            li++; qi = 0; right = 0;
            order = levels[li].questions.map(x => RA.util.shuffleOptions(x));
            draw();
        });
    };
    draw();
}

;
"use strict";

/* ==========================================================
   Урок-практика: письмо и говорение с самопроверкой.
   Текст ответа хранится как черновик только в этом браузере,
   запись голоса не сохраняется и никуда не отправляется.
========================================================== */

RA.Practice = {

    timers: [],
    stream: null,
    recorder: null,
    urls: [],
    micGen: 0,
    activeCard: null,

    stop() {
        this.micGen++;
        this.activeCard = null;
        this.timers.forEach(t => clearInterval(t));
        this.timers = [];
        if (this.recorder && this.recorder.state !== "inactive") {
            try { this.recorder.stop(); } catch (e) { /* уже остановлен */ }
        }
        this.recorder = null;
        if (this.stream) this.stream.getTracks().forEach(t => t.stop());
        this.stream = null;
        this.urls.forEach(u => URL.revokeObjectURL(u));
        this.urls = [];
    },

    draftKey(ctx, i) {
        return "ra.draft." + ctx.course.id + "/" + ctx.lesson.id + "/" + i;
    },

    readDraft(key) {
        try { return localStorage.getItem(key) || ""; } catch (e) { return ""; }
    },

    writeDraft(key, text) {
        try {
            if (text) localStorage.setItem(key, text);
            else localStorage.removeItem(key);
        } catch (e) { /* черновик необязателен */ }
    },

    clock(sec) {
        const s = Math.max(0, sec);
        return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
    },

    /* Обратный отсчёт по реальным часам */
    countdown(el, seconds, onEnd) {
        const end = Date.now() + seconds * 1000;
        const tick = () => {
            const left = Math.ceil((end - Date.now()) / 1000);
            el.textContent = this.clock(left);
            el.classList.toggle("low", left <= 10);
            if (left <= 0) {
                clearInterval(id);
                onEnd && onEnd();
            }
        };
        const id = setInterval(tick, 500);
        this.timers.push(id);
        tick();
        return () => clearInterval(id);
    },

    start(root, ctx) {
        this.stop();
        const { lesson } = ctx;
        const scores = lesson.tasks.map(() => null);
        root.innerHTML = lesson.tasks.map((t, i) => `<div class="card taskCard" data-i="${i}" style="margin-bottom:16px">
            <span class="tag">${t.type === "write" ? "✍️ Письмо" : "🎙 Говорение"}</span>
            <h2>${t.title}</h2>
            <div class="promptText">${t.prompt}</div>
            <div class="work"></div>
            <div class="check"></div>
        </div>`).join("") + `<div class="practiceSummary"></div>`;

        const finished = () => {
            if (scores.some(s => s === null)) return;
            const percent = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
            const pass = lesson.pass || 66;
            const ok = percent >= pass;
            if (ok) {
                const first = RA.store.completeLesson(ctx.course.id, lesson.id, 0);
                if (first) { RA.store.addXP(30); RA.store.addCoins(10); }
            }
            RA.achievements.check();
            root.querySelector(".practiceSummary").innerHTML = `<div class="card result">
                <h2>Самопроверка завершена</h2><div class="big">${percent}%</div>
                <p>${ok ? "✅ Практика засчитана" : "Повторите задания, чтобы набрать " + pass + "%"}</p>
                <p class="small">Это ваша собственная оценка, а не экзаменационный балл.</p></div>`;
        };

        root.querySelectorAll(".taskCard").forEach(card => {
            const i = Number(card.dataset.i);
            const task = lesson.tasks[i];
            const showCheck = () => this.selfCheck(card, task, percent => { scores[i] = percent; finished(); });
            if (task.type === "write") this.writeTask(card, task, this.draftKey(ctx, i), showCheck);
            else this.speakTask(card, task, showCheck);
        });
    },

    /* ---------- Письмо ---------- */
    writeTask(card, task, key, showCheck) {
        const target = task.min ? `${task.min}${task.max ? "–" + task.max : "+"}` : "";
        card.querySelector(".work").innerHTML = `
            <textarea class="answerBox" rows="10" placeholder="Напишите ответ здесь…"></textarea>
            <div class="workBar">
                <span class="chip"><span>Слов</span>: <b class="wc">0</b>${target ? " / " + target : ""}</span>
                ${task.time ? `<button class="btn ghost small startTimer">⏱ <span>Запустить таймер</span> (${task.time} <span>мин</span>)</button><span class="timer writeTimer"></span>` : ""}
                <button class="btn small doCheck" disabled>✅ Проверить себя</button>
            </div>`;
        const box = card.querySelector(".answerBox");
        const wc = card.querySelector(".wc");
        const doCheck = card.querySelector(".doCheck");
        let checked = false;
        const update = () => {
            const words = box.value.trim() ? box.value.trim().split(/\s+/).length : 0;
            wc.textContent = words;
            wc.style.color = task.min && words < task.min ? "var(--warn)" : task.max && words > task.max ? "var(--bad)" : "var(--ok)";
            doCheck.disabled = checked || !words;
        };
        box.value = this.readDraft(key);
        box.addEventListener("input", () => { this.writeDraft(key, box.value); update(); });
        update();
        const startTimer = card.querySelector(".startTimer");
        if (startTimer) startTimer.onclick = () => {
            startTimer.remove();
            this.countdown(card.querySelector(".writeTimer"), task.time * 60, () => RA.ui.toast(RA.t("Время вышло!")));
        };
        doCheck.onclick = () => { checked = true; doCheck.disabled = true; showCheck(); };
    },

    /* ---------- Говорение ----------
       Микрофоном в любой момент владеет одно задание (activeCard).
       Запрос разрешения нельзя отменить, поэтому результат устаревшего запроса отбрасывается. */
    speakTask(card, task, showCheck) {
        const work = card.querySelector(".work");
        work.innerHTML = `<div class="workBar">
                <span class="chip">🧠 <span>Подготовка</span>: ${this.clock(task.prep)}</span>
                <span class="chip">🗣 <span>Ответ</span>: ${this.clock(task.time)}</span>
                <button class="btn small startSpeak">▶ Начать подготовку</button>
                <button class="btn ghost small skipSpeak">Проверить себя без записи</button>
            </div>
            <p class="small">Запись остаётся только на этом устройстве и не сохраняется после ухода со страницы.</p>
            <div class="stage"></div>`;
        const stage = work.querySelector(".stage");
        const chunks = [];
        let ended = false;

        const review = (url) => {
            if (ended === "reviewed" || !card.isConnected) return;
            ended = "reviewed";
            if (this.activeCard === card) {
                this.stopMic();
                this.activeCard = null;
            }
            stage.innerHTML = url ? `<p><span>Ваша запись</span>:</p><audio controls src="${url}" style="width:100%"></audio>` : "";
            const bar = work.querySelector(".workBar");
            if (bar) bar.remove();
            showCheck();
        };

        const answer = () => {
            if (!card.isConnected || this.activeCard !== card) return;
            RA.audio.stop(); /* образец ответа не должен попасть в запись */
            const rec = this.recorder;
            stage.innerHTML = `<p class="stageTitle"><b>🗣 Говорите!</b> <span class="timer speakTimer"></span></p><div class="btnRow"><button class="btn small endSpeak">⏹ Закончить</button></div>`;
            const buildUrl = () => {
                if (!chunks.length || !card.isConnected) return null;
                const url = URL.createObjectURL(new Blob(chunks, { type: (rec && rec.mimeType) || "audio/webm" }));
                this.urls.push(url);
                return url;
            };
            let stopCount = null;
            const done = () => {
                if (ended) return;
                ended = true;
                if (stopCount) stopCount();
                if (rec && rec.state !== "inactive") {
                    rec.onstop = () => review(buildUrl());
                    rec.stop();
                } else {
                    /* Микрофон мог отключиться во время ответа: то, что записано, сохраняем */
                    review(buildUrl());
                }
            };
            if (rec && rec.state === "inactive") {
                try { rec.start(); } catch (e) { /* отвечаем без записи */ }
            }
            stopCount = this.countdown(stage.querySelector(".speakTimer"), task.time, done);
            stage.querySelector(".endSpeak").onclick = done;
        };

        work.querySelector(".skipSpeak").onclick = () => {
            if (this.activeCard === card) this.micGen++; /* отменяем ожидание разрешения */
            review(null);
        };
        work.querySelector(".startSpeak").onclick = async () => {
            if (this.activeCard) {
                RA.ui.toast(RA.t("Сначала закончите текущее задание"));
                return;
            }
            this.activeCard = card;
            work.querySelector(".startSpeak").remove();
            stage.innerHTML = `<p class="small">⏳</p>`;
            const mic = await this.startMic(blob => chunks.push(blob));
            if (mic === null || !card.isConnected || this.activeCard !== card) return;
            const skip = work.querySelector(".skipSpeak");
            if (skip) skip.remove();
            stage.innerHTML = `${mic ? "" : `<p class="small">🎙 Микрофон недоступен: отвечайте вслух без записи.</p>`}
                <p class="stageTitle"><b>🧠 Подготовка</b> <span class="timer prepTimer"></span></p>
                <div class="btnRow"><button class="btn small goSpeak">▶ Начать отвечать</button></div>`;
            const stopPrep = this.countdown(stage.querySelector(".prepTimer"), task.prep, answer);
            stage.querySelector(".goSpeak").onclick = () => { stopPrep(); answer(); };
        };
    },

    /* true — запись доступна, false — микрофона нет, null — запрос устарел */
    async startMic(onData) {
        const gen = ++this.micGen;
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) return false;
        try {
            this.stopMic();
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (gen !== this.micGen) {
                stream.getTracks().forEach(t => t.stop());
                return null;
            }
            this.stream = stream;
            this.recorder = new MediaRecorder(stream);
            this.recorder.ondataavailable = e => { if (e.data && e.data.size) onData(e.data); };
            return true;
        } catch (e) {
            if (gen !== this.micGen) return null;
            this.stopMic();
            return false;
        }
    },

    stopMic() {
        if (this.stream) this.stream.getTracks().forEach(t => t.stop());
        this.stream = null;
        this.recorder = null;
    },

    /* ---------- Самопроверка ---------- */
    selfCheck(card, task, onSave) {
        const box = card.querySelector(".check");
        box.innerHTML = `<h3 style="margin-top:16px">📋 Образец ответа ${RA.render.speakBtn(task.model)}</h3>
            <div class="readText">${task.model}</div>
            <h3>✅ Отметьте, что получилось</h3>
            <div class="criteria">${task.criteria.map((c, i) => `<label class="crit"><input type="checkbox" data-c="${i}"> <span class="critText">${c}</span></label>`).join("")}</div>
            <div class="btnRow"><button class="btn small saveCheck">💾 Сохранить оценку</button></div>
            <div class="savedMsg small"></div>`;
        box.querySelector(".saveCheck").onclick = () => {
            const done = box.querySelectorAll("input:checked").length;
            const percent = Math.round(done / task.criteria.length * 100);
            box.querySelector(".savedMsg").textContent = `${done} / ${task.criteria.length} (${percent}%)`;
            onSave(percent);
        };
        box.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
};

;
"use strict";

/* ==========================================================
   Работа без интернета и установка на телефон.
   Service worker есть только в собранной версии (папка dist),
   на сайте по адресу https:// или localhost.
========================================================== */

RA.pwa = {

    deferred: null,
    ready: false,
    failed: false,
    reg: null,
    lastCheck: 0,

    supported() {
        return !!window.RA_BUILD && "serviceWorker" in navigator && location.protocol.startsWith("http");
    },

    isStandalone() {
        return window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
    },

    isIos() {
        return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    },

    init() {
        window.addEventListener("beforeinstallprompt", (e) => {
            e.preventDefault();
            this.deferred = e;
            this.paint();
        });
        window.addEventListener("appinstalled", () => {
            this.deferred = null;
            RA.ui.toast(RA.t("Приложение установлено"));
            this.paint();
        });
        if (!this.supported()) return;

        const hadController = !!navigator.serviceWorker.controller;
        navigator.serviceWorker.addEventListener("controllerchange", () => {
            if (hadController) RA.ui.toast(RA.t("Сайт обновлён. Новая версия откроется при следующем запуске."));
        });
        window.addEventListener("load", () => {
            navigator.serviceWorker.register("sw.js").then(reg => this.watch(reg))
                .catch(e => { console.warn("Service worker:", e); this.setFailed(); });
        });
        /* Приложение не перезагружается при переходах: новые версии проверяем сами */
        document.addEventListener("visibilitychange", () => { if (!document.hidden) this.checkUpdate(); });
        window.addEventListener("online", () => this.checkUpdate(true));
    },

    watch(reg) {
        this.reg = reg;
        const track = (worker) => {
            if (!worker) return;
            worker.addEventListener("statechange", () => {
                if (worker.state === "activated") this.setReady();
                /* Установка сорвалась, а рабочей копии нет */
                if (worker.state === "redundant" && !reg.active) this.setFailed();
            });
        };
        reg.addEventListener("updatefound", () => track(reg.installing));
        if (reg.active) this.setReady();
        track(reg.installing || reg.waiting);
    },

    setReady() {
        this.ready = true;
        this.failed = false;
        this.paint();
        /* Просим браузер не удалять прогресс при нехватке места */
        if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { });
    },

    setFailed() {
        if (this.ready) return;
        this.failed = true;
        this.paint();
    },

    /* force — без ограничения по времени (например, снова появился интернет) */
    checkUpdate(force) {
        if (!this.reg || !navigator.onLine) return;
        if (!force && Date.now() - this.lastCheck < 6 * 3600 * 1000) return;
        this.lastCheck = Date.now();
        this.reg.update().catch(() => { });
    },

    /* Блок на странице настроек */
    paint() {
        const box = document.getElementById("pwaBox");
        if (!box) return;
        let status;
        if (!this.supported()) status = "Работа без интернета включится, когда сайт будет опубликован.";
        else if (this.ready) status = "✅ Сайт сохранён на устройстве и работает без интернета.";
        else if (this.failed) status = "⚠️ Не удалось сохранить сайт на устройство. Попробуем снова при подключении к интернету.";
        else status = "⏳ Сохраняем сайт на устройство…";

        box.innerHTML = `<label>📲 Приложение и работа без интернета</label>
            <p class="small"></p>
            <div class="btnRow" id="pwaBtns"></div>`;
        box.querySelector("p").textContent = status;
        const btns = box.querySelector("#pwaBtns");
        if (this.deferred) {
            const b = document.createElement("button");
            b.className = "btn small";
            b.textContent = "Установить на устройство";
            b.onclick = async () => {
                const prompt = this.deferred;
                this.deferred = null;
                prompt.prompt();
                await prompt.userChoice.catch(() => { });
                this.paint();
            };
            btns.appendChild(b);
        } else if (this.isIos() && !this.isStandalone() && this.supported()) {
            const p = document.createElement("p");
            p.className = "small";
            p.textContent = "На iPhone: откройте сайт в Safari, нажмите «Поделиться» и выберите «На экран Домой». Приложение хранит прогресс отдельно от Safari, поэтому сначала скачайте прогресс здесь, а затем загрузите его в приложении.";
            btns.appendChild(p);
        }
    }
};

;
"use strict";

/* Лёгкий анимированный фон из частиц (отключается в настройках) */
RA.effects = {

    running: false,
    particles: [],

    init() {
        this.canvas = document.getElementById("particles");
        this.ctx = this.canvas.getContext("2d");
        this.resize();
        window.addEventListener("resize", () => this.resize());
        const n = window.innerWidth < 700 ? 40 : 90;
        for (let i = 0; i < n; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                r: Math.random() * 1.8 + 0.6,
                v: Math.random() * 0.4 + 0.15
            });
        }
    },

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    },

    toggle(on) {
        if (!this.canvas) this.init();
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) on = false;
        this.running = on;
        this.canvas.style.display = on ? "block" : "none";
        if (on && !this.frame) this.loop();
    },

    loop() {
        if (!this.running) { this.frame = null; return; }
        const { ctx, canvas } = this;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = document.documentElement.dataset.theme === "light" ? "rgba(37,99,235,.35)" : "rgba(102,217,255,.55)";
        this.particles.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
            p.y -= p.v;
            if (p.y < -5) { p.y = canvas.height + 5; p.x = Math.random() * canvas.width; }
        });
        this.frame = requestAnimationFrame(() => this.loop());
    }
};

;
"use strict";

/* ==========================================================
   Запуск приложения, общие элементы интерфейса
========================================================== */

RA.ui = {

    plural(n, one, few, many) {
        const m10 = n % 10, m100 = n % 100;
        if (m10 === 1 && m100 !== 11) return one;
        if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
        return many;
    },

    toast(text) {
        this._queue = this._queue || [];
        this._queue.push(text);
        if (!this._showing) this.nextToast();
    },

    nextToast() {
        const el = document.getElementById("toast");
        const text = this._queue.shift();
        if (text === undefined) {
            this._showing = false;
            el.classList.remove("show");
            return;
        }
        this._showing = true;
        el.textContent = text;
        el.classList.add("show");
        setTimeout(() => this.nextToast(), this._queue.length ? 1800 : 3000);
    },

    modal(html) {
        document.getElementById("modalContent").innerHTML = html;
        document.getElementById("modal").classList.add("show");
    },

    closeModal() {
        document.getElementById("modal").classList.remove("show");
    },

    applySettings() {
        const s = RA.store.data.settings;
        document.documentElement.dataset.theme = s.theme;
        RA.effects && RA.effects.toggle(s.particles);
    },

    refresh() {
        const d = RA.store.data;
        if (!d) return;
        const need = RA.store.xpForLevel(d.level);
        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set("playerName", d.name);
        set("avatar", d.avatar);
        set("playerLevel", d.level);
        set("expText", d.xp + " / " + need + " XP");
        set("hLevel", d.level);
        set("hStreak", d.streak);
        set("hCoins", d.coins);
        set("sStreak", d.streak);
        set("sLessons", Object.keys(d.lessons).length);
        set("sGames", d.gamesPlayed);
        set("sXp", d.totalXp);
        const due = RA.store.srsDueKeys().length;
        const badge = document.getElementById("reviewBadge");
        if (badge) { badge.textContent = due; badge.hidden = !due; }
        const fill = document.getElementById("expFill");
        if (fill) fill.style.width = Math.min(100, d.xp / need * 100) + "%";
        const daily = d.daily.day === RA.util.today() ? d.daily.xp : 0;
        set("dailyText", daily >= 50 ? "🎉 Цель выполнена! " + daily + " XP сегодня" : "Наберите 50 XP: " + daily + " / 50");
        const df = document.getElementById("dailyFill");
        if (df) df.style.width = Math.min(100, daily / 50 * 100) + "%";
    },

    tip() {
        const tips = RA.gameData.tips.length ? RA.gameData.tips : ["Занимайтесь понемногу, но каждый день — так слова запоминаются надёжнее."];
        document.getElementById("speech").textContent = tips[Math.floor(Math.random() * tips.length)];
    }
};

RA.init = function () {
    RA.store.load();
    /* Заранее просим список голосов и выключаем звук при уходе со страницы */
    if ("speechSynthesis" in window) speechSynthesis.getVoices();
    window.addEventListener("pagehide", () => { RA.audio.stop(); RA.Practice.stop(); });
    RA.ui.applySettings();
    const uz = RA.i18n.lang() === "uz";
    document.getElementById("langBtn").dataset.lang = uz ? "ru" : "uz";
    document.getElementById("langLabel").textContent = uz ? "RU" : "UZ";
    RA.i18n.start();
    RA.ui.refresh();
    RA.ui.tip();
    RA.pwa.init();

    /* делегирование кликов */
    document.addEventListener("click", (e) => {
        const langBtn = e.target.closest("[data-lang]");
        if (langBtn && !langBtn.closest("#modalContent")) { RA.i18n.setLang(langBtn.dataset.lang); return; }
        const go = e.target.closest("[data-go]");
        if (go) { document.body.classList.remove("menuOpen"); location.hash = go.dataset.go; return; }
        const act = e.target.closest("[data-act]");
        if (!act) return;
        switch (act.dataset.act) {
            case "speak": e.preventDefault(); RA.util.speak(act.dataset.text); break;
            case "toggleTask": {
                const task = act.closest(".task");
                task.classList.toggle("open");
                act.textContent = RA.t(task.classList.contains("open") ? "Скрыть ответ" : "Показать ответ");
                break;
            }
            case "scrollTo": {
                const el = document.getElementById(act.dataset.target);
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                document.querySelectorAll(".tabs .tab").forEach(t => t.classList.toggle("active", t === act));
                break;
            }
            case "chooseGoal": RA.pages.chooseGoal(); break;
        }
    });

    document.getElementById("menuToggle").onclick = () => document.body.classList.toggle("menuOpen");
    document.getElementById("closeModal").onclick = () => RA.ui.closeModal();
    document.getElementById("modal").addEventListener("click", (e) => { if (e.target.id === "modal") RA.ui.closeModal(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") RA.ui.closeModal(); });
    document.getElementById("nextTip").onclick = () => RA.ui.tip();
    document.getElementById("searchForm").addEventListener("submit", (e) => {
        e.preventDefault();
        const q = document.getElementById("searchInput").value.trim();
        if (q) location.hash = "#/search?q=" + encodeURIComponent(q);
    });

    window.addEventListener("storage", (e) => {
        if (e.key !== RA.store.key) return;
        let saved = null;
        try { saved = JSON.parse(e.newValue || "null"); } catch (err) { return; }
        const before = RA.i18n.lang();
        RA.store.syncFrom(saved);
        if (RA.i18n.lang() !== before) { location.reload(); return; }
        RA.ui.applySettings();
        RA.ui.refresh();
    });

    /* Заставку скрываем при любом исходе отрисовки */
    const loader = document.getElementById("loader");
    setTimeout(() => loader.classList.add("hidden"), 500);
    setTimeout(() => { loader.style.display = "none"; }, 1300);

    window.addEventListener("hashchange", () => RA.router.render());
    RA.router.render();
    RA.achievements.check();

    if (!RA.store.data.goal && !location.hash.startsWith("#/lesson")) {
        setTimeout(() => RA.pages.chooseGoal(), 900);
    }
};

window.addEventListener("DOMContentLoaded", RA.init);
