# 15. Concurrency Deep Dive — поглиблено для Senior

> Цей файл доповнює топік 04 додатковою глибиною: JMM на рівні барʼєрів пам’яті, false sharing,
> внутрішня реалізація `synchronized` (lock inflation), Virtual Threads (continuations / pinning),
> ForkJoin work-stealing, exotic synchronizers, ScopedValue vs ThreadLocal, Reactor vs Loom.

---

## 15.1 JMM глибше: memory barriers, ordering

JMM описана в JLS §17. На рівні CPU вона транслюється у **memory barriers** (fences):

| Барʼєр | Що забороняє переупорядковувати | Java аналог |
|---|---|---|
| `LoadLoad` | read1 → read2 | `volatile` read (acquire) |
| `LoadStore` | read → write | `volatile` read |
| `StoreStore` | write1 → write2 | `volatile` write (release), `final` field write at end of constructor |
| `StoreLoad` | write → read | `volatile` write (повний fence на x86) |

**`volatile` write на x86** = `MFENCE` або `LOCK` префіксована інструкція. **Дорогий**: ~15–50 ns.

**`final` поля** мають **freeze action** в кінці конструктора → інші потоки бачать ініціалізоване значення без додаткової синхронізації (за умови, що `this` не «втік»).

```java
class Holder {
    final int[] data;
    Holder() {
        this.data = new int[]{1,2,3};
        // freeze action — після цього інші потоки бачать data ініціалізованим
        // АЛЕ якщо this опубліковано в статичне поле раніше — гарантія порушена
    }
}
```

**Acquire / Release семантика** (J9+ через `VarHandle`):

```java
private static final VarHandle V;
static {
    try { V = MethodHandles.lookup().findVarHandle(MyClass.class, "x", int.class); }
    catch (Exception e) { throw new Error(e); }
}
int v = (int) V.getAcquire(this);   // LoadLoad + LoadStore
V.setRelease(this, 42);             // StoreStore + LoadStore
V.compareAndSet(this, 0, 1);        // повний fence (як volatile)
```

Слабші режими (`getOpaque`, `getPlain`) — для дуже нішевих оптимізацій. У 99% коду — `volatile` достатньо.

---

## 15.2 Cache lines, false sharing

CPU читає памʼять блоками по **64 байти** (cache line). Якщо два потоки оновлюють поля, що лежать в одній лінії — кожен запис інвалідує лінію в чужому L1 → колосальний slowdown ("false sharing").

**Симптом:** низька утилізація CPU, перфоманс деградує лінійно з кількістю потоків.

**Лікування:**

```java
// Java 8+ : @Contended вирівнює поле/клас по cache line
@jdk.internal.vm.annotation.Contended
class Counter {
    volatile long value;
}
// Запуск з -XX:-RestrictContended (з Java 9 — exported only)
```

Без `@Contended` — ручний padding:
```java
class PaddedCounter {
    public volatile long value;
    public long p1, p2, p3, p4, p5, p6, p7;  // 56 байт паддингу
}
```

`LongAdder` уже використовує `@Contended` для кожної комірки.

---

## 15.3 Як `synchronized` реалізовано всередині

Кожен Object має **mark word** в заголовку (8 байт на 64-bit):

| Стан | Що зберігається у mark word |
|---|---|
| **Biased** (Java < 15) | thread id + epoch |
| **Lightweight** | вказівник на displaced mark у стеку власника |
| **Heavyweight** | вказівник на `ObjectMonitor` (queue, owner, recursion) |

**Lock inflation** — при contention lock «надувається» з lightweight у heavyweight. Це доросла структура з чергами очікування й wait set.

З Java 15 **biased locking deprecated** і за замовчуванням вимкнений (`-XX:-UseBiasedLocking`) — оскільки сучасні JVM з тяжкими CAS-операціями отримують від нього мало вигоди, а pause-time стрибки помітні.

**Висновок:** не покладайся на «дешевизну» `synchronized` без contention. Для гарячих ділянок використовуй `LongAdder`, `StampedLock` (optimistic) або lock-free структури.

