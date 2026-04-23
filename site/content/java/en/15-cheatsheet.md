# 🚀 Cheatsheet — quick review before the interview

> Use for the final pass 1–2 hours before the interview.
> If something is unclear — go to the detailed topic file.

---

## Core Java

| Concept | One-line answer |
|---|---|
| JDK / JRE / JVM | JDK = JRE + tools; JRE = JVM + libs; JVM = the virtual machine |
| Compile path | `.java` → `javac` → `.class` (bytecode) → JVM (interpret + JIT) |
| Java 8 main features | lambdas, Stream API, `Optional`, `java.time`, default methods |
| Java 17/21 | records, sealed, pattern matching, virtual threads, ZGC |
| `==` vs `equals` | `==` — reference / primitive value; `equals` — logical equality |
| Integer cache | `[-128;127]` — same objects, `200 == 200` → false |
| Why `String` is immutable | thread-safety, hashCode caching, string pool, security |
| `StringBuilder` vs `StringBuffer` | Builder — not synchronized (faster); Buffer — synchronized (legacy) |
| `final` | variable not reassignable, method not overridable, class not extendable |
| Checked vs unchecked | Checked — must catch/throws; unchecked — runtime errors |
| try-with-resources | auto-close for `AutoCloseable`, in reverse order |
| Generics | type erasure — types are erased at runtime (`List<String>` = `List`) |
| PECS | Producer Extends, Consumer Super |
| Effectively final | variable not changed → lambda may capture it |
| Inner vs static nested | inner holds reference to outer, can leak memory |
| Lambda vs anonymous | lambda — `invokedynamic`, no `.class`; `this` — outer |
| Why enum singleton | thread-safe, protected from reflection and serialization |
| Record | immutable data carrier, `equals/hashCode/toString` for free |
| Sealed | closed hierarchy → exhaustive `switch` without `default` |

## Collections

| Concept | Answer |
|---|---|
| `ArrayList` growth | ×1.5; default cap = 10 |
| `HashMap` defaults | 16 buckets, load factor 0.75 |
| `HashMap` treeify | bucket ≥ 8 + table ≥ 64 → red-black tree |
| `HashMap` resize | doubles; entries stay at index or move to index + oldCap |
| Hash function | `h ^ (h >>> 16)` — mixes high bits |
| `HashMap` vs `Hashtable` | `HashMap` not synchronized, allows null |
| `ConcurrentHashMap` | bucket-level locking + CAS, no nulls |
| Fail-fast | modification during iter → CME (via `modCount`) |
| `LinkedHashMap` accessOrder | for LRU cache (+ `removeEldestEntry`) |
| `TreeMap` | red-black tree, O(log n), navigation API |
| `WeakHashMap` | keys are `WeakReference`, GC may collect them |
| `EnumMap` / `EnumSet` | bit vector / array by ordinal — super fast |
| `ArrayDeque` | best choice for stack/queue (faster than `Stack`/`LinkedList`) |
| `BlockingQueue` methods | `add`/`offer`/`put` / `remove`/`poll`/`take` |
| `CopyOnWriteArrayList` | for read-heavy with rare writes |

## Streams / Optional

| Concept | Answer |
|---|---|
| Intermediate vs terminal | intermediate — lazy, terminal — fires the pipeline |
| `map` vs `flatMap` | `flatMap` "unwraps" a nested `Stream` |
| Stream is one-shot | yes, reusing → `IllegalStateException` |
| Parallel stream pool | `ForkJoinPool.commonPool` |
| When parallel is bad | I/O blocking, small collections, `LinkedList` source |
| `reduce` vs `collect` | `reduce` — immutable fold; `collect` — mutable accumulator |
| `Optional.of` vs `ofNullable` | `of` throws on null, `ofNullable` allows it |
| `orElse` vs `orElseGet` | `orElse` — default is always evaluated! `orElseGet` — only when empty |
| `Optional` as a field | ❌ not `Serializable`, anti-pattern |
| `Collectors.toMap` duplicate | `IllegalStateException`, need a merge function |

