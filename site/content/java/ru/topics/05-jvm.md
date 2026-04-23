# 5. JVM: память, GC, classloading, перформанс

## 5.1 Структура памяти JVM

### Runtime data areas

- **Heap** (общий для всех потоков) — все объекты и массивы.
  - **Young generation**:
    - **Eden** — куда попадают новые объекты.
    - **Survivor S0 / S1** — куда переезжают пережившие минорные сборки.
  - **Old generation (Tenured)** — куда переезжают долгоживущие объекты после нескольких "выживаний" (tenuring threshold, обычно 15).
- **Metaspace** (off-heap, native memory) — метаданные классов (с Java 8 заменил **PermGen**). Растёт без границ по умолчанию (`-XX:MaxMetaspaceSize=...` чтобы ограничить).
- **Stack** (по одному на поток) — фреймы методов: локальные переменные, операнды, ссылка на текущий метод. Размер `-Xss` (default ~512KB-1MB). При переполнении — `StackOverflowError`.
- **PC register** — указатель текущей инструкции.
- **Native method stack** — для JNI-вызовов.
- **Code cache** — JIT-скомпилированный нативный код. Может переполниться (`-XX:ReservedCodeCacheSize`).
- **String pool** — внутри heap (с Java 7).

### Где что живёт

- **Примитивы локальных переменных** — на стеке.
- **Объекты** — на heap (за исключением случаев escape analysis + scalar replacement, когда JIT может разложить объект на локальные переменные на стеке).
- **Поля объекта** — в самом объекте на heap.
- **Static-поля** — в самом `Class`-объекте (на heap, но "корень" GC — ссылки оттуда не собираются).

## 5.2 Garbage Collection

### Поколенческая гипотеза

Эмпирически: большинство объектов умирают молодыми. Поэтому heap делят на молодое и старое поколение, чтобы быстро очищать "недолгожителей".

### Алгоритмы

- **Mark-Sweep** — пометить достижимые → удалить остальное → фрагментация.
- **Mark-Compact** — после mark-sweep компактировать (двигать объекты).
- **Copying** — делим на 2 половины, копируем живых из одной в другую. Используется в Young (S0/S1).
- **Generational** — разные алгоритмы для разных поколений.

### GC в JVM

| GC | Когда |
|---|---|
| **Serial** | Один поток. Маленькие приложения (`-XX:+UseSerialGC`). |
| **Parallel (Throughput)** | Многопоточная stop-the-world сборка. Был дефолтом до Java 9. Хорош для batch / max throughput. |
| **CMS (Concurrent Mark Sweep)** | Конкурентный для Old. **Удалён в Java 14**. |
| **G1 (Garbage First)** | Дефолт с Java 9. Делит heap на регионы (~2048), приоритизирует регионы с большим мусором. Pause time goal: `-XX:MaxGCPauseMillis=200`. |
| **ZGC** | Низкие паузы (<10мс, с Java 17 — sub-ms). Подходит для очень больших heap (TB). С Java 21 — generational. |
| **Shenandoah** | RedHat, аналог ZGC по целям. Concurrent compaction. |
| **Epsilon** | "no-op" GC, для тестов и эфемерных задач. |

### Stop-the-world (STW)

Все application-потоки приостанавливаются. Даже concurrent-сборщики имеют короткие STW-паузы (initial mark, final remark). У ZGC/Shenandoah эти паузы — sub-ms.

### Minor / Major / Full GC

- **Minor GC** — собирает Young. Быстрая, частая, всегда STW.
- **Major / Old GC** — собирает Old.
- **Full GC** — весь heap, обычно STW и долго. Триггер: Metaspace overflow, allocation failure в Old, `System.gc()` (никогда не вызывай).

### Tenuring и Promotion

Объект переезжает Eden → Survivor → Survivor → ... → Old после `MaxTenuringThreshold` циклов. Большие объекты (`PretenureSizeThreshold`) сразу в Old.

### Allocation в TLAB

Каждый поток имеет **TLAB (Thread-Local Allocation Buffer)** в Eden — выделение объекта = bump-pointer (без синхронизации). Очень быстро.

### Reference types

| Тип | Когда собирается |
|---|---|
| **Strong** (обычная ссылка) | никогда, пока ссылка жива |
| **`SoftReference`** | если JVM нужна память (хорошо для memory-sensitive cache) |
| **`WeakReference`** | при следующем GC, если нет сильных ссылок |
| **`PhantomReference`** | после финализации; используется для cleanup-логики (`Cleaner` API) |

