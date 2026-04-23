# 4. Concurrency & Multithreading — детально

> Самый "валящий" блок на сеньорских интервью. Изучи особенно тщательно.

## 4.1 Процессы vs потоки

- **Процесс** — изолированное адресное пространство, ресурсы ОС. Дорогой context switch.
- **Поток** — единица исполнения внутри процесса, общая память (heap), но свой стек, свой PC.
- В Java каждый `Thread` — это нативный OS thread (до Java 21). С Java 21 есть **virtual threads** — лёгкие пользовательские потоки.

### Состояния потока (`Thread.State`)
- `NEW` — создан, не стартовал.
- `RUNNABLE` — выполняется или готов выполняться (ОС-планировщик решает).
- `BLOCKED` — ждёт монитор (`synchronized`).
- `WAITING` — `wait()`, `join()`, `LockSupport.park()` — без таймаута.
- `TIMED_WAITING` — то же с таймаутом, `sleep`.
- `TERMINATED` — завершился.

## 4.2 Создание потоков

```java
new Thread(() -> work()).start();          // Runnable
FutureTask<Integer> ft = new FutureTask<>(() -> 42);   // Callable
new Thread(ft).start();
```

В реальном коде — **никогда не создавай голые `Thread`**. Используй `ExecutorService`.

## 4.3 Java Memory Model (JMM)

JMM описывает, какие гарантии видимости и упорядочения операций между потоками даёт JVM.

### Ключевое: happens-before

Если действие A *happens-before* B, то результаты A гарантированно видимы и упорядочены раньше B. Создаётся через:

- **Program order** в одном потоке.
- **Monitor lock**: `unlock(m)` happens-before `lock(m)` для того же монитора.
- **`volatile`**: запись в `volatile` happens-before последующего чтения **этой же** переменной.
- **`Thread.start()`** happens-before любых действий в стартуемом потоке.
- Все действия потока happens-before `Thread.join()` на нём.
- `Thread.interrupt()` happens-before обнаружения interrupt.
- Завершение конструктора happens-before финализации (исторически).
- **Final fields** — после нормального завершения конструктора финальные поля гарантированно видны другим потокам.
- Транзитивность: A→B, B→C ⇒ A→C.

Без happens-before компилятор/CPU могут переупорядочивать операции, и другой поток увидит частично-инициализированное состояние.

### `volatile`
- Гарантирует **видимость** (запись напрямую в main memory, чтение оттуда же).
- Запрещает переупорядочение вокруг (memory barriers).
- **Не атомарен** для составных операций (`counter++` всё ещё race).
- Идеально для флагов (`volatile boolean stopped`) и double-checked locking.

### Double-checked locking (правильный)
```java
private volatile Singleton instance;
public Singleton get() {
    Singleton local = instance;
    if (local == null) {
        synchronized (this) {
            local = instance;
            if (local == null) instance = local = new Singleton();
        }
    }
    return local;
}
```
Без `volatile` — баг: другой поток может увидеть ссылку до завершения конструктора.

## 4.4 `synchronized`

- **Внутренний (intrinsic) лок** — у каждого объекта.
- **Метод инстанса** — лок на `this`.
- **Static метод** — лок на `Class<T>`.
- **Блок** — лок на указанном объекте: `synchronized(lock) { ... }`.
- **Reentrant** — один и тот же поток может войти повторно.
- При выходе из synchronized-блока (нормальном или через исключение) лок освобождается.

**На чём лочиться:** на **private final** объекте, не на `this` и не на `String`/`Integer` (могут шариться).

## 4.5 wait / notify / notifyAll

- Только в `synchronized`-блоке на том же мониторе.
- `wait()` отпускает лок и блокирует поток до `notify`/`notifyAll`/interrupt/spurious wakeup.
- Всегда в цикле: `while (!condition) lock.wait();`
- `notify` — будит один (любой) поток; `notifyAll` — все. На практике почти всегда нужен `notifyAll` (или используй `Condition`).

В современном коде — **используй `Lock` + `Condition`** или high-level примитивы.

## 4.6 java.util.concurrent

### `Executor` / `ExecutorService` / `ScheduledExecutorService`

