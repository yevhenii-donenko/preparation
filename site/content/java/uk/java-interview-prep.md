# План підготовки до співбесіди Java Middle+ / Senior

> Самодостатній конспект — для підготовки **достатньо лише цих файлів**, без інтернету.
> Теми розібрані детально в розділі **Теми**.
> Для фінального повторення — **Шпаргалка** та **100 питань**.

---

## 📚 Детальні конспекти по темах

| # | Тема | Опис |
|---|---|---|
| 1 | **Core Java** | мова, ООП/SOLID, exceptions, generics, nested, enum, annotations, reflection, IO/NIO, java.time, records, sealed, pattern matching |
| 2 | **Collections Framework** | HashMap всередині, TreeMap, ConcurrentHashMap, LRU, BlockingQueue |
| 3 | **Functional Java, Stream API, Optional, Collectors** | повний розбір |
| 4 | **Concurrency & Multithreading** 🔥 | JMM, volatile, locks, CAS, atomics, executors, CompletableFuture, virtual threads, structured concurrency |
| 5 | **JVM** | пам’ять, GC (G1/ZGC), classloading, JIT, тулінг (jstack/jmap/JFR), OOM, leak'и |
| 6 | **Spring / Spring Boot** | IoC, lifecycle, AOP, MVC, Security, Boot 3, Data, Events, Async |
| 7 | **БД, JPA / Hibernate, транзакції** | N+1, propagation, isolation, MVCC, locking, Criteria |
| 8 | **Архітектура, патерни GoF, DDD** | Saga/Outbox, Kafka, Resilience4j, hexagonal |
| 9 | **REST** | статус-коди, JWT/OAuth2/OIDC, CORS/CSRF, HTTP/2/3, WebSocket, gRPC |
| 10 | **Тестування** | JUnit 5, Mockito, AssertJ, Spring slices, Testcontainers, WireMock, Pact |
| 11 | **DevOps** | Maven/Gradle, Docker, K8s, CI/CD, GitOps, observability |
| 12 | **Алгоритми та Data Structures** | шаблони + приклади коду + топ-50 задач |
| 13 | **System Design** | URL shortener / rate limiter / news feed / cache, CAP/PACELC |
| 14 | **Soft skills, behavioral** | STAR-історії, self-intro, питання інтерв’юеру |

## ⚡ Фінальне повторення

| Файл | Коли використовувати |
|---|---|
| **Шпаргалка** | За 1-2 години до інтерв’ю — таблиці "питання → відповідь однією фразою" по всіх темах |
| **100 питань** | За день / тиждень — самоперевірка "100 реальних питань з еталонними відповідями" |

**Всього:** ~10 000 рядків / ~400 KB структурованого матеріалу. Кожен топік — повноцінний день вивчення (3-5 годин вдумливого читання + конспектування).

---

## 📅 Рекомендований темп (8 тижнів)