`ReferenceQueue` позволяет узнать, что ссылка обработана.

### Утечки памяти в Java (классика)

1. Статические коллекции, в которые добавляют, но не удаляют (`static Map<String, Cache>`).
2. **`ThreadLocal`** в пуле потоков без `remove()`.
3. Незакрытые ресурсы (соединения, потоки, файлы).
4. Listeners/callbacks, которые не отписываются.
5. Внутренние классы, удерживающие ссылку на enclosing instance.
6. ClassLoader leaks (часто в app-серверах при redeploy).
7. Большие ключи без правильного `hashCode` (вырождение в список).

### Симптомы и диагностика

- `OutOfMemoryError: Java heap space` — нет места в heap. Снять heap dump (`-XX:+HeapDumpOnOutOfMemoryError`), проанализировать в Eclipse MAT.
- `OutOfMemoryError: Metaspace` — слишком много загруженных классов (часто dynamic proxies, classloader leak).
- `OutOfMemoryError: GC overhead limit exceeded` — > 98% времени тратится на GC.
- `OutOfMemoryError: unable to create new native thread` — лимит ОС.
- `StackOverflowError` — глубокая/бесконечная рекурсия.

## 5.3 Class loading

### Этапы

1. **Loading** — найти и прочитать `.class`.
2. **Linking**:
   - **Verify** — байткод корректен.
   - **Prepare** — выделить память под static-поля, инициализировать дефолтами.
   - **Resolve** — преобразовать символьные ссылки.
3. **Initialization** — выполнение `<clinit>` (static-инициализаторы и static-поля). Триггеры: `new`, обращение к static-полю/методу, `Class.forName(...)`, инициализация подкласса.

### Иерархия (Java 9+)

```
Bootstrap (нативный, грузит java.base)
  └── Platform (модули JDK)
       └── Application/System (classpath)
            └── Custom (user-defined)
```

**Parent delegation model** — classloader сначала просит родителя загрузить класс, и только если тот не смог — грузит сам. Это защищает core-классы от подмены.

### Зачем кастомные classloader'ы

- Plugin-системы (изоляция плагинов).
- Hot reload (Spring Boot DevTools, OSGi).
- App-серверы (war/ear изолированы).
- Dynamic proxies, ASM/ByteBuddy.

## 5.4 Тулинг

| Утилита | Что делает |
|---|---|
| `jps` | Список Java-процессов |
| `jstack <pid>` | Thread dump |
| `jmap -histo <pid>` | Гистограмма объектов в heap |
| `jmap -dump:format=b,file=heap.hprof <pid>` | Heap dump |
| `jstat -gcutil <pid> 1s` | Статистика GC в реалтайме |
| `jcmd <pid> ...` | Универсальная: GC, JFR, heap dump, native memory |
| `jinfo` | Параметры запуска и system props |
| `jhsdb` | Низкоуровневый отладчик (post-mortem dumps) |

### Профилирование

- **JFR (Java Flight Recorder)** — встроен в JDK, низкий оверхед (< 1%). `jcmd <pid> JFR.start duration=60s filename=rec.jfr`. Анализ — JMC.
- **async-profiler** — sampling-профайлер (CPU, allocation, lock). Низкий оверхед, flame graphs.
- **VisualVM**, **YourKit**, **JProfiler** — графический.
- **Eclipse MAT** — анализ heap dump (доминаторы, retained size, leak suspects).

### Чтение thread dump

- Состояния потоков, на чём блокируются.
- "deadlock found" — JVM сам определяет.
- WAITING на CPU, BLOCKED на мониторе → contention.

## 5.5 JIT и оптимизации

- **Inlining** — подстановка тела метода вместо вызова.
- **Escape analysis** — если объект "не убегает" из метода → можно разложить на стек / скаляры.
- **Lock elision** — если объект не убегает, лок можно убрать.
- **Loop unrolling**, **vectorization (SIMD)**, **dead code elimination**.
- **Speculative inlining** для виртуальных вызовов (с deoptimization, если предположение неверно).

`final` помогает JIT (но не критично).  
`-XX:+PrintCompilation` — что компилируется.  
`-XX:+PrintInlining` — что инлайнится (нужен `-XX:+UnlockDiagnosticVMOptions`).

## 5.6 Полезные флаги

