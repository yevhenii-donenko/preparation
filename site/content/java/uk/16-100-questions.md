# 100 питань з еталонними відповідями

> Список реальних питань для фінальної самоперевірки.
> Спочатку відповідай **сам уголос**, потім звіряйся.

---

## Core Java (1–15)

**1. Чим JDK відрізняється від JRE та JVM?**
JVM — специфікація і реалізація віртуальної машини, виконує байткод. JRE = JVM + стандартні бібліотеки, достатньо для запуску. JDK = JRE + інструменти розробника (`javac`, `jar`, `jstack`). З Java 11 JRE окремо не постачається.

**2. Що нового в Java 17 / 21?**
17: sealed classes (final), pattern matching for `instanceof`, records (final), switch expressions. 21: virtual threads (final), pattern matching for `switch`, record patterns, Sequenced Collections, generational ZGC.

**3. Чому `String` immutable?**
Безпека (використовується як ключі, імена класів, URL), кешований `hashCode`, можливість string pool, thread-safety з коробки.

**4. Чим `==` від `equals` відрізняється?**
Для примітивів `==` порівнює значення. Для посилань — порівнює адреси. `equals` — логічна рівність, за замовчуванням у `Object` те саме, що `==`, але переозначається.

**5. Що виведе `Integer a = 127; Integer b = 127; a == b;` і для 200?**
Для 127: `true` (Integer cache `[-128;127]` використовує один об’єкт). Для 200: `false` (різні об’єкти). Завжди порівнюй обгортки через `equals`.

**6. `equals`/`hashCode` контракт.**
Рефлексивність, симетричність, транзитивність, узгодженість, `x.equals(null) == false`. Якщо `equals` рівні — `hashCode` рівні (зворотне не обов’язкове). Перевизначив `equals` — зобов’язаний `hashCode`.

**7. Чим checked від unchecked відрізняється?**
Checked зобов’язаний бути в `throws` або оброблений (compile-time). Unchecked — runtime, помилки програмування. `Error` — фатальні (OOM, `StackOverflow`), не ловимо.

**8. Що відбудеться при exception у `finally`?**
Замінить вихідне виключення з `try` (оригінальне втрачається). Anti-pattern. Правильно — try-with-resources, який зберігає основне і кладе решту в `getSuppressed()`.

**9. Type erasure — що це?**
Generics в Java реалізовані стиранням типів: `List<String>` і `List<Integer>` — один клас `List` у runtime. Наслідки: не можна `new T()`, `T.class`, `instanceof List<String>`, статичні поля з `T`.

**10. PECS — розшифровка з прикладом.**
Producer Extends, Consumer Super. `List<? extends Number>` — можемо читати (отримаємо `Number`), не можемо писати. `List<? super Integer>` — можемо писати `Integer`, читаємо як `Object`.

**11. Чим `final` поле корисне?**
Безпечна публікація (після конструктора видно всім потокам), допомагає JIT (escape analysis), expressive — показує immutability.

**12. Inner class vs static nested.**
Inner тримає неявне посилання на `Outer.this` — може утримувати enclosing об’єкт і призводити до витоків. Static nested — звичайний клас у namespace іншого, без посилання. Надавай перевагу static nested, якщо не потрібне посилання на Outer.

**13. Чим лямбда від анонімного класу відрізняється?**
Лямбда: `invokedynamic` + `LambdaMetafactory`, генерується ліниво, немає окремого `.class`, `this` — зовнішній. Анонімний: окремий `Outer$1.class`, `this` — на сам об’єкт.

**14. Records — що генерується?**
Усі поля `private final`, аксесори `field()`, `equals/hashCode/toString` за всіма полями, canonical constructor. Implicitly `final`, наслідує `java.lang.Record`. Можна реалізовувати інтерфейси, не наслідувати класи.

**15. Sealed classes — навіщо?**
Закрита ієрархія. Підтипи мають бути `final`, `sealed` або `non-sealed`. Компілятор знає всі підтипи → exhaustive `switch` без `default`. Ідеально для algebraic data types.

