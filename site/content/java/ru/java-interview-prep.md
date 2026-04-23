# План подготовки к собеседованию Java Middle+ / Senior

> Самодостаточный конспект — для подготовки **достаточно только этих файлов**, без интернета.  
> Темы разобраны детально в [`topics/`](./topics/).  
> Для финального повторения — `15-cheatsheet.md` и `16-100-questions.md`.

---

## 📚 Детальные конспекты по темам

| # | Тема | Файл | Объём (стр) |
|---|---|---|---|
| 1 | Core Java (язык, ООП/SOLID, исключения, generics, nested, enum, annotations, reflection, IO/NIO, java.time, records, sealed, pattern matching) | [01-core-java.md](./topics/01-core-java.md) | ~640 |
| 2 | Collections Framework (HashMap внутри, TreeMap, ConcurrentHashMap, LRU, BlockingQueue) | [02-collections.md](./topics/02-collections.md) | ~460 |
| 3 | Functional Java, Stream API, Optional, Collectors | [03-streams-functional.md](./topics/03-streams-functional.md) | ~470 |
| 4 | **Concurrency & Multithreading** 🔥 (JMM, volatile, locks, CAS, atomics, executors, CompletableFuture, virtual threads, structured concurrency) | [04-concurrency.md](./topics/04-concurrency.md) | ~740 |
| 5 | JVM: память, GC (G1/ZGC), classloading, JIT, тулинг (jstack/jmap/JFR), OOM, утечки | [05-jvm.md](./topics/05-jvm.md) | ~565 |
| 6 | Spring / Spring Boot (IoC, lifecycle, AOP, MVC, Security, Boot 3, Data, Events, Async) | [06-spring.md](./topics/06-spring.md) | ~1020 |
| 7 | БД, JPA / Hibernate, транзакции (N+1, propagation, isolation, MVCC, locking, Criteria) | [07-databases-jpa.md](./topics/07-databases-jpa.md) | ~835 |
| 8 | Архитектура, паттерны GoF, DDD, Saga/Outbox, Kafka, Resilience4j, hexagonal | [08-architecture-patterns.md](./topics/08-architecture-patterns.md) | ~840 |
| 9 | REST, статус-коды, JWT/OAuth2/OIDC, CORS/CSRF, HTTP/2/3, WebSocket, gRPC | [09-rest-api.md](./topics/09-rest-api.md) | ~720 |
| 10 | Тестирование (JUnit 5, Mockito, AssertJ, Spring slices, Testcontainers, WireMock, Pact) | [10-testing.md](./topics/10-testing.md) | ~840 |
| 11 | DevOps: Maven/Gradle, Docker, K8s, CI/CD, GitOps, observability (metrics/logs/traces) | [11-devops.md](./topics/11-devops.md) | ~910 |
| 12 | Алгоритмы и Data Structures (шаблоны + примеры кода + топ-50) | [12-algorithms.md](./topics/12-algorithms.md) | ~620 |
| 13 | System Design (шаблон + URL shortener / rate limiter / news feed / cache, CAP/PACELC) | [13-system-design.md](./topics/13-system-design.md) | ~655 |
| 14 | Soft skills, behavioral, STAR-истории, self-intro, вопросы интервьюеру | [14-soft-skills.md](./topics/14-soft-skills.md) | ~390 |

## ⚡ Финальное повторение

| Файл | Когда использовать |
|---|---|
| [15-cheatsheet.md](./15-cheatsheet.md) | За 1-2 часа до интервью — таблицы "вопрос → ответ одной фразой" по всем темам |
| [16-100-questions.md](./16-100-questions.md) | За день / неделю — самопроверка "100 реальных вопросов с эталонными ответами" |

**Всего:** ~10 000 строк / ~400 KB структурированного материала. Каждый топик-файл — полноценный день изучения (3-5 часов вдумчивого чтения + конспектирование).

---

## 📅 Рекомендуемый темп (8 недель)

| Неделя | День 1-2 | День 3-4 | День 5 | Выходные |
|--------|----------|----------|--------|----------|
| **1** | 01 (часть 1: язык, ООП) | 01 (часть 2: nested, enum, annotations, IO, time) | LeetCode (Easy×3) | mini-проект Spring Boot setup |
| **2** | 02 (Collections) | 03 (Streams, Optional) | LeetCode (Medium×2) | Прорешать вопросы из 16 по темам 1-3 |
| **3** | 04 часть 1 (JMM, locks) 🔥 | 04 часть 2 (CompletableFuture, virtual threads) | LeetCode + producer-consumer | Сделать concurrent pet-проект |
| **4** | 05 (JVM, GC) | 05 (тулинг, утечки) | Снять heap/thread dump из своего проекта | Эксперимент с разными GC |
| **5** | 06 часть 1 (IoC, lifecycle, AOP) | 06 часть 2 (Boot, Security, Data) + 10 (Testing) | Написать тесты для своего проекта | Testcontainers интеграция |
| **6** | 07 часть 1 (SQL, ACID, изоляция) | 07 часть 2 (JPA, N+1, транзакции) | EXPLAIN ANALYZE для своих запросов | Migration через Flyway |
| **7** | 08 (паттерны, DDD, Kafka) | 09 (REST, JWT, OAuth) | Дизайн API для pet-проекта | Outbox pattern в проекте |
| **8** | 12 (алгоритмы) — 10 LeetCode | 13 (System Design) — 2 worked example | 11 (DevOps), 14 (Soft skills) | Mock interview + cheatsheet review |