```
-Xms2g -Xmx2g                 # размер heap (фикс. для контейнеров)
-XX:MaxMetaspaceSize=256m
-Xss512k                       # размер стека потока
-XX:+UseG1GC                   # выбор GC (по умолчанию в Java 9+)
-XX:MaxGCPauseMillis=200
-XX:+UseZGC                    # для низких пауз
-XX:+HeapDumpOnOutOfMemoryError
-XX:HeapDumpPath=/dump
-XX:+ExitOnOutOfMemoryError    # упасть, чтобы k8s рестартнул
-XX:NativeMemoryTracking=summary
-XX:+UnlockExperimentalVMOptions
```

В контейнерах JVM с Java 8u191+ корректно учитывает cgroup-лимиты (`-XX:+UseContainerSupport` по умолчанию). Можно ограничить heap процентом: `-XX:MaxRAMPercentage=75.0`.

## 5.7 Часто спрашивают

- Опиши области памяти JVM.
- Где живут примитивы / объекты / static?
- Как работает Young/Old generation?
- Что такое STW? Какие GC дают минимальные паузы?
- Чем G1 отличается от Parallel?
- Что такое ZGC, для чего?
- Чем `Soft` от `Weak` ссылки отличаются?
- Что такое Metaspace и в чём отличие от PermGen?
- Что такое classloader, parent delegation?
- Как снять thread dump? Heap dump?
- Что такое JIT, escape analysis?
- Назови 5 причин утечки памяти в Java.
- Какие OOM ошибки бывают?
- Что произойдёт, если вызвать `System.gc()`?
- Как настроить JVM в контейнере (k8s)?


---

# Дополнительные темы JVM (продолжение)

## 5.8 Полная картина: что происходит при запуске Java-программы

1. **`java -cp ... Main`** запускает JVM (нативный процесс).
2. JVM создаёт runtime-структуры (heap, metaspace, stacks).
3. Bootstrap classloader грузит `java.base` (`java.lang.*`).
4. Platform classloader грузит остальные модули JDK.
5. Application classloader находит `Main.class` в classpath.
6. JVM выполняет linking → init `Main` (включая `static` блоки).
7. Вызывается `Main.main(String[])`.
8. Программа работает: интерпретация → JIT → нативный код.
9. При завершении `main` (если нет non-daemon потоков) — JVM завершается, вызывая shutdown hooks.

## 5.9 Стек vs heap — пример

```java
public void method() {
    int x = 10;                       // примитив на стеке
    User u = new User();              // ссылка u на стеке, объект User на heap
    int[] arr = new int[100];         // ссылка arr на стеке, массив на heap
}                                     // x, u, arr исчезают (фрейм снимается)
                                      // объекты остаются на heap до GC
```

**Escape analysis** (JIT) — если объект не "убегает" из метода, JIT может выделить его на стек или вообще "разложить" в скаляры (scalar replacement). Тогда нет аллокации в heap, нет работы для GC.

## 5.10 Heap detaily — что аллоцируется где

**TLAB** (Thread-Local Allocation Buffer) — у каждого потока свой кусок Eden:
- Аллокация = bump-pointer (атомарный `++`), без синхронизации.
- При исчерпании запросит новый TLAB.
- Размер тюнится, default ~1% от Eden.

**Большие объекты** (`PretenureSizeThreshold`) — могут идти сразу в Old (минуют Eden), чтобы не копировать большой блок при minor GC.

## 5.11 GC — детальная модель

### Generational hypothesis (поколенческая гипотеза)

- **Most objects die young** (Eden).
- **Few references from old to young**.

Поэтому:
- Young GC обходит только Young + remembered set ссылок Old → Young (через write barrier).
- Это делает minor GC очень быстрым.

### Marking (пометка)

Алгоритм: tri-color marking
- White — не посещён (мусор кандидат).
- Gray — посещён, но дети нет.
- Black — посещён, и дети тоже.

Старт от **GC roots**: статические поля, локальные переменные потоков, JNI ссылки, system classloader.

Проблема в concurrent: пока маркер бежит, mutator (приложение) меняет ссылки → нужны write barriers (G1, ZGC).

### G1 (Garbage First)

- Heap делится на **регионы** (~2048 одинаковых).
- Регионы помечаются как Eden / Survivor / Old / Humongous (для больших объектов).
- Sampling: G1 знает приблизительный "garbage" в каждом регионе.
- При GC выбирает регионы с наибольшим мусором → "garbage first".
- **Mixed GC** — собирает Young + часть Old регионов.
- STW паузы предсказуемые (`-XX:MaxGCPauseMillis`).
- Большие объекты (≥ 50% региона) — Humongous, могут вызывать фрагментацию.