```java
ExecutorService es = Executors.newFixedThreadPool(8);
Future<Integer> f = es.submit(() -> heavy());
Integer result = f.get();           // блокирует
es.shutdown();                      // graceful: не принимает новые, ждёт текущие
es.shutdownNow();                   // прерывает текущие
```

**Виды пулов из `Executors`:**
- `newFixedThreadPool(n)` — `n` потоков, `LinkedBlockingQueue` без ограничения. Очередь может разрастаться → **OOM**.
- `newCachedThreadPool` — `SynchronousQueue`, без ограничения числа потоков. Может создать тысячи потоков → краш.
- `newSingleThreadExecutor` — один поток, очередь без ограничения.
- `newScheduledThreadPool` — задержки/расписание.

**Предпочтительно** — собирать `ThreadPoolExecutor` напрямую:
```java
new ThreadPoolExecutor(
    core, max, keepAlive, TimeUnit.SECONDS,
    new ArrayBlockingQueue<>(1000),
    new CustomThreadFactory("worker"),
    new ThreadPoolExecutor.CallerRunsPolicy()    // backpressure
);
```
Стратегии rejection: `Abort` (default, кидает), `Discard`, `DiscardOldest`, `CallerRuns`.

### `Future` vs `CompletableFuture`

- `Future`: `get()` блокирует, `cancel`, `isDone`. Нельзя цепочки и комбинации.
- `CompletableFuture` (Java 8) — мощная композиция:

```java
CompletableFuture
    .supplyAsync(() -> fetchUser(id), executor)
    .thenApply(User::getName)                    // sync transform
    .thenComposeAsync(name -> loadProfile(name)) // chain async
    .thenCombine(other, (a,b) -> a + b)
    .exceptionally(ex -> "fallback")
    .whenComplete((res, ex) -> log(res, ex));

CompletableFuture.allOf(f1, f2, f3).join();
CompletableFuture.anyOf(f1, f2, f3).join();
```

`thenApply` vs `thenApplyAsync`:
- `thenApply` — на потоке, который **завершил предыдущий этап**.
- `thenApplyAsync` — на пуле (commonPool по умолчанию или указанном).

### Атомики и CAS

CAS (`Compare-And-Swap`) — атомарная инструкция CPU `compareAndSet(expected, new)`. Если текущее значение == expected → меняем на new и возвращаем true; иначе false.

```java
AtomicInteger counter = new AtomicInteger(0);
counter.incrementAndGet();                    // лок-фри
counter.updateAndGet(x -> x * 2);
counter.compareAndSet(10, 20);
```

Семейство: `AtomicInteger`, `AtomicLong`, `AtomicBoolean`, `AtomicReference<T>`, `AtomicIntegerArray`, `AtomicReferenceArray`.

**ABA-проблема**: значение поменялось A → B → A; CAS думает, что не менялось. Решение — `AtomicStampedReference` (значение + версия).

**`LongAdder` / `LongAccumulator`** — high-contention счётчики. Внутри массив "ячеек" (по потокам), при чтении сумма. Быстрее `AtomicLong` под нагрузкой, но `sum()` неточен в момент чтения.

### Locks

- **`ReentrantLock`** — аналог `synchronized`, но:
  - `tryLock()`, `tryLock(timeout)` — не блокирующее взятие.
  - `lockInterruptibly()` — реагирует на interrupt.
  - **Fair** режим (FIFO) — медленнее, но без starvation.
  - `Condition` — несколько condition queue (можно `notFull`, `notEmpty` отдельно).

  ```java
  Lock l = new ReentrantLock();
  l.lock();
  try { ... } finally { l.unlock(); }
  ```

- **`ReentrantReadWriteLock`** — много читателей или один писатель. `readLock`/`writeLock`. Можно даунгрейдить write→read, но не наоборот.
- **`StampedLock`** (Java 8) — лучший throughput для read-heavy. Optimistic read: `tryOptimisticRead()` → читаем → `validate(stamp)`. Не reentrant!

### Синхронизаторы

