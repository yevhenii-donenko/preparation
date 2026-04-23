# 3. Functional Java, Stream API, Optional — детально

## 3.1 Функциональные интерфейсы

**Функциональный интерфейс** — интерфейс с **ровно одним абстрактным методом** (Single Abstract Method, SAM). `default` и `static` методы не считаются. Рекомендуется аннотировать `@FunctionalInterface` (компилятор проверит).

| Интерфейс | Сигнатура | Назначение |
|---|---|---|
| `Function<T,R>` | `R apply(T)` | T → R |
| `BiFunction<T,U,R>` | `R apply(T,U)` | (T,U) → R |
| `Predicate<T>` | `boolean test(T)` | условие |
| `Consumer<T>` | `void accept(T)` | side effect |
| `Supplier<T>` | `T get()` | фабрика |
| `UnaryOperator<T>` | `T apply(T)` | T → T |
| `BinaryOperator<T>` | `T apply(T,T)` | (T,T) → T |
| `Runnable` | `void run()` | действие без аргументов |
| `Callable<T>` | `T call() throws Exception` | действие с возвратом |

Примитивные специализации (без autoboxing): `IntFunction`, `ToIntFunction`, `IntPredicate`, `IntConsumer`, `IntSupplier`, `IntUnaryOperator`, `IntBinaryOperator` (и аналогично для `long`, `double`).

## 3.2 Лямбды

```java
Runnable r = () -> System.out.println("hi");
Function<Integer,Integer> sq = x -> x * x;
BiFunction<Integer,Integer,Integer> add = (a, b) -> a + b;
```

- Лямбда **захватывает effectively final** переменные. Захват `this` ссылается на внешний класс (в отличие от анонимных классов).
- Под капотом — `invokedynamic` + `LambdaMetafactory`, который генерирует класс лениво при первом вызове. Анонимный класс компилируется в отдельный `.class` всегда.

### Method references

| Вид | Пример |
|---|---|
| Static | `Integer::parseInt` |
| Bound (на конкретном объекте) | `System.out::println` |
| Unbound (на типе, первый аргумент — instance) | `String::length` |
| Constructor | `ArrayList::new` |

## 3.3 Stream API

**Stream** — конвейер операций над источником данных. **Не коллекция, не хранит данные**, не модифицирует источник, **lazy**, одноразовый.

### Структура pipeline

1. **Source** — `collection.stream()`, `Arrays.stream`, `Stream.of`, `Files.lines`, `IntStream.range`, `Stream.generate`, `Stream.iterate`.
2. **Intermediate operations** (lazy, возвращают `Stream`): `filter`, `map`, `flatMap`, `peek`, `distinct`, `sorted`, `limit`, `skip`, `mapToInt`, `boxed`.
3. **Terminal operation** (запускает обработку): `forEach`, `toList`, `collect`, `reduce`, `count`, `min`, `max`, `findFirst`, `findAny`, `anyMatch`, `allMatch`, `noneMatch`.

Без терминальной операции **ничего не выполнится**.

### Lazy & short-circuit

- Элементы тянутся через pipeline по одному (pull-based), а не "filter всего, потом map всего".
- Short-circuit операции (`findFirst`, `anyMatch`, `limit`) могут не обрабатывать весь поток.

```java
list.stream()
    .filter(x -> { System.out.println("f " + x); return x > 0; })
    .map(x -> { System.out.println("m " + x); return x * 2; })
    .findFirst();
// напечатает f/m только до первого подходящего
```

### `map` vs `flatMap`

- `map`: T → R, "1 в 1".
- `flatMap`: T → `Stream<R>`, "1 во многие" (распаковка вложенного потока). Используется, например, для разворачивания `List<List<X>>` в `Stream<X>`.

### Сортировка
`sorted()` — натуральная (требует `Comparable`). `sorted(Comparator)` — кастомная. Сортировка — **stateful**, требует прохода всех элементов и буфера → плохо сочетается с infinite streams без `limit`.

### Параллельные стримы

