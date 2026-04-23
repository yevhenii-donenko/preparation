# 🚀 Cheat Sheet — быстрое повторение перед интервью

> Используй для финального прогона за 1-2 часа до интервью.  
> Если что-то непонятно — иди в детальный файл темы.

---

## Core Java

| Концепт | Ответ одной фразой |
|---|---|
| JDK / JRE / JVM | JDK = JRE + tools; JRE = JVM + libs; JVM = виртуалка |
| Compile path | `.java` → `javac` → `.class` (байткод) → JVM (interpret + JIT) |
| Java 8 main features | lambdas, Stream API, Optional, java.time, default methods |
| Java 17/21 | records, sealed, pattern matching, virtual threads, ZGC |
| `==` vs `equals` | `==` — ссылка/значение примитива; `equals` — логика равенства |
| Integer cache | `[-128;127]` — те же объекты, `200 == 200` → false |
| String immutable зачем | thread-safety, hashCode caching, string pool, security |
| StringBuilder vs Buffer | Builder — не synchronized (быстрее); Buffer — synchronized (legacy) |
| `final` | переменная неизм., метод не override, класс не наследуется |
| Checked vs unchecked | Checked — обязан catch/throws; unchecked — runtime errors |
| try-with-resources | auto close для AutoCloseable, в обратном порядке |
| Generics | type erasure — в runtime типы стираются (List<String> = List) |
| PECS | Producer Extends, Consumer Super |
| Effectively final | переменная не меняется → лямбда может захватить |
| Inner vs static nested | Inner держит ссылку на Outer, может течь память |
| Lambda vs anonymous | Лямбда — invokedynamic, нет `.class`; this — внешний |
| Enum singleton зачем | thread-safe, защищён от reflection и сериализации |
| Record | immutable data carrier, equals/hashCode/toString бесплатно |
| Sealed | закрытая иерархия → exhaustive switch без default |

## Collections

| Концепт | Ответ |
|---|---|
| ArrayList growth | ×1.5; default cap = 10 |
| HashMap default | 16 buckets, load factor 0.75 |
| HashMap treeify | bucket ≥8 + table ≥64 → Red-Black tree |
| HashMap resize | удваивает; элементы остаются на index или едут на index+oldCap |
| Hash function | `h ^ (h >>> 16)` — mix верхних бит |
| HashMap vs Hashtable | HashMap не synchronized, разрешает null |
| ConcurrentHashMap | bucket-level locking + CAS, нет null |
| Fail-fast | модификация во время iter → CME (через modCount) |
| LinkedHashMap accessOrder | для LRU cache (+ removeEldestEntry) |
| TreeMap | Red-Black tree, O(log n), navigation API |
| WeakHashMap | ключи WeakReference, GC может их собрать |
| EnumMap/Set | bit vector / array по ordinal — супербыстрые |
| ArrayDeque | лучший выбор для stack/queue (быстрее Stack/LinkedList) |
| BlockingQueue методы | add/offer/put / remove/poll/take |
| CopyOnWriteArrayList | для read-heavy с редкой записью |

## Streams / Optional

| Концепт | Ответ |
|---|---|
| Intermediate vs terminal | Intermediate — lazy, terminal — запускает pipeline |
| map vs flatMap | flatMap "распаковывает" вложенный Stream |
| Stream одноразовый | да, повторно — IllegalStateException |
| Параллельный stream pool | ForkJoinPool.commonPool |
| Когда параллельный плох | I/O blocking, маленькие коллекции, LinkedList источник |
| reduce vs collect | reduce — immutable свёртка; collect — mutable аккумулятор |
| Optional.of vs ofNullable | of падает на null, ofNullable допускает |
| orElse vs orElseGet | orElse — default считается всегда! orElseGet — только при empty |
| Optional как поле | ❌ не Serializable, антипаттерн |
| Collectors.toMap дубликат | IllegalStateException, нужен merge function |

## Concurrency