- **`CountDownLatch`** — одноразовый счётчик. `await()` блокирует, пока `countDown()` не дойдёт до 0. Не сбрасывается.
- **`CyclicBarrier`** — потоки ждут друг друга в "точке встречи". Сбрасывается, можно с `barrierAction`.
- **`Semaphore`** — N разрешений, `acquire()`/`release()`. Для лимитов параллелизма (rate limiter, connection pool).
- **`Phaser`** — гибкий многоуровневый барьер с динамическим числом участников.
- **`Exchanger`** — обмен данными между двумя потоками.

### Concurrent коллекции

- `ConcurrentHashMap` — см. главу про коллекции. Атомарные `compute`, `merge`, `forEach`.
- `CopyOnWriteArrayList`/`Set` — read-heavy.
- `ConcurrentLinkedQueue/Deque` — лок-фри (Michael-Scott).
- `BlockingQueue` — для producer/consumer.
- `ConcurrentSkipListMap`/`Set` — сортированный concurrent (аналог `TreeMap`).

## 4.7 Проблемы многопоточности

- **Race condition** — результат зависит от порядка выполнения. Решается синхронизацией / атомиками / immutability.
- **Deadlock** — два потока ждут лок друг друга. Решения:
  - Порядок взятия локов (всегда A, потом B).
  - `tryLock(timeout)`.
  - Lock striping.
- **Livelock** — потоки реагируют друг на друга, но не двигаются.
- **Starvation** — поток не получает CPU/лок (низкий приоритет, fair-режим помогает).

### Безопасная публикация

Чтобы другой поток увидел созданный объект **полностью инициализированным**, ссылка должна быть опубликована безопасно:
- через `volatile` поле,
- через `final` поле (после конструктора),
- через `synchronized`,
- через статический инициализатор,
- через concurrent-коллекцию.

Иначе возможен "частично-инициализированный объект".

### Immutable объекты

Immutable объекты безопасны по умолчанию — никаких локов не нужно. Правила:
1. `final class`.
2. Все поля `private final`.
3. Без сеттеров, без методов, меняющих состояние.
4. Defensive copy для mutable аргументов в конструкторе и геттерах.

## 4.8 ThreadLocal

Каждое значение привязано к потоку. Реализация: внутри `Thread` есть `ThreadLocalMap`, ключ — слабая ссылка на сам `ThreadLocal`.

**Опасность утечек памяти в пулах:** поток живёт долго, значение не очищается. Всегда вызывай `threadLocal.remove()` в `finally`.

`InheritableThreadLocal` — наследуется при создании дочернего потока. С virtual threads — `ScopedValue` (Java 21).

## 4.9 Virtual Threads (Java 21, Project Loom)

- Управляются JVM, монтируются на небольшое число "carrier" платформенных потоков.
- Лёгкие — миллионы virtual threads возможны.
- Идеальны для **blocking I/O** — блокировка virtual thread не блокирует carrier (JVM "размонтирует" его).
- НЕ ускоряют CPU-bound задачи.
- НЕ нужно их пулить — `Executors.newVirtualThreadPerTaskExecutor()` или `Thread.ofVirtual().start(...)`.
- **`synchronized` пиннит** virtual thread к carrier — лучше использовать `ReentrantLock`.

С Loom во многих случаях можно вернуться к простому imperative blocking коду и не использовать reactive (WebFlux), сохраняя scalability.

## 4.10 Часто спрашивают

- Чем `volatile` отличается от `synchronized`?
- Что такое happens-before?
- Что такое CAS, ABA, как решается?
- Чем `LongAdder` лучше `AtomicLong`?
- Когда `ReentrantLock` лучше `synchronized`? (timeout, interruptible, fair, condition).
- Чем `CountDownLatch` отличается от `CyclicBarrier`?
- Как избежать deadlock?
- Чем `thenApply` отличается от `thenApplyAsync`?
- Опасности `Executors.newCachedThreadPool` и `newFixedThreadPool` в проде.
- Что произойдёт, если в `synchronized` методе бросить исключение? (Лок отпустится.)
- Зачем `wait` в цикле `while`? (spurious wakeup, condition мог измениться).
- Что такое virtual threads и когда их использовать?
- Почему `String` и `Integer` плохой выбор для лока?
- Объясни, почему `i++` не атомарен (read-modify-write).
- Как реализовать producer-consumer? (`BlockingQueue`).