## Concurrency

| Concept | Answer |
|---|---|
| `volatile` guarantees | visibility + ordering (NOT atomicity) |
| `synchronized` on what | method — on `this`; static — on `Class`; block — on the object |
| `wait`/`notify` where | only inside `synchronized` on the same monitor |
| `wait` in a `while` | spurious wakeups + condition may have changed |
| happens-before | unlock→lock, volatile write→read, start→everything in thread, everything in thread→join |
| CAS | `compareAndSet(expected, new)` — atomic CPU instruction |
| ABA problem | value goes A→B→A; fix — `AtomicStampedReference` (versioning) |
| `LongAdder` vs `AtomicLong` | `LongAdder` — striped per-thread cells, `sum()` is approximate |
| `ReentrantLock` vs `synchronized` | `tryLock` + timeout + interruptible + fair + `Condition` |
| `ReadWriteLock` | many readers OR one writer; downgrade write→read OK, reverse is deadlock |
| `StampedLock` | optimistic read; not reentrant! |
| `CountDownLatch` vs `CyclicBarrier` | latch — one-shot, barrier — resettable |
| `Semaphore` | N permits (rate limiter, conn pool) |
| `ConcurrentHashMap` atomic ops | `compute`, `merge`, `putIfAbsent` |
| `ThreadLocal` in a pool | always `remove()` in `finally` — otherwise a leak |
| `newCachedThreadPool` is dangerous | unbounded threads → OOM |
| `newFixedThreadPool` is dangerous | unbounded queue → OOM |
| Backpressure for `ThreadPoolExecutor` | `ArrayBlockingQueue` + `CallerRunsPolicy` |
| `Future` vs `CompletableFuture` | CF — composition, async chains, exception handling |
| `thenApply` vs `thenApplyAsync` | apply — in the previous stage's thread; async — in the given pool |
| Virtual threads | Java 21, for I/O-bound; don't pool; `synchronized` pins |
| Structured concurrency | `StructuredTaskScope`; cancel one — all are cancelled |
| Deadlock prevention | ordered locking + `tryLock(timeout)` |
| Safe publication | `volatile`, `final`, `synchronized`, static initializer, concurrent collection |

## JVM / GC

| Concept | Answer |
|---|---|
| Heap layout | Young (Eden + S0/S1) + Old + Metaspace (off-heap) |
| Where things live | primitives — stack; objects — heap; static — `Class` object |
| TLAB | thread-local buffer in Eden; bump-pointer without sync |
| Generational hypothesis | most objects die young |
| G1 | regions ~2048; pause-time goal; mixed GC |
| ZGC | concurrent, sub-ms pauses, up to 16 TB heap |
| STW | all application threads paused |
| Soft / Weak / Phantom | Soft — under memory pressure; Weak — next GC; Phantom — after finalize, for cleanup |
| Top-5 memory leaks | static collections, `ThreadLocal` in pool, unclosed resources, listeners, inner classes |
| OOM types | heap space, GC overhead, Metaspace, direct buffer, native thread |
| Metaspace vs PermGen | Metaspace is in native memory (Java 8+), no default limit |
| Heap dump | `jcmd <pid> GC.heap_dump file` or `-XX:+HeapDumpOnOutOfMemoryError` |
| Thread dump | `jstack <pid>` or `jcmd Thread.print` |
| Classloader hierarchy | Bootstrap → Platform → App → Custom; parent delegation |
| JIT levels | C1 (fast) and C2 (aggressive); tiered |
| Escape analysis | if an object doesn't escape — JIT lays it out on the stack |
| JFR | built-in profiler, overhead < 1% |
| Container JVM | `-XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError` |

## Spring / Spring Boot

