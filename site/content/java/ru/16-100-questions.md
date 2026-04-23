# 100 вопросов с эталонными ответами

> Список реальных вопросов для финальной самопроверки.  
> Сначала отвечай **сам вслух**, потом сверяйся.

---

## Core Java (1-15)

**1. Чем JDK отличается от JRE и JVM?**  
JVM — спецификация и реализация виртуальной машины, исполняет байткод. JRE = JVM + стандартные библиотеки, достаточно для запуска. JDK = JRE + инструменты разработчика (javac, jar, jstack). С Java 11 JRE отдельно не поставляется.

**2. Что нового в Java 17 / 21?**  
17: sealed classes (final), pattern matching for instanceof, records (final), switch expressions. 21: Virtual Threads (final), pattern matching for switch, record patterns, Sequenced Collections, Generational ZGC.

**3. Почему String immutable?**  
Безопасность (используется как ключи, имена классов, URL), кэшируемый hashCode, возможность string pool, thread-safety из коробки.

**4. Чем `==` от `equals` отличается?**  
Для примитивов `==` сравнивает значения. Для ссылок — сравнивает адреса. `equals` — логическое равенство, по умолчанию у Object — то же что `==`, но переопределяется.

**5. Что выведет `Integer a = 127; Integer b = 127; a == b;` и для 200?**  
Для 127: `true` (Integer cache `[-128;127]` использует один объект). Для 200: `false` (разные объекты). Всегда сравнивать обёртки через `equals`.

**6. equals/hashCode контракт.**  
Рефлексивность, симметричность, транзитивность, согласованность, `x.equals(null) == false`. Если `equals` равны — `hashCode` равны (обратное не обязано). Переопределил equals — обязан hashCode.

**7. Чем checked от unchecked отличается?**  
Checked обязан быть в `throws` или обработан (compile-time). Unchecked — runtime, ошибки программирования. Error — фатальные (OOM, StackOverflow), не ловим.

**8. Что произойдёт при exception в `finally`?**  
Заменит исходное исключение из try (оригинальное теряется). Anti-pattern. Правильно — try-with-resources, который сохраняет основное и кладёт остальные в `getSuppressed()`.

**9. Type erasure — что это?**  
Generics в Java реализованы стиранием типов: `List<String>` и `List<Integer>` — один класс `List` в runtime. Следствия: нельзя `new T()`, `T.class`, `instanceof List<String>`, статические поля с T.

**10. PECS — расшифровка с примером.**  
Producer Extends, Consumer Super. `List<? extends Number>` — можем читать (получим Number), не можем писать. `List<? super Integer>` — можем писать Integer, читаем как Object.

**11. Чем `final` поле полезно?**  
Безопасная публикация (после конструктора видно всем потокам), помогает JIT (escape analysis), expressive — показывает immutability.

**12. Inner class vs static nested.**  
Inner держит неявную ссылку на Outer.this — может удерживать enclosing объект и приводить к утечкам. Static nested — обычный класс в namespace другого, без ссылки. Предпочитай static nested если не нужна ссылка на Outer.

**13. Чем лямбда от анонимного класса отличается?**  
Лямбда: `invokedynamic` + `LambdaMetafactory`, генерируется лениво, нет отдельного `.class`, `this` — внешний. Анонимный: отдельный `Outer$1.class`, `this` — на сам объект.

**14. Records — что генерируется?**  
Все поля private final, аксессоры `field()`, `equals/hashCode/toString` по всем полям, canonical constructor. Implicitly final, наследует `java.lang.Record`. Можно реализовывать интерфейсы, не наследовать классы.

**15. Sealed classes — зачем?**  
Закрытая иерархия. Подтипы должны быть `final`, `sealed` или `non-sealed`. Компилятор знает все подтипы → exhaustive switch без default. Идеально для algebraic data types.

---

## Collections (16-30)

**16. Как работает HashMap?**  
Массив бакетов длины степени 2 (default 16). Hash ключа смешивается (`h ^ h>>>16`), индекс = `(n-1) & hash`. Коллизии → связный список; при ≥8 элементов и table≥64 → Red-Black tree. При size > capacity * 0.75 — resize ×2.

**17. Что такое treeification и зачем?**  
При длине бакета ≥ 8 (и table ≥ 64) список превращается в Red-Black tree. Поиск становится O(log n) вместо O(n). Защита от плохих hashCode и hash-collision DoS.