---

# Дополнительные темы Concurrency (продолжение)

## 4.11 Полный пример producer/consumer

```java
public class WorkPipeline {
    private final BlockingQueue<Job> queue = new ArrayBlockingQueue<>(1000);
    private final ExecutorService consumers = Executors.newFixedThreadPool(4);
    private volatile boolean running = true;

    public void start() {
        for (int i = 0; i < 4; i++) {
            consumers.submit(this::consume);
        }
    }

    public void submit(Job j) throws InterruptedException {
        queue.put(j);                              // блокирует, если очередь полная
    }

    private void consume() {
        while (running || !queue.isEmpty()) {
            try {
                Job j = queue.poll(1, TimeUnit.SECONDS);
                if (j != null) process(j);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();   // КРИТИЧНО: восстанови флаг
                return;
            } catch (Exception e) {
                log.error("processing error", e);
            }
        }
    }

    public void shutdown() throws InterruptedException {
        running = false;
        consumers.shutdown();
        if (!consumers.awaitTermination(30, TimeUnit.SECONDS)) {
            consumers.shutdownNow();
        }
    }
}
```

**Ключевое:**
- `Thread.currentThread().interrupt()` восстанавливает interrupted-флаг после `InterruptedException`. Иначе вышестоящий код не узнает о прерывании.
- `shutdown()` + `awaitTermination()` + `shutdownNow()` — стандартный graceful shutdown.

## 4.12 Пример deadlock и его предотвращения

```java
// ❌ Deadlock: thread A берёт lockA → ждёт lockB; B берёт lockB → ждёт lockA
class TransferBuggy {
    void transfer(Account from, Account to, long amount) {
        synchronized (from) {
            synchronized (to) {
                from.debit(amount);
                to.credit(amount);
            }
        }
    }
}

// ✅ Решение 1: упорядочить локи (например, по id)
class TransferOrdered {
    void transfer(Account from, Account to, long amount) {
        Account first  = from.id() < to.id() ? from : to;
        Account second = from.id() < to.id() ? to   : from;
        synchronized (first) {
            synchronized (second) {
                from.debit(amount);
                to.credit(amount);
            }
        }
    }
}

// ✅ Решение 2: tryLock с таймаутом
class TransferTryLock {
    void transfer(Account from, Account to, long amount) throws InterruptedException {
        while (true) {
            if (from.lock.tryLock(1, TimeUnit.SECONDS)) {
                try {
                    if (to.lock.tryLock(1, TimeUnit.SECONDS)) {
                        try {
                            from.debit(amount);
                            to.credit(amount);
                            return;
                        } finally { to.lock.unlock(); }
                    }
                } finally { from.lock.unlock(); }
            }
        }
    }
}
```

## 4.13 Detection deadlock

`jstack <pid>` — JVM сама определит "Found one Java-level deadlock".

```
Found one Java-level deadlock:
=============================
"Thread-A":
  waiting to lock monitor 0x... (object 0x..., a Account),
  which is held by "Thread-B"
"Thread-B":
  waiting to lock monitor 0x... (object 0x..., a Account),
  which is held by "Thread-A"
```

## 4.14 ABA-проблема — детально

```java
AtomicReference<Node> head = new AtomicReference<>(nodeA);

// Thread T1 читает head → nodeA, готовится сделать CAS(nodeA, newNode)
// Thread T2 за это время:
//   1. удаляет nodeA, head = nodeB
//   2. удаляет nodeB, head = nodeA  (тот же объект! или новый с тем же значением)
// Thread T1 делает CAS(nodeA, newNode) — успешно! Но логически состояние другое.
```

Решение: **`AtomicStampedReference`** — пара (значение, версия), CAS на оба:

```java
AtomicStampedReference<Node> head = new AtomicStampedReference<>(nodeA, 0);

int[] stampHolder = new int[1];
Node current = head.get(stampHolder);
int stamp = stampHolder[0];

// делаем работу...

head.compareAndSet(current, newNode, stamp, stamp + 1);  // CAS на пару
```