**Каждый день:** 2-3 часа теории + 1 LeetCode задача + конспект "своими словами".

---

## 🎯 Как пользоваться этим материалом

### Цикл изучения одного топика

1. **Прочитай файл** от начала до конца (3-5 часов с конспектированием).
2. **Сделай свой mini-конспект** — голосовое сообщение себе ИЛИ короткий .md-файл с главными тезисами.
3. **Ответь на "Часто спрашивают"** в конце файла — где плывёшь, возвращайся к разделу.
4. **Сделай практику** — кодируй пример (для Concurrency, JPA, Spring это критично).
5. **Иди в `16-100-questions.md`** и ответь на вопросы по этой теме без подсматривания.

### Pet-проект (рекомендуется)

Один backend на Spring Boot + Postgres + Kafka + Testcontainers + Docker + GitHub Actions + Prometheus + Grafana покрывает **70% программы**. Например:
- "Order service" с REST + JPA + Kafka events.
- Outbox pattern для надёжной публикации.
- Sealed events.
- @Transactional с разными propagation.
- Тесты: unit + slice (@WebMvcTest, @DataJpaTest) + integration с Testcontainers.
- Liquibase миграции.
- Helm chart для k8s.
- Прометей-метрики через Micrometer.
- Logbook со структурными JSON логами + traceId.

### Mock-интервью

С 7-8 недели — обязательно. Pramp.com (бесплатно), interviewing.io, или с другом-разработчиком. Запиши себя на видео. Пересмотри.

---

## ✅ Чек-лист "за день до интервью"

- [ ] Прогнать [`15-cheatsheet.md`](./15-cheatsheet.md) — все таблицы.
- [ ] Прогнать [`16-100-questions.md`](./16-100-questions.md) — отвечать вслух.
- [ ] Перечитать "Часто спрашивают" из самых горячих тем: 04 (Concurrency), 05 (JVM/GC), 06 (Spring), 07 (JPA/transactions), 02 (HashMap).
- [ ] 2 LeetCode Medium на разогрев.
- [ ] Подготовить self-introduction на 90 сек (RU + EN).
- [ ] Подготовить 3-5 вопросов компании.
- [ ] Перечитать свой CV — детали по всем проектам.
- [ ] Проверить технику: камера, микрофон, IDE, Coderpad/CodeSignal.
- [ ] Зарядить ноут.
- [ ] Выспаться 8+ часов.

---

## 📚 Бонусные ресурсы (если будет интернет)

**Книги (must-read для Senior):**
- *Effective Java* — Joshua Bloch.
- *Java Concurrency in Practice* — Brian Goetz.
- *Designing Data-Intensive Applications* — Martin Kleppmann.
- *High-Performance Java Persistence* — Vlad Mihalcea.

**Сайты / каналы:**
- Baeldung — рецепты Spring/Java.
- Vlad Mihalcea blog — JPA/Hibernate глубоко.
- LeetCode + NeetCode 150.
- github.com/donnemartin/system-design-primer.
- ByteByteGo (System Design на YouTube).

**Mock-интервью:**
- pramp.com — peer-to-peer бесплатно.
- interviewing.io — с настоящими интервьюерами.

---

## 🎯 Критерии готовности к Senior

- ✅ Объясняешь любую тему из этого плана **без подсказок**, с **примерами из своей практики**.
- ✅ Можешь развернуть System Design на 45-60 минут с trade-offs.
- ✅ Решаешь LeetCode Medium за 25-35 минут с чистым кодом и тестами.
- ✅ Имеешь 6-8 готовых STAR-историй из реального опыта.
- ✅ На каждый ответ: **trade-off**, не догматизм.
- ✅ Можешь критиковать чужой код и аргументированно предлагать улучшения.
- ✅ Понимаешь **почему** что-то сделано так в Spring/JPA/JVM, а не просто "как".

---

## 📊 Что было добавлено в эту итерацию (аудит)

При втором проходе я расширил каждый файл, добавив:

