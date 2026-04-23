# 100 questions with reference answers

> A list of real questions for the final self-check.
> Answer **out loud** first, then verify.

---

## Core Java (1–15)

**1. How is the JDK different from the JRE and the JVM?**
The JVM is the spec and an implementation of the virtual machine that runs bytecode. JRE = JVM + standard libraries, enough to run apps. JDK = JRE + developer tools (`javac`, `jar`, `jstack`). Since Java 11 the JRE is no longer shipped separately.

**2. What's new in Java 17 / 21?**
17: sealed classes (final), pattern matching for `instanceof`, records (final), switch expressions. 21: virtual threads (final), pattern matching for `switch`, record patterns, Sequenced Collections, generational ZGC.

**3. Why is `String` immutable?**
Security (used as keys, class names, URLs), cached `hashCode`, ability to use the string pool, thread-safety out of the box.

**4. How is `==` different from `equals`?**
For primitives `==` compares values. For references — addresses. `equals` is logical equality; on `Object` it's the same as `==` but is meant to be overridden.

**5. What does `Integer a = 127; Integer b = 127; a == b;` print, and for 200?**
For 127: `true` (the Integer cache `[-128;127]` reuses one object). For 200: `false` (different objects). Always compare boxed types via `equals`.

**6. The `equals`/`hashCode` contract.**
Reflexivity, symmetry, transitivity, consistency, `x.equals(null) == false`. If `equals` is true → `hashCode` must be equal (the reverse isn't required). Override `equals` → you must override `hashCode`.

**7. How is checked different from unchecked?**
Checked must be in `throws` or handled (compile-time). Unchecked — runtime, programming errors. `Error` — fatal (OOM, `StackOverflow`), don't catch.

**8. What happens if an exception is thrown in `finally`?**
It replaces the original exception from `try` (the original one is lost). Anti-pattern. The right approach is try-with-resources, which keeps the main one and puts the rest in `getSuppressed()`.

**9. What is type erasure?**
Generics in Java are implemented via type erasure: `List<String>` and `List<Integer>` are the same class `List` at runtime. Consequences: no `new T()`, `T.class`, `instanceof List<String>`, no static fields with `T`.

**10. PECS — explanation with example.**
Producer Extends, Consumer Super. `List<? extends Number>` — you can read (you'll get `Number`), can't write. `List<? super Integer>` — you can write `Integer`, read as `Object`.

**11. Why is a `final` field useful?**
Safe publication (after the constructor it's visible to all threads), helps the JIT (escape analysis), expressive — communicates immutability.

**12. Inner class vs static nested.**
An inner class holds an implicit reference to `Outer.this` — it can keep the enclosing object alive and cause leaks. A static nested class is just a class in another's namespace, no hidden reference. Prefer static nested unless you need the outer reference.

**13. How is a lambda different from an anonymous class?**
Lambda: `invokedynamic` + `LambdaMetafactory`, generated lazily, no separate `.class`, `this` is the outer one. Anonymous: a separate `Outer$1.class`, `this` is the object itself.

**14. Records — what is generated?**
All fields `private final`, accessors `field()`, `equals/hashCode/toString` by all components, a canonical constructor. Implicitly `final`, extends `java.lang.Record`. Can implement interfaces, can't extend classes.

**15. Sealed classes — what for?**
A closed hierarchy. Subtypes must be `final`, `sealed`, or `non-sealed`. The compiler knows all subtypes → exhaustive `switch` without `default`. Ideal for algebraic data types.

---

## Collections (16–30)

**16. How does `HashMap` work?**
An array of buckets sized to a power of two (default 16). The key's hash is mixed (`h ^ h>>>16`), the index is `(n-1) & hash`. Collisions → linked list; with ≥ 8 entries and table ≥ 64 → red-black tree. When `size > capacity * 0.75` — resize ×2.

**17. What is treeification and why?**
At bucket length ≥ 8 (and table ≥ 64) the list becomes a red-black tree. Lookup goes from O(n) to O(log n). Protection against bad `hashCode` and hash-collision DoS.

**18. Why load factor 0.75?**
An empirical compromise between density (memory) and collision frequency (performance). Lower — more memory, fewer resizes; higher — more collisions, slower operations.

**19. How is `HashMap` different from `ConcurrentHashMap`?**
`HashMap` is not thread-safe; allows one null key. `ConcurrentHashMap` — bucket-level locking + CAS, lock-free reads, atomic `compute`/`merge`, no nulls. `HashMap` in a multi-threaded environment can lose data on resize.

**20. How is `ArrayList` different from `LinkedList`? Which to pick?**
`ArrayList` is array-backed, `get` O(1), insert/remove in the middle O(n). `LinkedList` is doubly linked, insert/remove at the ends O(1), index access O(n). Almost always `ArrayList` — cache-friendly. `LinkedList` is rarely needed in practice (`ArrayDeque` is better as a queue).

**21. How to implement an LRU cache with stdlib collections?**
`LinkedHashMap` with `accessOrder=true` + override `removeEldestEntry`. Returns true when `size() > maxCapacity` — the map removes the eldest entry on `put`.

**22. What is a fail-fast iterator?**
The iterator checks `modCount` on every `next()` — if the collection changed, it throws `ConcurrentModificationException`. Not a multi-thread indicator — easy to trigger from a single thread via `for-each + remove`.

**23. What does `set.add(obj)` return if the object is already there?**
`false`. `Set.add` returns true only if the element was actually added.

**24. Why is `ArrayDeque` better than `LinkedList`?**
A circular array buffer — cache-friendly, no per-node allocation, faster on push/pop. The best choice for stack and queue in a single thread.

**25. When to pick `TreeMap`?**
When you need sorting by key, navigation (`floorKey`/`ceilingKey`/`headMap`/`tailMap`), range queries. The price is O(log n) instead of O(1) of `HashMap`.

**26. When is `CopyOnWriteArrayList` appropriate?**
Read-mostly with rare writes. Each modification creates a new array → expensive writes, but readers are lock-free. Listeners, observers.

**27. Why is `EnumMap` so fast?**
Internally an array indexed by `ordinal()`. No hashing, no collision handling. Memory is compact.

**28. How is `Collections.synchronizedMap` different from `ConcurrentHashMap`?**
`synchronizedMap` — a global lock on the whole map (`synchronized` on every method). `ConcurrentHashMap` — fine-grained locking at the bucket level + CAS. `ConcurrentHashMap` is significantly faster under load.

**29. What is a weakly consistent iterator?**
Not fail-fast: doesn't throw CME on modification, but may or may not see changes made after creation. `ConcurrentHashMap`, `ConcurrentSkipListMap`.

**30. How is `merge` different from `compute` in `Map`?**
`merge(key, value, remapping)` — if absent → put value; if present → result of `remapping(old, value)`. A simplified API for counters. `compute(key, remapping)` — universal: receives `(key, currentValue|null)` and returns the new value.

---

## Streams / Optional (31–40)

**31. Are streams lazy and what does that give us?**
Yes, intermediate operations are lazy — they only run on a terminal op. Benefits: short-circuit (`findFirst` doesn't traverse everything), optimization (a single pass through all operations).

**32. How is `map` different from `flatMap`?**
`map`: T → R, "1 to 1". `flatMap`: T → `Stream<R>`, unwraps a nested stream. For `List<List<X>>`, `flatMap` produces `Stream<X>`.

**33. Can a stream be reused?**
No. A stream is one-shot — a second terminal operation throws `IllegalStateException`.

**34. When is a parallel stream harmful?**
Small collections (splitter overhead), blocking I/O (you'll block the shared `ForkJoinPool.commonPool`), poorly splittable sources (`LinkedList`, `Stream.iterate`), stateful or synchronized ops.

**35. How is `reduce` different from `collect`?**
`reduce` — for an immutable fold (sum, max). `collect` — for a mutable accumulator (Builder, List, Map). `reduce` is a combinable associative function; `collect` is a `Collector` with supplier/accumulator/combiner.

**36. `orElse` vs `orElseGet` — why is `orElse` dangerous?**
`orElse(value)` — `value` is ALWAYS evaluated, even if `Optional` is non-empty. `orElseGet(supplier)` — supplier is only called when empty. For expensive defaults — use `orElseGet`.

**37. How is `Optional.of` different from `ofNullable`?**
`of` throws NPE if value is null. `ofNullable` allows null (creates empty).

**38. Why shouldn't `Optional` be a class field?**
Not `Serializable`, an extra object per field, confuses the API (no one expects an `Optional` field). It's intended as a return type to make "may be absent" explicit.

**39. What does `Collectors.toMap` return on duplicate keys?**
`IllegalStateException`. You must pass a merge function: `toMap(keyMapper, valueMapper, (a, b) -> a)` — keep first or second value.

**40. How is `Stream.toList()` different from `Collectors.toList()`?**
`Stream.toList()` (Java 16+) returns an immutable list. `Collectors.toList()` returns a mutable `ArrayList` (historically).

---

## Concurrency (41–60)

**41. How is `volatile` different from `synchronized`?**
`volatile` guarantees visibility and forbids reordering for one variable, but NOT atomicity (`counter++` is still a race). `synchronized` — mutual exclusion + visibility + atomicity for a block.

**42. What is happens-before?**
An ordering relation between operations in the JMM. If A happens-before B — results of A are visible to B and ordered before. Created by: program order, unlock→lock, volatile write→read, `Thread.start()`→everything in the new thread, everything in the thread→`join`, final fields after constructor.

**43. What is CAS and where is it used?**
Compare-And-Swap: an atomic CPU instruction `compareAndSet(expected, new)`. Atomically checks the current value and replaces if it matches. The basis of atomics, lock-free structures, `ConcurrentHashMap`.

**44. What is the ABA problem?**
The value goes A→B→A. CAS can't tell that anything happened. The fix is `AtomicStampedReference` (value + version), CAS on the pair.

**45. Why is `LongAdder` better than `AtomicLong` for counters?**
`AtomicLong` — all threads CAS on one variable → high contention. `LongAdder` — striped per-thread cells, each thread updates its own → no contention. `sum()` is approximate at read time.

**46. Why `wait` in a `while`, not in an `if`?**
Spurious wakeups (a thread can wake up without a `notify`); the condition could have changed by wakeup. The loop re-checks the condition and goes back to waiting if needed.

**47. What happens to the lock if an exception is thrown in a `synchronized` method?**
The lock is released automatically. The JVM guarantees `monitorexit` on any exit from a `synchronized` block.

**48. Why is `ReentrantLock` better than `synchronized`?**
`tryLock()`, `tryLock(timeout)`, `lockInterruptibly`, fair mode (FIFO), multiple `Condition`s. Downside — you must `unlock` manually in `finally`.

**49. `ReadWriteLock` — how does it work?**
Many readers OR one writer. You can downgrade a write lock to a read lock in the same thread, but not the reverse (deadlock).

**50. `CountDownLatch` vs `CyclicBarrier` — what's the difference?**
A latch is one-shot — the counter doesn't reset, after 0 it can't be reused. A barrier resets, can be reused. Latch — "wait for N tasks to complete", barrier — "rendezvous point of N threads".

**51. Why is `Executors.newCachedThreadPool` dangerous in production?**
Unbounded threads — under load it can spawn thousands → OOM, native thread limit. Use `ThreadPoolExecutor` directly with bounded max + bounded queue + `CallerRunsPolicy`.

**52. Why is `Executors.newFixedThreadPool` dangerous?**
Unbounded `LinkedBlockingQueue` — tasks can pile up forever → heap OOM. Again — `ThreadPoolExecutor` with a bounded queue.

**53. `ThreadLocal` in a pool — what's the danger?**
The pool's thread lives long; the `ThreadLocal` value persists between tasks. If you don't call `remove()` in `finally` — the previous task "pollutes" the next one and the value is never cleaned → memory leak.

**54. Why is `CompletableFuture` better than `Future`?**
Composition (`thenApply`, `thenCompose`, `thenCombine`), parallel waits (`allOf`, `anyOf`), exception handling (`exceptionally`, `handle`), timeouts (`orTimeout`). `Future` only has `get()`/`cancel()`.

**55. `thenApply` vs `thenApplyAsync` — where does it run?**
`thenApply` — in the thread that completed the previous stage. `thenApplyAsync` — in the given pool (or `ForkJoinPool.commonPool` by default).

**56. What is safe publication?**
Ways to make a new object visible to other threads fully initialized: `volatile` field, `final` field, `synchronized`, static initializer, concurrent collection. Without these — others may see a partially-initialized state.

**57. What are virtual threads and when to use them?**
Java 21. Lightweight user-level threads, mounted on a small number of carrier threads. Ideal for I/O-bound (millions of blocking calls). Not for CPU-bound. DON'T pool them. `synchronized` pins to the carrier — prefer `ReentrantLock`.

**58. What is structured concurrency?**
Java 21+ (preview). `StructuredTaskScope` groups parallel tasks; cancelling one cancels the rest. Safer than raw `CompletableFuture`s.

**59. How to avoid deadlock?**
Order lock acquisition (always A then B), use `tryLock` with a timeout, minimize lock holding, avoid nested `synchronized`. Detection — `jstack` shows them itself.

**60. What is an immutable object and why?**
`final class`, `private final` fields, no setters, defensive copy for mutable fields. Thread-safe by default, safe to publish, cacheable `hashCode`. Examples: `String`, `BigDecimal`, `java.time.*`.

---

## JVM / GC (61–72)

**61. Describe the JVM memory areas.**
Heap (shared, objects): Young (Eden + S0/S1) + Old; Metaspace (off-heap, class metadata); Stack (per-thread, method frames); PC register; native method stack; code cache (JIT).

**62. Where do primitives, objects, static fields live?**
Local primitives — on the stack (in the frame). Objects — on the heap. Object fields — inside the object on the heap. Static fields — in the `Class` object (on the heap, but GC roots).

**63. What is TLAB?**
Thread-Local Allocation Buffer — every thread gets its own slice of Eden. Allocation = bump-pointer without sync, hence very fast. When exhausted — request a new one.

**64. How does G1 work?**
The heap is split into ~2048 regions (Eden/Survivor/Old/Humongous). G1 knows the approximate garbage in each and prioritizes the regions with the most garbage → "garbage first". Pause-time goal — `-XX:MaxGCPauseMillis=200`.

**65. How is ZGC different from G1?**
ZGC is a concurrent collector with sub-millisecond pauses, up to 16 TB heap. Uses coloured pointers and load barriers. Since Java 21 — generational. G1 is more balanced, ZGC is for low-latency.

**66. How are Soft, Weak, Phantom references different?**
Soft — collected by the JVM under memory pressure (memory-sensitive cache). Weak — collected on the next GC if no strong references. Phantom — after `finalize`, for cleanup logic (Cleaner API).

**67. Name 5 classic memory leak causes.**
1) Static collections without removal; 2) `ThreadLocal` in a pool without `remove`; 3) Unclosed resources (`Stream`/`Connection`/`File`); 4) Listeners/callbacks without unsubscribe; 5) Inner class holds outer (or ClassLoader leaks on redeploy).

