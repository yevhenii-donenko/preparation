# 🚀 Шпаргалка — швидке повторення перед інтерв’ю

> Використовуй для фінального прогону за 1-2 години до інтерв’ю.
> Якщо щось незрозуміло — іди в детальний файл теми.

---

## Core Java

| Концепт | Відповідь однією фразою |
|---|---|
| JDK / JRE / JVM | JDK = JRE + tools; JRE = JVM + libs; JVM = віртуалка |
| Compile path | `.java` → `javac` → `.class` (байткод) → JVM (interpret + JIT) |
| Java 8 main features | lambdas, Stream API, `Optional`, `java.time`, default methods |
| Java 17/21 | records, sealed, pattern matching, virtual threads, ZGC |
| `==` vs `equals` | `==` — посилання/значення примітива; `equals` — логіка рівності |
| Integer cache | `[-128;127]` — ті самі об’єкти, `200 == 200` → false |
| Чому `String` immutable | thread-safety, hashCode caching, string pool, security |
| `StringBuilder` vs `StringBuffer` | Builder — не synchronized (швидший); Buffer — synchronized (legacy) |
| `final` | змінна незмінна, метод не override, клас не наслідується |
| Checked vs unchecked | Checked — обов’язковий catch/throws; unchecked — runtime errors |
| try-with-resources | auto close для `AutoCloseable`, у зворотному порядку |
| Generics | type erasure — у runtime типи стираються (`List<String>` = `List`) |
| PECS | Producer Extends, Consumer Super |
| Effectively final | змінна не змінюється → лямбда може захопити |
| Inner vs static nested | Inner тримає посилання на Outer, може текти пам’ять |
| Lambda vs anonymous | Лямбда — `invokedynamic`, немає `.class`; `this` — зовнішній |
| Enum singleton навіщо | thread-safe, захищений від reflection та серіалізації |
| Record | immutable data carrier, `equals/hashCode/toString` безкоштовно |
| Sealed | закрита ієрархія → exhaustive `switch` без `default` |

## Collections

| Концепт | Відповідь |
|---|---|
| `ArrayList` growth | ×1.5; default cap = 10 |
| `HashMap` default | 16 buckets, load factor 0.75 |
| `HashMap` treeify | bucket ≥ 8 + table ≥ 64 → Red-Black tree |
| `HashMap` resize | подвоює; елементи лишаються на index або їдуть на index + oldCap |
| Hash function | `h ^ (h >>> 16)` — mix верхніх біт |
| `HashMap` vs `Hashtable` | `HashMap` не synchronized, дозволяє null |
| `ConcurrentHashMap` | bucket-level locking + CAS, без null |
| Fail-fast | модифікація під час iter → CME (через `modCount`) |
| `LinkedHashMap` accessOrder | для LRU cache (+ `removeEldestEntry`) |
| `TreeMap` | Red-Black tree, O(log n), navigation API |
| `WeakHashMap` | ключі `WeakReference`, GC може їх зібрати |
| `EnumMap`/`EnumSet` | bit vector / array за ordinal — супершвидкі |
| `ArrayDeque` | найкращий вибір для stack/queue (швидше за `Stack`/`LinkedList`) |
| `BlockingQueue` методи | `add`/`offer`/`put` / `remove`/`poll`/`take` |
| `CopyOnWriteArrayList` | для read-heavy з рідким записом |

## Streams / Optional

| Концепт | Відповідь |
|---|---|
| Intermediate vs terminal | Intermediate — lazy, terminal — запускає pipeline |
| `map` vs `flatMap` | `flatMap` "розпаковує" вкладений `Stream` |
| Stream одноразовий | так, повторно — `IllegalStateException` |
| Параллельний stream pool | `ForkJoinPool.commonPool` |
| Коли паралельний поганий | I/O blocking, маленькі колекції, `LinkedList` як джерело |
| `reduce` vs `collect` | `reduce` — immutable згортка; `collect` — mutable акумулятор |
| `Optional.of` vs `ofNullable` | `of` падає на null, `ofNullable` дозволяє |
| `orElse` vs `orElseGet` | `orElse` — default рахується завжди! `orElseGet` — лише при empty |
| `Optional` як поле | ❌ не Serializable, антипатерн |
| `Collectors.toMap` дублікат | `IllegalStateException`, потрібна merge function |