| Концепт | Ответ |
|---|---|
| volatile гарантирует | видимость + запрет переупорядочивания (НЕ атомарность) |
| synchronized на чём | методе — на this; static методе — на Class; блоке — на объекте |
| wait/notify где | только в synchronized на том же мониторе |
| wait в while | spurious wakeup + condition мог измениться |
| happens-before | unlock→lock, volatile write→read, start→всё в потоке, всё в потоке→join |
| CAS | compareAndSet(expected, new) — атомарная инструкция CPU |
| ABA проблема | значение A→B→A; решение — AtomicStampedReference (версия) |
| LongAdder vs AtomicLong | LongAdder — массив ячеек по потокам, sum() приблизителен |
| ReentrantLock vs synchronized | tryLock + timeout + interruptible + fair + Condition |
| ReadWriteLock | много readers ИЛИ один writer; downgrade write→read да, наоборот нет |
| StampedLock | optimistic read; не reentrant! |
| CountDownLatch vs CyclicBarrier | Latch одноразовый, Barrier сбрасывается |
| Semaphore | N разрешений (rate limiter, conn pool) |
| ConcurrentHashMap атомарные | compute, merge, putIfAbsent |
| ThreadLocal в пуле | обязательно remove() в finally — иначе утечка |
| newCachedThreadPool опасен | unbounded threads → OOM |
| newFixedThreadPool опасен | unbounded queue → OOM |
| ThreadPoolExecutor backpressure | ArrayBlockingQueue + CallerRunsPolicy |
| Future vs CompletableFuture | CF — composition, async chain, exception handling |
| thenApply vs thenApplyAsync | Apply — в потоке предыдущего; Async — в указанном пуле |
| Virtual threads | Java 21, для I/O-bound; не пулить; synchronized пиннит |
| Structured concurrency | StructuredTaskScope; cancel один — отменяются все |
| Deadlock prevention | ordered locking + tryLock(timeout) |
| Safe publication | volatile, final, synchronized, static init, concurrent collection |

## JVM / GC

| Концепт | Ответ |
|---|---|
| Heap layout | Young (Eden + S0/S1) + Old + Metaspace (off-heap) |
| Где живут | примитивы — стек; объекты — heap; static — Class object |
| TLAB | thread-local буфер в Eden; bump-pointer без synchro |
| Generational hypothesis | большинство объектов умирают молодыми |
| G1 | regions ~2048; pause time goal; mixed GC |
| ZGC | concurrent, sub-ms pauses, до 16TB heap |
| STW | все приложение-потоки приостановлены |
| Soft / Weak / Phantom | Soft — на нехватке памяти; Weak — следующий GC; Phantom — после finalize, для cleanup |
| Memory leak топ-5 | static collections, ThreadLocal в пуле, unclosed resources, listeners, inner class |
| OOM types | heap space, GC overhead, Metaspace, direct buffer, native thread |
| Metaspace vs PermGen | Metaspace в native memory (Java 8+), без default limit |
| Heap dump | `jcmd <pid> GC.heap_dump file` или `-XX:+HeapDumpOnOOM` |
| Thread dump | `jstack <pid>` или `jcmd Thread.print` |
| Classloader hierarchy | Bootstrap → Platform → App → Custom; parent delegation |
| JIT levels | C1 (быстро) и C2 (агрессивные оптимизации); tiered |
| Escape analysis | если объект не убегает — JIT раскладывает на стек |
| JFR | встроенный профайлер, overhead <1% |
| Container JVM | `-XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError` |

## Spring / Spring Boot