`stream().parallel()` или `parallelStream()`. Использует общий **`ForkJoinPool.commonPool`** (по числу CPU). Подводные камни:
- Дешёвые операции на маленьких коллекциях — оверхед на split/merge превысит профит.
- **Не используй blocking I/O** в параллельном стриме — заблокируешь общий пул.
- Источник должен хорошо сплититься (`ArrayList`/массив — да; `LinkedList`/`HashSet` — плохо).
- Порядок может теряться (`forEach` vs `forEachOrdered`).
- Накладные расходы на boxing — для чисел используй `IntStream`/`LongStream`.

### Collectors

```java
List<X>            list     = stream.collect(Collectors.toList());     // изменяемый
List<X>            unmod    = stream.toList();                          // Java 16+, immutable
Set<X>             set      = stream.collect(Collectors.toSet());
Map<K, V>          map      = stream.collect(Collectors.toMap(X::key, X::value));
                                          // дубликат ключей → IllegalStateException; нужен merge
Map<K, V>          mapMerge = stream.collect(Collectors.toMap(X::key, X::value, (a, b) -> a));
Map<K, List<V>>    grouped  = stream.collect(Collectors.groupingBy(X::key));
Map<K, Long>       counts   = stream.collect(Collectors.groupingBy(X::key, Collectors.counting()));
Map<Boolean, List<X>> parts = stream.collect(Collectors.partitioningBy(X::isOk));
String             joined   = stream.map(X::name).collect(Collectors.joining(", ", "[", "]"));
```

`reduce` vs `collect`:
- `reduce` — для **immutable** сворачивания (sum, max).
- `collect` — для **mutable** аккумуляторов (Builder/коллекции).

### Stateful vs stateless операции

- **Stateless:** `filter`, `map`, `flatMap`, `peek` — независимы от других элементов.
- **Stateful:** `distinct`, `sorted`, `limit`, `skip` — нуждаются в состоянии/буфере. С infinite stream работают плохо (`distinct`/`sorted` могут не завершиться).

### Stream gotchas
- **Stream одноразовый** — повторный вызов терминальной операции бросит `IllegalStateException`.
- `peek` — **для отладки**, не для side-effect (после `findFirst` лишние элементы могут не "пикнуться").
- В `forEach` параллельного стрима **не модифицируй внешнее состояние** без синхронизации — UB.
- `Stream.generate(...)` infinite — обязателен `limit`.

## 3.4 Optional

Контейнер для значения, которое может отсутствовать. Цель — **явное** API, чтобы клиент знал про возможный "пустой" результат и не получал `NPE`.

### Создание
- `Optional.empty()`
- `Optional.of(value)` — `value` обязан быть non-null, иначе `NPE`.
- `Optional.ofNullable(value)` — допускает `null`.

### Использование
- `isPresent()`, `isEmpty()` (Java 11+).
- `get()` — **избегать** (бросает `NoSuchElementException`); если уж — после проверки.
- `ifPresent(Consumer)`, `ifPresentOrElse` (Java 9+).
- `orElse(default)` — default считается **всегда** (даже если значение есть!).
- `orElseGet(Supplier)` — supplier вызывается только если empty (предпочтительно, когда default дорогой).
- `orElseThrow()` / `orElseThrow(Supplier)`.
- `map`, `flatMap`, `filter` — как у Stream.
- `stream()` (Java 9+) — превратить в `Stream` (0 или 1 элемент).

### Best practices
- Используй как **возвращаемый тип**, не как поле/параметр.
- Не возвращай `Optional<Collection>` — возвращай пустую коллекцию.
- Не делай `if (opt.isPresent()) opt.get()` — используй `ifPresent`/`map`/`orElse`.
- Не сериализуй (не `Serializable`).
- Для примитивов — `OptionalInt`, `OptionalLong`, `OptionalDouble`.

## 3.5 Часто задают

- В чём отличие `map` от `flatMap`?
- Почему стримы lazy и что это даёт?
- Когда параллельный стрим выгоден, когда вреден?
- Чем `reduce` отличается от `collect`?
- `orElse` vs `orElseGet`?
- Почему `Optional` не поле?
- Можно ли стрим запустить дважды? (Нет.)
- Что делает `peek`?
- Как сгруппировать `List<User>` в `Map<City, List<User>>`? (`groupingBy(User::getCity)`).
- Как посчитать количество слов? `stream.collect(groupingBy(identity(), counting()))`.


---

# Дополнительные темы Streams / Functional (продолжение)