---

## Collections (16–30)

**16. Як працює `HashMap`?**
Масив бакетів довжини степеня 2 (default 16). Hash ключа змішується (`h ^ h>>>16`), index = `(n-1) & hash`. Колізії → зв’язний список; при ≥ 8 елементів і table ≥ 64 → Red-Black tree. При `size > capacity * 0.75` — resize ×2.

**17. Що таке treeification і навіщо?**
При довжині бакета ≥ 8 (і table ≥ 64) список перетворюється на Red-Black tree. Пошук стає O(log n) замість O(n). Захист від поганих `hashCode` і hash-collision DoS.

**18. Чому load factor 0.75?**
Емпіричний компроміс між щільністю (пам’ять) і частотою колізій (продуктивність). Менше — більше пам’яті, рідше resize; більше — більше колізій, довші операції.

**19. Чим `HashMap` від `ConcurrentHashMap` відрізняється?**
`HashMap` не thread-safe, дозволяє один null ключ. `ConcurrentHashMap` — bucket-level locking + CAS, читання lock-free, atomic `compute`/`merge`, не дозволяє null. `HashMap` у multi-threaded середовищі може втратити дані при resize.

**20. Чим `ArrayList` від `LinkedList` відрізняється? Коли який?**
`ArrayList` — масив, `get` O(1), insert/remove у середині O(n). `LinkedList` — двозв’язний список, insert/remove у кінцях O(1), доступ за індексом O(n). Майже завжди `ArrayList` — cache-friendly. `LinkedList` у реальності майже не потрібен (`ArrayDeque` кращий для черги).

**21. Як реалізувати LRU cache на стандартних колекціях?**
`LinkedHashMap` з `accessOrder=true` + перевизначити `removeEldestEntry`. Повертає true коли `size() > maxCapacity` — `Map` сам видаляє найстарший елемент при `put`.

**22. Що таке fail-fast iterator?**
Iterator перевіряє `modCount` при кожному `next()` — якщо колекція змінилася — кидає `ConcurrentModificationException`. Не індикатор multithreading — легко отримати і в одному потоці через `for-each + remove`.

**23. Що поверне `set.add(obj)` якщо об’єкт уже є?**
`false`. `Set.add` повертає true лише якщо елемент дійсно доданий.

**24. Чим `ArrayDeque` від `LinkedList` кращий?**
Кільцевий буфер (масив) — cache-friendly, немає per-node алокації, швидший на push/pop. Найкращий вибір для stack і queue в одному потоці.

**25. Коли вибрати `TreeMap`?**
Коли потрібне сортування за ключем, навігація (`floorKey`/`ceilingKey`/`headMap`/`tailMap`), діапазонні запити. Ціна — O(log n) замість O(1) у `HashMap`.

**26. Чим `CopyOnWriteArrayList` доречний?**
Read-mostly з рідким записом. Кожна модифікація створює копію масиву → дорогий запис, але читачі lock-free. Listeners, observers.

**27. `EnumMap` — чому такий швидкий?**
Усередині масив, index = `ordinal()` константи. Немає hashing, collision handling. Пам’ять компактна.

**28. Чим `Collections.synchronizedMap` від `ConcurrentHashMap` відрізняється?**
`synchronizedMap` — глобальний лок на весь `Map` (`synchronized` на кожному методі). `ConcurrentHashMap` — fine-grained locking на рівні бакета + CAS. `ConcurrentHashMap` значно швидший під навантаженням.

**29. Що таке weakly consistent iterator?**
Не fail-fast: не кидає CME при модифікації, але може бачити або не бачити зміни, зроблені після створення ітератора. У `ConcurrentHashMap`, `ConcurrentSkipListMap`.