| Concept | Answer |
|---|---|
| IoC / DI | container injects dependencies instead of `new` |
| DI flavors | constructor (✅ best), setter, field (❌) |
| `BeanFactory` vs `ApplicationContext` | `ApplicationContext` = `BeanFactory` + events + i18n + AOP + eager singletons |
| Bean lifecycle | constructor → DI → `Aware` → BPP.before → `@PostConstruct` → `InitializingBean` → init → BPP.after (AOP proxy) → … → `@PreDestroy` |
| Scopes | singleton (default), prototype, request, session, application |
| Prototype inside singleton | `ObjectProvider`, `@Lookup`, `proxyMode=TARGET_CLASS` |
| `@Configuration` vs `@Component` | `@Configuration` is CGLIB-proxied → `@Bean` methods are singletons |
| `@Configuration` lite mode | `proxyBeanMethods=false` → faster, but no singleton semantics |
| Self-invocation problem | calling via `this` bypasses the proxy → AOP/`@Transactional` doesn't fire |
| JDK proxy vs CGLIB | JDK — for interfaces; CGLIB — subclasses the class |
| Auto-configuration | `@Conditional*` + `AutoConfiguration.imports` |
| `@SpringBootApplication` | `@Configuration` + `@EnableAutoConfiguration` + `@ComponentScan` |
| Property source priority | CLI > sys props > env > files > defaults |
| `@ConfigurationProperties` | type-safe binding with validation |
| `@Profile` activation | `--spring.profiles.active=prod` or env `SPRING_PROFILES_ACTIVE` |
| Filter vs Interceptor | Filter — Servlet, all requests; Interceptor — Spring, controllers only |
| `@ControllerAdvice` | global exception handling |
| `ProblemDetail` (Spring 6) | RFC 7807 error format |
| `@TransactionalEventListener` | fires after commit (`AFTER_COMMIT`) |
| `@Async` requires | `@EnableAsync` + works through proxy (no self-invocation) |

## JPA / Hibernate / DB

| Concept | Answer |
|---|---|
| ACID | Atomicity, Consistency, Isolation, Durability |
| Isolation levels | RU, RC (default in PG), RR (default in MySQL), Serializable |
| Anomalies | dirty read, non-repeatable, phantom, lost update, write skew |
| MVCC | each tx sees a snapshot; readers don't block writers |
| Optimistic vs pessimistic | optimistic — `@Version`; pessimistic — `SELECT FOR UPDATE` |
| Persistence context | `EntityManager` + L1 cache; one entity → one Java object |
| Entity states | transient, managed, detached, removed |
| `persist` vs `merge` | `persist` — for new (transient); `merge` — for detached |
| Dirty checking | Hibernate compares snapshot with current and emits `UPDATE` |
| LAZY vs EAGER | always LAZY, even for `@ManyToOne` |
| `LazyInitializationException` | accessing LAZY outside of a transaction |
| N+1 fixes | `JOIN FETCH`, `@EntityGraph`, `@BatchSize`, `FetchMode.SUBSELECT`, DTO projection |
| `@Enumerated` | always STRING, never ORDINAL |
| `@Transactional` propagation | REQUIRED (default), REQUIRES_NEW, NESTED, MANDATORY, NEVER, SUPPORTS |
| `@Transactional` rollback | only `RuntimeException`/`Error`; checked → set `rollbackFor` |
| `@Transactional` self-invoke | doesn't work (proxy) |
| `readOnly=true` | Hibernate disables dirty checking |
| `@Version` | optimistic; `UPDATE … WHERE id=? AND version=?`; 0 rows → exception |
| `@ManyToMany` | avoid; use an explicit join entity |
| Index not used when | `LOWER(col)`, implicit cast, `LIKE '%x'`, low selectivity, `OR` |
| Composite index order | `(a,b,c)` works for queries starting with `a` |
| HikariCP size | rarely > 20–30 |
| Flyway vs Liquibase | Flyway — simple SQL versions; Liquibase — XML/YAML with rollback |

## REST / API