## 4.15 ThreadLocal — пример и ловушки

```java
private static final ThreadLocal<SimpleDateFormat> FMT =
    ThreadLocal.withInitial(() -> new SimpleDateFormat("yyyy-MM-dd"));

String s = FMT.get().format(new Date());
```

В пуле потоков значение живёт между задачами:

```java
// ❌ Утечка: значение остаётся после задачи
executor.submit(() -> {
    USER_CONTEXT.set(loadUser(req));
    process();
});

// ✅ Очищай в finally
executor.submit(() -> {
    USER_CONTEXT.set(loadUser(req));
    try { process(); }
    finally { USER_CONTEXT.remove(); }
});
```

`InheritableThreadLocal` — наследуется при создании дочернего потока. С virtual threads — `ScopedValue` (Java 21+).

## 4.16 ExecutorService — production-ready конфиг

```java
ThreadPoolExecutor pool = new ThreadPoolExecutor(
    /* corePoolSize  */ 8,
    /* maximumPool   */ 16,
    /* keepAlive     */ 60L, TimeUnit.SECONDS,
    /* workQueue     */ new ArrayBlockingQueue<>(1000),    // bounded! защищает от OOM
    /* threadFactory */ new ThreadFactoryBuilder()
        .setNameFormat("worker-%d")
        .setUncaughtExceptionHandler((t, e) -> log.error("uncaught", e))
        .build(),
    /* rejection     */ new ThreadPoolExecutor.CallerRunsPolicy()  // backpressure
);
```

**Стратегии rejection:**
- `AbortPolicy` (default) — `RejectedExecutionException`.
- `CallerRunsPolicy` — выполняет задачу в потоке-вызывающем (естественный backpressure).
- `DiscardPolicy` — молча отбрасывает.
- `DiscardOldestPolicy` — отбрасывает старейшую в очереди и пробует снова.

**Размер пула:**
- CPU-bound: `cores + 1`.
- IO-bound: `cores * (1 + W/C)` где W — время ожидания, C — время вычислений. Часто десятки потоков.

## 4.17 CompletableFuture — полные примеры

```java
// Простой async
CompletableFuture<User> userFuture = CompletableFuture
    .supplyAsync(() -> loadUser(id), executor);

// Цепочка
CompletableFuture<String> pipeline = CompletableFuture
    .supplyAsync(() -> loadUser(id), executor)             // загрузить юзера
    .thenApply(User::name)                                  // получить имя
    .thenCompose(name -> CompletableFuture                  // загрузить профиль (async)
        .supplyAsync(() -> loadProfile(name), executor))
    .thenCombine(loadStatsAsync(id), (profile, stats) ->    // объединить
        profile.toString() + " " + stats);

// Параллельные
CompletableFuture<Void> all = CompletableFuture.allOf(f1, f2, f3);
all.thenRun(() -> log.info("all done"));

CompletableFuture<List<Result>> resultList = all.thenApply(v ->
    Stream.of(f1, f2, f3).map(CompletableFuture::join).toList());

// Обработка ошибок
future
    .thenApply(this::transform)
    .exceptionally(ex -> fallback)                          // ловит и возвращает значение
    .handle((res, ex) -> ex == null ? res : null)           // ловит обе ветки
    .whenComplete((res, ex) -> log.info("done"));           // не меняет результат

// Timeout (Java 9+)
future.orTimeout(5, TimeUnit.SECONDS);
future.completeOnTimeout(defaultValue, 5, TimeUnit.SECONDS);
```

### `thenApply` vs `thenApplyAsync`

```java
CompletableFuture.supplyAsync(this::load)         // в commonPool
    .thenApply(this::transform)                   // в том же потоке (load)
    .thenApplyAsync(this::store, executor);       // в указанном пуле
```

## 4.18 ForkJoinPool

Используется параллельными стримами и `CompletableFuture` (по умолчанию commonPool).

- **Work-stealing** — поток без работы крадёт задачи из очереди другого потока.
- Идеален для задач "разделяй и властвуй".
- `RecursiveTask<V>` (с результатом) / `RecursiveAction` (без).