## Concurrency

| Концепт | Відповідь |
|---|---|
| `volatile` гарантує | видимість + заборону переупорядкування (НЕ атомарність) |
| `synchronized` на чому | методі — на `this`; static методі — на `Class`; блоці — на об’єкті |
| `wait`/`notify` де | лише в `synchronized` на тому ж моніторі |
| `wait` у `while` | spurious wakeup + condition міг змінитися |
| happens-before | unlock→lock, volatile write→read, start→все в потоці, все в потоці→join |
| CAS | `compareAndSet(expected, new)` — атомарна інструкція CPU |
| ABA проблема | значення A→B→A; рішення — `AtomicStampedReference` (версія) |
| `LongAdder` vs `AtomicLong` | `LongAdder` — масив комірок по потоках, `sum()` приблизний |
| `ReentrantLock` vs `synchronized` | `tryLock` + timeout + interruptible + fair + `Condition` |
| `ReadWriteLock` | багато readers АБО один writer; downgrade write→read так, навпаки — ні |
| `StampedLock` | optimistic read; не reentrant! |
| `CountDownLatch` vs `CyclicBarrier` | Latch одноразовий, Barrier скидається |
| `Semaphore` | N дозволів (rate limiter, conn pool) |
| `ConcurrentHashMap` атомарні | `compute`, `merge`, `putIfAbsent` |
| `ThreadLocal` у пулі | обов’язково `remove()` у `finally` — інакше витік |
| `newCachedThreadPool` небезпечний | unbounded threads → OOM |
| `newFixedThreadPool` небезпечний | unbounded queue → OOM |
| `ThreadPoolExecutor` backpressure | `ArrayBlockingQueue` + `CallerRunsPolicy` |
| `Future` vs `CompletableFuture` | CF — composition, async chain, exception handling |
| `thenApply` vs `thenApplyAsync` | Apply — у потоці попереднього; Async — у вказаному пулі |
| Virtual threads | Java 21, для I/O-bound; не пулити; `synchronized` пінить |
| Structured concurrency | `StructuredTaskScope`; cancel один — скасовуються всі |
| Deadlock prevention | ordered locking + `tryLock(timeout)` |
| Safe publication | `volatile`, `final`, `synchronized`, static init, concurrent collection |

## JVM / GC

| Концепт | Відповідь |
|---|---|
| Heap layout | Young (Eden + S0/S1) + Old + Metaspace (off-heap) |
| Де живуть | примітиви — стек; об’єкти — heap; static — Class object |
| TLAB | thread-local буфер у Eden; bump-pointer без synchro |
| Generational hypothesis | більшість об’єктів помирає молодими |
| G1 | regions ~2048; pause time goal; mixed GC |
| ZGC | concurrent, sub-ms pauses, до 16 ТБ heap |
| STW | усі application-потоки призупинено |
| Soft / Weak / Phantom | Soft — при нестачі пам’яті; Weak — наступний GC; Phantom — після finalize, для cleanup |
| Memory leak топ-5 | static collections, `ThreadLocal` у пулі, unclosed resources, listeners, inner class |
| OOM types | heap space, GC overhead, Metaspace, direct buffer, native thread |
| Metaspace vs PermGen | Metaspace у native memory (Java 8+), без default limit |
| Heap dump | `jcmd <pid> GC.heap_dump file` або `-XX:+HeapDumpOnOOM` |
| Thread dump | `jstack <pid>` або `jcmd Thread.print` |
| Classloader hierarchy | Bootstrap → Platform → App → Custom; parent delegation |
| JIT levels | C1 (швидко) і C2 (агресивні оптимізації); tiered |
| Escape analysis | якщо об’єкт не "втікає" — JIT кладе його на стек |
| JFR | вбудований профайлер, overhead < 1% |
| Container JVM | `-XX:MaxRAMPercentage=75 -XX:+ExitOnOutOfMemoryError` |

## Spring / Spring Boot