**30. Чим `merge` від `compute` у `Map` відрізняється?**
`merge(key, value, remapping)` — якщо немає ключа → put value; якщо є → результат `remapping(old, value)`. Спрощений API для лічильників. `compute(key, remapping)` — universal: отримує `(key, currentValue|null)` і повертає нове значення.

---

## Streams / Optional (31–40)

**31. Lazy чи стріми і що це дає?**
Так, intermediate операції lazy — виконуються лише при terminal. Переваги: short-circuit (`findFirst` не йде по всьому), оптимізація (один pass через всі операції).

**32. Чим `map` від `flatMap` відрізняється?**
`map`: T → R, "1 в 1". `flatMap`: T → `Stream<R>`, розгортає вкладений потік. Для `List<List<X>>` `flatMap` перетворює на `Stream<X>`.

**33. Чи можна запустити стрім повторно?**
Ні. Stream одноразовий — повторна terminal operation кине `IllegalStateException`.

**34. Коли паралельний стрім шкідливий?**
Маленькі колекції (overhead splitter), blocking I/O (заблокуєш загальний `ForkJoinPool.commonPool`), погано спліторовані джерела (`LinkedList`, `Stream.iterate`), stateful чи synchronized операції.

**35. Чим `reduce` від `collect` відрізняється?**
`reduce` — для immutable згортки (sum, max). `collect` — для mutable акумулятора (Builder, List, Map). `reduce` — поєднувана асоціативна функція; `collect` — `Collector` з supplier/accumulator/combiner.

**36. `orElse` vs `orElseGet` — чим небезпечний `orElse`?**
`orElse(value)` — value обчислюється ЗАВЖДИ, навіть якщо `Optional` не порожній. `orElseGet(supplier)` — supplier викликається лише при empty. Для дорогих default — `orElseGet`.

**37. Чим `Optional.of` від `ofNullable` відрізняється?**
`of` падає з NPE якщо value == null. `ofNullable` дозволяє null (створює empty).

**38. Чому `Optional` не повинен бути полем класу?**
Не Serializable, зайвий об’єкт на кожне поле, плутає API (ніхто не очікує `Optional` поле). Використовується як return type для явного "може бути відсутнім".

**39. Що поверне `Collectors.toMap` при дублікаті ключів?**
`IllegalStateException`. Потрібно явно передати merge function: `toMap(keyMapper, valueMapper, (a, b) -> a)` — бере перше або друге значення.

**40. Чим `Stream.toList()` від `Collectors.toList()` відрізняється?**
`Stream.toList()` (Java 16+) — повертає immutable список. `Collectors.toList()` — mutable `ArrayList` (історично).

---

## Concurrency (41–60)

**41. Чим `volatile` від `synchronized` відрізняється?**
`volatile` гарантує видимість і забороняє переупорядкування для однієї змінної, але НЕ атомарність (`counter++` все одно race). `synchronized` — взаємне виключення + видимість + атомарність для блока.

**42. Що таке happens-before?**
Відношення впорядкування операцій у JMM. Якщо A happens-before B — результати A видно B і впорядковані раніше. Створюється: program order, unlock→lock, volatile write→read, `Thread.start()`→все в новому потоці, все в потоці→`join`, final-поля після конструктора.

**43. Що таке CAS і де застосовується?**
Compare-And-Swap: атомарна інструкція CPU `compareAndSet(expected, new)`. Атомарно перевіряє поточне значення і замінює, якщо збіглося. Основа атоміків, lock-free структур, `ConcurrentHashMap`.

**44. Що таке ABA-проблема?**
Значення змінилось A→B→A. CAS не відрізнить, що змінювалось. Рішення — `AtomicStampedReference` (значення + версія), CAS на пару.

**45. Чим `LongAdder` від `AtomicLong` кращий для лічильників?**
`AtomicLong` — усі потоки CAS на одну змінну → high contention. `LongAdder` — масив "комірок" по потоках, кожний збільшує свою → немає contention. `sum()` приблизний у момент читання.