---

## 15.4 ReentrantLock vs synchronized — таблиця

| Властивість | `synchronized` | `ReentrantLock` |
|---|---|---|
| Reentrant | ✅ | ✅ |
| Auto-release on exception | ✅ (JVM `monitorexit`) | ❌ (потрібен `try { } finally { unlock() }`) |
| `tryLock()` | ❌ | ✅ |
| `tryLock(timeout)` | ❌ | ✅ |
| Перерване очікування (`lockInterruptibly`) | ❌ | ✅ |
| Fair mode (FIFO) | ❌ | ✅ (`new ReentrantLock(true)`) |
| Декілька умов (`Condition`) | ❌ (одна wait set) | ✅ (багато `newCondition()`) |
| Sees by JFR / `jstack` | ✅ дуже добре | ✅ (з Java 11+) |
| Працює з Virtual Threads | пінить carrier | ✅ паркує без піну (preferred!) |

---

## 15.5 Virtual Threads — як вони працюють

**Continuation** — обʼєкт, що містить захоплений stack потоку. Коли VT блокується на I/O або `LockSupport.park`, JVM **демонтує** його з carrier thread (записує stack у heap у `Continuation.stack`) і carrier стає вільним для іншого VT.

**Carrier thread** — звичайний platform thread з `ForkJoinPool` (`-Djdk.virtualThreadScheduler.parallelism`, default = `Runtime.availableProcessors()`).

**Pinning** — VT неможливо демонтувати, тому carrier «пінується»:
1. Усередині `synchronized` блоку (до Java 24 — JEP 491 знімає це обмеження).
2. Усередині native-методу (JNI).
3. Усередині `Object.wait()`.

Як знайти pinning:
```bash
-Djdk.tracePinnedThreads=full   # повний stack trace кожного pinning
-Djdk.tracePinnedThreads=short  # лише фрейм, що пінить
```

**Best practices для VT:**
- Не пулити (`Executors.newVirtualThreadPerTaskExecutor()`).
- Уникати `synchronized` для довгих операцій → замінити на `ReentrantLock`.
- `ThreadLocal` — обережно: на 1 М VT вони помножуються. Краще `ScopedValue` (Java 21+ preview).
- Не ставити VT в `ForkJoinPool.commonPool()` — це «карусель».
- Для CPU-bound — звичайні platform threads.

```java
try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
    var user = scope.fork(() -> userService.fetch(id));
    var orders = scope.fork(() -> orderService.fetch(id));
    scope.join().throwIfFailed();
    return new Aggregate(user.get(), orders.get());
}
// При exception в одній — друга автоматично скасовується
```

---

## 15.6 ScopedValue vs ThreadLocal

`ThreadLocal` проблеми:
- Немає очищення → витоки в пулі.
- Помножується на кількість потоків (для 1 М VT — мільйон копій).
- Mutable — складно міркувати.

`ScopedValue` (JEP 446, preview в 21):
```java
private static final ScopedValue<User> USER = ScopedValue.newInstance();

ScopedValue.where(USER, currentUser).run(() -> {
    // тут USER.get() поверне currentUser
    // після виходу — гарантовано очищується
});
```

Властивості:
- **Immutable** в межах scope.
- **Inherited** в дочірні `StructuredTaskScope.fork()` без копіювання.
- Дешевше за `ThreadLocal` для VT.

---

## 15.7 ForkJoinPool — work stealing деталі

Кожен worker має **подвійну чергу (deque)**:
- Свої задачі — push/pop з вершини (LIFO, кеш-friendly).
- Чужі красти — з низу (FIFO).

Це мінімізує contention: власник майже завжди працює зі своєю чергою, а злодії приходять з протилежного боку.

**Submission queue** (зовнішні `submit`) — окрема, по кругу.