**18. Почему load factor 0.75?**  
Эмпирический компромисс между плотностью (память) и частотой коллизий (производительность). Меньше — больше памяти, реже resize; больше — больше коллизий, дольше операции.

**19. Чем HashMap от ConcurrentHashMap отличается?**  
HashMap не thread-safe, разрешает один null ключ. ConcurrentHashMap — bucket-level locking + CAS, чтения lock-free, atomic compute/merge, не разрешает null. HashMap в multi-threaded окружении может потерять данные при resize.

**20. Чем ArrayList от LinkedList отличается? Когда какой?**  
ArrayList — массив, get O(1), insert/remove в середине O(n). LinkedList — двусвязный список, insert/remove в концах O(1), доступ по индексу O(n). Почти всегда ArrayList — cache-friendly. LinkedList в реальности почти не нужен (ArrayDeque лучше для очереди).

**21. Как реализовать LRU cache на стандартных коллекциях?**  
LinkedHashMap с `accessOrder=true` + переопределить `removeEldestEntry`. Возвращает true когда `size() > maxCapacity` — Map сам удаляет старейший элемент при put.

**22. Что такое fail-fast iterator?**  
Iterator проверяет modCount при каждом next() — если коллекция изменилась — бросает ConcurrentModificationException. Не индикатор multithreading — легко получить и в одном потоке через `for-each + remove`.

**23. Что вернёт `set.add(obj)` если объект уже есть?**  
`false`. Set.add возвращает true только если элемент действительно добавлен.

**24. Чем ArrayDeque от LinkedList лучше?**  
Кольцевой буфер (массив) — cache-friendly, нет per-node аллокации, быстрее на push/pop. Лучший выбор для stack и queue в одном потоке.

**25. Когда выбрать TreeMap?**  
Когда нужна сортировка по ключу, навигация (floorKey/ceilingKey/headMap/tailMap), диапазонные запросы. Цена — O(log n) вместо O(1) у HashMap.

**26. Чем CopyOnWriteArrayList уместен?**  
Read-mostly с редкой записью. Каждая модификация создаёт копию массива → дорогая запись, но читатели lock-free. Listeners, observers.

**27. EnumMap — почему так быстр?**  
Внутри массив, индекс = `ordinal()` константы. Нет hashing, нет collision handling. Память компактна.

**28. Чем `Collections.synchronizedMap` от ConcurrentHashMap отличается?**  
synchronizedMap — глобальный лок на весь Map (`synchronized` на каждом методе). ConcurrentHashMap — fine-grained locking на уровне bucket'а + CAS. ConcurrentHashMap значительно быстрее под нагрузкой.

**29. Что такое weakly consistent iterator?**  
Не fail-fast: не бросает CME при модификации, но может видеть или не видеть изменения, сделанные после создания итератора. У ConcurrentHashMap, ConcurrentSkipListMap.

**30. Чем merge от compute отличается в Map?**  
`merge(key, value, remapping)` — если нет ключа → put value; если есть → result of remapping(old, value). Упрощённый API для счётчиков. `compute(key, remapping)` — universal: получает (key, currentValue|null) и возвращает новое значение.

---

## Streams / Optional (31-40)

**31. Lazy ли стримы и что это даёт?**  
Да, intermediate операции lazy — выполняются только при terminal. Преимущества: short-circuit (`findFirst` не идёт по всему), оптимизация (один pass через все операции).

**32. Чем map от flatMap отличается?**  
map: T → R, "1 в 1". flatMap: T → Stream<R>, разворачивает вложенный поток. Для `List<List<X>>` flatMap превращает в Stream<X>.

**33. Можно ли запустить стрим повторно?**  
Нет. Stream одноразовый — повторная terminal operation бросит IllegalStateException.

**34. Когда параллельный стрим вреден?**  
Маленькие коллекции (оверхед splitter), blocking I/O (заблокируешь общий ForkJoinPool.commonPool), плохо сплитящиеся источники (LinkedList, Stream.iterate), stateful или synchronized операции.

**35. Чем reduce от collect отличается?**  
reduce — для immutable свёртки (sum, max). collect — для mutable аккумулятора (Builder, List, Map). reduce — комбинируемая ассоциативная функция; collect — Collector с supplier/accumulator/combiner.