**46. Навіщо `wait` у `while`, а не у `if`?**
Spurious wakeup (потік може прокинутися без notify); condition міг змінитися до моменту wakeup. Цикл перевіряє condition і знову піде чекати, якщо потрібно.

**47. Що відбудеться з локом при exception у `synchronized` методі?**
Лок відпуститься автоматично. JVM гарантує `monitorexit` при будь-якому виході з `synchronized`.

**48. Чим `ReentrantLock` кращий за `synchronized`?**
`tryLock()`, `tryLock(timeout)`, `lockInterruptibly`, fair режим (FIFO), декілька `Condition`. Мінус — зобов’язаний вручну `unlock` у `finally`.

**49. `ReadWriteLock` — як працює?**
Багато читачів АБО один писатель. Можна downgrade `writeLock` → `readLock` у тому ж потоці, але не навпаки (deadlock).

**50. `CountDownLatch` vs `CyclicBarrier` — різниця?**
Latch одноразовий — лічильник не скидається, після 0 не можна використовувати. Barrier скидається, можна використовувати багаторазово. Latch — "чекати поки N задач завершиться", Barrier — "точка зустрічі N потоків".

**51. Чим небезпечний `Executors.newCachedThreadPool` у проді?**
Unbounded threads — може створити тисячі при навантаженні → OOM, native thread limit. Використовуй `ThreadPoolExecutor` напряму з обмеженим max + bounded queue + `CallerRunsPolicy`.

**52. Чим небезпечний `Executors.newFixedThreadPool`?**
Unbounded `LinkedBlockingQueue` — задачі можуть накопичуватися нескінченно → OOM heap. Знову — `ThreadPoolExecutor` з bounded queue.

**53. `ThreadLocal` у пулі — яка небезпека?**
Потік у пулі живе довго; значення `ThreadLocal` залишається між задачами. Якщо не викликати `remove()` у `finally` — попередня задача "забруднює" наступну і значення ніколи не очищається → витік пам’яті.

**54. Чим `CompletableFuture` від `Future` кращий?**
Composition (`thenApply`, `thenCompose`, `thenCombine`), паралельні очікування (`allOf`, `anyOf`), exception handling (`exceptionally`, `handle`), timeout (`orTimeout`). `Future` вміє лише `get()`/`cancel()`.

**55. `thenApply` vs `thenApplyAsync` — де виконується?**
`thenApply` — у потоці, який завершив попередню стадію. `thenApplyAsync` — у вказаному пулі (або `ForkJoinPool.commonPool` за замовчуванням).

**56. Що таке safe publication?**
Способи зробити новий об’єкт видимим іншим потокам повністю ініціалізованим: `volatile` field, `final` field, `synchronized`, static initializer, concurrent collection. Без — може бачити частково-ініціалізований стан.

**57. Що таке virtual threads і коли використовувати?**
Java 21. Легкі user-level потоки, монтуються на невелику кількість carrier threads. Ідеальні для I/O-bound (мільйони блокуючих викликів). Не для CPU-bound. НЕ пулити. `synchronized` пінить до carrier — краще `ReentrantLock`.

**58. Що таке structured concurrency?**
Java 21+ (preview). `StructuredTaskScope` групує паралельні задачі; при скасуванні однієї — решта автоматично скасовуються. Безпечніше за голі `CompletableFuture`.

**59. Як уникнути deadlock?**
Упорядкувати взяття локів (завжди A потім B), використовувати `tryLock` з таймаутом, мінімізувати утримання лока, уникати вкладених `synchronized`. Detection — `jstack` сам показує.

**60. Що таке immutable об’єкт і навіщо?**
`final class`, `private final` поля, без сетерів, defensive copy для mutable полів. Thread-safe by default, безпечно публікувати, кешований `hashCode`. Приклади: `String`, `BigDecimal`, `java.time.*`.

---

## JVM / GC (61–72)