### ZGC

- Concurrent collector, паузы < 1 ms (с Java 17 — sub-millisecond).
- Работает с heap до 16 TB.
- Использует **coloured pointers** (биты в указателе) и **load barriers**.
- С Java 21 — generational ZGC (раздел Young/Old).

### Когда какой GC

| GC | Use case |
|---|---|
| Serial | embedded, < 100 MB heap |
| Parallel | batch, max throughput |
| G1 | default; balanced latency vs throughput |
| ZGC / Shenandoah | low-latency, large heap |
| Epsilon | testing, ultra-short tasks |

## 5.12 Reference types — практика

```java
// SoftReference — для memory-sensitive cache
Map<Key, SoftReference<Value>> cache = new HashMap<>();
SoftReference<Value> ref = cache.get(key);
Value v = (ref != null) ? ref.get() : null;        // null если GC собрал

// WeakReference — для регистрии, не удерживающей объекты
Map<Object, Listener> listeners = new WeakHashMap<>();
// если ключ только в этой мапе — GC уберёт

// PhantomReference — finalize-альтернатива; в Java 9+ есть Cleaner API
Cleaner cleaner = Cleaner.create();
cleaner.register(myObj, () -> closeNativeResource());
```

⚠️ **Не используй `Object.finalize()`** — deprecated, недетерминированный, медленный, может ресуррекцию делать. Всегда `try-with-resources` + `Cleaner`.

## 5.13 Memory leaks — реальные кейсы

### 1. Static collection без удаления
```java
class UserService {
    private static final Map<Long, User> CACHE = new HashMap<>();   // живёт вечно
    public User get(long id) { return CACHE.computeIfAbsent(id, this::load); }
}
```
**Лечение:** `Caffeine`/`Guava` cache с TTL и max size; или `WeakHashMap`/`SoftReference`; или явная инвалидация.

### 2. ThreadLocal в пуле
```java
private static final ThreadLocal<Connection> CONN = new ThreadLocal<>();
// если не вызывать remove() в finally — Connection живёт пока жив поток
```

### 3. Unclosed resources
```java
// Stream от Files.lines — держит file handle
Files.lines(path).forEach(this::process);   // ❌ забыли close, может течь FD
// ✅
try (Stream<String> s = Files.lines(path)) { s.forEach(this::process); }
```

### 4. Inner class держит outer
```java
class Outer {
    private byte[] huge = new byte[100_000_000];
    public Listener createListener() {
        return new Listener() {              // anonymous → ссылка на Outer.this
            @Override public void onEvent() {}
        };
    }
}
// Listener держит весь Outer (с huge), даже если huge не нужен.
// Используй static nested или lambda, если не нужен Outer.
```

### 5. ClassLoader leaks
- Динамические прокси, ASM-классы, Groovy/Scala scripts создают много классов в Metaspace.
- При redeploy в app-сервере старые ClassLoader'ы могут не собраться (если есть ссылка из core-classloader).

### 6. Listeners / callbacks
- Подписался → не отписался → подписчик удерживается источником событий.

## 5.14 OutOfMemory — полная классификация

| Сообщение | Причина | Как чинить |
|---|---|---|
| `Java heap space` | переполнен heap | heap dump → MAT; `-Xmx` больше; найти leak |
| `GC overhead limit exceeded` | >98% времени в GC, освобождает <2% | то же |
| `Metaspace` | слишком много загруженных классов | `-XX:MaxMetaspaceSize`; искать ClassLoader leak |
| `Direct buffer memory` | переполнен off-heap (NIO direct buffers) | проверить Netty/NIO утечки |
| `unable to create new native thread` | OS thread limit | сократить число потоков; virtual threads |
| `Requested array size exceeds VM limit` | массив > 2³¹-1 | переделать структуру данных |

## 5.15 Heap dump — как снять и анализировать

```bash
# Снять
jcmd <pid> GC.heap_dump /tmp/heap.hprof
# или при OOM автоматически
-XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=/dump

# Анализ — Eclipse MAT
# - Open Heap Dump
# - Leak Suspects Report — auto-detection потенциальных ликов
# - Dominator Tree — кто кого удерживает (retained heap)
# - Histogram — сколько объектов какого класса
```