**36. orElse vs orElseGet — чем опасен orElse?**  
orElse(value) — value вычисляется ВСЕГДА, даже если Optional не пустой. orElseGet(supplier) — supplier вызывается только при empty. Для дорогих default — orElseGet.

**37. Чем Optional.of от ofNullable отличается?**  
of падает с NPE если value == null. ofNullable допускает null (создаёт empty).

**38. Почему Optional не должен быть полем класса?**  
Не Serializable, лишний объект на каждое поле, путает API (никто не ожидает Optional поле). Используется как возвращаемый тип для явного "может отсутствовать".

**39. Что вернёт Collectors.toMap при дубликате ключей?**  
IllegalStateException. Нужно явно передать merge function: `toMap(keyMapper, valueMapper, (a, b) -> a)` — берёт первое или второе значение.

**40. Чем Stream.toList() от Collectors.toList() отличается?**  
`Stream.toList()` (Java 16+) — возвращает immutable список. `Collectors.toList()` — mutable ArrayList (исторически).

---

## Concurrency (41-60)

**41. Чем volatile от synchronized отличается?**  
volatile гарантирует видимость и запрещает переупорядочивание для одной переменной, но НЕ атомарность (counter++ всё равно race). synchronized — взаимное исключение + видимость + атомарность для блока.

**42. Что такое happens-before?**  
Отношение упорядочивания операций в JMM. Если A happens-before B — результаты A видны B и упорядочены раньше. Создаётся: program order, unlock→lock, volatile write→read, Thread.start()→всё в новом потоке, всё в потоке→join, final-поля после конструктора.

**43. Что такое CAS и где применяется?**  
Compare-And-Swap: атомарная инструкция CPU `compareAndSet(expected, new)`. Атомарно проверяет текущее значение и заменяет если совпало. Основа атомиков, lock-free структур, ConcurrentHashMap.

**44. Что такое ABA-проблема?**  
Значение поменялось A→B→A. CAS не отличит, что менялось. Решение — AtomicStampedReference (значение + версия), CAS на пару.

**45. Чем LongAdder от AtomicLong лучше для счётчиков?**  
AtomicLong — все потоки CAS на одну переменную → high contention. LongAdder — массив "ячеек" по потокам, каждый увеличивает свою → нет contention. sum() приблизителен в момент чтения.

**46. Зачем wait в while а не в if?**  
Spurious wakeup (поток может проснуться без notify); condition мог измениться к моменту wakeup. Цикл проверяет condition и снова уйдёт ждать если нужно.

**47. Что произойдёт с локом при exception в synchronized методе?**  
Лок отпустится автоматически. JVM гарантирует unlock в monitorexit при любом выходе из synchronized.

**48. Чем ReentrantLock лучше synchronized?**  
tryLock(), tryLock(timeout), lockInterruptibly, fair режим (FIFO), несколько Condition. Минус — обязан вручную unlock в finally.

**49. ReadWriteLock — как работает?**  
Много читателей ИЛИ один писатель. Можно даунгрейдить writeLock → readLock в том же потоке, но не наоборот (deadlock).

**50. CountDownLatch vs CyclicBarrier — разница?**  
Latch одноразовый — счётчик не сбрасывается, после 0 нельзя использовать. Barrier сбрасывается, можно использовать многократно. Latch — "ждать пока N задач завершится", Barrier — "точка встречи N потоков".

**51. Чем опасен Executors.newCachedThreadPool в проде?**  
Unbounded threads — может создать тысячи при нагрузке → OOM, native thread limit. Используй ThreadPoolExecutor напрямую с ограниченной max + bounded queue + CallerRunsPolicy.

**52. Чем опасен Executors.newFixedThreadPool?**  
Unbounded LinkedBlockingQueue — задачи могут копиться бесконечно → OOM heap. Опять же — ThreadPoolExecutor с bounded queue.

**53. ThreadLocal в пуле — какая опасность?**  
Поток в пуле живёт долго; значение ThreadLocal остаётся между задачами. Если не вызывать `remove()` в finally — предыдущая задача "загрязняет" следующую и значение никогда не очищается → утечка памяти.

**54. Чем CompletableFuture от Future лучше?**  
Composition (`thenApply`, `thenCompose`, `thenCombine`), параллельные ожидания (`allOf`, `anyOf`), exception handling (`exceptionally`, `handle`), timeout (`orTimeout`). Future умеет только `get()`/`cancel()`.