**68. What OOM errors exist?**
Java heap space (heap full); GC overhead limit exceeded (>98% time in GC); Metaspace (too many classes); direct buffer memory (off-heap); unable to create new native thread (OS limit); requested array size exceeds VM limit.

**69. How to capture and analyze a heap dump?**
`jcmd <pid> GC.heap_dump file.hprof` or `-XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=…`. Analyze in Eclipse MAT: Leak Suspects Report (auto), Dominator Tree (retained heap).

**70. What does a thread dump show?**
The state of every thread (`RUNNABLE`/`BLOCKED`/`WAITING`), stack traces, what monitor it waits on, who holds the lock, deadlock detection. Capture with `jstack <pid>`. Look for contention (many `BLOCKED` on one lock), CPU hotspots (many `RUNNABLE` on the same stack).

**71. What is JIT and tiered compilation?**
The Just-In-Time compiler converts hot bytecode into native code. Tiered: interpreter → C1 (fast) → C2 (aggressive optimizations). Decisions are based on call counters.

**72. How to tune the JVM in a Kubernetes container?**
`-XX:MaxRAMPercentage=75` (75% of cgroup memory limit for the heap), `-XX:+ExitOnOutOfMemoryError` (restart the pod on OOM), `-XX:+HeapDumpOnOutOfMemoryError`. Java 11+ automatically respects cgroup limits.