```java
class SumTask extends RecursiveTask<Long> {
    private final long[] arr; private final int from, to;
    SumTask(long[] arr, int from, int to) { ... }
    @Override protected Long compute() {
        if (to - from < 1000) {
            long s = 0;
            for (int i = from; i < to; i++) s += arr[i];
            return s;
        }
        int mid = (from + to) >>> 1;
        SumTask left  = new SumTask(arr, from, mid);
        SumTask right = new SumTask(arr, mid,  to);
        left.fork();
        return right.compute() + left.join();
    }
}
ForkJoinPool.commonPool().invoke(new SumTask(arr, 0, arr.length));
```

## 4.19 Locks — углублённо

### `ReentrantLock` с `Condition`

```java
Lock lock = new ReentrantLock();
Condition notFull  = lock.newCondition();
Condition notEmpty = lock.newCondition();

void put(T item) throws InterruptedException {
    lock.lock();
    try {
        while (queue.size() == capacity) notFull.await();
        queue.add(item);
        notEmpty.signal();
    } finally { lock.unlock(); }
}

T take() throws InterruptedException {
    lock.lock();
    try {
        while (queue.isEmpty()) notEmpty.await();
        T item = queue.remove();
        notFull.signal();
        return item;
    } finally { lock.unlock(); }
}
```

`await` всегда в `while`, не в `if` — спасает от spurious wakeups и от того, что условие могло измениться к моменту wakeup.

### `StampedLock` — оптимистичное чтение

```java
StampedLock sl = new StampedLock();

double distanceFromOrigin() {
    long stamp = sl.tryOptimisticRead();
    double cx = x, cy = y;             // читаем без блокировки
    if (!sl.validate(stamp)) {         // если кто-то писал — fallback
        stamp = sl.readLock();
        try { cx = x; cy = y; }
        finally { sl.unlockRead(stamp); }
    }
    return Math.sqrt(cx * cx + cy * cy);
}
```

Очень быстрое чтение, когда писатели редки. **Не reentrant!**

## 4.20 Synchronizers — короткие примеры

### `CountDownLatch` — ждать пока N задач не завершится

```java
CountDownLatch latch = new CountDownLatch(N);
for (int i = 0; i < N; i++) {
    executor.submit(() -> {
        try { doWork(); }
        finally { latch.countDown(); }
    });
}
latch.await();          // блокирует до countDown == 0
```

Одноразовый. После 0 — нельзя сбросить.

### `CyclicBarrier` — точка встречи

```java
CyclicBarrier barrier = new CyclicBarrier(N, () -> log.info("all reached"));
// в каждом потоке:
barrier.await();        // ждём всех N
// сбрасывается автоматически, можно использовать снова
```

### `Semaphore` — лимит конкурентности

```java
Semaphore permits = new Semaphore(10);

void downloadFile(URL url) throws InterruptedException {
    permits.acquire();
    try { /* не более 10 одновременных загрузок */ }
    finally { permits.release(); }
}
```

## 4.21 Virtual Threads — детально (Java 21)

```java
// Создание
Thread.ofVirtual().start(() -> ...);
Thread.ofVirtual().name("handler").start(() -> ...);

// Executor — каждый submit создаёт отдельный virtual thread
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    for (int i = 0; i < 1_000_000; i++) {
        executor.submit(() -> {
            httpClient.send(req);     // blocking I/O — OK
        });
    }
}
```

**Когда использовать:**
- ✅ Много IO-bound задач (HTTP клиенты, БД, файлы).
- ❌ CPU-bound — не даст ускорения.
- ❌ Ограниченный downstream (БД с пулом 20) — нужен отдельный semaphore.

**Особенности:**
- НЕ нужно их пулить.
- `synchronized` "пиннит" virtual thread к carrier — лучше `ReentrantLock`.
- `ThreadLocal` работает, но из-за миллионов потоков может стать дорогим — переходи на `ScopedValue`.

### Structured Concurrency (preview в Java 21+)