| Тиждень | День 1-2 | День 3-4 | День 5 | Вихідні |
|--------|----------|----------|--------|----------|
| **1** | 01 (мова, ООП) | 01 (nested, enum, annotations, IO, time) | LeetCode (Easy×3) | mini-проєкт Spring Boot setup |
| **2** | 02 (Collections) | 03 (Streams, Optional) | LeetCode (Medium×2) | Прорішати питання з 16 по темах 1-3 |
| **3** | 04 ч.1 (JMM, locks) 🔥 | 04 ч.2 (CompletableFuture, virtual threads) | LeetCode + producer-consumer | Concurrent pet-проєкт |
| **4** | 05 (JVM, GC) | 05 (тулінг, leak'и) | Зняти heap/thread dump зі свого проєкту | Експеримент з різними GC |
| **5** | 06 ч.1 (IoC, lifecycle, AOP) | 06 ч.2 (Boot, Security, Data) + 10 (Testing) | Написати тести для свого проєкту | Testcontainers інтеграція |
| **6** | 07 ч.1 (SQL, ACID, isolation) | 07 ч.2 (JPA, N+1, транзакції) | EXPLAIN ANALYZE для своїх запитів | Migration через Flyway |
| **7** | 08 (патерни, DDD, Kafka) | 09 (REST, JWT, OAuth) | Дизайн API для pet-проєкту | Outbox pattern в проєкті |
| **8** | 12 (алгоритми) — 10 LeetCode | 13 (System Design) — 2 worked example | 11 (DevOps), 14 (Soft skills) | Mock interview + cheatsheet review |

**Кожен день:** 2-3 години теорії + 1 LeetCode задача + конспект "своїми словами".

---

## 🎯 Як користуватися матеріалом

### Цикл вивчення одного топіка

1. **Прочитай файл** від початку до кінця (3-5 годин з конспектуванням).
2. **Зроби свій mini-конспект** — голосове повідомлення собі АБО короткий .md-файл з головними тезами.
3. **Дай відповідь на "Часто питають"** в кінці файла — де "пливеш", повертайся до розділу.
4. **Зроби практику** — кодуй приклад (для Concurrency, JPA, Spring це критично).
5. **Іди в розділ "100 питань"** і дай відповідь без підглядання.

### Pet-проєкт (рекомендується)

Один backend на Spring Boot + Postgres + Kafka + Testcontainers + Docker + GitHub Actions + Prometheus + Grafana покриває **70% програми**. Наприклад:
- "Order service" з REST + JPA + Kafka events.
- Outbox pattern для надійної публікації.
- Sealed events.
- `@Transactional` з різними propagation.
- Тести: unit + slice (`@WebMvcTest`, `@DataJpaTest`) + integration з Testcontainers.
- Liquibase міграції.
- Helm chart для k8s.
- Prometheus-метрики через Micrometer.
- Logbook зі структурними JSON логами + traceId.

### Mock-інтерв’ю

З 7-8 тижня — обов’язково. Pramp.com (безкоштовно), interviewing.io, або з другом-розробником. Запиши себе на відео. Передивись.

---

## ✅ Чек-лист "за день до інтерв’ю"

- [ ] Прогнати **Шпаргалку** — всі таблиці.
- [ ] Прогнати **100 питань** — відповідати вголос.
- [ ] Перечитати "Часто питають" з найгарячіших тем: 04 (Concurrency), 05 (JVM/GC), 06 (Spring), 07 (JPA/transactions), 02 (HashMap).
- [ ] 2 LeetCode Medium на розігрів.
- [ ] Підготувати self-introduction на 90 сек (UK + EN).
- [ ] Підготувати 3-5 питань компанії.
- [ ] Перечитати своє CV — деталі по всіх проєктах.
- [ ] Перевірити техніку: камера, мікрофон, IDE, Coderpad/CodeSignal.
- [ ] Зарядити ноут.
- [ ] Виспатися 8+ годин.

---

## 📚 Бонусні ресурси

**Книги (must-read для Senior):**
- *Effective Java* — Joshua Bloch.
- *Java Concurrency in Practice* — Brian Goetz.
- *Designing Data-Intensive Applications* — Martin Kleppmann.
- *High-Performance Java Persistence* — Vlad Mihalcea.

**Сайти / канали:**
- Baeldung — рецепти Spring/Java.
- Vlad Mihalcea blog — JPA/Hibernate глибоко.
- LeetCode + NeetCode 150.
- github.com/donnemartin/system-design-primer.
- ByteByteGo (System Design на YouTube).

**Mock-інтерв’ю:**
- pramp.com — peer-to-peer безкоштовно.
- interviewing.io — зі справжніми інтерв’юерами.

---

## 🎯 Критерії готовності до Senior

- ✅ Пояснюєш будь-яку тему **без підказок**, з **прикладами зі своєї практики**.
- ✅ Можеш розгорнути System Design на 45-60 хвилин з trade-offs.
- ✅ Розв’язуєш LeetCode Medium за 25-35 хвилин з чистим кодом і тестами.
- ✅ Маєш 6-8 готових STAR-історій з реального досвіду.
- ✅ На кожну відповідь: **trade-off**, не догматизм.
- ✅ Можеш критикувати чужий код і аргументовано пропонувати покращення.
- ✅ Розумієш **чому** щось зроблено саме так у Spring/JPA/JVM, а не просто "як".

---

Удачі! 🚀