**55. thenApply vs thenApplyAsync — где выполняется?**  
thenApply — в потоке, который завершил предыдущую стадию. thenApplyAsync — в указанном пуле (или ForkJoinPool.commonPool по умолчанию).

**56. Что такое safe publication?**  
Способы сделать новый объект видимым другим потокам полностью инициализированным: volatile field, final field, synchronized, static initializer, concurrent collection. Без — может видеть частично-инициализированное состояние.

**57. Что такое Virtual Threads и когда использовать?**  
Java 21. Лёгкие user-level потоки, монтируются на небольшое число carrier threads. Идеальны для IO-bound (миллионы блокирующих вызовов). Не для CPU-bound. НЕ пулить. synchronized пиннит к carrier — лучше ReentrantLock.

**58. Что такое Structured Concurrency?**  
Java 21+ (preview). StructuredTaskScope группирует параллельные задачи; при отмене одной — остальные автоматически отменяются. Безопаснее голых CompletableFuture.

**59. Как избежать deadlock?**  
Упорядочить взятие локов (всегда A потом B), использовать tryLock с таймаутом, минимизировать удержание лока, избегать вложенных synchronized. Detection — `jstack` сам показывает.

**60. Что такое immutable объект и зачем?**  
final class, private final поля, без сеттеров, defensive copy для mutable полей. Thread-safe by default, безопасно публиковать, кэшируемый hashCode. Примеры: String, BigDecimal, java.time.*.

---

## JVM / GC (61-72)

**61. Опиши области памяти JVM.**  
Heap (общий, объекты): Young (Eden + S0/S1) + Old; Metaspace (off-heap, метаданные классов); Stack (на поток, фреймы методов); PC register; Native method stack; Code cache (JIT).

**62. Где живут примитивы, объекты, static-поля?**  
Локальные примитивы — на стеке (в фрейме). Объекты — на heap. Поля объекта — внутри объекта на heap. Static-поля — в Class-объекте (на heap, но GC roots).

**63. Что такое TLAB?**  
Thread-Local Allocation Buffer — у каждого потока свой кусок Eden. Аллокация = bump-pointer без синхронизации, поэтому супербыстрая. При исчерпании — запросит новый.

**64. Как работает G1?**  
Heap делится на ~2048 регионов (Eden/Survivor/Old/Humongous). G1 знает примерный мусор в каждом и приоритизирует регионы с большим мусором → "garbage first". Pause time goal — `-XX:MaxGCPauseMillis=200`.

**65. Чем ZGC от G1 отличается?**  
ZGC — concurrent collector, паузы sub-millisecond, до 16TB heap. Использует coloured pointers и load barriers. С Java 21 — generational. G1 более balanced, ZGC — для low-latency.

**66. Чем Soft, Weak, Phantom ссылки отличаются?**  
Soft — собирается JVM при нехватке памяти (для memory-sensitive cache). Weak — собирается на следующем GC если нет сильных ссылок. Phantom — после finalize, для cleanup-логики (Cleaner API).

**67. Назови 5 классических причин утечек памяти.**  
1) Static collections без удаления; 2) ThreadLocal в пуле без remove; 3) Незакрытые ресурсы (Stream/Connection/File); 4) Listeners/callbacks без отписки; 5) Inner class держит outer (или ClassLoader leaks при redeploy).

**68. Какие OOM ошибки бывают?**  
Java heap space (heap полный); GC overhead limit exceeded (>98% времени в GC); Metaspace (классов слишком много); Direct buffer memory (off-heap); unable to create new native thread (OS limit); Requested array size exceeds VM limit.

**69. Как снять и анализировать heap dump?**  
`jcmd <pid> GC.heap_dump file.hprof` или `-XX:+HeapDumpOnOutOfMemoryError -XX:HeapDumpPath=...`. Анализ в Eclipse MAT: Leak Suspects Report (auto), Dominator Tree (retained heap).

**70. Что показывает thread dump?**  
Состояние каждого потока (RUNNABLE/BLOCKED/WAITING), stack trace, на каком мониторе ждёт, кто держит лок, deadlock-detection. Снять `jstack <pid>`. Искать contention (много BLOCKED на одном lock), CPU hotspots (много RUNNABLE на одном стеке).