---

## Spring (73–85)

**73. What are IoC and DI?**
IoC — Inversion of Control: the container manages object lifecycles and wiring instead of the application. DI — Dependency Injection: the way to inject dependencies (constructor/setter/field).

**74. Which form of DI is best and why?**
Constructor injection: fields can be `final`, fail-fast at startup (if dependencies aren't resolved), easy to test without Spring, explicit dependencies. Field injection — anti-pattern (not `final`, hidden dependencies).

**75. The full bean lifecycle.**
Constructor → DI → `BeanNameAware`/`BeanFactoryAware`/`ApplicationContextAware` → `BeanPostProcessor.before` → `@PostConstruct` → `InitializingBean.afterPropertiesSet` → init-method → `BeanPostProcessor.after` (here the AOP proxy is created) → … → `@PreDestroy` → `DisposableBean.destroy` → destroy-method.

**76. How is `@Component` different from `@Bean`?**
`@Component` — on a class, registered via component scan. `@Bean` — on a method in `@Configuration`. Use `@Bean` when: the class is third-party, complex initialization is needed, multiple variants of one type.

**77. Why is `@Configuration` proxied with CGLIB?**
So that `@Bean`-method calls within the class return the singleton (instead of creating a new object every time). If you turn it off (`proxyBeanMethods=false`) — lite mode, faster startup, but methods don't self-coordinate.

**78. What is the self-invocation problem?**
Calling `this.method()` inside the class doesn't go through the proxy, so AOP aspects (`@Transactional`, `@Async`, `@Cacheable`) don't fire. Solutions: extract to another bean, inject self, use AspectJ.

**79. JDK proxy vs CGLIB?**
JDK dynamic proxy — for classes implementing an interface; the proxy implements the same interface. CGLIB — subclasses the class (needed for classes without interfaces); doesn't work with `final` classes/methods. Spring prefers JDK by default, switches to CGLIB via `proxyTargetClass=true`.

**80. How does Spring Boot load auto-configurations?**
From `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` (formerly `spring.factories`). Each is annotated with `@AutoConfiguration` + `@Conditional*` (on a class/bean/property/etc presence) — only enabled if the conditions hold.

**81. Property source order in Spring Boot.**
From lowest to highest priority: code defaults → `application.yml` in jar → profile-specific → external `application.yml` → OS env → `-D` system props → command-line args → `@TestPropertySource`.

**82. How is a `Filter` different from a `HandlerInterceptor`?**
`Filter` — Servlet API, runs on every request including static and before `DispatcherServlet`. `Interceptor` — Spring, only for controllers, has access to the handler. CORS/security — `Filter`; business logic like audit — `Interceptor`.

**83. How is `@MockBean` different from `@Mock`?**
`@Mock` — pure Mockito without Spring (for unit tests). `@MockBean` — replaces a bean in the Spring context with a mock (for integration). `@MockBean` recreates the context between tests with different configurations → slow.

**84. What `@Transactional` propagations are there?**
REQUIRED (default — join or create), REQUIRES_NEW (suspend current, open new), NESTED (savepoint), MANDATORY (must already exist), NEVER (must not exist), SUPPORTS (join if exists), NOT_SUPPORTED (suspend).

**85. Why doesn't a checked exception roll back `@Transactional` by default?**
A historical decision (EJB legacy). Spring rolls back only `RuntimeException` and `Error` by default. To roll back checked — set `@Transactional(rollbackFor = MyException.class)`.

---

## JPA / DB (86–95)

**86. What is ACID?**
Atomicity (all or nothing), Consistency (valid → valid), Isolation (parallel transactions are isolated), Durability (after commit data isn't lost).

**87. Isolation levels and which anomalies do they prevent?**
READ UNCOMMITTED — prevents nothing. READ COMMITTED (default in PG) — no dirty read. REPEATABLE READ — no non-repeatable. SERIALIZABLE — no phantom. Anomalies: dirty / non-repeatable / phantom / lost update / write skew.

**88. What is MVCC?**
Multi-Version Concurrency Control. Each transaction sees a snapshot of the DB at start (or per-statement). Row versions are kept simultaneously. Readers don't block writers and vice versa. PostgreSQL and InnoDB use this.

**89. Optimistic vs pessimistic locking.**
Optimistic: `@Version` field, on `UPDATE` checked via `WHERE version=?`. If 0 rows — conflict → retry. Good for read-heavy with rare conflicts. Pessimistic: `SELECT FOR UPDATE` — locks the row until commit. Good for frequent conflicts, downside — contention/deadlocks.

**90. What is the N+1 problem and how to fix it?**
1 query → list of parents; for each — a separate query for the collection (LAZY). Fixes: `JOIN FETCH` in JPQL, `@EntityGraph`, `@BatchSize`, `FetchMode.SUBSELECT`, DTO projection via `SELECT new com.x.Dto(...)`.

**91. LAZY vs EAGER — which to choose?**
Always LAZY, even for `@ManyToOne` (specify it explicitly). EAGER causes extra queries, makes query optimization impossible, and produces unpredictable `LazyInitializationException` issues.

**92. What is a persistence context?**
`EntityManager` + L1 cache. Within one transaction the same id always returns the same Java object. Hibernate does dirty checking on flush, comparing the current state to the snapshot taken at load time.

**93. Entity states.**
Transient (new, not in EM); managed (tracked, dirty checking); detached (context closed, changes are not applied); removed (marked for deletion).

**94. `persist` vs `merge`?**
`persist` — for transient (new), turns it into managed; `INSERT` on flush. `merge` — for detached, copies fields into a managed instance; returns the managed one (the old detached stays detached).

**95. When is an index NOT used?**
A function on a column (`LOWER(email)`) — needs a functional index; implicit type cast; `LIKE '%abc'` (leading wildcard); low selectivity; `OR` without an index on each column; stale statistics (`ANALYZE`).

---

## REST / Architecture (96–100)

**96. Which HTTP methods are idempotent?**
GET, HEAD, OPTIONS, PUT, DELETE. Safe (don't change state) — GET, HEAD, OPTIONS. POST and PATCH are not idempotent (PATCH may be).

**97. How is 401 different from 403?**
401 Unauthorized — not authenticated (no token or invalid). 403 Forbidden — authenticated, but no permission for the resource/action.

**98. JWT — structure and validation.**
`header.payload.signature` (base64url). Header: `alg`, `typ`, `kid`. Payload: `iss`, `sub`, `aud`, `exp`, `nbf`, `iat`, `jti` + custom (roles). Validation: signature (via the issuer's JWKS), `exp`, `nbf`, `iss`, `aud`. RS256 for microservices (asymmetric).

**99. How does Kafka guarantee ordering?**
Only inside a partition. Messages with the same key always land in the same partition (`hash(key) % numPartitions`) → order preserved per key. There's no ordering across the topic.

**100. What is the Outbox pattern?**
Solves the "atomically write to DB and publish an event" problem. In one transaction we write the business data and an event into an `outbox` table. A separate process (relay) or Debezium/CDC reads `outbox` and publishes to Kafka. At-least-once, the consumer must be idempotent.

---

## Final

After going through all 100:
- Where you stumbled — write it down and go to the topic file.
- Record yourself answering 5–10 random questions — evaluate the speech.
- The day before the interview — go through ALL of them again, answering out loud.

Good luck! 🎯