**Common pool** (`ForkJoinPool.commonPool()`):
- Default size = `availableProcessors() - 1`.
- Використовується parallel streams, `CompletableFuture.xxxAsync` без executor.
- ❌ Не блокуй у ньому → залишишся без потоків для інших задач.
- Розмір налаштовується: `-Djava.util.concurrent.ForkJoinPool.common.parallelism=N`.

**`ManagedBlocker`** — спосіб сказати ForkJoinPool «я зараз заблокуюсь, створи додатковий compensation thread»:
```java
ForkJoinPool.managedBlock(new ManagedBlocker() {
    public boolean block() throws InterruptedException {
        Thread.sleep(1000); return true;
    }
    public boolean isReleasable() { return false; }
});
```

---

## 15.8 CompletableFuture — підводні камені

```java
CompletableFuture
  .supplyAsync(this::loadUser)         // у commonPool!
  .thenApply(this::enrich)             // у тому ж потоці, що завершив supplyAsync
  .thenApplyAsync(this::format, exec)  // у явному executor
  .exceptionallyCompose(ex ->
      CompletableFuture.completedFuture(fallback))
  .orTimeout(2, TimeUnit.SECONDS)
  .whenComplete((res, err) -> log(res, err));
```

**Грабли:**
1. `supplyAsync` без явного executor → `commonPool` → можна задушити stream.
2. `thenApply` ≠ `thenApplyAsync`. Без `Async` функція виконається в потоці-завершувачу попередньої стадії (часто це ваш HTTP I/O thread!).
3. `get()` без timeout → вічне блокування.
4. `cancel(true)` **не** перериває в тому сенсі, як у `Future`: всередині не йде `Thread.interrupt()`, просто вершина «обривається».
5. `exceptionally` отримує **`CompletionException`** з обгорткою. Розгортай: `ex.getCause()`.
6. `allOf().join()` — викине лише першу помилку, інші — у `getSuppressed()`.
7. `supplyAsync(... , virtualThreadExecutor)` — гарне поєднання з VT для I/O.

```java
// Patterns
CompletableFuture<List<User>> all = CompletableFuture
  .allOf(f1, f2, f3)
  .thenApply(v -> Stream.of(f1, f2, f3).map(CompletableFuture::join).toList());
```

---

## 15.9 Reactor (Project Reactor) vs Virtual Threads

| | Reactor / WebFlux | Virtual Threads |
|---|---|---|
| Стиль | reactive (callbacks, operators) | imperative (синхронний код) |
| Backpressure | вбудовано (`request(n)`) | ❌ — потрібно вручну |
| Debug | складно (stack traces «розрізані») | ✅ як звичайний thread |
| Інтеграція з legacy | ❌ blocking-libs ламають event loop | ✅ блокування дешеве |
| Перевага | високий throughput, granular control, streaming, SSE | простота, читабельність, низький cognitive load |

З Java 21+ для більшості CRUD-сервісів **VT > Reactor**: простіший код, ті самі гарантії throughput для I/O-bound. Reactor лишається для streaming, backpressure-критичних і реактивних архітектур (Kafka Reactor, R2DBC + операції потокової обробки).

---

## 15.10 Phaser, Exchanger — рідкісні, але корисні

**`Phaser`** — гнучкий barrier, де кількість учасників може мінятися динамічно:
```java
Phaser phaser = new Phaser(1);  // sentinel
for (int i = 0; i < workers; i++) {
    phaser.register();
    new Thread(() -> {
        doPhase1();
        phaser.arriveAndAwaitAdvance();  // фаза 1 -> 2
        doPhase2();
        phaser.arriveAndDeregister();
    }).start();
}
phaser.arriveAndDeregister();
```

**`Exchanger<V>`** — точка обміну значеннями між двома потоками:
```java
Exchanger<Buffer> ex = new Exchanger<>();
// producer: ex.exchange(fullBuffer);
// consumer: ex.exchange(emptyBuffer);
```

---

## 15.11 Lock-free / wait-free — коли і як

**Lock-free**: хоча б один потік завжди прогресує. **Wait-free**: кожен потік прогресує за обмежену кількість кроків.