| Концепт | Відповідь |
|---|---|
| IoC / DI | контейнер впроваджує залежності замість `new` |
| DI варіанти | constructor (✅ best), setter, field (❌) |
| `BeanFactory` vs `ApplicationContext` | `ApplicationContext` = `BeanFactory` + events + i18n + AOP + eager singleton |
| Bean lifecycle | constructor → DI → `Aware` → BPP.before → `@PostConstruct` → `InitializingBean` → init → BPP.after (AOP proxy) → … → `@PreDestroy` |
| Scopes | singleton (default), prototype, request, session, application |
| Prototype у singleton | `ObjectProvider`, `@Lookup`, `proxyMode=TARGET_CLASS` |
| `@Configuration` vs `@Component` | `@Configuration` проксується CGLIB → `@Bean`-методи singleton |
| `@Configuration` lite mode | `proxyBeanMethods=false` → швидший старт, але без singleton-семантики |
| Self-invocation | виклик через `this` обходить проксі → AOP/`@Transactional` не працює |
| JDK proxy vs CGLIB | JDK — є інтерфейс; CGLIB — наслідує клас |
| Auto-configuration | `@Conditional*` + `AutoConfiguration.imports` |
| `@SpringBootApplication` | `@Configuration` + `@EnableAutoConfig` + `@ComponentScan` |
| Property sources priority | CLI > sys props > env > file > defaults |
| `@ConfigurationProperties` | type-safe binding з валідацією |
| `@Profile` активація | `--spring.profiles.active=prod` або env `SPRING_PROFILES_ACTIVE` |
| Filter vs Interceptor | Filter — Servlet, усе; Interceptor — Spring, лише controllers |
| `@ControllerAdvice` | глобальна обробка exceptions |
| `ProblemDetail` (Spring 6) | RFC 7807 формат помилок |
| `@TransactionalEventListener` | спрацьовує після commit (`AFTER_COMMIT`) |
| `@Async` потребує | `@EnableAsync` + працює через проксі (не self-invoke) |

## JPA / Hibernate / БД

| Концепт | Відповідь |
|---|---|
| ACID | Atomicity, Consistency, Isolation, Durability |
| Isolation levels | RU, RC (default PG), RR (default MySQL), Serializable |
| Аномалії | dirty, non-repeatable, phantom, lost update, write skew |
| MVCC | кожна транзакція бачить знімок; readers не блокують writers |
| Optimistic vs Pessimistic | Optimistic — `@Version`; Pessimistic — `SELECT FOR UPDATE` |
| Persistence context | `EntityManager` + L1 cache; одна сутність → один Java-об’єкт |
| Стани сутності | transient, managed, detached, removed |
| `persist` vs `merge` | `persist` — для new (transient); `merge` — для detached |
| Dirty checking | Hibernate порівнює snapshot з current, генерує `UPDATE` |
| LAZY vs EAGER | завжди LAZY, навіть для `@ManyToOne` |
| `LazyInitializationException` | звернення до LAZY поза транзакцією |
| N+1 рішення | `JOIN FETCH`, `@EntityGraph`, `@BatchSize`, `FetchMode.SUBSELECT`, DTO projection |
| `@Enumerated` | завжди STRING, не ORDINAL |
| `@Transactional` propagation | REQUIRED (def), REQUIRES_NEW, NESTED, MANDATORY, NEVER, SUPPORTS |
| `@Transactional` rollback | лише `RuntimeException`/`Error`; checked → потрібен `rollbackFor` |
| `@Transactional` self-invoke | не працює (проксі) |
| `readOnly=true` | Hibernate вимикає dirty checking |
| `@Version` | optimistic; `UPDATE … WHERE id=? AND version=?`; 0 рядків → exception |
| `@ManyToMany` | уникати; робити проміжну сутність |
| Index не працює коли | `LOWER(col)`, неявне приведення, `LIKE '%x'`, низька селективність, `OR` |
| Composite index порядок | `(a,b,c)` працює для запитів, що починаються з `a` |
| HikariCP розмір | рідко > 20-30 |
| Flyway vs Liquibase | Flyway — прості SQL версії; Liquibase — XML/YAML з rollback |

## REST / API

