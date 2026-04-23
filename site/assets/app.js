/* =====================================================================
 * Codecademia — SPA app
 *  - hash router with views: home / courses / course / topic / roadmap / about
 *  - theme + lang persistence
 *  - markdown rendering with copy buttons & ToC
 *  - progress tracking (localStorage)
 *  - command palette
 * ================================================================== */
(function () {
  "use strict";

  const STORAGE = { theme: "cca.theme", lang: "cca.lang", progress: "cca.progress" };
  const DEFAULT_LANG = "ru";

  const AppState = window.AppState = {
    lang: localStorage.getItem(STORAGE.lang) || DEFAULT_LANG,
    theme: localStorage.getItem(STORAGE.theme) ||
           (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"),
    route: { name: "home" },
    headings: []
  };

  marked.setOptions({ gfm: true, breaks: false });

  const $ = sel => document.querySelector(sel);
  const $$ = sel => document.querySelectorAll(sel);
  const view = document.getElementById("view");

  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------- Progress ----------
  function loadProgress() {
    try { return JSON.parse(localStorage.getItem(STORAGE.progress) || "{}"); } catch (_) { return {}; }
  }
  function saveProgress(p) { localStorage.setItem(STORAGE.progress, JSON.stringify(p)); }
  function isCompleted(courseId, topicId) {
    const p = loadProgress();
    return !!(p[courseId] && p[courseId][topicId]);
  }
  function setCompleted(courseId, topicId, value) {
    const p = loadProgress();
    p[courseId] = p[courseId] || {};
    if (value) p[courseId][topicId] = Date.now();
    else delete p[courseId][topicId];
    saveProgress(p);
  }
  function courseProgress(course) {
    const total = CATALOG_HELPERS.flatTopics(course).length || 1;
    const done = Object.keys((loadProgress()[course.id] || {})).length;
    return { total, done, pct: Math.round((done / total) * 100) };
  }

  // ---------- Theme ----------
  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    AppState.theme = theme;
    localStorage.setItem(STORAGE.theme, theme);
    $("#hljs-light").disabled = theme === "dark";
    $("#hljs-dark").disabled = theme !== "dark";
  }
  $("#themeToggle").addEventListener("click", () => applyTheme(AppState.theme === "dark" ? "light" : "dark"));

  // ---------- Language ----------
  function applyLang(lang) {
    AppState.lang = lang;
    localStorage.setItem(STORAGE.lang, lang);
    document.documentElement.lang = lang;
    $$(".lang-btn").forEach(b => b.classList.toggle("active", b.dataset.lang === lang));
    applyI18nDom();
    render();
  }
  function applyI18nDom() {
    $$("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
    document.title = t("brand.tag") === "premium engineering theory"
      ? "Codecademia — premium learning for engineers"
      : document.title;
  }
  $$(".lang-btn").forEach(b => b.addEventListener("click", () => applyLang(b.dataset.lang)));

  function pick(obj) {
    if (!obj) return "";
    return obj[AppState.lang] || obj.ru || obj.en || "";
  }

  // ---------- Router ----------
  function parseRoute() {
    const h = location.hash.replace(/^#/, "") || "/";
    const segs = h.split("/").filter(Boolean);
    if (segs.length === 0) return { name: "home" };
    if (segs[0] === "courses") return { name: "courses" };
    if (segs[0] === "roadmap") return { name: "roadmap" };
    if (segs[0] === "about") return { name: "about" };
    if (segs[0] === "c" && segs[1]) {
      if (segs[2] === "t" && segs[3]) {
        return { name: "topic", courseId: segs[1], topicId: segs[3], anchor: segs[4] || null };
      }
      return { name: "course", courseId: segs[1] };
    }
    return { name: "home" };
  }

  function render() {
    AppState.route = parseRoute();
    updateActiveNav();
    closeDrawer();
    switch (AppState.route.name) {
      case "courses": renderCourses(); break;
      case "course":  renderCourse(AppState.route.courseId); break;
      case "topic":   renderTopic(AppState.route.courseId, AppState.route.topicId, AppState.route.anchor); break;
      case "roadmap": renderRoadmap(); break;
      case "about":   renderAbout(); break;
      default:        renderHome(); break;
    }
    window.scrollTo(0, 0);
  }
  function updateActiveNav() {
    const map = { home: "home", courses: "courses", course: "courses", topic: "courses", roadmap: "roadmap", about: "about" };
    const want = map[AppState.route.name] || "home";
    $$("[data-route-link]").forEach(a => a.classList.toggle("active", a.dataset.routeLink === want));
  }
  window.addEventListener("hashchange", render);

  // ---------- Mobile drawer ----------
  let drawer;
  function openDrawer() {
    if (drawer) return;
    drawer = document.createElement("div");
    drawer.className = "drawer open";
    drawer.innerHTML = `
      <div class="drawer-back"></div>
      <div class="drawer-panel">
        <a href="#/" data-i18n-key="nav.home">${t("nav.home")}</a>
        <a href="#/courses" data-i18n-key="nav.courses">${t("nav.courses")}</a>
        <a href="#/roadmap" data-i18n-key="nav.roadmap">${t("nav.roadmap")}</a>
        <a href="#/about" data-i18n-key="nav.about">${t("nav.about")}</a>
      </div>`;
    document.body.appendChild(drawer);
    drawer.querySelector(".drawer-back").addEventListener("click", closeDrawer);
    drawer.querySelectorAll("a").forEach(a => a.addEventListener("click", closeDrawer));
  }
  function closeDrawer() { if (drawer) { drawer.remove(); drawer = null; } }
  $("#menuToggle").addEventListener("click", openDrawer);

  // ---------- Markdown helpers ----------
  function slugify(text) {
    return String(text).toLowerCase()
      .replace(/[\s\u00A0]+/g, "-")
      .replace(/[^\w\-а-яёіїєґа-щьюя]+/gi, "")
      .replace(/-+/g, "-").replace(/^-|-$/g, "") || "section";
  }
  function highlightCode(scope) {
    scope.querySelectorAll("pre code").forEach(code => {
      try {
        const m = (code.className || "").match(/language-(\w+)/);
        if (m && hljs.getLanguage(m[1])) {
          code.innerHTML = hljs.highlight(code.textContent, { language: m[1], ignoreIllegals: true }).value;
        } else {
          code.innerHTML = hljs.highlightAuto(code.textContent).value;
        }
        code.classList.add("hljs");
      } catch (_) {}
    });
  }
  function wrapCodeBlocks(scope) {
    scope.querySelectorAll("pre").forEach(pre => {
      if (pre.parentElement && pre.parentElement.classList.contains("code-block")) return;
      const wrap = document.createElement("div");
      wrap.className = "code-block";
      const code = pre.querySelector("code");
      const langClass = code && (code.className || "").match(/language-(\w+)/);
      const lang = langClass ? langClass[1] : "";
      pre.parentNode.insertBefore(wrap, pre);
      wrap.appendChild(pre);
      if (lang) {
        const badge = document.createElement("span");
        badge.className = "code-lang";
        badge.textContent = lang;
        wrap.appendChild(badge);
      }
      const btn = document.createElement("button");
      btn.className = "code-copy";
      btn.title = "Copy";
      btn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(code.innerText);
          btn.classList.add("copied");
          setTimeout(() => btn.classList.remove("copied"), 1300);
        } catch (_) {}
      });
      wrap.appendChild(btn);
    });
  }
  function wrapTables(scope) {
    scope.querySelectorAll("table").forEach(table => {
      if (table.parentElement && table.parentElement.classList.contains("table-wrap")) return;
      const wrap = document.createElement("div");
      wrap.className = "table-wrap";
      table.parentNode.insertBefore(wrap, table);
      wrap.appendChild(table);
    });
  }
  function addHeadingIds(scope) {
    const used = new Set();
    AppState.headings = [];
    scope.querySelectorAll("h2, h3").forEach(h => {
      const base = h.id || slugify(h.textContent);
      let id = base, i = 1;
      while (used.has(id)) id = `${base}-${++i}`;
      used.add(id);
      h.id = id;
      const a = document.createElement("a");
      a.className = "heading-anchor";
      a.href = "#" + (location.hash.slice(1) || "/").split("#")[0];
      a.textContent = "#";
      a.setAttribute("aria-hidden", "true");
      h.prepend(a);
      AppState.headings.push({ id, text: h.textContent.replace(/^#\s*/, "").trim(), level: parseInt(h.tagName[1], 10) });
    });
  }

  async function fetchFirst(urls) {
    for (const url of urls) {
      try {
        const res = await fetch(url, { cache: "no-cache" });
        if (res.ok) return { url, text: await res.text() };
      } catch (_) {}
    }
    return null;
  }

  // ====================================================================
  // VIEWS
  // ====================================================================
  function renderHome() {
    const courses = CATALOG_HELPERS.list();
    const liveCourses = courses.filter(c => c.status === "live");
    const totalTopics = liveCourses.reduce((acc, c) => acc + CATALOG_HELPERS.flatTopics(c).length, 0);
    const totalModules = liveCourses.reduce((acc, c) => acc + (c.modules || []).length, 0);

    view.innerHTML = `
      <section class="hero">
        <span class="hero-eyebrow"><span class="dot"></span>${t("home.eyebrow")}</span>
        <h1>${t("home.title.a")} <span class="accent">${t("home.title.b")}</span>${t("home.title.c")}</h1>
        <p class="lede">${t("home.lede")}</p>
        <div class="hero-cta">
          <a href="#/courses" class="btn btn-primary btn-lg">${t("home.cta.primary")}</a>
          <a href="#/roadmap" class="btn btn-lg">${t("home.cta.secondary")}</a>
        </div>
        <div class="hero-stats">
          <div class="hero-stat"><span class="num">${totalTopics}+</span><span class="label">${t("home.stats.topics")}</span></div>
          <div class="hero-stat"><span class="num">${totalModules}</span><span class="label">${t("home.stats.modules")}</span></div>
          <div class="hero-stat"><span class="num">3</span><span class="label">${t("home.stats.languages")}</span></div>
          <div class="hero-stat"><span class="num">100+</span><span class="label">${t("home.stats.questions")}</span></div>
        </div>
      </section>

      <section class="section">
        <div class="container">
          <div class="section-head">
            <div class="section-eyebrow">${t("home.courses.eyebrow")}</div>
            <h2>${t("home.courses.title")}</h2>
            <p class="section-sub">${t("home.courses.sub")}</p>
          </div>
          <div class="courses-grid">${courses.map(courseCardHtml).join("")}</div>
        </div>
      </section>

      <section class="section">
        <div class="container">
          <div class="section-head">
            <div class="section-eyebrow">${t("home.features.eyebrow")}</div>
            <h2>${t("home.features.title")}</h2>
            <p class="section-sub">${t("home.features.sub")}</p>
          </div>
          <div class="features">
            ${featureHtml("📚", t("home.f1.t"), t("home.f1.d"))}
            ${featureHtml("🎯", t("home.f2.t"), t("home.f2.d"))}
            ${featureHtml("🌐", t("home.f3.t"), t("home.f3.d"))}
            ${featureHtml("✅", t("home.f4.t"), t("home.f4.d"))}
            ${featureHtml("⚡", t("home.f5.t"), t("home.f5.d"))}
            ${featureHtml("🔧", t("home.f6.t"), t("home.f6.d"))}
          </div>
        </div>
      </section>

      <div class="cta-strip">
        <h2>${t("home.cta2.title")}</h2>
        <p>${t("home.cta2.sub")}</p>
        <a href="#/courses" class="btn btn-lg">${t("home.cta2.btn")}</a>
      </div>
    `;
  }

  function courseCardHtml(course) {
    const isLive = course.status === "live";
    const flat = CATALOG_HELPERS.flatTopics(course);
    const minutes = flat.reduce((s, t) => s + (t.minutes || 0), 0);
    const progress = isLive ? courseProgress(course) : null;
    const badge = isLive
      ? `<span class="badge badge-success">live</span>`
      : `<span class="badge badge-soon">${t("comingSoon")}</span>`;
    const meta = isLive
      ? `<div class="course-meta">
          <span>${iconClock()} ${minutes} ${t("course.minutes")}</span>
          <span>${iconBook()} ${flat.length} ${t("course.topics")}</span>
          <span>${iconLayers()} ${(course.modules || []).length} ${t("course.modules")}</span>
        </div>`
      : `<div class="course-meta"><span>${t("comingSoon")}</span></div>`;
    const href = isLive ? `#/c/${course.slug}` : "#/roadmap";
    return `
      <a class="course-card ${isLive ? "" : "coming-soon"}" href="${href}">
        <div class="badge-row">${badge}</div>
        <div class="course-icon">${escapeHtml(course.icon)}</div>
        <h3>${escapeHtml(pick(course.titles))}</h3>
        <p class="course-desc">${escapeHtml(pick(course.tagline))}</p>
        ${progress && progress.done > 0 ? `
          <div class="course-progress"><div class="course-progress-fill" style="width:${progress.pct}%"></div></div>
          <div class="course-progress-meta"><span>${progress.done}/${progress.total} ${t("course.completed")}</span><span>${progress.pct}%</span></div>
        ` : ""}
        ${meta}
      </a>`;
  }
  function featureHtml(icon, title, desc) {
    return `<div class="feature">
      <div class="feature-icon" style="font-size:22px;">${icon}</div>
      <h4>${escapeHtml(title)}</h4>
      <p>${escapeHtml(desc)}</p>
    </div>`;
  }
  function iconClock() { return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>'; }
  function iconBook() { return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h12a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4V4z"/><path d="M4 4v12"/></svg>'; }
  function iconLayers() { return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l9 5-9 5-9-5 9-5zm9 10l-9 5-9-5m18 5l-9 5-9-5"/></svg>'; }

  // -------- Courses index --------
  function renderCourses() {
    const courses = CATALOG_HELPERS.list();
    view.innerHTML = `
      <section class="section">
        <div class="container">
          <div class="breadcrumb">
            <a href="#/">${t("nav.home")}</a><span class="sep">/</span><span class="current">${t("nav.courses")}</span>
          </div>
          <div class="section-head" style="text-align:left;margin:0 0 36px;">
            <h2 style="font-size:clamp(2rem,3.6vw,2.8rem);">${t("courses.title")}</h2>
            <p class="section-sub">${t("courses.sub")}</p>
          </div>
          <div class="courses-grid">${courses.map(courseCardHtml).join("")}</div>
        </div>
      </section>`;
  }

  // -------- Course detail --------
  function renderCourse(courseId) {
    const course = CATALOG_HELPERS.get(courseId);
    if (!course) { view.innerHTML = errorHtml(); return; }
    if (course.status !== "live") { renderRoadmap(); return; }

    const flat = CATALOG_HELPERS.flatTopics(course);
    const minutes = flat.reduce((s, t) => s + (t.minutes || 0), 0);
    const progress = courseProgress(course);
    const objectivesHtml = listSection(t("course.objectives"), pick(course.objectives));
    const audienceHtml = listSection(t("course.audience"), pick(course.audience));
    const prereqHtml = listSection(t("course.prereq"), pick(course.prerequisites));

    const ctaText = progress.done > 0 ? t("course.continue") : t("course.start");
    const firstTopic = flat[0];
    const ctaHref = `#/c/${course.slug}/t/${firstTopic.id}`;

    view.innerHTML = `
      <section class="course-hero">
        <div class="container">
          <div class="breadcrumb">
            <a href="#/">${t("nav.home")}</a><span class="sep">/</span>
            <a href="#/courses">${t("nav.courses")}</a><span class="sep">/</span>
            <span class="current">${escapeHtml(pick(course.titles))}</span>
          </div>
          <h1>${escapeHtml(pick(course.titles))}</h1>
          <p class="lede">${escapeHtml(pick(course.summary) || pick(course.tagline))}</p>
          <div class="course-hero-meta">
            <span>${iconClock()} ${minutes} ${t("course.minutes")}</span>
            <span>${iconBook()} ${flat.length} ${t("course.topics")}</span>
            <span>${iconLayers()} ${(course.modules || []).length} ${t("course.modules")}</span>
          </div>
          <div class="course-progress" style="max-width:420px;margin-top:18px;"><div class="course-progress-fill" style="width:${progress.pct}%"></div></div>
          <div class="course-progress-meta" style="max-width:420px;"><span>${progress.done}/${progress.total} ${t("course.completed")}</span><span>${progress.pct}%</span></div>
          <div style="margin-top:22px;display:flex;gap:10px;flex-wrap:wrap;">
            <a href="${ctaHref}" class="btn btn-primary btn-lg">${ctaText}</a>
          </div>
        </div>
      </section>

      <div class="container">
        ${objectivesHtml}${audienceHtml}${prereqHtml}
      </div>

      <div class="container">
        <div class="modules">
          ${(course.modules || []).map((m, mi) => moduleHtml(course, m, mi)).join("")}
        </div>
      </div>
    `;
  }

  function moduleHtml(course, module, idx) {
    const items = module.topics.map((topicMeta, ti) => {
      const isDone = isCompleted(course.id, topicMeta.id);
      const lvlText = t("level." + topicMeta.level);
      const titleText = topicTitle(course, topicMeta);
      return `
        <a class="topic-row ${isDone ? "completed" : ""}" href="#/c/${course.slug}/t/${topicMeta.id}">
          <span class="topic-check"></span>
          <span class="topic-title">${escapeHtml(titleText)}</span>
          <span class="topic-meta">
            <span class="lvl">${escapeHtml(lvlText)}</span>
            <span>${topicMeta.minutes} ${t("course.minutes")}</span>
          </span>
          <span class="topic-arrow">→</span>
        </a>`;
    }).join("");
    return `
      <div class="module">
        <div class="module-head">
          <div class="module-num">${String(idx + 1).padStart(2, "0")}</div>
          <div>
            <h3>${escapeHtml(pick(module.titles))}</h3>
            <p>${escapeHtml(pick(module.descriptions) || "")}</p>
          </div>
        </div>
        <div class="topic-list">${items}</div>
      </div>`;
  }
  function listSection(title, items) {
    if (!items || !items.length) return "";
    return `
      <div class="module" style="margin:24px 0 0;">
        <h3 style="margin:0 0 12px;font-size:1.1rem;">${escapeHtml(title)}</h3>
        <ul style="margin:0;color:var(--fg-muted);">
          ${items.map(i => `<li>${escapeHtml(i)}</li>`).join("")}
        </ul>
      </div>`;
  }
  // Try to derive a topic title from filename if no explicit title
  function topicTitle(course, topicMeta) {
    if (topicMeta.titles) return pick(topicMeta.titles);
    // Fallback: humanize id
    return topicMeta.id.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  }

  // -------- Topic --------
  async function renderTopic(courseId, topicId, anchor) {
    const course = CATALOG_HELPERS.get(courseId);
    if (!course) { view.innerHTML = errorHtml(); return; }
    const info = CATALOG_HELPERS.topicByPath(course, topicId);
    if (!info) { view.innerHTML = errorHtml(); return; }
    const { topic, prev, next, index, total } = info;

    view.innerHTML = `
      <div class="topic-layout">
        <aside class="topic-sidebar">
          <h4>${t("topic.contents")}</h4>
          ${(course.modules || []).map(m => `
            <div style="margin-bottom:12px;">
              <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:var(--fg-subtle);font-weight:700;padding:6px 12px;">${escapeHtml(pick(m.titles))}</div>
              ${m.topics.map((tt, ii) => `
                <a href="#/c/${course.slug}/t/${tt.id}" class="${tt.id === topic.id ? "active" : ""}">
                  <span class="num">${String((m.topics.indexOf(tt) + 1)).padStart(2, "0")}</span>
                  <span>${escapeHtml(topicTitle(course, tt))}</span>
                </a>
              `).join("")}
            </div>
          `).join("")}
        </aside>

        <main class="topic-main">
          <div class="breadcrumb">
            <a href="#/">${t("nav.home")}</a><span class="sep">/</span>
            <a href="#/courses">${t("nav.courses")}</a><span class="sep">/</span>
            <a href="#/c/${course.slug}">${escapeHtml(pick(course.titles))}</a><span class="sep">/</span>
            <span class="current">${escapeHtml(topicTitle(course, topic))}</span>
          </div>

          <div class="topic-meta-strip">
            <span>${iconLayers()} ${escapeHtml(pick((course.modules.find(m => m.id === topic.moduleId) || {}).titles))}</span>
            <span><span class="badge badge-level">${escapeHtml(t("level." + topic.level))}</span></span>
            <span>${iconClock()} ${topic.minutes} ${t("course.minutes")}</span>
            <span>${index + 1} / ${total}</span>
          </div>

          <div id="banner" class="banner hidden"></div>
          <article id="article" class="markdown-body">
            <p style="color:var(--fg-muted);">${t("loading")}</p>
          </article>

          <div class="topic-actions">
            <button id="completeBtn" class="btn btn-primary"></button>
            ${next ? `<a class="btn" href="#/c/${course.slug}/t/${next.id}">${t("topic.next")} →</a>` : ""}
          </div>

          <nav class="pager" id="pager"></nav>
        </main>

        <aside class="toc" id="toc"></aside>
      </div>
    `;

    const article = $("#article");
    const banner = $("#banner");

    const candidates = [
      `./content/${course.id}/${AppState.lang}/${topic.file}`,
      `./content/${course.id}/ru/${topic.file}`
    ];
    const got = await fetchFirst(candidates);
    if (!got) { article.innerHTML = `<p>${t("error")}</p>`; return; }
    const fellBack = AppState.lang !== "ru" && got.url.includes("/ru/");
    if (fellBack) {
      banner.textContent = t("topic.fallback");
      banner.classList.remove("hidden");
    }

    article.innerHTML = marked.parse(got.text);
    addHeadingIds(article);
    highlightCode(article);
    wrapCodeBlocks(article);
    wrapTables(article);

    // Pager
    const pager = $("#pager");
    pager.innerHTML = "";
    if (prev) {
      const a = document.createElement("a");
      a.className = "prev"; a.href = `#/c/${course.slug}/t/${prev.id}`;
      a.innerHTML = `<span class="label">← ${t("topic.prev")}</span><span class="title">${escapeHtml(topicTitle(course, prev))}</span>`;
      pager.appendChild(a);
    } else { const ph = document.createElement("span"); ph.className = "placeholder"; pager.appendChild(ph); }
    if (next) {
      const a = document.createElement("a");
      a.className = "next"; a.href = `#/c/${course.slug}/t/${next.id}`;
      a.innerHTML = `<span class="label">${t("topic.next")} →</span><span class="title">${escapeHtml(topicTitle(course, next))}</span>`;
      pager.appendChild(a);
    } else { const ph = document.createElement("span"); ph.className = "placeholder"; pager.appendChild(ph); }

    // ToC
    renderToc();
    setupScrollSpy();

    // Complete button
    const btn = $("#completeBtn");
    function refreshBtn() {
      const done = isCompleted(course.id, topic.id);
      btn.textContent = done ? "✓ " + t("topic.markIncomplete") : t("topic.markComplete");
      btn.classList.toggle("btn-primary", !done);
    }
    refreshBtn();
    btn.addEventListener("click", () => {
      setCompleted(course.id, topic.id, !isCompleted(course.id, topic.id));
      refreshBtn();
    });

    if (anchor) {
      const el = document.getElementById(anchor);
      if (el) el.scrollIntoView({ behavior: "instant", block: "start" });
    }
  }

  function renderToc() {
    const toc = $("#toc");
    if (!toc) return;
    if (!AppState.headings.length || window.innerWidth < 1200) { toc.innerHTML = ""; return; }
    toc.innerHTML = `<div class="toc-title">${t("topic.toc")}</div>
      <ul class="toc-list">${AppState.headings.map(h =>
        `<li class="lvl-${h.level}"><a href="#" data-target="${h.id}">${escapeHtml(h.text)}</a></li>`
      ).join("")}</ul>`;
    toc.querySelectorAll("a[data-target]").forEach(a => {
      a.addEventListener("click", e => {
        e.preventDefault();
        const el = document.getElementById(a.dataset.target);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }
  let spyObserver = null;
  function setupScrollSpy() {
    if (spyObserver) spyObserver.disconnect();
    if (!AppState.headings.length) return;
    spyObserver = new IntersectionObserver(entries => {
      entries.forEach(en => {
        const id = en.target.id;
        const link = document.querySelector(`.toc-list a[data-target="${id}"]`);
        if (!link) return;
        if (en.isIntersecting) {
          $$(".toc-list a.active").forEach(a => a.classList.remove("active"));
          link.classList.add("active");
        }
      });
    }, { rootMargin: "-80px 0px -70% 0px", threshold: 0 });
    AppState.headings.forEach(h => {
      const el = document.getElementById(h.id);
      if (el) spyObserver.observe(el);
    });
  }

  // -------- Roadmap / About --------
  function renderRoadmap() {
    const items = [
      { tag: "Q2 2026", title: "Python course (live)", desc: "Asyncio, GIL, CPython internals, Django/FastAPI, type hints." },
      { tag: "Q2 2026", title: "System Design (extended)", desc: "Standalone course covering capacity planning, CAP/PACELC, sharding, queues." },
      { tag: "Q3 2026", title: "Go for backend", desc: "Goroutines, channels, runtime scheduler, generics, gRPC." },
      { tag: "Q3 2026", title: "Practice problems & quizzes", desc: "Inline quizzes after each topic, spaced-repetition mode." },
      { tag: "Q4 2026", title: "Kotlin & Android", desc: "Coroutines deep dive, Kotlin Multiplatform, Compose." },
      { tag: "future",  title: "User accounts (optional)", desc: "Sign in to sync progress across devices. Anonymous use stays default." }
    ];
    view.innerHTML = `
      <section class="section">
        <div class="container">
          <div class="breadcrumb"><a href="#/">${t("nav.home")}</a><span class="sep">/</span><span class="current">${t("nav.roadmap")}</span></div>
          <div class="section-head" style="text-align:left;margin:0 0 36px;">
            <h2>${t("roadmap.title")}</h2>
            <p class="section-sub">${t("roadmap.sub")}</p>
          </div>
          <div class="modules">
            ${items.map(it => `
              <div class="module">
                <div class="module-head">
                  <div class="module-num" style="background:var(--surface-2);color:var(--accent);font-size:12px;">${escapeHtml(it.tag)}</div>
                  <div><h3>${escapeHtml(it.title)}</h3><p>${escapeHtml(it.desc)}</p></div>
                </div>
              </div>`).join("")}
          </div>
        </div>
      </section>`;
  }

  function renderAbout() {
    view.innerHTML = `
      <section class="section">
        <div class="container-narrow">
          <div class="breadcrumb"><a href="#/">${t("nav.home")}</a><span class="sep">/</span><span class="current">${t("nav.about")}</span></div>
          <div class="section-head" style="text-align:left;margin:0 0 36px;">
            <h2>${t("about.title")}</h2>
            <p class="section-sub">${t("about.sub")}</p>
          </div>
          <article class="markdown-body">
            <h2>Why</h2>
            <p>Engineers don't lack videos. They lack <strong>structured deep theory</strong> with the «why», production-grade examples, and the questions actually asked at interviews.</p>
            <h2>How</h2>
            <ul>
              <li>Every topic is a self-contained lesson with metadata: level, duration, prerequisites.</li>
              <li>Content is open source — fork, fix, extend, send a PR.</li>
              <li>Progress lives in your browser. No tracking, no signup.</li>
              <li>Three UI languages with technical terms preserved identical across locales.</li>
            </ul>
            <h2>Stack</h2>
            <p>Plain HTML/CSS/JS, no build step. Deploys as a static site to Cloud Run / GitHub Pages / S3 / anywhere.</p>
          </article>
        </div>
      </section>`;
  }

  function errorHtml() {
    return `<section class="section"><div class="container">
      <h2>404</h2><p style="color:var(--fg-muted);">Not found.</p>
      <a href="#/" class="btn btn-primary">← ${t("nav.home")}</a>
    </div></section>`;
  }

  // ---------- Reading progress + to-top ----------
  const progressBar = $("#progressBar");
  const toTop = $("#toTop");
  window.addEventListener("scroll", () => {
    const h = document.documentElement.scrollHeight - window.innerHeight;
    const pct = h > 0 ? (window.scrollY / h) * 100 : 0;
    progressBar.style.width = pct + "%";
    toTop.classList.toggle("hidden", window.scrollY < 400);
  });
  toTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

  // ---------- Command Palette ----------
  const palette = $("#palette");
  const paletteInput = $("#paletteInput");
  const paletteResults = $("#paletteResults");
  let paletteIndex = 0;
  let paletteItems = [];

  function paletteData() {
    const items = [];
    CATALOG_HELPERS.list().forEach(c => {
      items.push({ kind: "course", title: pick(c.titles), num: c.icon, href: c.status === "live" ? `#/c/${c.slug}` : "#/roadmap", meta: c.status === "live" ? "course" : t("comingSoon") });
      if (c.status === "live") {
        CATALOG_HELPERS.flatTopics(c).forEach(t => {
          items.push({ kind: "topic", title: topicTitle(c, t), num: "›", href: `#/c/${c.slug}/t/${t.id}`, meta: pick(c.titles) });
        });
      }
    });
    items.push({ kind: "page", title: t("nav.roadmap"), num: "→", href: "#/roadmap", meta: "page" });
    items.push({ kind: "page", title: t("nav.about"),    num: "→", href: "#/about",    meta: "page" });
    return items;
  }
  function openPalette() {
    palette.classList.remove("hidden");
    paletteInput.value = "";
    renderPaletteResults("");
    setTimeout(() => paletteInput.focus(), 0);
  }
  function closePalette() { palette.classList.add("hidden"); }
  function renderPaletteResults(query) {
    const q = query.trim().toLowerCase();
    paletteItems = paletteData().map(i => ({ ...i, score: q ? scoreMatch(i.title.toLowerCase(), q) : 1 }))
      .filter(i => i.score > 0).sort((a, b) => b.score - a.score).slice(0, 12);
    paletteResults.innerHTML = paletteItems.map((it, i) =>
      `<li class="palette-item ${i === 0 ? "active" : ""}" data-href="${it.href}">
         <span class="num">${escapeHtml(it.num)}</span>
         <span>${escapeHtml(it.title)}</span>
         <span class="meta">${escapeHtml(it.meta)}</span>
       </li>`).join("");
    paletteIndex = 0;
    paletteResults.querySelectorAll(".palette-item").forEach(el => {
      el.addEventListener("click", () => { closePalette(); location.hash = el.dataset.href; });
      el.addEventListener("mouseenter", () => {
        paletteResults.querySelectorAll(".palette-item.active").forEach(a => a.classList.remove("active"));
        el.classList.add("active");
        paletteIndex = Array.from(paletteResults.children).indexOf(el);
      });
    });
  }
  function scoreMatch(text, q) {
    if (text.includes(q)) return 10 + (text.startsWith(q) ? 5 : 0);
    let pos = 0, matched = 0;
    for (const ch of q) { const p = text.indexOf(ch, pos); if (p < 0) return 0; matched++; pos = p + 1; }
    return matched > 0 ? 1 : 0;
  }
  $("#paletteBtn").addEventListener("click", openPalette);
  $(".palette-backdrop").addEventListener("click", closePalette);
  paletteInput.addEventListener("input", e => renderPaletteResults(e.target.value));
  paletteInput.addEventListener("keydown", e => {
    const items = paletteResults.querySelectorAll(".palette-item");
    if (!items.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); paletteIndex = (paletteIndex + 1) % items.length; updatePaletteActive(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); paletteIndex = (paletteIndex - 1 + items.length) % items.length; updatePaletteActive(); }
    else if (e.key === "Enter") { e.preventDefault(); closePalette(); location.hash = items[paletteIndex].dataset.href; }
  });
  function updatePaletteActive() {
    const items = paletteResults.querySelectorAll(".palette-item");
    items.forEach((el, i) => el.classList.toggle("active", i === paletteIndex));
    const active = items[paletteIndex];
    if (active) active.scrollIntoView({ block: "nearest" });
  }
  document.addEventListener("keydown", e => {
    const isMeta = e.metaKey || e.ctrlKey;
    if (isMeta && e.key.toLowerCase() === "k") { e.preventDefault(); openPalette(); return; }
    if (e.key === "Escape" && !palette.classList.contains("hidden")) { closePalette(); return; }
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    if (e.key === "/" && palette.classList.contains("hidden")) { e.preventDefault(); openPalette(); }
  });

  // ---------- Boot ----------
  applyTheme(AppState.theme);
  applyLang(AppState.lang);
  render();
})();