## 3.6 Полные примеры Stream

### Базовые операции

```java
List<User> users = ...;

// Фильтрация + маппинг + сортировка
List<String> names = users.stream()
    .filter(u -> u.age() >= 18)
    .map(User::name)
    .sorted()
    .toList();                           // Java 16+, immutable

// Группировка
Map<City, List<User>> byCity = users.stream()
    .collect(Collectors.groupingBy(User::city));

// Группировка с подсчётом
Map<City, Long> countByCity = users.stream()
    .collect(Collectors.groupingBy(User::city, Collectors.counting()));

// Группировка со средним
Map<City, Double> avgAge = users.stream()
    .collect(Collectors.groupingBy(User::city,
             Collectors.averagingInt(User::age)));

// Группировка с маппингом значения
Map<City, List<String>> namesByCity = users.stream()
    .collect(Collectors.groupingBy(User::city,
             Collectors.mapping(User::name, Collectors.toList())));

// Несколько уровней группировки
Map<City, Map<Boolean, List<User>>> nested = users.stream()
    .collect(Collectors.groupingBy(User::city,
             Collectors.partitioningBy(u -> u.age() >= 18)));
```

### `toMap` с дубликатами

```java
// ❌ IllegalStateException при дубликате ключа
users.stream().collect(Collectors.toMap(User::name, u -> u));

// ✅ Указать merge function
users.stream().collect(Collectors.toMap(
    User::name,
    Function.identity(),
    (existing, replacement) -> existing));

// ✅ Указать тип Map
users.stream().collect(Collectors.toMap(
    User::name,
    Function.identity(),
    (a, b) -> a,
    LinkedHashMap::new));
```

### `reduce` vs `collect`

```java
// reduce — для immutable аккумулирования
int sum = list.stream().reduce(0, Integer::sum);

Optional<Integer> max = list.stream().reduce(Integer::max);

// collect — для mutable аккумулятора (StringBuilder, List, Map)
String joined = list.stream()
    .map(String::valueOf)
    .collect(Collectors.joining(", ", "[", "]"));
```

### Кастомный Collector

```java
Collector<User, ?, Map<City, Integer>> totalAgeByCity =
    Collectors.groupingBy(
        User::city,
        Collectors.summingInt(User::age)
    );
```

### Stream от других источников

```java
Stream.of("a", "b", "c");
Stream.empty();
Stream.iterate(1, x -> x * 2).limit(10);     // 1, 2, 4, 8, ...
Stream.generate(Math::random).limit(5);
IntStream.range(0, 100);
IntStream.rangeClosed(0, 100);
Arrays.stream(arr);
Files.lines(path);                            // Stream<String>, требует close()
new BufferedReader(...).lines();
String.chars();                               // IntStream
Pattern.compile(",").splitAsStream(csv);
```

### Бесконечные стримы

```java
Stream<Integer> nats = Stream.iterate(1, n -> n + 1);
nats.limit(10).forEach(System.out::println);   // обязательно limit или takeWhile

// takeWhile / dropWhile (Java 9+)
nats.takeWhile(n -> n < 100).toList();
nats.dropWhile(n -> n < 100).limit(5).toList();
```

## 3.7 Примитивные стримы

```java
IntStream.range(0, 100).sum();                  // O(n)
IntStream.range(0, 100).average();              // OptionalDouble
IntStream.range(0, 100).max();                  // OptionalInt
IntStream.range(0, 100).boxed().toList();       // конвертация в Stream<Integer>

users.stream().mapToInt(User::age).sum();       // IntStream — без autoboxing
users.stream().mapToInt(User::age).summaryStatistics();
// IntSummaryStatistics{count=10, sum=350, min=18, average=35.0, max=70}
```

## 3.8 Lazy evaluation — наглядно

```java
List<Integer> result = Stream.of(1, 2, 3, 4, 5)
    .peek(x -> System.out.println("filter " + x))
    .filter(x -> x > 2)
    .peek(x -> System.out.println("map " + x))
    .map(x -> x * 10)
    .findFirst()                                // short-circuit
    .stream().toList();

// Вывод:
// filter 1
// filter 2
// filter 3
// map 3
// (всё, нашли первый — стоп)
```