**Retained vs shallow:**
- **Shallow size** — размер самого объекта.
- **Retained size** — сколько освободится, если этот объект удалить (он + всё, что он эксклюзивно держит).

## 5.16 Thread dump — анализ

```bash
jstack -l <pid> > tdump.txt
# или
jcmd <pid> Thread.print
```

В дампе видишь:
- Состояние каждого потока (RUNNABLE, BLOCKED, WAITING, TIMED_WAITING).
- Stack trace.
- На каком мониторе ждёт (`waiting to lock <monitor>`).
- Кто держит лок (`locked <monitor>`).
- Detection deadlock'а внизу.

**Что искать:**
- Много потоков RUNNABLE на одном и том же стеке → CPU hotspot.
- Много BLOCKED на одном lock'е → contention.
- WAITING на пустом thread pool → задачи закончились или producer не работает.

## 5.17 JIT — детально

### Tiered compilation (HotSpot, default)

```
Level 0: интерпретатор
Level 1: C1 (без профиля)
Level 2: C1 (с базовым профилем, без всех счётчиков)
Level 3: C1 (полный профиль) ← собираем данные
Level 4: C2 (агрессивная оптимизация на основе профиля)
```

Метод дойдёт до C2 после ~10000 вызовов / итераций (counter-based).

### Inlining

JIT может встраивать тело метода в место вызова, если метод небольшой / "горячий". Условия:
- Виртуальный метод — нужно "monomorphic" / "bimorphic" call site (1-2 реализации) → polymorphic inline cache.
- Если call site "megamorphic" (>3 реализаций) — inline отменяется.

### Escape analysis + scalar replacement

```java
public Point compute() {
    Point p = new Point(1, 2);
    p.scale(3);
    return p.scaled();
}
// Если p не уходит наружу — JIT может разложить на скаляры (x=1, y=2) на стек.
// Аллокация исчезает.
```

### Deoptimization

JIT делает **спекулятивные** оптимизации (предположение, что монотипное место останется монотипным). Если предположение нарушается — JIT откатывается на интерпретатор и перекомпилирует.

### Полезные флаги

```
-XX:+PrintCompilation          # видишь, что компилируется
-XX:+UnlockDiagnosticVMOptions
-XX:+PrintInlining             # что инлайнится
-XX:+PrintAssembly             # требует hsdis
-XX:CompileThreshold=10000     # порог компиляции
```

## 5.18 Class loading — practical

### Parent delegation

```
Класс foo.Bar нужен:
1. AppClassLoader.loadClass("foo.Bar")
   → сначала просит parent: PlatformClassLoader.loadClass(...)
     → сначала parent: BootstrapClassLoader → не найдено
     → сама ищет → не найдено
   → теперь App ищет в своём classpath → найдено → возвращает класс
```

Защищает core-классы: даже если ты положишь свой `java/lang/String.class` — Bootstrap отдаст свой.

### Кастомный ClassLoader

```java
class PluginClassLoader extends ClassLoader {
    @Override
    protected Class<?> findClass(String name) throws ClassNotFoundException {
        byte[] bytes = readPluginClassBytes(name);
        return defineClass(name, bytes, 0, bytes.length);
    }
}
```

