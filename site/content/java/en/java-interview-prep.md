# Java Middle+ / Senior Interview Prep Plan

> A self-contained study guide — these files are **enough** to prepare without internet.
> Each topic is covered in detail under **Topics**.
> For the final review use **Cheatsheet** and **100 Questions**.

---

## 📚 Detailed topic notes

| # | Topic | Description |
|---|---|---|
| 1 | **Core Java** | language, OOP/SOLID, exceptions, generics, nested, enum, annotations, reflection, IO/NIO, `java.time`, records, sealed, pattern matching |
| 2 | **Collections Framework** | `HashMap` internals, `TreeMap`, `ConcurrentHashMap`, LRU, `BlockingQueue` |
| 3 | **Functional Java, Stream API, Optional, Collectors** | full breakdown |
| 4 | **Concurrency & Multithreading** 🔥 | JMM, `volatile`, locks, CAS, atomics, executors, `CompletableFuture`, virtual threads, structured concurrency |
| 5 | **JVM** | memory, GC (G1/ZGC), classloading, JIT, tooling (`jstack`/`jmap`/JFR), OOM, leaks |
| 6 | **Spring / Spring Boot** | IoC, lifecycle, AOP, MVC, Security, Boot 3, Data, Events, Async |
| 7 | **DBs, JPA / Hibernate, transactions** | N+1, propagation, isolation, MVCC, locking, Criteria |
| 8 | **Architecture, GoF patterns, DDD** | Saga/Outbox, Kafka, Resilience4j, hexagonal |
| 9 | **REST** | status codes, JWT/OAuth2/OIDC, CORS/CSRF, HTTP/2/3, WebSocket, gRPC |
| 10 | **Testing** | JUnit 5, Mockito, AssertJ, Spring slices, Testcontainers, WireMock, Pact |
| 11 | **DevOps** | Maven/Gradle, Docker, K8s, CI/CD, GitOps, observability |
| 12 | **Algorithms & Data Structures** | patterns + code examples + top-50 problems |
| 13 | **System Design** | URL shortener / rate limiter / news feed / cache, CAP/PACELC |
| 14 | **Soft skills, behavioral** | STAR stories, self-intro, questions to interviewer |

## ⚡ Final review

| File | When to use |
|---|---|
| **Cheatsheet** | 1–2 hours before the interview — "question → one-line answer" tables for every topic |
| **100 Questions** | A day or week before — self-check "100 real questions with reference answers" |

**Total:** ~10 000 lines / ~400 KB of structured material. Each topic file is a full study day (3–5 hours of focused reading + note taking).

---

## 📅 Recommended pace (8 weeks)

| Week | Day 1–2 | Day 3–4 | Day 5 | Weekend |
|--------|----------|----------|--------|----------|
| **1** | 01 (language, OOP) | 01 (nested, enum, annotations, IO, time) | LeetCode (Easy×3) | mini Spring Boot project setup |
| **2** | 02 (Collections) | 03 (Streams, Optional) | LeetCode (Medium×2) | Answer questions from 100 on topics 1–3 |
| **3** | 04 part 1 (JMM, locks) 🔥 | 04 part 2 (`CompletableFuture`, virtual threads) | LeetCode + producer/consumer | concurrent pet project |
| **4** | 05 (JVM, GC) | 05 (tooling, leaks) | Capture heap/thread dump from your project | Try different GCs |
| **5** | 06 part 1 (IoC, lifecycle, AOP) | 06 part 2 (Boot, Security, Data) + 10 (Testing) | Write tests for your project | Testcontainers integration |
| **6** | 07 part 1 (SQL, ACID, isolation) | 07 part 2 (JPA, N+1, transactions) | `EXPLAIN ANALYZE` your queries | Flyway migration |
| **7** | 08 (patterns, DDD, Kafka) | 09 (REST, JWT, OAuth) | API design for the pet project | Outbox pattern in the project |
| **8** | 12 (algorithms) — 10 LeetCode | 13 (System Design) — 2 worked examples | 11 (DevOps), 14 (Soft skills) | Mock interview + cheatsheet review |

**Daily:** 2–3 hours of theory + 1 LeetCode problem + a "your own words" summary.

---

## 🎯 How to use the material

### Single-topic loop

1. **Read the file** end-to-end (3–5 hours with note taking).
2. **Make your own mini summary** — a voice memo or a short `.md` with the key points.
3. **Answer the "FAQ" section** at the end — where you struggle, return to the section.
4. **Practice** — code an example (mandatory for Concurrency, JPA, Spring).
5. **Go to "100 Questions"** and answer the topic without peeking.

### Pet project (recommended)

A single Spring Boot + Postgres + Kafka + Testcontainers + Docker + GitHub Actions + Prometheus + Grafana backend covers **70% of the curriculum**. Example:
- "Order service" with REST + JPA + Kafka events.
- Outbox pattern for reliable publishing.
- Sealed events.
- `@Transactional` with different propagations.
- Tests: unit + slice (`@WebMvcTest`, `@DataJpaTest`) + integration with Testcontainers.
- Liquibase migrations.
- Helm chart for k8s.
- Prometheus metrics via Micrometer.
- Logback with structured JSON logs + `traceId`.

### Mock interviews

From week 7–8 — mandatory. Pramp.com (free), interviewing.io, or with a developer friend. Record yourself on video. Watch it back.

---

## ✅ "Day-before" checklist

- [ ] Run through the **Cheatsheet** — every table.
- [ ] Run through **100 Questions** — answer out loud.
- [ ] Reread the "FAQ" of the hottest topics: 04 (Concurrency), 05 (JVM/GC), 06 (Spring), 07 (JPA/transactions), 02 (`HashMap`).
- [ ] 2 LeetCode Mediums for warm-up.
- [ ] Prepare a 90-second self-introduction (EN).
- [ ] Prepare 3–5 questions for the company.
- [ ] Reread your CV — details on every project.
- [ ] Test gear: camera, microphone, IDE, Coderpad/CodeSignal.
- [ ] Charge the laptop.
- [ ] Sleep 8+ hours.

---

## 📚 Bonus resources

**Must-read books for Senior:**
- *Effective Java* — Joshua Bloch.
- *Java Concurrency in Practice* — Brian Goetz.
- *Designing Data-Intensive Applications* — Martin Kleppmann.
- *High-Performance Java Persistence* — Vlad Mihalcea.

**Sites / channels:**
- Baeldung — Spring/Java recipes.
- Vlad Mihalcea blog — deep JPA/Hibernate.
- LeetCode + NeetCode 150.
- github.com/donnemartin/system-design-primer.
- ByteByteGo (System Design on YouTube).

**Mock interviews:**
- pramp.com — peer-to-peer, free.
- interviewing.io — with real interviewers.

---

## 🎯 Senior readiness criteria

- ✅ You explain any topic from this plan **without prompts**, with **examples from your own practice**.
- ✅ You can run a System Design discussion for 45–60 minutes with trade-offs.
- ✅ You solve LeetCode Mediums in 25–35 minutes with clean code and tests.
- ✅ You have 6–8 ready STAR stories from real experience.
- ✅ Every answer ends with **trade-offs**, not dogma.
- ✅ You can critique someone else's code and propose improvements with reasoning.
- ✅ You understand **why** things are done a certain way in Spring/JPA/JVM, not just "how".

---

Good luck! 🚀