| Concept | Answer |
|---|---|
| Idempotent methods | GET, HEAD, OPTIONS, PUT, DELETE |
| Safe methods | GET, HEAD, OPTIONS |
| 200/201/204 | OK / Created (with `Location`) / No Content |
| 401 vs 403 | 401 — not authenticated; 403 — no permissions |
| 422 vs 400 | 422 — syntactically valid, semantically invalid |
| 429 | rate limit (with `Retry-After`) |
| 503 | temporarily unavailable |
| HATEOAS | hypermedia links to possible actions in the response |
| ETag | optimistic concurrency via `If-Match` |
| Cache-Control | public/private, max-age, must-revalidate |
| JWT structure | `header.payload.signature` (base64url) |
| JWT algorithms | HS256 (symmetric), RS256 (asymmetric, for microservices) |
| JWT validation | signature + `exp` + `iss` + `aud` |
| OAuth flow for SPA | Authorization Code + PKCE |
| OAuth flow for service | Client Credentials |
| When to defend CSRF | session+cookie auth (not needed for stateless JWT) |
| CORS preflight | OPTIONS for non-standard methods/headers |
| HTTP/2 | multiplexing, HPACK headers, binary |
| WebSocket vs SSE | WS — bidirectional; SSE — server→client one-way |
| gRPC vs REST | gRPC — HTTP/2 + protobuf, streaming, not browser-friendly |

## Architecture / Patterns / Kafka

| Concept | Answer |
|---|---|
| Best singleton | enum (thread-safe, reflection- and serialization-proof) |
| Strategy | family of algorithms behind a common interface |
| Decorator vs Proxy | Decorator extends; Proxy controls access |
| Hexagonal | core + ports (interfaces) + adapters (implementations) |
| DDD basics | Entity (id), VO (immutable, equals by value), Aggregate Root |
| Bounded Context | one model = one area; between — ACL |
| CQRS | separate read and write models |
| Event Sourcing | store the sequence of events, not the current state |
| Saga choreography | services listen/publish events, no orchestrator |
| Saga orchestration | central service drives the flow |
| Outbox pattern | one tx: business data + outbox table → relay to Kafka |
| Idempotency | `Idempotency-Key` + cache the result for N hours |
| Circuit breaker states | CLOSED → OPEN → HALF_OPEN |
| Bulkhead | resource isolation (separate pool per downstream) |
| Kafka partition | ordering only inside a partition |
| Kafka by key | `hash(key) % numPartitions` → one partition → ordering |
| Kafka acks | 0 (no), 1 (leader), all (ISR) — for durability use all |
| ISR | in-sync replicas (not lagging the leader) |
| Idempotent producer | `enable.idempotence=true` (no retry duplicates) |
| Compaction | keeps the last value per key |
| Consumer group | partitions are split between group consumers |
| Rebalancing | when a consumer joins/leaves; cooperative since 2.4 |
| Kafka exactly-once | idempotent + transactional + `read_committed` |

## Testing

| Concept | Answer |
|---|---|
| Pyramid | unit (many, fast) > integration > e2e (few) |
| `@SpringBootTest` | full context, slow |
| `@WebMvcTest` | only the web layer, services mocked |
| `@DataJpaTest` | only JPA, in-memory or Testcontainers |
| `@MockBean` | replaces a bean in the Spring context with a mock |
| `@Mock` | pure Mockito without Spring |
| Mock vs Spy | mock — empty; spy — real object, can partially mock |
| Testcontainers | real Postgres/Kafka/Redis in Docker for tests |
| `@ServiceConnection` (Boot 3.1+) | auto-configures the data source from the container |
| Pact | consumer-driven contracts |
| TDD cycle | red → green → refactor |
| Awaitility | for async tests instead of `Thread.sleep` |
| Mutation testing | Pitest — mutates code, validates test quality |

## DevOps