**71. Что такое JIT и tiered compilation?**  
Just-In-Time компилятор переводит "горячий" байткод в нативный код. Tiered: интерпретатор → C1 (быстро) → C2 (агрессивные оптимизации). Решает по счётчикам вызовов.

**72. Как настроить JVM в k8s контейнере?**  
`-XX:MaxRAMPercentage=75` (75% от cgroup memory limit под heap), `-XX:+ExitOnOutOfMemoryError` (рестартнуть pod при OOM), `-XX:+HeapDumpOnOutOfMemoryError`. С Java 11+ JVM автоматически учитывает cgroup лимиты.

---

## Spring (73-85)

**73. Что такое IoC и DI?**  
IoC — Inversion of Control: контейнер управляет жизненным циклом объектов и связями вместо приложения. DI — Dependency Injection: способ внедрения зависимостей (constructor/setter/field).

**74. Какой вид DI лучше и почему?**  
Constructor injection: поля можно final, fail-fast при старте (если зависимости не разрешились), легко тестировать без Spring, явные зависимости. Field injection — anti-pattern (не final, скрытые зависимости).

**75. Полный жизненный цикл бина.**  
Constructor → DI → BeanNameAware/BeanFactoryAware/ApplicationContextAware → BeanPostProcessor.before → @PostConstruct → InitializingBean.afterPropertiesSet → init-method → BeanPostProcessor.after (тут AOP-прокси) → ... → @PreDestroy → DisposableBean.destroy → destroy-method.

**76. Чем @Component от @Bean отличается?**  
@Component — на классе, регистрируется через component scan. @Bean — на методе в @Configuration. @Bean используется когда: класс не свой, нужна сложная инициализация, несколько вариантов одного типа.

**77. Зачем @Configuration проксируется CGLIB?**  
Чтобы вызовы `@Bean`-методов внутри класса возвращали singleton (а не создавали новый объект каждый раз). Если выключить (`proxyBeanMethods=false`) — lite mode, быстрее старт, но методы не самосогласуются.

**78. Что такое self-invocation проблема?**  
Вызов `this.method()` внутри класса не идёт через прокси, поэтому AOP-аспекты (`@Transactional`, `@Async`, `@Cacheable`) не срабатывают. Решения: вынести в другой бин, инжектить self, AspectJ.

**79. JDK proxy vs CGLIB?**  
JDK dynamic proxy — для классов, реализующих интерфейс; прокси реализует тот же интерфейс. CGLIB — наследует класс (нужен для классов без интерфейса); не работает с final классами/методами. По умолчанию Spring предпочитает JDK, переключается на CGLIB через `proxyTargetClass=true`.

**80. Как Spring Boot подгружает auto-configurations?**  
Из `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` (раньше `spring.factories`). Каждая аннотирована `@AutoConfiguration` + `@Conditional*` (на наличие класса/бина/property/etc) — подключается только если условия выполнены.

**81. Порядок property sources в Spring Boot.**  
От низшего приоритета к высшему: дефолты в коде → application.yml в jar → профильные → внешние application.yml → OS env → -D system props → command-line args → @TestPropertySource.

**82. Чем Filter от HandlerInterceptor отличается?**  
Filter — Servlet API, работает на всех запросах включая статику и до DispatcherServlet. Interceptor — Spring, только для контроллеров, имеет доступ к handler. Для CORS/security — Filter; для бизнес-логики типа audit — Interceptor.

**83. Чем @MockBean от @Mock отличается?**  
@Mock — чистый Mockito без Spring (для unit-тестов). @MockBean — заменяет бин в Spring контексте моком (для интеграционных). @MockBean пересоздаёт контекст между тестами с разной конфигурацией → тормозит.

**84. Какие propagation у @Transactional?**  
REQUIRED (default — присоединиться или создать), REQUIRES_NEW (приостановить текущую, открыть новую), NESTED (savepoint), MANDATORY (обязана быть), NEVER (не должна быть), SUPPORTS (присоединиться если есть), NOT_SUPPORTED (приостановить).

**85. Почему checked exception не откатывает @Transactional по умолчанию?**  
Историческое решение (наследие EJB). Spring откатывает только RuntimeException и Error по умолчанию. Чтобы откатить checked — указать `@Transactional(rollbackFor = MyException.class)`.

---

## JPA / БД (86-95)