| Концепт | Ответ |
|---|---|
| IoC / DI | контейнер внедряет зависимости вместо `new` |
| DI варианты | constructor (✅ best), setter, field (❌) |
| BeanFactory vs AppContext | AppContext = BeanFactory + events + i18n + AOP + eager singleton |
| Bean lifecycle | constructor → DI → Aware → BPP.before → @PostConstruct → InitializingBean → init → BPP.after (AOP proxy) → ... → @PreDestroy |
| Scopes | singleton (default), prototype, request, session, application |
| Prototype в singleton | `ObjectProvider`, `@Lookup`, `proxyMode=TARGET_CLASS` |
| @Configuration vs @Component | @Configuration проксируется CGLIB → @Bean методы singleton |
| @Configuration lite mode | proxyBeanMethods=false → быстрее, но без singleton-семантики |
| Self-invocation проблема | вызов через `this` обходит прокси → AOP/@Transactional не работают |
| JDK proxy vs CGLIB | JDK — есть интерфейс; CGLIB — наследует класс |
| Auto-configuration | @Conditional* + AutoConfiguration.imports |
| @SpringBootApplication | @Configuration + @EnableAutoConfig + @ComponentScan |
| Property sources priority | CLI > sys props > env > file > defaults |
| @ConfigurationProperties | type-safe binding с валидацией |
| @Profile активация | `--spring.profiles.active=prod` или env `SPRING_PROFILES_ACTIVE` |
| Filter vs Interceptor | Filter — Servlet, всё; Interceptor — Spring, только controllers |
| @ControllerAdvice | глобальная обработка exceptions |
| ProblemDetail (Spring 6) | RFC 7807 формат ошибок |
| @TransactionalEventListener | срабатывает после commit (AFTER_COMMIT) |
| @Async требует | @EnableAsync + работает через прокси (не self-invoke) |

## JPA / Hibernate / БД

| Концепт | Ответ |
|---|---|
| ACID | Atomicity, Consistency, Isolation, Durability |
| Isolation levels | RU, RC (default PG), RR (default MySQL), Serializable |
| Аномалии | dirty, non-repeatable, phantom, lost update, write skew |
| MVCC | каждая транзакция видит снимок; readers не блокируют writers |
| Optimistic vs Pessimistic | Optimistic — @Version; Pessimistic — SELECT FOR UPDATE |
| Persistence context | EntityManager + L1 cache; одна сущность → один Java-объект |
| Состояния сущности | transient, managed, detached, removed |
| persist vs merge | persist — для new (transient); merge — для detached |
| Dirty checking | Hibernate сравнивает snapshot с current, генерит UPDATE |
| LAZY vs EAGER | всегда LAZY, даже для @ManyToOne |
| LazyInitializationException | обращение к LAZY вне транзакции |
| N+1 решения | JOIN FETCH, @EntityGraph, @BatchSize, FetchMode.SUBSELECT, DTO projection |
| @Enumerated | всегда STRING, не ORDINAL |
| @Transactional propagation | REQUIRED (def), REQUIRES_NEW, NESTED, MANDATORY, NEVER, SUPPORTS |
| @Transactional rollback | только RuntimeException/Error; checked → нужен `rollbackFor` |
| @Transactional self-invoke | не работает (прокси) |
| readOnly=true | Hibernate отключает dirty checking |
| @Version | optimistic; UPDATE ... WHERE id=? AND version=?; 0 строк → exception |
| @ManyToMany | избегать; делать промежуточную сущность |
| Index когда не работает | LOWER(col), неявное приведение, LIKE '%x', низкая селективность, OR |
| Composite index порядок | (a,b,c) работает для запросов начиная с a |
| HikariCP размер | редко >20-30 |
| Flyway vs Liquibase | Flyway — простые SQL версии; Liquibase — XML/YAML с rollback |

## REST / API

| Концепт | Ответ |
|---|---|
| Idempotent методы | GET, HEAD, OPTIONS, PUT, DELETE |
| Safe методы | GET, HEAD, OPTIONS |
| 200/201/204 | OK / Created (с Location) / No Content |
| 401 vs 403 | 401 — не аутентифицирован; 403 — нет прав |
| 422 vs 400 | 422 — валидно по форме, невалидно по семантике |
| 429 | rate limit (с Retry-After) |
| 503 | временно недоступен |
| HATEOAS | гиперссылки в ответе на возможные действия |
| ETag | optimistic concurrency через If-Match |
| Cache-Control | public/private, max-age, must-revalidate |
| JWT структура | header.payload.signature (base64url) |
| JWT алгоритмы | HS256 (symmetric), RS256 (asymmetric, для микросервисов) |
| JWT validation | подпись + exp + iss + aud |
| OAuth flow для SPA | Authorization Code + PKCE |
| OAuth flow для service | Client Credentials |
| CSRF когда защищать | session+cookie auth (не нужен для stateless JWT) |
| CORS preflight | OPTIONS для нестандартных методов/headers |
| HTTP/2 | multiplexing, HPACK headers, бинарный |
| WebSocket vs SSE | WS — двунаправленный; SSE — server→client one-way |
| gRPC vs REST | gRPC — HTTP/2 + Protobuf, streaming, не для браузера |