| Концепт | Відповідь |
|---|---|
| Idempotent методи | GET, HEAD, OPTIONS, PUT, DELETE |
| Safe методи | GET, HEAD, OPTIONS |
| 200/201/204 | OK / Created (з `Location`) / No Content |
| 401 vs 403 | 401 — не аутентифікований; 403 — немає прав |
| 422 vs 400 | 422 — валідно за формою, невалідно за семантикою |
| 429 | rate limit (з `Retry-After`) |
| 503 | тимчасово недоступний |
| HATEOAS | гіперпосилання у відповіді на можливі дії |
| ETag | optimistic concurrency через `If-Match` |
| Cache-Control | public/private, max-age, must-revalidate |
| JWT структура | `header.payload.signature` (base64url) |
| JWT алгоритми | HS256 (symmetric), RS256 (asymmetric, для мікросервісів) |
| JWT validation | підпис + `exp` + `iss` + `aud` |
| OAuth flow для SPA | Authorization Code + PKCE |
| OAuth flow для service | Client Credentials |
| CSRF коли захищати | session+cookie auth (не потрібен для stateless JWT) |
| CORS preflight | OPTIONS для нестандартних методів/headers |
| HTTP/2 | multiplexing, HPACK headers, бінарний |
| WebSocket vs SSE | WS — двонаправлений; SSE — server→client one-way |
| gRPC vs REST | gRPC — HTTP/2 + Protobuf, streaming, не для браузера |

## Архітектура / Patterns / Kafka

| Концепт | Відповідь |
|---|---|
| Singleton best | enum (thread-safe, проти reflection та serialization) |
| Strategy | сімейство алгоритмів за спільним інтерфейсом |
| Decorator vs Proxy | Decorator розширює; Proxy контролює доступ |
| Hexagonal | ядро + ports (interfaces) + adapters (implementations) |
| DDD основи | Entity (id), VO (immutable, equals по value), Aggregate Root |
| Bounded Context | одна модель = одна область; між — ACL |
| CQRS | розділення моделей читання та запису |
| Event Sourcing | зберігається послідовність подій, не поточний стан |
| Saga choreography | сервіси слухають/публікують події, без оркестратора |
| Saga orchestration | центральний сервіс керує |
| Outbox pattern | в одній транзакції: бізнес-дані + outbox table → relay у Kafka |
| Idempotency | `Idempotency-Key` + кеш результату на N годин |
| Circuit Breaker стани | CLOSED → OPEN → HALF_OPEN |
| Bulkhead | ізоляція ресурсів (окремий пул на кожен downstream) |
| Kafka partition | порядок гарантований лише всередині партиції |
| Kafka по ключу | `hash(key) % numPartitions` → одна партиція → порядок |
| Kafka acks | 0 (no), 1 (leader), all (ISR) — для durability all |
| ISR | in-sync replicas (не сильно відстають від leader) |
| Idempotent producer | `enable.idempotence=true` (захист від дублів при retry) |
| Compaction | зберігає останнє значення по ключу |
| Consumer group | партиції діляться між consumers групи |
| Rebalancing | при додаванні/видаленні consumer’а; cooperative з 2.4+ |
| Exactly-once Kafka | idempotent + transactional + `read_committed` |

## Тестування

| Концепт | Відповідь |
|---|---|
| Піраміда | unit (багато, швидко) > integration > e2e (мало) |
| `@SpringBootTest` | повний контекст, повільно |
| `@WebMvcTest` | лише web шар, моки сервісів |
| `@DataJpaTest` | лише JPA, in-memory або Testcontainers |
| `@MockBean` | замінює бін у Spring контексті моком |
| `@Mock` | чистий Mockito без Spring |
| Mock vs Spy | Mock — пустушка; Spy — реальний об’єкт, можна частково замокати |
| Testcontainers | real Postgres/Kafka/Redis у Docker для тестів |
| `@ServiceConnection` (Boot 3.1+) | автоконфіг datasource з контейнера |
| Pact | consumer-driven contracts |
| TDD цикл | red → green → refactor |
| Awaitility | для async тестів замість `Thread.sleep` |
| Mutation testing | Pitest — мутує код, перевіряє якість тестів |

## DevOps

| Концепт | Відповідь |
|---|---|
| Maven scopes | compile, provided, runtime, test, system, import |
| BOM | `dependencyManagement` з версіями для версійної узгодженості |
| Multi-stage Docker | build в одному, runtime у мінімальному |
| Distroless | без shell, безпечніше, мінімальний |
| Layered jar | dependencies в окремий шар → кращий cache |
| Probes | liveness (рестарт), readiness (виключення з Service), startup |
| HPA | автоскейл за CPU/memory/custom metrics |
| Graceful shutdown | `server.shutdown=graceful` + `terminationGracePeriodSeconds` |
| Heap у k8s | `-XX:MaxRAMPercentage=75` (залишити під non-heap) |
| 12-factor app | config in env, stateless, port binding, logs у stdout, … |
| GitOps | бажаний стан у Git, controller підтягує (pull) |
| Three pillars observability | metrics, logs, traces |
| Cardinality | уникай `user_id` у labels Prometheus |
| MDC | thread-local context для логів (`traceId`, `userId`) |
| OpenTelemetry | стандарт distributed tracing, `traceparent` header |