**61. Опиши області пам’яті JVM.**
Heap (загальний, об’єкти): Young (Eden + S0/S1) + Old; Metaspace (off-heap, метадані класів); Stack (на потік, фрейми методів); PC register; Native method stack; Code cache (JIT).

**62. Де живуть примітиви, об’єкти, static-поля?**
Локальні примітиви — на стеку (у фреймі). Об’єкти — на heap. Поля об’єкта — всередині об’єкта на heap. Static-поля — у `Class`-об’єкті (на heap, але GC roots).

**63. Що таке TLAB?**
Thread-Local Allocation Buffer — у кожного потоку свій шматок Eden. Алокація = bump-pointer без синхронізації, тому супершвидка. При вичерпанні — запросить новий.

**64. Як працює G1?**
Heap ділиться на ~2048 регіонів (Eden/Survivor/Old/Humongous). G1 знає приблизне сміття в кожному і пріоритезує регіони з більшим сміттям → "garbage first". Pause time goal — `-XX:MaxGCPauseMillis=200`.

**65. Чим ZGC від G1 відрізняється?**
ZGC — concurrent collector, паузи sub-millisecond, до 16 ТБ heap. Використовує coloured pointers і load barriers. З Java 21 — generational. G1 більш balanced, ZGC — для low-latency.

**66. Чим Soft, Weak, Phantom посилання відрізняються?**
Soft — збирається JVM при нестачі пам’яті (для memory-sensitive cache). Weak — збирається на наступному GC, якщо немає сильних посилань. Phantom — після `finalize`, для cleanup-логіки (Cleaner API).

**67. Назви 5 класичних причин витоків пам’яті.**
1) Static collections без видалення; 2) `ThreadLocal` у пулі без `remove`; 3) Незакриті ресурси (`Stream`/`Connection`/`File`); 4) Listeners/callbacks без відписки; 5) Inner class тримає outer (або ClassLoader leaks при redeploy).

**68. Які OOM помилки бувають?**
Java heap space (heap повний); GC overhead limit exceeded (>98% часу в GC); Metaspace (класів забагато); Direct buffer memory (off-heap); unable to create new native thread (OS limit); Requested array size exceeds VM limit.

**69. Як зняти і проаналізувати heap dump?**
`jcmd <pid> GC.heap_dump file.hprof` або `-XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=…`. Аналіз у Eclipse MAT: Leak Suspects Report (auto), Dominator Tree (retained heap).

**70. Що показує thread dump?**
Стан кожного потоку (`RUNNABLE`/`BLOCKED`/`WAITING`), stack trace, на якому моніторі чекає, хто тримає лок, deadlock-detection. Зняти `jstack <pid>`. Шукати contention (багато `BLOCKED` на одному lock), CPU hotspots (багато `RUNNABLE` на одному стеку).

**71. Що таке JIT і tiered compilation?**
Just-In-Time компілятор переводить "гарячий" байткод у нативний код. Tiered: інтерпретатор → C1 (швидко) → C2 (агресивні оптимізації). Вирішує за лічильниками викликів.

**72. Як налаштувати JVM у k8s контейнері?**
`-XX:MaxRAMPercentage=75` (75% від cgroup memory limit під heap), `-XX:+ExitOnOutOfMemoryError` (рестартнути pod при OOM), `-XX:+HeapDumpOnOutOfMemoryError`. З Java 11+ JVM автоматично враховує cgroup limits.

---

## Spring (73–85)

**73. Що таке IoC і DI?**
IoC — Inversion of Control: контейнер керує життєвим циклом об’єктів і зв’язками замість додатка. DI — Dependency Injection: спосіб впровадження залежностей (constructor/setter/field).

**74. Який вид DI кращий і чому?**
Constructor injection: поля можна `final`, fail-fast при старті (якщо залежності не розв’язалися), легко тестувати без Spring, явні залежності. Field injection — anti-pattern (не `final`, приховані залежності).