## 3.9 Параллельные стримы — когда работают

**Хорошо:**
- CPU-bound операции.
- Большой набор данных (>10000 элементов).
- Источник хорошо сплитится: `ArrayList`, массив, `IntStream.range`.
- Stateless и неблокирующие операции.

**Плохо:**
- Маленькие коллекции (оверхед сплита).
- Blocking I/O (заблокируешь общий `commonPool`).
- Stateful или synchronized операции.
- `LinkedList`, `Stream.iterate` — плохо сплитятся.

```java
// Свой пул, чтобы не загрязнять commonPool
ForkJoinPool myPool = new ForkJoinPool(8);
List<Integer> result = myPool.submit(() ->
    list.parallelStream().map(this::heavy).toList()
).get();
```

## 3.10 Stream gotchas

### Stream одноразовый

```java
Stream<Integer> s = Stream.of(1, 2, 3);
s.count();        // OK
s.count();        // IllegalStateException
```

### Не модифицируй источник

```java
List<Integer> list = new ArrayList<>(List.of(1, 2, 3));
list.stream().forEach(list::remove);             // ConcurrentModificationException
```

### `peek` для side effects — не работает с short-circuit

```java
list.stream()
    .peek(x -> log.info("processing {}", x))    // не для всех элементов
    .filter(x -> x > 0)
    .findFirst();
```

`peek` исполняется только для тех элементов, которые реально дошли до терминальной операции.

### `forEach` параллельного стрима — UB при общем mutable state

```java
List<Integer> result = new ArrayList<>();
list.parallelStream().forEach(result::add);     // UB! ArrayList не thread-safe
// Используй collect(Collectors.toList())
```

## 3.11 Optional — полные паттерны

```java
Optional<User> opt = repo.findById(id);

// ✅ Хорошо
opt.map(User::name).orElse("anonymous");
opt.ifPresentOrElse(
    user -> log.info("found {}", user),
    () -> log.warn("not found"));
opt.orElseThrow(() -> new NotFoundException(id));
opt.filter(u -> u.age() >= 18).ifPresent(this::sendMail);

// ❌ Анти-паттерны
if (opt.isPresent()) { use(opt.get()); }        // лучше map/ifPresent
opt.orElse(expensiveDefault());                 // expensive вычисляется всегда!
opt.orElseGet(() -> expensiveDefault());        // ✅ только при empty

// flatMap для вложенных Optional
Optional<Address> addr = userOpt.flatMap(User::getAddress);

// Stream API на Optional
List<User> users = ids.stream()
    .map(repo::findById)        // Stream<Optional<User>>
    .flatMap(Optional::stream)  // Stream<User> — пропускает empty
    .toList();
```

### Когда НЕ использовать Optional

- Поле класса (`Optional` не Serializable, лишний объект).
- Параметр метода (передавай null или используй overloading).
- Возврат `Optional<Collection>` — возвращай пустую коллекцию.
- `Optional<Optional<T>>` — почти всегда дизайн-баг.

## 3.12 Полезные Collectors

```java
Collectors.toList();            // mutable List (от Java 16 — toList() в Stream возвращает immutable)
Collectors.toUnmodifiableList();
Collectors.toSet();
Collectors.toMap(...);
Collectors.groupingBy(...);
Collectors.partitioningBy(...);
Collectors.counting();
Collectors.summingInt(...);
Collectors.averagingDouble(...);
Collectors.maxBy(comparator);
Collectors.minBy(comparator);
Collectors.joining(delim, prefix, suffix);
Collectors.mapping(mapper, downstream);
Collectors.flatMapping(mapper, downstream);     // Java 9+
Collectors.filtering(predicate, downstream);    // Java 9+
Collectors.collectingAndThen(downstream, finisher);
Collectors.reducing(identity, mapper, op);
Collectors.teeing(c1, c2, merger);              // Java 12+ — два сборщика параллельно

// Пример teeing
record Stats(double avg, long count) {}
Stats s = list.stream().collect(Collectors.teeing(
    Collectors.averagingDouble(Double::doubleValue),
    Collectors.counting(),
    Stats::new));
```

## 3.13 Функциональные интерфейсы — полная таблица