```java
try (var scope = new StructuredTaskScope.ShutdownOnFailure()) {
    Subtask<User>    user    = scope.fork(() -> loadUser(id));
    Subtask<Profile> profile = scope.fork(() -> loadProfile(id));

    scope.join();                  // ждать обе
    scope.throwIfFailed();         // если хоть одна упала — бросить

    return new UserProfile(user.get(), profile.get());
}
```

Преимущество: при отмене/exception в одной — все остальные subtask автоматически отменяются. Гораздо безопаснее голого `CompletableFuture`.

### `ScopedValue` (preview, Java 21+)

Замена `ThreadLocal` для virtual threads:

```java
private static final ScopedValue<User> CURRENT_USER = ScopedValue.newInstance();

ScopedValue.where(CURRENT_USER, user)
    .run(() -> processRequest());

// Внутри:
User u = CURRENT_USER.get();
```

Immutable, не требует `remove()`, дешевле для миллионов потоков.

## 4.22 Безопасная публикация — детально

Сценарий: создал объект в одном потоке, передал в другой → нужно гарантировать видимость **полностью инициализированного** состояния.

Способы:
- Через `volatile` поле.
- Через `final` поле (после конструктора видны все final-поля).
- Через `synchronized` (запись в одном synchronized — чтение в другом synchronized на том же мониторе).
- Через статический инициализатор (он гарантированно happens-before любого использования).
- Через concurrent-коллекцию (`put` happens-before `get` в `ConcurrentHashMap`).

**Что плохо:**
```java
public class Holder { Object obj; }
public class Bad {
    Holder h;
    void init() { h = new Holder(); h.obj = new Object(); }
    void use()  { h.obj.toString(); }     // другой поток может увидеть h != null, но obj == null
}
```

## 4.23 Atomics — детально

```java
AtomicInteger counter = new AtomicInteger();

counter.incrementAndGet();           // ++i, возвращает новое
counter.getAndIncrement();           // i++, возвращает старое
counter.addAndGet(5);
counter.compareAndSet(10, 20);       // CAS

// Atomic update с лямбдой
counter.updateAndGet(x -> x * 2);
counter.accumulateAndGet(5, Integer::sum);

// LongAdder — для high-contention
LongAdder hits = new LongAdder();
hits.increment();                    // лок-фри, по ячейкам на поток
long total = hits.sum();             // приблизительно

// AtomicReference + CAS
AtomicReference<State> ref = new AtomicReference<>(State.INITIAL);
ref.compareAndSet(State.INITIAL, State.RUNNING);
```

## 4.24 Дополнительные частые вопросы

- Зачем `wait()` в цикле, а не в `if`? (Spurious wakeup, изменение условия.)
- Что произойдёт, если в `synchronized`-методе бросить исключение? (Лок отпустится автоматически.)
- Чем `notify` отличается от `notifyAll`? Когда какой?
- Можно ли `wait` без `synchronized`? (Нет — `IllegalMonitorStateException`.)
- Почему нельзя дважды стартовать `Thread`?
- Зачем `Thread.interrupt()`? Как реагировать на InterruptedException?
- Чем `ReentrantLock` лучше `synchronized`?
- Что такое fair lock?
- Чем `ConcurrentHashMap` отличается от `Collections.synchronizedMap`?
- Какие операции в `ConcurrentHashMap` атомарны? (`compute*`, `merge`, `putIfAbsent`.)
- В чём опасность `Executors.newFixedThreadPool` без bounded queue?
- Чем `submit` отличается от `execute`?
- Что вернёт `Future.get()` при interrupt?
- Чем `volatile` гарантирует/не гарантирует?
- Что такое JMM happens-before?
- Что такое safe publication?
- Чем `LongAdder` лучше `AtomicLong`?
- Что произойдёт при `synchronized` на virtual thread? (Pinning к carrier.)
- Как реализовать пул соединений? (Semaphore + BlockingQueue.)
- Чем structured concurrency лучше CompletableFuture?
- Что такое immutable объект и почему он thread-safe by default?
- Когда нужен `volatile` для DCL?
- Чем `CountDownLatch` отличается от `CyclicBarrier`?
- Чем `Semaphore(1)` отличается от `ReentrantLock`? (Семафор не reentrant; владельца не отслеживает.)