**75. Повний життєвий цикл бину.**
Constructor → DI → `BeanNameAware`/`BeanFactoryAware`/`ApplicationContextAware` → `BeanPostProcessor.before` → `@PostConstruct` → `InitializingBean.afterPropertiesSet` → init-method → `BeanPostProcessor.after` (тут AOP-проксі) → … → `@PreDestroy` → `DisposableBean.destroy` → destroy-method.

**76. Чим `@Component` від `@Bean` відрізняється?**
`@Component` — на класі, реєструється через component scan. `@Bean` — на методі в `@Configuration`. `@Bean` використовується коли: клас не свій, потрібна складна ініціалізація, кілька варіантів одного типу.

**77. Навіщо `@Configuration` проксується CGLIB?**
Щоб виклики `@Bean`-методів усередині класу повертали singleton (а не створювали новий об’єкт щоразу). Якщо вимкнути (`proxyBeanMethods=false`) — lite mode, швидший старт, але методи не самоузгоджені.

**78. Що таке self-invocation проблема?**
Виклик `this.method()` усередині класу не йде через проксі, тому AOP-аспекти (`@Transactional`, `@Async`, `@Cacheable`) не спрацьовують. Рішення: винести в інший бін, інжектити self, AspectJ.

**79. JDK proxy vs CGLIB?**
JDK dynamic proxy — для класів, що реалізують інтерфейс; проксі реалізує той самий інтерфейс. CGLIB — наслідує клас (потрібен для класів без інтерфейсу); не працює з `final` класами/методами. За замовчуванням Spring надає перевагу JDK, перемикається на CGLIB через `proxyTargetClass=true`.

**80. Як Spring Boot підвантажує auto-configurations?**
З `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` (раніше `spring.factories`). Кожна анотована `@AutoConfiguration` + `@Conditional*` (на наявність класу/біна/property/etc) — підключається лише якщо умови виконані.

**81. Порядок property sources у Spring Boot.**
Від нижчого пріоритету до вищого: дефолти в коді → `application.yml` у jar → профільні → зовнішні `application.yml` → OS env → `-D` system props → command-line args → `@TestPropertySource`.

**82. Чим Filter від `HandlerInterceptor` відрізняється?**
Filter — Servlet API, працює на всіх запитах включаючи статику і до `DispatcherServlet`. Interceptor — Spring, лише для контролерів, має доступ до handler. Для CORS/security — Filter; для бізнес-логіки типу audit — Interceptor.

**83. Чим `@MockBean` від `@Mock` відрізняється?**
`@Mock` — чистий Mockito без Spring (для unit-тестів). `@MockBean` — замінює бін у Spring контексті моком (для інтеграційних). `@MockBean` перестворює контекст між тестами з різною конфігурацією → гальмує.

**84. Які propagation у `@Transactional`?**
REQUIRED (default — приєднатися або створити), REQUIRES_NEW (призупинити поточну, відкрити нову), NESTED (savepoint), MANDATORY (зобов’язана бути), NEVER (не повинна бути), SUPPORTS (приєднатися якщо є), NOT_SUPPORTED (призупинити).

**85. Чому checked exception не відкатує `@Transactional` за замовчуванням?**
Історичне рішення (спадщина EJB). Spring відкатує лише `RuntimeException` і `Error` за замовчуванням. Щоб відкатити checked — вказати `@Transactional(rollbackFor = MyException.class)`.

---

## JPA / БД (86–95)

**86. Що таке ACID?**
Atomicity (все або нічого), Consistency (валідне → валідне), Isolation (паралельні транзакції ізольовані), Durability (після commit дані не втрачаються).

**87. Рівні ізоляції і від яких аномалій захищають?**
READ UNCOMMITTED — нічого не забороняє. READ COMMITTED (default PG) — немає dirty read. REPEATABLE READ — немає non-repeatable. SERIALIZABLE — немає phantom. Аномалії: dirty/non-repeatable/phantom/lost update/write skew.