## Архитектура / Patterns / Kafka

| Концепт | Ответ |
|---|---|
| Singleton best | enum (thread-safe, против reflection и serialization) |
| Strategy | семейство алгоритмов за общим интерфейсом |
| Decorator vs Proxy | Decorator расширяет; Proxy контролирует доступ |
| Hexagonal | ядро + ports (interfaces) + adapters (implementations) |
| DDD основы | Entity (id), VO (immutable, equals по value), Aggregate Root |
| Bounded Context | одна модель = одна область; между — ACL |
| CQRS | разделение моделей чтения и записи |
| Event Sourcing | хранится последовательность событий, не текущее состояние |
| Saga choreography | сервисы слушают/публикуют события, без оркестратора |
| Saga orchestration | центральный сервис управляет |
| Outbox pattern | в одной транзакции: бизнес-данные + outbox table → relay в Kafka |
| Idempotency | Idempotency-Key + кэш результата на N часов |
| Circuit Breaker состояния | CLOSED → OPEN → HALF_OPEN |
| Bulkhead | изоляция ресурсов (отдельный пул на каждый downstream) |
| Kafka partition | порядок гарантирован только внутри партиции |
| Kafka по ключу | hash(key) % numPartitions → одна партиция → порядок |
| Kafka acks | 0 (no), 1 (leader), all (ISR) — для durability all |
| ISR | in-sync replicas (не отстают сильно от leader) |
| Idempotent producer | enable.idempotence=true (защита от дублей при retry) |
| Compaction | хранит последнее значение по ключу |
| Consumer group | партиции делятся между consumers группы |
| Rebalancing | при добавлении/удалении consumer'а; cooperative с 2.4+ |
| Exactly-once Kafka | idempotent + transactional + read_committed |

## Тестирование

| Концепт | Ответ |
|---|---|
| Пирамида | unit (много, быстро) > integration > e2e (мало) |
| @SpringBootTest | полный контекст, медленно |
| @WebMvcTest | только web слой, моки сервисов |
| @DataJpaTest | только JPA, in-memory или Testcontainers |
| @MockBean | заменяет бин в Spring контексте моком |
| @Mock | чистый Mockito без Spring |
| Mock vs Spy | Mock — пустышка; Spy — реальный объект, можно частично замокать |
| Testcontainers | real Postgres/Kafka/Redis в Docker для тестов |
| @ServiceConnection (Boot 3.1+) | автоконфиг datasource из контейнера |
| Pact | consumer-driven contracts |
| TDD цикл | red → green → refactor |
| Awaitility | для async тестов вместо Thread.sleep |
| Mutation testing | Pitest — мутирует код, проверяет качество тестов |

## DevOps

| Концепт | Ответ |
|---|---|
| Maven scopes | compile, provided, runtime, test, system, import |
| BOM | dependencyManagement с версиями для версионной согласованности |
| Multi-stage Docker | build в одном, runtime в минимальном |
| Distroless | без shell, безопаснее, минимальный |
| Layered jar | dependencies в отдельный слой → лучший cache |
| Probes | liveness (рестарт), readiness (исключение из Service), startup |
| HPA | автоскейл по CPU/memory/custom metrics |
| Graceful shutdown | `server.shutdown=graceful` + terminationGracePeriodSeconds |
| Heap в k8s | `-XX:MaxRAMPercentage=75` (оставить под non-heap) |
| 12-factor app | config in env, stateless, port binding, logs в stdout, … |
| GitOps | желаемое состояние в Git, controller подтягивает (pull) |
| Three pillars observability | metrics, logs, traces |
| Cardinality | избегай user_id в labels Prometheus |
| MDC | thread-local context для логов (traceId, userId) |
| OpenTelemetry | стандарт distributed tracing, traceparent header |