## Алгоритми

| Концепт | Відповідь |
|---|---|
| Big-O practical | n=10⁸ ≈ 1 сек O(n); n=10⁶ → O(n log n) макс |
| `HashMap` | O(1) avg, O(log n) worst (treeified) |
| `TreeMap` | O(log n) завжди |
| `ArrayList` vs `LinkedList` | майже завжди `ArrayList` (cache-friendly) |
| `ArrayDeque` | найкращий stack/queue |
| `PriorityQueue` | min-heap; для max — `Comparator.reverseOrder()` |
| Two pointers | для відсортованих масивів |
| Sliding window | підмасив/підрядок з умовою |
| Hash для O(1) lookup | Two Sum, anagrams |
| Binary search "по відповіді" | min capacity, koko bananas |
| BFS/DFS | BFS — найкоротший шлях незваженого; DFS — шляхи, цикли |
| Topological sort | Kahn’s (BFS з indegree) або DFS post-order |
| DP питання | підзадачі + мемоїзація |
| Greedy | локальний вибір → глобальний оптимум (якщо доказово) |
| Top-K | min-heap розміру K |
| Cycle in linked list | Floyd’s tortoise & hare |
| LRU cache | `LinkedHashMap` (`accessOrder=true`) + `removeEldestEntry` |

## System Design

| Концепт | Відповідь |
|---|---|
| Шаблон відповіді | Requirements → Capacity → API → Data → HLD → Deep dive → Scale → Trade-offs |
| Cache-aside | додаток читає кеш, на miss йде в БД і кладе |
| Write-through | синхронно в кеш і БД |
| Write-back | у кеш одразу, у БД async (ризик втрати) |
| Eviction | LRU, LFU, FIFO, TTL |
| Thundering herd | TTL завершився → усі одразу в БД; рішення: jitter, single-flight |
| Sharding strategies | range (hot spots), hash (rebalance pain), consistent hash |
| Consistent hashing | мінімізує переїзд ключів при зміні нод |
| Quorum | W + R > N → strong; типово W=R=N/2+1 |
| CAP при partition | C — відмова; A — stale data |
| PACELC | else (no partition) — Latency vs Consistency |
| Linearizable | як одна точка істини, впорядковані в реальному часі |
| Eventual consistency | рано чи пізно консистентно |
| Rate limiter algos | token bucket (bursty), leaky (smooth), sliding window |
| Retry | exponential backoff + jitter, лише для ідемпотентних |
| Circuit breaker | не йти в хворий сервіс, fail fast |
| 99.9% downtime | 8.76 год/рік |
| 99.99% downtime | 52.6 хв/рік |
| Error budget | 100% − SLO; коли спалили — фокус на стабільність |

## Soft skills

| Концепт | Відповідь |
|---|---|
| STAR | Situation, Task, Action, Result |
| Self-intro time | 90 секунд |
| Заготовити історій | 6-8: bug, conflict, failure, leadership, legacy, decision, deadline, disagreement |
| Senior signal | trade-offs, "depends on", impact beyond own code |
| Не робити | звинувачувати інших, "ми" замість "я", брехати, не ставити запитань |
| Якщо не знаю | "Не впевнений, міркував би так…" (НЕ вигадувати) |
| Питання інтерв’юеру | мінімум 3-5; ресерч компанії обов’язковий |

---

## Фінальна мантра

1. **Trade-offs**, не догматизм.
2. **It depends** — нормальна відповідь, якщо поясниш від чого.
3. Думай **вголос**.
4. Уточнюй **вимоги** перш ніж кодити.
5. **Один pass**: прочитав → план → код → тести → складність.
6. Якщо не знаєш — **скажи**, не вигадуй.
7. Дихай і посміхайся. Це діалог, не іспит.

Удачі! 🚀