| Интерфейс | Метод | T → R |
|---|---|---|
| `Function<T,R>` | `R apply(T)` | да |
| `BiFunction<T,U,R>` | `R apply(T,U)` | да |
| `Predicate<T>` | `boolean test(T)` | T → boolean |
| `BiPredicate<T,U>` | `boolean test(T,U)` | |
| `Consumer<T>` | `void accept(T)` | T → void |
| `BiConsumer<T,U>` | `void accept(T,U)` | |
| `Supplier<T>` | `T get()` | () → T |
| `UnaryOperator<T>` | `T apply(T)` | T → T |
| `BinaryOperator<T>` | `T apply(T,T)` | (T,T) → T |
| `Runnable` | `void run()` | () → void |
| `Callable<T>` | `T call() throws Exception` | () → T |

Примитивные специализации (избежать boxing): `IntFunction`, `IntPredicate`, `IntConsumer`, `IntSupplier`, `IntUnaryOperator`, `IntBinaryOperator`, `ToIntFunction`, `ToIntBiFunction`, и аналоги для `long`/`double`.

## 3.14 Композиция функций

```java
Function<Integer, Integer> plus2 = x -> x + 2;
Function<Integer, Integer> times3 = x -> x * 3;

Function<Integer, Integer> f1 = plus2.andThen(times3);    // (x + 2) * 3
Function<Integer, Integer> f2 = plus2.compose(times3);    // (x * 3) + 2

Predicate<String> notNull = Objects::nonNull;
Predicate<String> notEmpty = s -> !s.isEmpty();
Predicate<String> validString = notNull.and(notEmpty);
Predicate<String> isNullOrEmpty = notNull.negate().or(notEmpty.negate());
```

## 3.15 Дополнительные частые вопросы

- Что такое intermediate vs terminal операция?
- Что значит "stream lazy"?
- Чем `map` отличается от `flatMap`? Приведи пример.
- Чем `findFirst` отличается от `findAny`?
- Почему параллельный стрим может вернуть результаты в другом порядке?
- Что произойдёт при `Stream.parallel().forEach()` на mutable List?
- Чем `reduce` от `collect` отличается?
- Чем `Collectors.toList()` отличается от `Stream.toList()`?
- Когда `Optional.orElse` вреден?
- Чем `Optional.map` от `flatMap` отличается?
- Можно ли использовать стрим повторно?
- Как сгруппировать с подсчётом?
- Что такое `IntStream.summaryStatistics()`?
- Зачем `peek`?
- Почему лямбда не может изменять не-final локальные переменные?
- Что такое method reference и какие виды бывают?
- Чем лямбда отличается от анонимного класса (this, .class файлы)?

---

# Глубокие объяснения: как Stream API работает внутри

Stream API — это не просто удобный синтаксис для цикла. За ним стоит строгая модель обработки "по одному элементу", и понимание этой модели объясняет все странности (почему `peek` иногда не вызывается, почему параллельные стримы ломаются, почему `reduce` и `collect` — разные звери).

## Жизненный цикл одного элемента в pipeline

Главное заблуждение — думать, что стрим работает "как цикл за циклом". То есть сначала `filter` пробежит по всем элементам, потом `map` по отфильтрованным, потом `collect` соберёт. На самом деле **всё наоборот**.

Стрим — это **pull-based pipeline**. Терминальная операция в конце — главный двигатель. Она "тянет" один элемент из стадии перед ней, та — один из предыдущей, и так до источника. Когда элемент появляется на входе, он проходит **всю цепочку до конца** (или пока какая-то стадия его не отфильтрует), и только потом запрашивается следующий. Это важно: **один элемент не ждёт остальных**.

Эта модель объясняет все особенности:
- **Lazy** — до вызова терминальной операции ничего не происходит, потому что "тянуть" некому.
- **Short-circuit** — `findFirst` тянет, пока не получит первый подходящий, потом останавливается. Остальные элементы никогда не обрабатываются.
- **`peek` после `findFirst`** — может не увидеть некоторые элементы, потому что pipeline остановился раньше.

Под капотом это реализовано через `Spliterator` (источник) и `Sink` (цепочка обработчиков). Каждая промежуточная операция оборачивает предыдущий Sink, добавляя свою логику. Терминальная операция — тот самый "двигатель", который вызывает `Spliterator.tryAdvance`, передавая результат через цепочку Sink'ов.