## Algorithms

| Концепт | Ответ |
|---|---|
| Big-O practical | n=10⁸ ≈ 1 сек O(n); n=10⁶ → O(n log n) макс |
| HashMap | O(1) avg, O(log n) worst (treeified) |
| TreeMap | O(log n) всегда |
| ArrayList vs LinkedList | почти всегда ArrayList (cache-friendly) |
| ArrayDeque | лучший stack/queue |
| PriorityQueue | min-heap; для max — Comparator.reverseOrder() |
| Two pointers | для отсортированных массивов |
| Sliding window | подмассив/подстрока с условием |
| Hash для O(1) lookup | Two Sum, anagrams |
| Binary search "по ответу" | min capacity, koko bananas |
| BFS/DFS | BFS — кратчайший путь невзвешенный; DFS — пути, циклы |
| Topological sort | Kahn's (BFS с indegree) или DFS post-order |
| DP вопрос | подзадачи + мемоизация |
| Greedy | локальный выбор → глобальный оптимум (если доказуемо) |
| Top-K | min-heap размера K |
| Cycle in linked list | Floyd's tortoise & hare |
| LRU cache | LinkedHashMap (accessOrder=true) + removeEldestEntry |

## System Design

| Концепт | Ответ |
|---|---|
| Шаблон ответа | Requirements → Capacity → API → Data → HLD → Deep dive → Scale → Trade-offs |
| Cache-aside | приложение читает кэш, на miss идёт в БД и кладёт |
| Write-through | синхронно в кэш и БД |
| Write-back | в кэш сразу, в БД async (риск потери) |
| Eviction | LRU, LFU, FIFO, TTL |
| Thundering herd | TTL истёк → все сразу в БД; решение: jitter, single-flight |
| Sharding strategies | range (hot spots), hash (rebalance pain), consistent hash |
| Consistent hashing | минимизирует переезд ключей при изменении нод |
| Quorum | W + R > N → strong; типично W=R=N/2+1 |
| CAP при partition | C — отказ; A — stale data |
| PACELC | else (no partition) — Latency vs Consistency |
| Linearizable | как одна точка истины, упорядочены в реальном времени |
| Eventual consistency | рано или поздно консистентно |
| Rate limiter algos | token bucket (bursty), leaky (smooth), sliding window |
| Retry | exponential backoff + jitter, только для идемпотентных |
| Circuit breaker | не идти в больной сервис, fail fast |
| 99.9% downtime | 8.76 ч/год |
| 99.99% downtime | 52.6 мин/год |
| Error budget | 100% - SLO; когда сожгли — фокус на стабильность |

## Soft skills

| Концепт | Ответ |
|---|---|
| STAR | Situation, Task, Action, Result |
| Self-intro time | 90 секунд |
| Истории заготовить | 6-8: bug, conflict, failure, leadership, legacy, decision, deadline, disagreement |
| Senior signal | trade-offs, "depends on", impact beyond own code |
| Не делать | винить других, "мы" вместо "я", лгать, не задавать вопросов |
| Если не знаю | "Не уверен, рассуждал бы так..." (НЕ выдумывать) |
| Вопросы интервьюеру | минимум 3-5; ресёрч компании обязателен |

---

## Финальный mantra

1. **Trade-offs**, не догматизм.
2. **It depends** — нормальный ответ, если объяснишь от чего.
3. Думай **вслух**.
4. Уточняй **требования** прежде чем кодить.
5. **Один pass**: прочитал → план → код → тесты → сложность.
6. Если не знаешь — **скажи**, не выдумывай.
7. Дыши и улыбайся. Это диалог, не экзамен.

Удачи! 🚀