- **01 Core Java**: nested classes, enums глубоко, annotations, reflection, IO/NIO, сериализация, java.time, regex, форматирование, полные примеры equals/hashCode/immutable, records детально, sealed, pattern matching, var.
- **02 Collections**: реальные примеры HashMap (computeIfAbsent/merge), treeification, resize механика, LRU реализация, TreeMap navigation, ConcurrentHashMap атомарные операции, producer/consumer, безопасное удаление, Sequenced Collections, cheatsheet выбора.
- **03 Streams**: групповки, toMap с дубликатами, кастомный Collector, бесконечные стримы, takeWhile/dropWhile, примитивные стримы, lazy evaluation наглядно, параллельные стримы тонкости, Optional паттерны, teeing collector, композиция функций.
- **04 Concurrency**: producer/consumer, deadlock prevention, ABA пример, ThreadLocal ловушки, ExecutorService production-config, CompletableFuture цепочки, ForkJoinPool, Locks с Condition, StampedLock, синхронизаторы, virtual threads, structured concurrency, ScopedValue, safe publication.
- **05 JVM**: TLAB, generational hypothesis, G1 / ZGC внутри, escape analysis + scalar replacement, reference types практика, 6 типов утечек, OOM полная классификация, heap/thread dump анализ, JIT детально, container JVM, JFR, async-profiler.
- **06 Spring**: полный пример Boot приложения, расширенный lifecycle с кодом, lite mode @Configuration, profiles, ConfigurationProperties с валидацией, Spring Events с @TransactionalEventListener, @Async, кастомная валидация, написание своего starter, Spring Security полный пример, Spring Data расширенно (derived queries, Specifications, Auditing, Projections), Actuator + Micrometer.
- **07 JPA / БД**: полная сущность с правильными маппингами, 5 способов решения N+1 с примерами, транзакции с REQUIRES_NEW для аудита, self-invocation, Criteria API, кэш L2, оконные функции, CTE, EXPLAIN ANALYZE гайд, composite index порядок, optimistic/pessimistic примеры, MVCC, HikariCP параметры, миграции (Flyway/Liquibase).
- **08 Архитектура**: 9 GoF паттернов с реальным Java-кодом, hexagonal с конкретной структурой папок, DDD концепции с примерами, Saga orchestration/choreography, Outbox реализация, Kafka producer/consumer полная конфигурация, Resilience4j, идемпотентность.
- **09 REST**: полный пример REST API дизайна, ProblemDetail, pagination (offset vs cursor), HTTP кэширование (ETag/If-Match/If-None-Match), content negotiation, OpenAPI пример, JWT детально + JWKS, OAuth flows step-by-step, CORS preflight, CSRF когда нужен, HTTP/2/3, WebSocket/SSE, gRPC, GraphQL.
- **10 Тестирование**: полные примеры JUnit 5 (lifecycle, nested, parameterized), AssertJ, Mockito углублённо (mock vs spy, ArgumentCaptor, mockStatic), Spring slices с примерами кода, Testcontainers паттерны (singleton, @ServiceConnection), WireMock scenarios, Awaitility, Pact, JaCoCo, Pitest.
- **11 DevOps**: полный pom.xml пример, Maven scopes таблица, lifecycle, BOM, Gradle с configurations, production Dockerfile с multi-stage и layered jar, distroless, Buildpacks/Jib, полный Kubernetes Deployment+Service+Ingress+HPA, probes, graceful shutdown, Helm basics, GitHub Actions pipeline, observability (Counter/Gauge/Histogram, MDC, OpenTelemetry), 12-factor.
- **12 Алгоритмы**: Big-O таблица "n vs время", шаблоны кода для всех паттернов (two pointers, sliding window, binary search, BFS/DFS, backtracking, DP, heap, Union-Find, topological sort, Floyd cycle), реализации LRU/Trie/MinStack, Java-специфика и подводные камни, 10 шагов на интервью, top-50 задач.
- **13 System Design**: полный worked example URL shortener (10 шагов), Rate Limiter с Lua-скриптом, News Feed с push/pull/hybrid, Distributed cache, Distributed ID (UUIDv7/Snowflake/KGS), consistent hashing, quorum, CAP/PACELC примеры, idempotency, backpressure, SLO/SLI/SLA, error budget.
- **14 Soft skills**: 6 готовых STAR-шаблонов с конкретным текстом (bug, conflict, failure, mentoring, legacy, decision), self-intro на RU и EN, расширенный список вопросов интервьюеру (4 категории), что НЕ делать, что делать после интервью, переговоры по offer, английский на интервью с фразами, психология.

---

Удачи! 🚀

> Если что-то осталось непонятным или хочешь углубить какую-то тему ещё — просто скажи.