**86. Что такое ACID?**  
Atomicity (всё или ничего), Consistency (валидное → валидное), Isolation (параллельные транзакции изолированы), Durability (после commit данные не теряются).

**87. Уровни изоляции и от каких аномалий защищают?**  
READ UNCOMMITTED — ничего не запрещает. READ COMMITTED (default PG) — нет dirty read. REPEATABLE READ — нет non-repeatable. SERIALIZABLE — нет phantom. Аномалии: dirty/non-repeatable/phantom/lost update/write skew.

**88. Что такое MVCC?**  
Multi-Version Concurrency Control. Каждая транзакция видит снимок БД на момент старта (или statement). Версии строк хранятся одновременно. Читатели не блокируют писателей и наоборот. PostgreSQL и InnoDB используют.

**89. Optimistic vs Pessimistic locking.**  
Optimistic: поле @Version, при UPDATE проверяется WHERE version=?. Если 0 строк — конфликт → retry. Хорош для read-heavy с редкими конфликтами. Pessimistic: SELECT FOR UPDATE — блокирует строку до commit. Хорош для частых конфликтов, минус — contention/deadlocks.

**90. Что такое N+1 проблема и как лечить?**  
1 запрос → список родителей; для каждого — отдельный запрос на коллекцию (LAZY). Решения: JOIN FETCH в JPQL, @EntityGraph, @BatchSize, FetchMode.SUBSELECT, DTO-проекция через `SELECT new com.x.Dto(...)`.

**91. LAZY vs EAGER — что выбрать?**  
Всегда LAZY, даже для @ManyToOne (явно указать). EAGER приводит к лишним запросам, делает невозможной оптимизацию запросов и ловит в LazyInitializationException-проблемы непредсказуемо.

**92. Persistence context — что это?**  
EntityManager + первый уровень кэша. В пределах одной транзакции один и тот же ID всегда возвращает тот же Java-объект. Hibernate делает dirty checking при flush, сравнивая текущее состояние с snapshot при загрузке.

**93. Состояния сущности.**  
Transient (новая, не в EM); Managed (отслеживается, dirty checking); Detached (контекст закрыт, изменения не применяются); Removed (помечена на удаление).

**94. persist vs merge?**  
persist — для transient (новой), сделает managed; INSERT на flush. merge — для detached, копирует поля в managed; возвращает managed (старый detached остаётся).

**95. Когда индекс НЕ используется?**  
Функция от колонки (LOWER(email)) — нужен функциональный индекс; неявное приведение типа; LIKE '%abc' (с конца); низкая селективность; OR без индекса на каждой колонке; устаревшая статистика (ANALYZE).

---

## REST / Архитектура (96-100)

**96. Какие HTTP методы идемпотентны?**  
GET, HEAD, OPTIONS, PUT, DELETE. Safe (не меняют состояние) — GET, HEAD, OPTIONS. POST и PATCH — не идемпотентны (хотя PATCH может быть).

**97. Чем 401 от 403 отличается?**  
401 Unauthorized — не аутентифицирован (нет токена или невалидный). 403 Forbidden — аутентифицирован, но нет прав на ресурс/действие.

**98. JWT — структура и валидация.**  
header.payload.signature (base64url). Header: alg, typ, kid. Payload: iss, sub, aud, exp, nbf, iat, jti + custom (roles). Validation: подпись (через JWKS issuer'а), exp, nbf, iss, aud. RS256 для микросервисов (асимметричный).

**99. Как Kafka гарантирует порядок?**  
Только внутри партиции. Сообщения с одинаковым ключом всегда попадают в одну партицию (hash(key) % numPartitions) → порядок сохранён по ключу. По всему топику порядка нет.

**100. Что такое Outbox pattern?**  
Решает проблему "атомарно записать в БД и опубликовать событие". В одной транзакции вместе с бизнес-данными пишем событие в `outbox` таблицу. Отдельный процесс (relay) или Debezium/CDC читает outbox и публикует в Kafka. At-least-once, получатель должен быть идемпотентным.

---

## Финал

После прохождения всех 100:
- Где плыл — выпиши и иди в детальный файл темы.
- Запиши себя голосовым на 5-10 случайных вопросов — оцени качество речи.
- За день до интервью прогони ВСЕ ещё раз, отвечая вслух.

Удачи! 🎯

