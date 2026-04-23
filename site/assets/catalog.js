// =====================================================================
// Codecademia — course catalog
// Multi-course architecture. Topics are still backed by markdown content
// stored in /site/content/<courseId>/<lang>/... but the user-facing model
// is courses → modules → topics with rich metadata.
// =====================================================================

window.CATALOG = {
  /* -----------------------------------------------------------------
   * JAVA — full course
   * ----------------------------------------------------------------- */
  java: {
    id: "java",
    slug: "java",
    icon: "Ja",
    accent: "#f89820",
    status: "live",
    titles: {
      ru: "Java для Senior-собеседования",
      uk: "Java для Senior-співбесіди",
      en: "Java for Senior interviews"
    },
    tagline: {
      ru: "От синтаксиса до JMM, Loom и Kafka. 14 модулей теории + 2 deep dive + 100 вопросов.",
      uk: "Від синтаксису до JMM, Loom і Kafka. 14 модулів теорії + 2 deep dive + 100 питань.",
      en: "From syntax to JMM, Loom and Kafka. 14 modules + 2 deep dives + 100 questions."
    },
    summary: {
      ru: "Полный курс по экосистеме Java для подготовки к Middle/Senior собеседованию. Глубина уровня Senior, разбор внутренностей JVM, реальные production-конфиги, классические подводные камни.",
      uk: "Повний курс з екосистеми Java для підготовки до Middle/Senior співбесіди. Глибина рівня Senior, розбір нутрощів JVM, реальні production-конфіги, класичні підводні камені.",
      en: "A complete course on the Java ecosystem for Middle/Senior interview prep. Senior-level depth, JVM internals, real production configs, classic pitfalls."
    },
    audience: {
      ru: ["Middle разработчики, готовящиеся к Senior собеседованию", "Senior, обновляющие знания по Loom / Kafka / JMM", "Тимлиды и архитекторы для review базы знаний"],
      uk: ["Middle розробники, що готуються до Senior співбесіди", "Senior, що оновлюють знання з Loom / Kafka / JMM", "Тимліди та архітектори для review бази знань"],
      en: ["Middle engineers preparing for Senior interview", "Senior engineers refreshing knowledge of Loom / Kafka / JMM", "Tech leads and architects reviewing the foundations"]
    },
    prerequisites: {
      ru: ["Опыт коммерческой разработки на Java от 2 лет", "Базовое понимание Maven/Gradle и Spring"],
      uk: ["Досвід комерційної розробки на Java від 2 років", "Базове розуміння Maven/Gradle та Spring"],
      en: ["2+ years of commercial Java experience", "Basic Maven/Gradle and Spring understanding"]
    },
    objectives: {
      ru: ["Уверенно отвечать на вопросы по Core Java, Collections, JVM", "Объяснять концепты Concurrency / JMM / Loom на доске", "Знать внутренности Spring, Hibernate, Kafka", "Решать System Design задачи на интервью"],
      uk: ["Впевнено відповідати на питання з Core Java, Collections, JVM", "Пояснювати концепти Concurrency / JMM / Loom на дошці", "Знати нутрощі Spring, Hibernate, Kafka", "Розвʼязувати System Design задачі на співбесіді"],
      en: ["Confidently answer Core Java, Collections, JVM questions", "Explain Concurrency / JMM / Loom on a whiteboard", "Know Spring, Hibernate, Kafka internals", "Tackle System Design at interviews"]
    },

    modules: [
      {
        id: "language",
        titles: { ru: "Язык", uk: "Мова", en: "The language" },
        descriptions: {
          ru: "Синтаксис, типы, ООП, generics, исключения, новые фичи Java 8-21.",
          uk: "Синтаксис, типи, ООП, generics, винятки, нові фічі Java 8-21.",
          en: "Syntax, types, OOP, generics, exceptions, Java 8-21 features."
        },
        topics: [
          { id: "core-java",          file: "topics/01-core-java.md",          level: "intermediate", minutes: 45 },
          { id: "collections",        file: "topics/02-collections.md",        level: "intermediate", minutes: 35 },
          { id: "streams-functional", file: "topics/03-streams-functional.md", level: "intermediate", minutes: 30 }
        ]
      },
      {
        id: "platform",
        titles: { ru: "Платформа", uk: "Платформа", en: "The platform" },
        descriptions: {
          ru: "Многопоточность, JMM, JVM, GC, classloading, перформанс.",
          uk: "Багатопотоковість, JMM, JVM, GC, classloading, перформанс.",
          en: "Concurrency, JMM, JVM, GC, classloading, performance."
        },
        topics: [
          { id: "concurrency",      file: "topics/04-concurrency.md",      level: "advanced", minutes: 50 },
          { id: "jvm",              file: "topics/05-jvm.md",              level: "advanced", minutes: 45 }
        ]
      },
      {
        id: "platform-extras",
        titles: { ru: "Платформа: глубже", uk: "Платформа: глибше", en: "Platform: deeper" },
        descriptions: {
          ru: "JPMS, I/O/NIO, сеть, логирование, regex — то, что спрашивают на Senior.",
          uk: "JPMS, I/O/NIO, мережа, логування, regex — що питають на Senior.",
          en: "JPMS, I/O/NIO, networking, logging, regex — common Senior questions."
        },
        topics: [
          { id: "modules-jpms", file: "topics/17-modules-jpms.md", level: "advanced", minutes: 35,
            titles: { ru: "Модули (JPMS)",           uk: "Модулі (JPMS)",            en: "Java Modules (JPMS)" } },
          { id: "io-nio",       file: "topics/18-io-nio.md",       level: "advanced", minutes: 35,
            titles: { ru: "I/O и NIO",                uk: "I/O та NIO",                en: "I/O and NIO" } },
          { id: "networking",   file: "topics/19-networking.md",   level: "advanced", minutes: 35,
            titles: { ru: "Networking и HttpClient", uk: "Networking та HttpClient", en: "Networking and HttpClient" } },
          { id: "logging",      file: "topics/20-logging.md",      level: "intermediate", minutes: 30,
            titles: { ru: "Логирование",              uk: "Логування",                 en: "Logging" } },
          { id: "regex",        file: "topics/21-regex.md",        level: "intermediate", minutes: 25,
            titles: { ru: "Регулярные выражения",     uk: "Регулярні вирази",          en: "Regular expressions" } }
        ]
      },
      {
        id: "frameworks",
        titles: { ru: "Фреймворки и данные", uk: "Фреймворки та дані", en: "Frameworks & data" },
        descriptions: {
          ru: "Spring, Spring Boot, JPA / Hibernate, транзакции, базы.",
          uk: "Spring, Spring Boot, JPA / Hibernate, транзакції, бази.",
          en: "Spring, Spring Boot, JPA / Hibernate, transactions, databases."
        },
        topics: [
          { id: "spring",         file: "topics/06-spring.md",         level: "advanced", minutes: 60 },
          { id: "databases-jpa",  file: "topics/07-databases-jpa.md",  level: "advanced", minutes: 55 }
        ]
      },
      {
        id: "architecture",
        titles: { ru: "Архитектура и API", uk: "Архітектура та API", en: "Architecture & API" },
        descriptions: {
          ru: "Паттерны, микросервисы, Kafka, REST, gRPC.",
          uk: "Патерни, мікросервіси, Kafka, REST, gRPC.",
          en: "Patterns, microservices, Kafka, REST, gRPC."
        },
        topics: [
          { id: "architecture-patterns", file: "topics/08-architecture-patterns.md", level: "senior",   minutes: 55 },
          { id: "rest-api",              file: "topics/09-rest-api.md",              level: "advanced", minutes: 40 }
        ]
      },
      {
        id: "delivery",
        titles: { ru: "Качество и delivery", uk: "Якість і delivery", en: "Quality & delivery" },
        descriptions: {
          ru: "Тестирование, DevOps, Docker, Kubernetes, CI/CD.",
          uk: "Тестування, DevOps, Docker, Kubernetes, CI/CD.",
          en: "Testing, DevOps, Docker, Kubernetes, CI/CD."
        },
        topics: [
          { id: "testing", file: "topics/10-testing.md", level: "advanced", minutes: 45 },
          { id: "devops",  file: "topics/11-devops.md",  level: "advanced", minutes: 50 }
        ]
      },
      {
        id: "interview",
        titles: { ru: "Интервью-секции", uk: "Секції співбесіди", en: "Interview sections" },
        descriptions: {
          ru: "Алгоритмы, System Design, soft skills.",
          uk: "Алгоритми, System Design, soft skills.",
          en: "Algorithms, System Design, soft skills."
        },
        topics: [
          { id: "algorithms",   file: "topics/12-algorithms.md",   level: "advanced", minutes: 40 },
          { id: "system-design", file: "topics/13-system-design.md", level: "senior",   minutes: 60 },
          { id: "soft-skills",  file: "topics/14-soft-skills.md",  level: "intermediate", minutes: 25 }
        ]
      },
      {
        id: "deep",
        titles: { ru: "Deep dive", uk: "Deep dive", en: "Deep dive" },
        descriptions: {
          ru: "Углублённое погружение в Concurrency и Kafka — для Senior+.",
          uk: "Поглиблене занурення у Concurrency та Kafka — для Senior+.",
          en: "Senior+ deep dives into Concurrency and Kafka."
        },
        topics: [
          { id: "concurrency-deep", file: "topics/15-concurrency-deep.md", level: "deep", minutes: 60 },
          { id: "kafka-deep",       file: "topics/16-kafka-deep.md",       level: "deep", minutes: 60 }
        ]
      },
      {
        id: "review",
        titles: { ru: "Финальное повторение", uk: "Фінальне повторення", en: "Final review" },
        descriptions: {
          ru: "План подготовки, шпаргалка, 100 вопросов.",
          uk: "План підготовки, шпаргалка, 100 питань.",
          en: "Study plan, cheatsheet, 100 questions."
        },
        topics: [
          { id: "study-plan", file: "java-interview-prep.md", level: "intermediate", minutes: 15 },
          { id: "cheatsheet", file: "15-cheatsheet.md",       level: "intermediate", minutes: 20 },
          { id: "questions",  file: "16-100-questions.md",    level: "intermediate", minutes: 90 }
        ]
      }
    ]
  },

  /* -----------------------------------------------------------------
   * Coming soon courses (placeholders)
   * ----------------------------------------------------------------- */
  python: {
    id: "python",
    slug: "python",
    icon: "Py",
    status: "coming-soon",
    titles: { ru: "Python для собеседования", uk: "Python для співбесіди", en: "Python for interviews" },
    tagline: {
      ru: "Скоро. CPython внутренности, asyncio, GIL, type hints, Django/FastAPI.",
      uk: "Скоро. CPython нутрощі, asyncio, GIL, type hints, Django/FastAPI.",
      en: "Soon. CPython internals, asyncio, GIL, type hints, Django/FastAPI."
    },
    modules: []
  },
  golang: {
    id: "golang",
    slug: "golang",
    icon: "Go",
    status: "coming-soon",
    titles: { ru: "Go для backend", uk: "Go для backend", en: "Go for backend" },
    tagline: {
      ru: "Скоро. Goroutines, каналы, runtime, generics, gRPC.",
      uk: "Скоро. Goroutines, канали, runtime, generics, gRPC.",
      en: "Soon. Goroutines, channels, runtime, generics, gRPC."
    },
    modules: []
  },
  systemDesign: {
    id: "system-design",
    slug: "system-design",
    icon: "SD",
    status: "coming-soon",
    titles: { ru: "System Design", uk: "System Design", en: "System Design" },
    tagline: {
      ru: "Скоро. Расширенный курс по System Design отдельно от Java.",
      uk: "Скоро. Розширений курс із System Design окремо від Java.",
      en: "Soon. Extended System Design course, decoupled from Java."
    },
    modules: []
  },
  kotlin: {
    id: "kotlin",
    slug: "kotlin",
    icon: "Kt",
    status: "coming-soon",
    titles: { ru: "Kotlin для JVM-разработчиков", uk: "Kotlin для JVM-розробників", en: "Kotlin for JVM developers" },
    tagline: {
      ru: "Скоро. Coroutines, sealed/data, Kotlin для Android и backend.",
      uk: "Скоро. Coroutines, sealed/data, Kotlin для Android і backend.",
      en: "Soon. Coroutines, sealed/data, Kotlin for Android and backend."
    },
    modules: []
  }
};

// Flatten helpers ------------------------------------------------------
window.CATALOG_HELPERS = {
  list() {
    return Object.values(window.CATALOG);
  },
  get(courseId) {
    return Object.values(window.CATALOG).find(c => c.id === courseId || c.slug === courseId);
  },
  flatTopics(course) {
    const out = [];
    (course.modules || []).forEach((m, mi) => {
      m.topics.forEach((t, ti) => {
        out.push({ ...t, moduleId: m.id, moduleIndex: mi, topicIndex: ti, course });
      });
    });
    return out;
  },
  topicByPath(course, topicId) {
    const flat = this.flatTopics(course);
    const i = flat.findIndex(t => t.id === topicId);
    if (i < 0) return null;
    return { topic: flat[i], prev: flat[i - 1] || null, next: flat[i + 1] || null, index: i, total: flat.length };
  }
};