**88. Що таке MVCC?**
Multi-Version Concurrency Control. Кожна транзакція бачить знімок БД на момент старту (або statement). Версії рядків зберігаються одночасно. Читачі не блокують писачів і навпаки. PostgreSQL і InnoDB використовують.

**89. Optimistic vs Pessimistic locking.**
Optimistic: поле `@Version`, при `UPDATE` перевіряється `WHERE version=?`. Якщо 0 рядків — конфлікт → retry. Хороший для read-heavy з рідкими конфліктами. Pessimistic: `SELECT FOR UPDATE` — блокує рядок до commit. Хороший для частих конфліктів, мінус — contention/deadlocks.

**90. Що таке N+1 проблема і як лікувати?**
1 запит → список батьків; для кожного — окремий запит на колекцію (LAZY). Рішення: `JOIN FETCH` у JPQL, `@EntityGraph`, `@BatchSize`, `FetchMode.SUBSELECT`, DTO-проекція через `SELECT new com.x.Dto(...)`.

**91. LAZY vs EAGER — що вибрати?**
Завжди LAZY, навіть для `@ManyToOne` (явно вказати). EAGER призводить до зайвих запитів, робить неможливою оптимізацію запитів і ловить у `LazyInitializationException`-проблеми непередбачувано.

**92. Persistence context — що це?**
`EntityManager` + перший рівень кешу. У межах однієї транзакції той самий ID завжди повертає той самий Java-об’єкт. Hibernate робить dirty checking при flush, порівнюючи поточний стан зі snapshot при завантаженні.

**93. Стани сутності.**
Transient (нова, не в EM); Managed (відстежується, dirty checking); Detached (контекст закритий, зміни не застосовуються); Removed (помічена на видалення).

**94. `persist` vs `merge`?**
`persist` — для transient (нової), зробить managed; `INSERT` на flush. `merge` — для detached, копіює поля в managed; повертає managed (старий detached залишається).

**95. Коли індекс НЕ використовується?**
Функція від колонки (`LOWER(email)`) — потрібен функціональний індекс; неявне приведення типу; `LIKE '%abc'` (з кінця); низька селективність; `OR` без індексу на кожній колонці; застаріла статистика (`ANALYZE`).

---

## REST / Архітектура (96–100)

**96. Які HTTP методи ідемпотентні?**
GET, HEAD, OPTIONS, PUT, DELETE. Safe (не змінюють стан) — GET, HEAD, OPTIONS. POST і PATCH — не ідемпотентні (хоча PATCH може бути).

**97. Чим 401 від 403 відрізняється?**
401 Unauthorized — не аутентифікований (немає токена або невалідний). 403 Forbidden — аутентифікований, але немає прав на ресурс/дію.

**98. JWT — структура і валідація.**
`header.payload.signature` (base64url). Header: `alg`, `typ`, `kid`. Payload: `iss`, `sub`, `aud`, `exp`, `nbf`, `iat`, `jti` + custom (roles). Validation: підпис (через JWKS issuer’а), `exp`, `nbf`, `iss`, `aud`. RS256 для мікросервісів (асиметричний).

**99. Як Kafka гарантує порядок?**
Лише всередині партиції. Повідомлення з однаковим ключем завжди потрапляють в одну партицію (`hash(key) % numPartitions`) → порядок збережено за ключем. По всьому топіку порядку немає.

**100. Що таке Outbox pattern?**
Розв’язує проблему "атомарно записати в БД і опублікувати подію". В одній транзакції разом з бізнес-даними пишемо подію в `outbox` таблицю. Окремий процес (relay) або Debezium/CDC читає `outbox` і публікує в Kafka. At-least-once, отримувач має бути ідемпотентним.

---

## Фінал

Після проходження всіх 100:
- Де "плив" — випиши і йди в детальний файл теми.
- Запиши себе голосовим на 5-10 випадкових питань — оціни якість мовлення.
- За день до інтерв’ю прогони ВСЕ ще раз, відповідаючи вголос.

Удачі! 🎯
