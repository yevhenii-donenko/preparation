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