## Почему `sorted` и `distinct` — особые

Есть две категории промежуточных операций: **stateless** и **stateful**.

**Stateless** (`filter`, `map`, `flatMap`, `peek`) принимают один элемент, делают что-то и передают дальше. Им не нужно помнить предыдущие элементы. Это идеально для lazy pipeline: элемент вошёл → вышел → забыли.

**Stateful** (`sorted`, `distinct`, `limit`, `skip`) не могут работать по одному элементу. `sorted` должен сначала собрать **все** элементы в буфер, отсортировать, потом выдавать. `distinct` — хранить set виденных элементов. Это ломает lazy-модель: `sorted` **обязан** обработать весь upstream, прежде чем выдать первый элемент downstream.

**Практическое следствие.** На бесконечном стриме (`Stream.iterate`) без `limit` перед `sorted` программа просто **не завершится** — `sorted` будет пытаться собрать все элементы, пока не кончится память. Правильно: `Stream.iterate(...).limit(1000).sorted()`.

**Ещё важное следствие для производительности.** Если после `sorted` идёт `filter`, вы отсортировали всё, а потом выкинули половину. Делайте наоборот: `filter` сначала, `sorted` потом. В SQL-оптимизаторах это называется "predicate pushdown", и в стримах **оптимизации нет** — порядок операций именно такой, как вы написали.

## Параллельные стримы — ловушка со множеством дверей

Параллельный стрим выглядит соблазнительно: добавил `.parallel()` и получил ускорение в N раз, где N — число CPU. В реальности — чаще получается замедление или непредсказуемое поведение.

**Где живёт параллелизм.** `parallelStream()` использует **общий ForkJoinPool.commonPool** — один на всю JVM. Его размер по умолчанию — `Runtime.availableProcessors() - 1`. Это означает:
1. Все параллельные стримы конкурируют за один пул.
2. Если один стрим делает blocking I/O (чтение из БД), он **выключает** поток из пула на всё время ожидания. Остальные стримы ждут.
3. Если вы в Spring или Servlet-контексте, HTTP-треды могут ждать commonPool, и сервер деградирует.

**Где живёт корректность.** Параллельный стрим разбивает данные через `Spliterator.trySplit`. Насколько хорошо делится источник:
- `ArrayList`, `long[]`, `IntStream.range` — **идеально** (разделение за O(1) на два равных куска).
- `HashSet`, `HashMap.values()` — **средне** (разделение за O(n) на неравные куски).
- `LinkedList`, `BufferedReader.lines()`, `Stream.iterate` — **плохо** (нельзя эффективно разделить).

Для плохо делимых источников параллелизм замедляет: оверхед на координацию forkJoin'ов > выгода от параллельного выполнения.

**Где живёт дьявол — общее состояние.** Если в `forEach` вы меняете общий `ArrayList`, это **не потокобезопасно**, и результат может быть мусором (не ConcurrentModificationException — хуже: потери, дубли, частично записанные объекты). Правильно — использовать `collect` с thread-safe коллектором. **Никогда** не делайте `parallelStream().forEach(list::add)` — это bug-магнит.

**Порядок результатов.** `forEach` на параллельном стриме **не гарантирует порядок**. Если порядок важен — используйте `forEachOrdered`, но это существенно снижает параллелизм (требует синхронизации).

**Когда параллельный стрим реально выгоден:**
- Данных много (десятки тысяч + элементов).
- Операция над элементом — CPU-bound и нетривиальная (хеш, шифрование, парсинг).
- Источник хорошо делится.
- Нет общего состояния.
- Нет blocking I/O.

В остальных случаях — обычный стрим или явный `ExecutorService` под контролем.

## Collector — три функции, из которых собрано всё

`Collector` — это не магия. Он состоит из пяти частей, но три ключевые:

1. **Supplier<A>** — создаёт **промежуточный аккумулятор**. Для `toList` это `ArrayList::new`. Для `joining` — `StringBuilder::new`.
2. **BiConsumer<A, T>** — добавляет элемент в аккумулятор. Для `toList` это `List::add`.
3. **BinaryOperator<A>** — объединяет два аккумулятора. Нужно **только для параллельных стримов**. Для `toList` это что-то вроде `(a, b) -> { a.addAll(b); return a; }`.