Применение: плагин-системы, hot reload (DevTools), app-серверы (изоляция war'ов), Groovy/Scala JIT.

## 5.19 JVM в контейнере (k8s)

С Java 8u191+ и Java 11+:
- JVM автоматически читает cgroup-лимиты (`-XX:+UseContainerSupport` по умолчанию).
- `Runtime.availableProcessors()` возвращает количество "доступных" CPU (учитывая cgroup quota).
- `-XX:MaxRAMPercentage=75.0` — выделить 75% от лимита под heap, оставить место на metaspace, threads, direct buffers.

```yaml
# k8s deployment пример
resources:
  requests: { memory: "1Gi", cpu: "500m" }
  limits:   { memory: "1Gi", cpu: "1" }
env:
  - name: JAVA_TOOL_OPTIONS
    value: >-
      -XX:MaxRAMPercentage=75.0
      -XX:+ExitOnOutOfMemoryError
      -XX:+HeapDumpOnOutOfMemoryError
      -XX:HeapDumpPath=/dump
      -XX:+UseG1GC
      -XX:MaxGCPauseMillis=200
```

`-XX:+ExitOnOutOfMemoryError` — упасть при OOM, чтобы k8s рестартнул pod (вместо болезни).

## 5.20 JFR (Java Flight Recorder)

Встроенный low-overhead профайлер.

```bash
# Старт записи на 60 секунд
jcmd <pid> JFR.start duration=60s filename=rec.jfr settings=profile

# Дамп
jcmd <pid> JFR.dump filename=rec.jfr

# Стоп
jcmd <pid> JFR.stop
```

Анализ: **JDK Mission Control (JMC)**.

Что показывает: CPU usage, allocation, GC pauses, lock contention, IO, exceptions, method profile (sampling).

Overhead < 1% для default, ~2% для profile settings.

## 5.21 async-profiler — современная альтернатива

Ниже шум, лучше для production:

```bash
./profiler.sh -d 30 -f flame.html <pid>
./profiler.sh -e alloc -d 30 -f alloc.html <pid>     # allocation profile
./profiler.sh -e lock -d 30 -f lock.html <pid>       # lock contention
```

Генерирует **flame graph** — визуализация, где потрачен CPU.

## 5.22 String deduplication (G1)

`-XX:+UseStringDeduplication` (с G1) — фоновый поток дедуплицирует одинаковые `String` (заменяет внутренний `byte[]` на shared). Полезно для приложений с большим числом дублей строк.

## 5.23 Дополнительные частые вопросы

- Какие области памяти есть в JVM?
- Где живут локальные переменные? Объекты? Static-поля?
- Что такое TLAB?
- Как работает поколенческая гипотеза?
- Опиши G1 в деталях.
- Чем ZGC от G1 отличается?
- Что такое Stop-The-World?
- Что такое safepoint?
- Какие есть типы ссылок? Когда какую использовать?
- Что такое Cleaner и почему лучше finalize?
- 5 классических причин утечки памяти.
- Как снять heap dump? Как анализировать?
- Что такое retained vs shallow size?
- Как работает classloader-делегация?
- Зачем делать кастомный ClassLoader?
- Что такое JIT, tiered compilation?
- Что такое escape analysis и scalar replacement?
- Как настроить JVM для контейнера?
- Что такое JFR и async-profiler? В чём отличие?
- Как обнаружить deadlock? (jstack автоматически.)
- Что такое class data sharing (CDS)? (Сериализованный архив классов для быстрого старта.)
- Что такое compressed oops? (Сжатие 64-битных указателей до 32 бит при heap < 32 GB.)

---

# Глубокие объяснения: что происходит внутри JVM

JVM — это не просто "запускалка байткода". Это мини-ОС с собственным планировщиком, менеджером памяти, компилятором и механизмами защиты. Понимание, как они взаимодействуют, превращает "загадочные" проблемы (latency spikes, OOM, high CPU) в решаемые задачи.

## Память JVM: где что живёт

В процессе Java-приложения память делится на несколько непересекающихся областей, и каждая ведёт себя по-своему.

**Heap** — здесь живут все `new` объекты. Самая большая область, ограничена `-Xmx`. Управляется GC. Делится на поколения:
- **Young** (новорождённые объекты): Eden + два Survivor (S0, S1). Большинство объектов умирают здесь и никогда не доходят до Old.
- **Old (Tenured)**: выжившие после нескольких minor GC. Здесь же — большие объекты (humongous в G1).

**Metaspace** (до Java 8 — PermGen) — метаданные классов: структура класса, байткод методов, interned strings (в Java 7+). **Растёт динамически**, поэтому класслоадер, который не освобождается (частая проблема в hot-reload Tomcat), приводит к `OutOfMemoryError: Metaspace`.

**Stack** — по одному на поток. Стековые кадры, локальные переменные, parameter values. Размер каждого стека — `-Xss` (по умолчанию ~1 MB на OS-thread). Переполнение → `StackOverflowError`.

**Direct memory (off-heap)** — через `ByteBuffer.allocateDirect` и mmap. Не под GC heap, учитывается в `-XX:MaxDirectMemorySize`. Нужна для NIO с высокой производительностью (Kafka, Netty). Утечки здесь особенно коварны — не видны в heap dump.

**Code cache** — JIT-скомпилированный нативный код. Ограничен `-XX:ReservedCodeCacheSize`. Если переполняется — JIT останавливается, всё работает через интерпретатор (50-100× медленнее). Один из классических "невидимых" инцидентов.

**Native stacks** — для OS-потоков, mmap-regions библиотек (zlib, SSL).

**Как понять "сколько на самом деле ест JVM".** Это **не просто `-Xmx`**. Реальное потребление = heap + metaspace + direct memory + code cache + стеки всех потоков + native libraries + JIT-temporary + GC bookkeeping. Рекомендую использовать Native Memory Tracking (`-XX:NativeMemoryTracking=summary` + `jcmd VM.native_memory summary`) — покажет all of the above.

## Сборка мусора: поколенческая гипотеза и её следствия

GC основан на эмпирическом наблюдении: **большинство объектов умирают молодыми**. Временный StringBuilder в методе, анонимная лямбда, результат map-операции — всё это живёт миллисекунды. Этому противопоставляется небольшое количество "долгожителей" — кеши, singleton'ы, конфигурация.

Отсюда идея — разделить heap и применять **разные алгоритмы**: для молодого — быстрое частое копирование, для старого — медленное редкое.

**Minor GC (молодое поколение).** Часто (раз в секунды). Использует **copying collector**: из Eden и одного Survivor копирует живые объекты в другой Survivor (или в Old). Остальное — мусор. Быстро, потому что живых обычно мало. Один minor GC — обычно 10-50 ms.

**Major/Full GC (старое поколение).** Реже, но дольше. Раньше требовал остановки всех потоков (STW). Современные GC минимизируют STW:
- **G1** — делит heap на регионы (~2 MB), собирает **несколько самых "мусорных"** за раз. Цель — предсказуемая пауза (`-XX:MaxGCPauseMillis=200`).
- **ZGC** — concurrent GC. Остановка ~1 ms независимо от размера heap. До 16 TB heap (!). Использует цветные указатели (colored pointers) — трюк с битами виртуального адреса для отслеживания состояния ссылки.
- **Shenandoah** — аналогично ZGC, но другая реализация (read barriers вместо load barriers).

**Какой GC выбрать:**
- **Parallel** (`-XX:+UseParallelGC`) — max throughput, большие паузы. Для batch-джобов.
- **G1** (default с Java 9) — баланс. Для 99% приложений.
- **ZGC** (`-XX:+UseZGC`) — sub-ms паузы. Для low-latency (trading, real-time API). В Java 21 стал generational.
- **Serial** — для маленьких приложений и тестов.

**Наблюдение GC — не глазами, а метриками.** `-Xlog:gc*:file=gc.log:tags,uptime` даёт лог. Тулы: GCViewer, GCEasy, Universal GC Log Analyzer. Главные метрики: **throughput** (% времени не в GC), **pause time** (p99 STW), **allocation rate** (MB/s).

## JIT: почему первый запрос всегда медленный

Когда ваш сервис только поднялся, первые запросы идут в **10-50 раз медленнее** установившейся производительности. Это нормально.

**Почему.** Код сначала **интерпретируется** (читает байткод и выполняет). Только после того, как JVM увидит "этот метод вызывается часто" (обычно 10000 раз), включается JIT.

**Tiered compilation.** Современный HotSpot использует пять уровней:
- **Level 0** — интерпретатор.
- **Level 1-3** — C1 (быстрая компиляция, базовые оптимизации, профилирование).
- **Level 4** — C2 (агрессивная оптимизация на основе собранного профиля).

Метод обычно проходит: интерпретатор → C1 level 3 (с профилированием) → C2 level 4 (финальный).

**Главные оптимизации C2:**
1. **Inlining** — вставка тела вызываемого метода в вызывающий. Убирает оверхед вызова + открывает возможности для других оптимизаций. Ограничено размером метода (`-XX:MaxInlineSize=35`).
2. **Escape analysis** — проверка, "убегает" ли объект за пределы метода. Если нет, JIT может:
   - **Allocate on stack** вместо heap (не грузит GC).
   - **Scalar replacement** — вместо объекта с 3 полями работать с 3 переменными.
3. **Dead code elimination** — выкидывание веток, которые никогда не исполнялись по профилю.
4. **Lock coarsening/elision** — объединение/удаление synchronized-блоков на объектах, которые не escape.
5. **Loop unrolling** — разворот циклов для векторизации.

**Деоптимизация.** Если JIT предположил, что вызов `animal.speak()` всегда идёт в `Dog`, и заинлайнил код `Dog.speak()`, а в рантайме пришёл `Cat` — JVM делает **deoptimization**: выбрасывает JIT-код, откатывается к интерпретатору, собирает новый профиль, перекомпилирует. Это нормально, но частые деоптимизации — признак плохо "классифицируемого" кода.

**Warmup для бенчмарков.** Обязательно. JMH делает это автоматически (3-5 итераций warmup). Вручную: запустить нагрузку на 30-60 секунд до замеров. Иначе вы измеряете производительность интерпретатора, а не C2.

## Reference types — четыре уровня "крепости"

Java предоставляет четыре типа ссылок для управления lifetime объектов.

**Strong (обычная).** Обычная переменная. Пока есть сильная ссылка, объект **не будет** собран GC. 99% кода использует только это.

**Soft (`SoftReference`).** "Собирается, только когда память кончается". Идеальна для кешей: "держи пока есть память, отпусти при OOM". На практике JVM использует формулу на основе freeHeap × SoftRefLRUPolicyMSPerMB — чем больше свободной памяти, тем дольше держится.

**Weak (`WeakReference`).** Собирается **при следующем GC**, если нет сильных ссылок. Используется в `WeakHashMap`, Listener'ах (чтобы подписчик не держал publisher), кешах без гарантий.

**Phantom (`PhantomReference`).** Ссылка, через которую **нельзя получить объект** (`get()` всегда null). Используется только для получения уведомления в `ReferenceQueue`, когда объект был финализирован и готов к освобождению памяти. Это чище, чем `finalize()`, потому что не блокирует GC.

**Когда использовать Cleaner (Java 9+).** Это современная замена `finalize()`. `finalize()` — **deprecated** с Java 9, будет удалён. Проблемы `finalize`: бежит в special thread, может воскресить объект, замедляет GC, может не вызваться никогда. `Cleaner` — регистрируете callback, который выполнится когда phantom-ссылка попала в очередь. Использует — для освобождения native-ресурсов (DirectByteBuffer именно так).

## Classloader: как JVM грузит классы

Когда вы пишете `new MyClass()`, JVM делает куда больше, чем кажется.

**Делегирование — parent first.** Каждый ClassLoader перед загрузкой класса **спрашивает у родителя**: "можешь загрузить?". Только если родитель сказал "нет", сам ищет. Иерархия:
1. **Bootstrap** — JDK-модули (java.base, java.util, java.lang).
2. **Platform** — java.sql, java.xml, JDBC-реализации.
3. **Application** — ваш classpath.

Это защищает систему: вы не можете создать свой класс `java.lang.String` и подсунуть его в classpath — Bootstrap ClassLoader загрузит настоящий String первым. Но также означает: если в appcl подгружен `org.slf4j.Logger`, а какая-то либа на classpath его вытеснила — они не совместимы (разные экземпляры класса с одинаковым именем, но разным ClassLoader).

**Custom ClassLoader** — нужен для:
- **Plugin systems** — каждый плагин в своём ClassLoader, чтобы мог быть выгружен.
- **Hot reload** (Tomcat, Spring DevTools) — перезагрузка приложения без рестарта JVM.
- **Изоляция версий** — две версии одной библиотеки в одном процессе (OSGi).

**Как класс выгружается.** Класс выгружается **только когда его ClassLoader становится unreachable**. Один класс, загруженный системным ClassLoader, будет жить всё время JVM. Class leak — когда ClassLoader "протекает" (например, держится через ThreadLocal) — классический источник PermGen/Metaspace OOM.

## Когда Java жрёт память в контейнере — и почему

Классический инцидент: Java-под в Kubernetes OOMKilled по `memory limit`, хотя `-Xmx` меньше.

**Причина.** Как уже сказано, JVM потребляет больше, чем heap. В контейнере типичный overhead поверх heap:
- **Metaspace**: 50-200 MB (больше для Spring Boot).
- **Code cache**: 48-240 MB.
- **Direct buffers**: 64-256 MB (Netty использует агрессивно).
- **Thread stacks**: 1 MB × число потоков. Virtual threads исключение.
- **JVM internals (GC, JIT)**: 100-300 MB.
- **Native libs (zlib, OpenSSL, JVM itself)**: 100+ MB.

Итого overhead: 500 MB — 1 GB. Если `memory limit = 1 GB` и `-Xmx = 900M`, OOMKill гарантирован.

**Правило большого пальца:** heap = 50-70% от container limit.

**Container-aware JVM.** Java 10+ автоматически читает cgroup limits. Для старых версий — `-XX:+UseContainerSupport -XX:MaxRAMPercentage=60`.