| Concept | Answer |
|---|---|
| Maven scopes | compile, provided, runtime, test, system, import |
| BOM | `dependencyManagement` with versions for version alignment |
| Multi-stage Docker | build in one image, run in a minimal one |
| Distroless | no shell, safer, minimal |
| Layered jar | dependencies in a separate layer → better cache |
| Probes | liveness (restart), readiness (drop from Service), startup |
| HPA | autoscale by CPU/memory/custom metrics |
| Graceful shutdown | `server.shutdown=graceful` + `terminationGracePeriodSeconds` |
| Heap in k8s | `-XX:MaxRAMPercentage=75` (leave room for non-heap) |
| 12-factor app | config in env, stateless, port binding, logs to stdout, … |
| GitOps | desired state in Git, controller pulls it |
| Three pillars of observability | metrics, logs, traces |
| Cardinality | avoid `user_id` in Prometheus labels |
| MDC | thread-local context for logs (`traceId`, `userId`) |
| OpenTelemetry | distributed tracing standard, `traceparent` header |

## Algorithms

| Concept | Answer |
|---|---|
| Big-O practical | n=10⁸ ≈ 1 s for O(n); n=10⁶ → O(n log n) max |
| `HashMap` | O(1) avg, O(log n) worst (treeified) |
| `TreeMap` | O(log n) always |
| `ArrayList` vs `LinkedList` | almost always `ArrayList` (cache-friendly) |
| `ArrayDeque` | best stack/queue |
| `PriorityQueue` | min-heap; for max — `Comparator.reverseOrder()` |
| Two pointers | for sorted arrays |
| Sliding window | sub-array/substring with a constraint |
| Hash for O(1) lookup | Two Sum, anagrams |
| Binary search "on the answer" | min capacity, koko bananas |
| BFS/DFS | BFS — shortest unweighted path; DFS — paths, cycles |
| Topological sort | Kahn's (BFS with indegree) or DFS post-order |
| DP question | sub-problems + memoization |
| Greedy | local choice → global optimum (when provable) |
| Top-K | min-heap of size K |
| Cycle in linked list | Floyd's tortoise & hare |
| LRU cache | `LinkedHashMap` (`accessOrder=true`) + `removeEldestEntry` |

## System Design

| Concept | Answer |
|---|---|
| Answer template | Requirements → Capacity → API → Data → HLD → Deep dive → Scale → Trade-offs |
| Cache-aside | app reads cache, on miss goes to DB and stores |
| Write-through | sync write to cache and DB |
| Write-back | write to cache immediately, DB async (loss risk) |
| Eviction | LRU, LFU, FIFO, TTL |
| Thundering herd | TTL expired → everyone hits DB; fix: jitter, single-flight |
| Sharding strategies | range (hot spots), hash (rebalance pain), consistent hash |
| Consistent hashing | minimizes key movement when nodes change |
| Quorum | W + R > N → strong; typically W = R = N/2 + 1 |
| CAP under partition | C — refuse; A — stale data |
| PACELC | else (no partition) — Latency vs Consistency |
| Linearizable | as if a single source of truth, real-time ordered |
| Eventual consistency | eventually consistent |
| Rate limiter algos | token bucket (bursty), leaky (smooth), sliding window |
| Retry | exponential backoff + jitter, idempotent operations only |
| Circuit breaker | don't go to a failing service, fail fast |
| 99.9% downtime | 8.76 h/year |
| 99.99% downtime | 52.6 min/year |
| Error budget | 100% − SLO; when burned — focus on stability |

## Soft skills

| Concept | Answer |
|---|---|
| STAR | Situation, Task, Action, Result |
| Self-intro time | 90 seconds |
| Pre-baked stories | 6–8: bug, conflict, failure, leadership, legacy, decision, deadline, disagreement |
| Senior signal | trade-offs, "depends on", impact beyond your own code |
| Don't | blame, "we" instead of "I", lie, ask no questions |
| If you don't know | "Not sure — I'd reason like this…" (DON'T fabricate) |
| Questions to interviewer | at least 3–5; research the company beforehand |

---

## Final mantra

1. **Trade-offs**, not dogma.
2. **It depends** — a normal answer if you explain on what.
3. Think **out loud**.
4. Clarify **requirements** before coding.
5. **One pass**: read → plan → code → tests → complexity.
6. If you don't know — **say so**, don't fabricate.
7. Breathe and smile. It's a dialogue, not an exam.

Good luck! 🚀