Плюс опциональные:
- **Function<A, R>** — финализация (например, превращает `StringBuilder` в `String`).
- **Set<Characteristics>** — подсказки (`CONCURRENT`, `UNORDERED`, `IDENTITY_FINISH`) для оптимизации.

Это даёт понимание ключевого различия:
- **`reduce`** работает с **immutable** значениями: каждый шаг создаёт новое значение. Для суммы чисел это нормально. Для собирания строк в `String` через `reduce` — катастрофа: `O(n²)` аллокаций, потому что каждый `+` создаёт новую строку.
- **`collect`** работает с **mutable** аккумулятором: добавление в `StringBuilder` — O(1) amortized. Для "собрать результаты в коллекцию" всегда используйте `collect`.

**Собственный Collector** пишется через `Collector.of(supplier, accumulator, combiner)`. Редко нужно, но когда нужно — знание модели даёт понимание.

## Optional — контракт, а не контейнер

`Optional` часто используют неправильно, потому что воспринимают его как "wrapper для null". На самом деле это **часть сигнатуры метода**, говорящая клиенту: "результата может не быть, и это нормальная часть API, а не ошибка".

**Что он делает хорошо.** Возвращаемый тип метода: `Optional<User> findByEmail(String email)`. Клиент видит — и компилятор напоминает — что нужно обработать случай "не нашли". Это ясно выражает API и убирает потребность в null-проверке "по соглашению".

**Что не надо.**
- **Поле класса.** Поля с `Optional` делают сериализацию проблемной (Optional не Serializable), добавляют лишний уровень indirection, и вообще изменяемое поле типа "может быть значение, может не быть" — это просто nullable-поле.
- **Параметр метода.** Это удваивает количество вариантов вызова: `foo(Optional.empty())` vs `foo(Optional.of(x))`. Используйте перегрузку или передавайте null с явным `@Nullable`.
- **`Optional<Collection>`** вместо пустой коллекции. Коллекция сама — хороший "Optional": пустая коллекция означает "нет данных".

**`orElse` vs `orElseGet` — важная разница.** `orElse(expensive())` вызывает `expensive()` **всегда**, даже если значение есть. `orElseGet(() -> expensive())` — только если значения нет. Когда default дорогой (запрос в БД, генерация ID) — всегда `orElseGet`.

**`get()` — это `NoSuchElementException` ждёт.** Использование `opt.get()` без проверки — тот же антипаттерн, что `map.get(key).toString()` без проверки на null. Используйте `ifPresent`, `map`, `orElse`, `orElseThrow(() -> ...)`.

## Лямбды под капотом — `invokedynamic` и LambdaMetafactory

Когда вы пишете `Function<String, Integer> f = String::length`, компилятор не создаёт анонимный класс. Вместо этого в байткоде появляется одна инструкция **invokedynamic**. При первом выполнении этой инструкции JVM вызывает **bootstrap method** — `LambdaMetafactory.metafactory`, который **в рантайме** генерирует маленький класс-имплементацию `Function`, кэширует его и возвращает инстанс.

**Преимущества этого подхода:**
1. **Ленивая генерация.** Если лямбду никогда не выполнили — класс не создан, байт-коду меньше.
2. **Гибкость.** JVM может оптимизировать генерацию на основе платформы (например, для `Supplier<String>` со stateless-лямбдой можно вернуть singleton).
3. **Меньше байткода.** Анонимный класс — отдельный `.class` файл. Лямбда — несколько инструкций в вызывающем методе.

**`this` в лямбде и анонимном классе разный.** В анонимном классе `this` — это **сам анонимный объект**. В лямбде `this` — это enclosing instance (внешний класс). Это важно для дебаггинга и для кода, который передаёт `this` (например, в `addListener(this)`).

**Captured variables — effectively final.** Лямбда "захватывает" локальные переменные из окружения. Но JVM захватывает их **по значению** (копирует в поле сгенерированного класса). Поэтому если бы вы могли изменять переменную — лямбда не увидела бы изменений. Чтобы избежать путаницы, компилятор требует, чтобы захватываемая переменная была `final` или **effectively final** (не изменяется после инициализации).