Java інструменти:
- `Atomic*` (CAS).
- `ConcurrentLinkedQueue` (Michael & Scott algorithm).
- `ConcurrentSkipListMap` (lock-free skip list).

Власну lock-free структуру писати **дуже** складно. ABA, memory ordering, retry budget, livelock — спеціалізована тема. Зазвичай — переиспользуй готове.

**Pattern: optimistic retry**
```java
while (true) {
    Node curr = head.get();
    Node next = new Node(value, curr);
    if (head.compareAndSet(curr, next)) return;
    // backoff
}
```

---

## 15.12 ThreadPoolExecutor — production-ready конфіг

```java
int cores = Runtime.getRuntime().availableProcessors();
ThreadPoolExecutor pool = new ThreadPoolExecutor(
    cores,                                     // core
    cores * 2,                                 // max
    60L, TimeUnit.SECONDS,                     // keepAlive
    new ArrayBlockingQueue<>(1000),            // BOUNDED!
    new ThreadFactoryBuilder()
        .setNameFormat("orders-%d")
        .setUncaughtExceptionHandler((t, e) -> log.error("uncaught in {}", t, e))
        .build(),
    new ThreadPoolExecutor.CallerRunsPolicy()  // backpressure: захопить producer thread
);
pool.allowCoreThreadTimeOut(true);
```

**Чому `CallerRunsPolicy`** — коли черга повна, новий submit виконується в потоці submitter'а → природний backpressure (HTTP-обробник зупиняється, його `accept()` гальмується).

**Метрики через Micrometer:**
```java
ExecutorServiceMetrics.monitor(meterRegistry, pool, "orders-pool");
```

---

## 15.13 Pitfalls — топ-10

1. `Executors.newCachedThreadPool()` без обмеження → unbounded threads → OOM native.
2. `Executors.newFixedThreadPool()` з `LinkedBlockingQueue(Integer.MAX)` → unbounded queue → heap OOM.
3. `CompletableFuture.supplyAsync(...)` без executor → `commonPool`.
4. `ConcurrentHashMap` + `synchronized` поверх → втрата сенсу.
5. `synchronized(map)` коли map це `ConcurrentHashMap` → false sense of safety.
6. `volatile` для `++` → не атомарно.
7. `double-check locking` без `volatile` → ламається на JIT-reordering.
8. `Thread.sleep` у `synchronized` блоці → блокує всіх.
9. `ThreadLocal` без `remove()` у пулі → витік + крос-контекст.
10. `Future.get()` без timeout у HTTP-handler → потенційне DoS.

---

## 15.14 Метрики потоків у проді

| Метрика | Як знімати | Що означає |
|---|---|---|
| `jvm.threads.live` | Micrometer `JvmThreadMetrics` | загальна кількість потоків |
| `jvm.threads.daemon` | те саме | daemon-потоки |
| `executor.active` | `ExecutorServiceMetrics` | активні в пулі |
| `executor.queued` | те саме | у черзі |
| `executor.completed` | те саме | rate |
| `executor.rejected` | counter | bad signal — backpressure не справляється |

Алерти:
- `rejected > 0` — підняти capacity або зменшити upstream.
- `queued` росте лінійно — bottleneck.
- `live > N * cores` для CPU-bound — context switching > роботи.

---

## 15.15 Чек-ліст для Senior на інтерв’ю

- ✅ Зможеш пояснити happens-before на пальцях.
- ✅ Знаєш різницю між `getAcquire`/`setRelease`/`getVolatile`.
- ✅ Розумієш false sharing і `@Contended`.
- ✅ Можеш накидати producer/consumer на `BlockingQueue` за хвилину.
- ✅ Розумієш VT pinning і як його виявити.
- ✅ Можеш порівняти Reactor і VT з аргументацією.
- ✅ Знаєш топ-3 пастки `CompletableFuture`.
- ✅ Налаштовуєш `ThreadPoolExecutor` правильно (bounded + backpressure).
