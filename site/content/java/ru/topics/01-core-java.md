# 1. Core Java — детально

## 1.1 JDK / JRE / JVM

- **JVM (Java Virtual Machine)** — спецификация и реализация виртуальной машины, которая исполняет байткод (`.class`). Делает: загрузка классов, верификация байткода, JIT-компиляция, управление памятью (GC), интерпретация. Реализаций много: HotSpot (Oracle/OpenJDK — самая популярная), GraalVM, OpenJ9, Azul Zing.
- **JRE (Java Runtime Environment)** — JVM + стандартные библиотеки (`java.lang`, `java.util`, …). Достаточно, чтобы **запустить** программу. Начиная с Java 11 отдельно не поставляется — есть только JDK, из которого через `jlink` можно собрать минимальный рантайм.
- **JDK (Java Development Kit)** — JRE + инструменты разработчика: `javac`, `javadoc`, `jar`, `jlink`, `jdeps`, `jcmd`, `jstack`, `jmap`, `jfr`, отладчик `jdb`.

**Как исполняется код:**
1. `javac` компилирует `.java` → `.class` (платформонезависимый байткод стек-машины).
2. ClassLoader подгружает классы.
3. Bytecode verifier проверяет корректность.
4. Interpreter исполняет байткод; "горячие" методы перекомпилируются JIT'ом в нативный код.

**JIT в HotSpot:** два уровня — **C1 (Client)** быстрая компиляция с базовыми оптимизациями, **C2 (Server)** агрессивные оптимизации (inlining, escape analysis, scalar replacement, dead code elimination, loop unrolling). Tiered compilation: сначала C1 → собираем профиль → C2.

**AOT / GraalVM Native Image** — компиляция в нативный бинарь до запуска: мгновенный старт, низкое потребление памяти, но нет рантайм-оптимизаций по профилю и серьёзные ограничения (рефлексия, динамические прокси, ресурсы — нужно конфигурировать). Идеально для serverless / CLI.

## 1.2 Версии Java — что важно знать

| Версия | LTS | Главное |
|--------|-----|---------|
| 8 (2014) | ✅ | Lambdas, Stream API, `Optional`, `java.time`, default-методы в интерфейсах |
| 9 | | Модули (JPMS), `var` нет ещё, `JShell`, factory-методы коллекций (`List.of`) |
| 10 | | `var` (local variable type inference) |
| 11 | ✅ | `String` методы (`isBlank`, `lines`, `strip`), HTTP Client, `Files.readString`, удалили JEE-модули |
| 14 | | `switch` expressions (final), helpful NPE |
| 15 | | Text blocks (final), sealed (preview), ZGC (production) |
| 16 | | Records (final), Pattern matching for `instanceof` (final) |
| 17 | ✅ | Sealed classes (final), pattern matching switch (preview), удалили Applet API |
| 21 | ✅ | **Virtual Threads** (final), Pattern matching for switch (final), Record patterns (final), Sequenced Collections, Generational ZGC |

**Ключевые фичи современной Java для интервью:**

```java
// var
var list = new ArrayList<String>();           // только локальные переменные

// records — immutable data carrier
public record Point(int x, int y) {}          // equals/hashCode/toString бесплатно

// sealed — ограниченная иерархия
public sealed interface Shape permits Circle, Square, Triangle {}

// pattern matching for instanceof
if (obj instanceof String s && !s.isBlank()) { ... }

// switch expressions + pattern matching (Java 21)
String result = switch (shape) {
    case Circle c    -> "circle r=" + c.radius();
    case Square s    -> "square " + s.side();
    case Triangle t  -> "triangle";
};

// text blocks
String json = """
    { "name": "Bob" }
    """;

// virtual threads (Java 21)
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    executor.submit(() -> ...);
}
```

## 1.3 Примитивы и обёртки

| Тип | Размер | Диапазон | Default |
|-----|--------|----------|---------|
| `byte` | 8 | -128..127 | 0 |
| `short` | 16 | -32k..32k | 0 |
| `int` | 32 | ±2.1·10⁹ | 0 |
| `long` | 64 | ±9.2·10¹⁸ | 0L |
| `float` | 32 | IEEE 754 | 0.0f |
| `double` | 64 | IEEE 754 | 0.0d |
| `char` | 16 | UTF-16 code unit | '\u0000' |
| `boolean` | JVM-зависим | true/false | false |

- **Autoboxing/unboxing** — автопреобразование `int ↔ Integer`. Может бросить `NullPointerException` при unboxing `null`. Имеет накладные расходы — в горячем цикле использовать примитивы.
- **Integer cache** `[-128; 127]` — `Integer.valueOf(100) == Integer.valueOf(100)` → `true`, а `200 == 200` → `false`. Всегда сравнивать обёртки через `equals`.
- Float-арифметика **не точна** — для денег `BigDecimal` (и обязательно через строковый конструктор: `new BigDecimal("0.1")`, не `new BigDecimal(0.1)`).

## 1.4 String, StringBuilder, StringBuffer

- `String` **immutable, final**. Все модификации возвращают новую строку.
- **String pool** — область в heap (с Java 7), куда складываются строковые литералы. `"abc" == "abc"` → `true` (оба ссылаются на один объект из пула). `new String("abc") == "abc"` → `false`.
- `intern()` — кладёт строку в пул и возвращает каноническую ссылку.
- **Compact strings** (Java 9+): внутри `byte[]` + флаг кодировки (LATIN1 / UTF-16) — экономия памяти.
- `StringBuilder` — **не потокобезопасен**, быстрый. `StringBuffer` — synchronized, медленный (легаси). В одном потоке — всегда `StringBuilder`.
- В Java 9+ `+` для строк компилируется через `invokedynamic` → `StringConcatFactory`, поэтому `+` в большинстве случаев не уступает `StringBuilder`. Но в **циклах** `StringBuilder` всё ещё оптимальнее.

**Почему String immutable:**
1. **Безопасность** — строки используются как имена классов, URL, пути файлов, ключи в `HashMap`.
2. **Кэшируемый `hashCode`** — считается один раз.
3. **String pool** возможен только для immutable.
4. **Потокобезопасность** "из коробки".

## 1.5 ООП — 4 принципа

- **Инкапсуляция** — сокрытие внутренней реализации; доступ только через публичный API. В Java: `private` поля + методы / геттеры (а лучше — поведение, а не геттеры).
- **Наследование** — `extends`. Один родитель, много интерфейсов. Наследовать имеет смысл при реальном "is-a", иначе — композиция.
- **Полиморфизм** — *subtype polymorphism* (виртуальные вызовы по типу объекта в рантайме), *parametric* (generics), *ad-hoc* (перегрузка).
- **Абстракция** — выделение существенного, скрытие деталей; абстрактные классы и интерфейсы.

### Abstract class vs interface

| | abstract class | interface |
|---|---|---|
| Состояние (поля) | да (любые) | только `public static final` |
| Конструктор | да | нет |
| Множественное наследование | нет | да |
| Default методы | методы со static-биндингом | `default`, `static`, `private` (с Java 8/9) |
| Семантика | "is-a" с базой | "может" / контракт |

Правило: **сначала interface**, abstract class — когда нужен общий код или состояние.

### SOLID — с примерами

- **S — Single Responsibility.** Класс/модуль — одна причина для изменения. Не мешать парсинг + бизнес-логику + persistence в одном классе.
- **O — Open/Closed.** Открыт для расширения, закрыт для модификации. Реализуется через полиморфизм/стратегии: добавляешь новую реализацию интерфейса вместо `if-else if-else if` по типу.
- **L — Liskov Substitution.** Подкласс должен заменять родителя без поломки контракта. Классический антипример: `Square extends Rectangle` — `setWidth` ломает инвариант квадрата.
- **I — Interface Segregation.** Много мелких специализированных интерфейсов лучше, чем один "толстый". Клиент не должен зависеть от методов, которые не использует.
- **D — Dependency Inversion.** Зависимости — на абстракции, не на конкретные классы. Высокоуровневые модули не зависят от низкоуровневых; и те и другие — от абстракций. Реализуется через DI.

### `equals` / `hashCode` контракт

1. **Рефлексивность:** `x.equals(x)`.
2. **Симметричность:** `x.equals(y) ⇔ y.equals(x)`.
3. **Транзитивность:** `x=y, y=z ⇒ x=z`.
4. **Согласованность:** результат не меняется, если поля не меняются.
5. `x.equals(null) == false`.
6. **`equals` ⇒ одинаковый `hashCode`** (обратное не обязано).

Если переопределил `equals` — обязан `hashCode`, иначе всё сломается в `HashMap`/`HashSet`. Записи (`record`) генерируют корректные `equals/hashCode/toString` автоматически. Используй `Objects.equals(...)` и `Objects.hash(...)`.

### `Comparable` vs `Comparator`

- `Comparable<T>` — естественный порядок, метод `compareTo`. Один на класс. Должен быть согласован с `equals` (иначе странности в `TreeMap`).
- `Comparator<T>` — внешний компаратор, можно много. `Comparator.comparing(...).thenComparing(...).reversed()`.

## 1.6 Исключения

```
Throwable
├── Error            // фатально (OOM, StackOverflow) — не ловим
└── Exception        // checked
    └── RuntimeException  // unchecked
```

- **Checked** — обязаны быть в `throws` или обработаны (`IOException`, `SQLException`). Идея — заставить разработчика подумать.
- **Unchecked** — ошибки программирования (`NullPointerException`, `IllegalArgumentException`, `IllegalStateException`).
- **Error** — проблемы JVM (`OutOfMemoryError`, `StackOverflowError`).

### Best practices
- **Не глотать** (`catch (Exception e) {}`) — минимум залогировать.
- Не ловить `Throwable`/`Error`.
- Не использовать исключения для управления потоком (дорого: построение стектрейса).
- Бросать наиболее **конкретный** тип; ловить — самый конкретный, который реально умеешь обработать.
- Заворачивая в свой тип — сохраняй cause: `throw new MyException("...", e)`.
- В библиотеках — checked для recoverable, unchecked для programming errors. В современных API часто всё unchecked (Spring, JDBC через Spring и т.д.).

### try-with-resources

```java
try (var in = new FileInputStream(f);
     var out = new FileOutputStream(g)) {
    in.transferTo(out);
}
```

Закрывает в **обратном** порядке. Если и `try`, и `close()` бросают — основное идёт первым, остальные доступны через `e.getSuppressed()`. Работает для всего, что реализует `AutoCloseable`.

### Хитрые случаи
- `finally` всегда выполняется, кроме `System.exit` и kill JVM. Если в `finally` `return` или `throw` — он "съедает" исходный результат/исключение (антипаттерн).
- `try-with-resources` устраняет необходимость писать `finally` для close.

## 1.7 Generics

- Введены в Java 5. Реализованы через **type erasure** — после компиляции дженерик-параметры стираются (заменяются на bound, по умолчанию `Object`). В рантайме `List<String>` и `List<Integer>` — один и тот же класс `List`.
- Из этого следствия:
  - Нельзя `new T()`, `new T[10]`, `T.class`.
  - Нельзя `instanceof List<String>` (только `List<?>`).
  - Нет статических полей с параметром типа.
  - Перегрузка по дженерик-параметрам не работает (`foo(List<String>)` и `foo(List<Integer>)` — конфликт).
- **Bridge methods** — компилятор генерирует синтетические методы для сохранения полиморфизма после стирания.

### Wildcards и PECS

- `List<? extends Number>` — *covariant*, можно **читать** (получим `Number`), но нельзя добавлять (кроме `null`).
- `List<? super Integer>` — *contravariant*, можно **класть** `Integer`, но при чтении получим `Object`.
- **PECS — Producer Extends, Consumer Super.** Если коллекция отдаёт T — `extends`; если принимает — `super`.

```java
public static <T> void copy(List<? super T> dest, List<? extends T> src) { ... }
```

### Bounded type parameters

```java
<T extends Comparable<T>> T max(List<T> list) { ... }
<T extends Number & Serializable> ...   // несколько границ через &
```

### Reified vs erased
В Java дженерики **non-reified** — тип неизвестен в рантайме. В Kotlin есть `inline reified`. В Java приходится передавать `Class<T>` (паттерн "type token") или `TypeReference` (Jackson).

## 1.8 Модификаторы и важные ключевые слова

- `static` — принадлежит классу, а не экземпляру. Static-блок инициализации выполняется при загрузке класса.
- `final` — переменная неизменяема, метод нельзя переопределить, класс нельзя наследовать. Помогает JIT (escape analysis).
- `transient` — поле не сериализуется (стандартная Java-сериализация).
- `volatile` — гарантирует видимость изменений между потоками (см. concurrency).
- `synchronized` — монитор (см. concurrency).
- `native` — реализация на C/C++ (JNI).
- `strictfp` — строгая IEEE 754 арифметика (с Java 17 поведение по умолчанию).

## 1.9 Перегрузка vs переопределение

- **Overloading** — статически (по типам аргументов), на этапе компиляции. Возвращаемое значение НЕ участвует в выборе.
- **Overriding** — динамически, по типу объекта в рантайме. Сигнатура должна совпадать; возвращаемый тип может быть **ковариантным**; checked-исключение — не шире родительского; модификатор доступа — не уже.

## 1.10 Часто задают на интервью

- Что выведет `Integer a = 127; Integer b = 127; a == b;`? → `true`. С `200` → `false`.
- Можно ли в `switch` положить `String`? → да, с Java 7. С Java 21 — pattern matching.
- Что такое immutable объект? Как сделать класс immutable: `final class`, `private final` поля, без сеттеров, defensive copy для mutable полей в конструкторе/геттере.
- Чем `==` отличается от `equals`? Для примитивов — сравнение значения, для ссылок — сравнение ссылок. `equals` — логическое равенство.
- Как работает `hashCode` по умолчанию? Возвращает значение, основанное на адресе/идентичности (через `System.identityHashCode`).
- Что такое `String.intern()`?
- Что произойдёт, если в конструкторе бросить исключение? Объект не будет создан, но если ссылка где-то "утекла" (например, this в другой поток) — будет частично-инициализирован.
- Можно ли переопределить `private`/`static` метод? Нет — это method hiding, не override.
- Что такое covariant return type?

---

# Дополнительные темы Core Java (продолжение)

## 1.11 Вложенные классы (Nested classes)

В Java 4 вида вложенных классов:

```java
class Outer {
    private int x;

    static class StaticNested { /* как обычный класс, не имеет доступа к Outer.this */ }

    class Inner {              // нестатический; держит неявную ссылку на Outer.this
        void foo() { System.out.println(x); }   // видит private поле Outer
    }

    void method() {
        class Local { /* виден только внутри method */ }
        Runnable r = new Runnable() {           // анонимный
            @Override public void run() { System.out.println(x); }
        };
    }
}
```

- **Static nested** — обычный класс, просто живёт внутри namespace другого. Нет ссылки на enclosing instance.
- **Inner (non-static)** — держит **синтетическую ссылку** на Outer (`Outer.this`). Может вызвать утечку памяти (если объект Inner живёт дольше Outer).
- **Local class** — внутри метода. Видит effectively final локальные переменные.
- **Anonymous class** — реализация интерфейса/наследник класса "на месте". С Java 8 чаще заменяется лямбдой (если SAM).
- **Lambda vs анонимный класс**:
  - Лямбда — `invokedynamic` + `LambdaMetafactory`, генерируется лениво, нет отдельного `.class`. `this` ссылается на enclosing.
  - Анонимный — отдельный `.class` (`Outer$1.class`), `this` — на сам анонимный объект.

## 1.12 Enum'ы — глубоко

Enum в Java — полноценный класс, наследует `java.lang.Enum`, неявно `final`.

```java
public enum Status {
    NEW(0),
    ACTIVE(1),
    DELETED(-1) {
        @Override public boolean isVisible() { return false; }   // override на конкретной константе
    };

    private final int code;
    Status(int code) { this.code = code; }
    public int code() { return code; }
    public boolean isVisible() { return true; }                  // default
}
```

- Каждая константа — singleton (один объект на JVM).
- Поля и методы: `name()`, `ordinal()`, `values()`, `valueOf(String)`.
- Можно реализовывать интерфейсы; нельзя наследоваться от классов.
- В `switch` работает компактно (по умолчанию по `name`).
- **Singleton через enum** — best practice: thread-safe, защищён от рефлексии и сериализации.
- `EnumSet` — внутри bit vector; `EnumMap` — внутри массив по `ordinal()`. Очень быстрые.

## 1.13 Аннотации

Метаданные на коде, обрабатываются:
- **Compile-time** (`@Override`, Lombok, MapStruct, JPA criteria meta-model).
- **Runtime** через рефлексию (Spring, JUnit, Jackson).

Создание своей:

```java
@Retention(RetentionPolicy.RUNTIME)        // SOURCE / CLASS / RUNTIME
@Target({ElementType.METHOD, ElementType.TYPE})
@Documented
@Inherited                                  // только для типов
public @interface Loggable {
    String value() default "";
    int level() default 0;
}
```

- `@Retention` — до какого этапа жить.
  - SOURCE — выкидывается компилятором (`@Override`).
  - CLASS — в `.class`, но не доступна через reflection (default).
  - RUNTIME — доступна через reflection.
- `@Target` — где можно ставить (METHOD, FIELD, TYPE, PARAMETER, …).
- `@Repeatable` — несколько одинаковых на одном элементе.
- `@Inherited` — наследуется подклассами (для классов).

## 1.14 Reflection и дескрипторы

```java
Class<?> cls = Class.forName("com.x.User");
Object u = cls.getDeclaredConstructor().newInstance();
Field f = cls.getDeclaredField("name");
f.setAccessible(true);
f.set(u, "Bob");
Method m = cls.getMethod("getName");
String name = (String) m.invoke(u);
```

- Используется фреймворками (Spring, JPA, Jackson).
- Медленнее обычных вызовов, обходит инкапсуляцию, ломает рефакторинг.
- `MethodHandle` (`java.lang.invoke`) — быстрее reflection.
- `VarHandle` (Java 9+) — типобезопасный аналог `sun.misc.Unsafe`.
- В Java 9+ модули ограничивают доступ к internal API (`--add-opens`).

## 1.15 java.io / java.nio (базы)

### java.io

- **Byte streams**: `InputStream` / `OutputStream` (бинарные данные).
- **Char streams**: `Reader` / `Writer` (текст с кодировкой).
- Декораторы:
  - `BufferedInputStream`, `BufferedReader` — буферизация (почти всегда нужна).
  - `DataInputStream` — примитивы.
  - `ObjectInputStream` — Java-сериализация.
- `try-with-resources` обязательно.

```java
try (var br = Files.newBufferedReader(Path.of("file.txt"), StandardCharsets.UTF_8)) {
    br.lines().forEach(System.out::println);
}
String content = Files.readString(path);                 // Java 11+
List<String> lines = Files.readAllLines(path);
Files.write(path, lines);
```

### java.nio

- `Path` / `Files` — современная замена `java.io.File`.
- `FileChannel`, `SocketChannel` — non-blocking I/O.
- `ByteBuffer.allocate` (heap) vs `allocateDirect` (off-heap, для high-perf I/O).
- `Selector` — non-blocking multi-channel (основа Netty).
- `MappedByteBuffer` — memory-mapped файлы (mmap).
- `WatchService` — слежение за изменениями ФС.

**Кодировка:** всегда явно `StandardCharsets.UTF_8`. Без явной — берётся **default charset платформы**, и поведение разное в Linux/Windows.

## 1.16 Сериализация

### Java Serialization

```java
class User implements Serializable {
    private static final long serialVersionUID = 1L;
    private String name;
    private transient String password;        // не сериализуется
}
```

- Указывай `serialVersionUID` явно — иначе генерится автоматически и любое изменение класса ломает совместимость.
- `transient` — поле не сериализуется.
- Хуки: `writeObject`, `readObject`, `readResolve` (для singleton после десериализации).
- **Опасно**: deserialization-уязвимости (известные RCE через gadget chains в Apache Commons-Collections и др.). Используй allowlist (`ObjectInputFilter`) или вообще откажись от Java-сериализации в пользу JSON/Protobuf.

### Современные альтернативы

- **JSON** — Jackson (де-факто стандарт), Gson.
- **Protocol Buffers** — бинарно, схема, кросс-язычно.
- **Avro** — для Kafka.
- **MessagePack**, **CBOR** — бинарный JSON.

## 1.17 java.time (Date/Time API, Java 8+)

Все классы **immutable** и thread-safe.

| Класс | Что |
|---|---|
| `LocalDate` | дата без времени и зоны (2025-04-23) |
| `LocalTime` | время без даты (10:15:30) |
| `LocalDateTime` | дата+время без зоны |
| `ZonedDateTime` | дата+время+зона (с правилами DST) |
| `OffsetDateTime` | дата+время+offset (без правил DST) |
| `Instant` | момент на UTC-шкале (эпохальный timestamp) |
| `Duration` | продолжительность (нс/сек) |
| `Period` | период (годы/месяцы/дни) |
| `ZoneId` | "Europe/Kyiv" |

```java
LocalDate today    = LocalDate.now();
LocalDate tomorrow = today.plusDays(1);
ZonedDateTime now  = ZonedDateTime.now(ZoneId.of("Europe/Kyiv"));
Instant ts         = Instant.now();
long epochSec      = ts.getEpochSecond();
Duration d         = Duration.between(start, end);

DateTimeFormatter fmt = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
String s              = now.format(fmt);
LocalDateTime parsed  = LocalDateTime.parse("2025-04-23 10:15", fmt);
```

**В БД сохранять время как `Instant` / `OffsetDateTime`** — без неоднозначности зоны.

`java.util.Date` / `Calendar` — **legacy**, не использовать в новом коде.

## 1.18 Regex

```java
private static final Pattern SSN = Pattern.compile("\\d{3}-\\d{2}-\\d{4}");

Matcher m = SSN.matcher("123-45-6789 and 999-00-1111");
while (m.find()) System.out.println(m.group());

String cleaned = "abc123".replaceAll("\\d", "*");     // "abc***"
boolean ok     = "abc".matches("[a-z]+");
```

- `Pattern` тяжёлый — компилируй один раз, держи в `static final`.
- Поддержка: groups, backreferences, lookahead `(?=...)` / lookbehind `(?<=...)`, non-greedy `*?`.

## 1.19 Форматирование строк

```java
String s = String.format("Name: %s, age: %d, price: %.2f", "Bob", 30, 19.99);
String fs = "Name: %s".formatted("Bob");                  // Java 15+
System.out.printf("hex: %x%n", 255);                      // %n — platform line separator
```

С Java 9+ конкатенация через `+` компилируется в `invokedynamic` → `StringConcatFactory` (быстро).

## 1.20 Полные примеры на equals/hashCode/Comparable/immutable

### Правильный equals/hashCode (с подводным камнем BigDecimal)

```java
public final class Money {
    private final BigDecimal amount;
    private final String currency;

    public Money(BigDecimal amount, String currency) {
        this.amount = Objects.requireNonNull(amount);
        this.currency = Objects.requireNonNull(currency);
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Money m)) return false;        // pattern matching
        return amount.compareTo(m.amount) == 0            // BigDecimal! не equals
            && currency.equals(m.currency);
    }

    @Override
    public int hashCode() {
        return Objects.hash(amount.stripTrailingZeros(), currency);
    }

    @Override
    public String toString() { return amount + " " + currency; }
}
```

⚠️ Тонкость: `BigDecimal.equals` сравнивает scale (`1.0` ≠ `1.00`), а `compareTo` — нет. Для денег — `compareTo` в `equals` и нормализация для `hashCode`.

С Java 16+ — `record Money(BigDecimal amount, String currency) {}`. Если нужна нестандартная семантика (как с BigDecimal) — переопредели `equals`/`hashCode`.

### Immutable c mutable полем (defensive copy)

```java
public final class DateRange {
    private final Date start;
    private final Date end;

    public DateRange(Date start, Date end) {
        this.start = new Date(start.getTime());           // защитная копия в конструкторе
        this.end   = new Date(end.getTime());
    }
    public Date getStart() { return new Date(start.getTime()); }   // и в геттере
    public Date getEnd()   { return new Date(end.getTime()); }
}
```

### Comparator-композиция

```java
Comparator<User> byAgeThenName = Comparator
    .comparingInt(User::getAge)
    .thenComparing(User::getName, Comparator.nullsLast(Comparator.naturalOrder()))
    .reversed();

list.sort(byAgeThenName);
```

## 1.21 Records — детально

```java
public record Point(int x, int y) {
    // compact constructor — валидация без переписывания присваиваний
    public Point {
        if (x < 0 || y < 0) throw new IllegalArgumentException();
    }

    // дополнительный конструктор обязан делегировать в canonical
    public Point() { this(0, 0); }

    public static Point origin() { return new Point(0, 0); }

    public Point translate(int dx, int dy) { return new Point(x + dx, y + dy); }
}
```

- Implicitly `final`, наследует `java.lang.Record`.
- Все поля `private final`. Генерятся аксессоры (`x()`, `y()`), `equals`, `hashCode`, `toString`, canonical constructor.
- Можно переопределять любой generated-метод.
- Реализует интерфейсы (но не наследует классы).
- Не может иметь mutable instance fields (только static).

С Java 21 — **record patterns** для деструктуризации:

```java
if (obj instanceof Point(int x, int y)) { use(x, y); }

switch (shape) {
    case Circle(double r)        -> ...;
    case Rectangle(int w, int h) -> ...;
}
```

## 1.22 Sealed classes / interfaces

```java
public sealed interface Shape permits Circle, Square, Triangle {}
public record Circle(double r) implements Shape {}
public record Square(double side) implements Shape {}
public final class Triangle implements Shape { ... }
// Альтернатива final — sealed (своя закрытая иерархия) или non-sealed (открыть обратно)
```

- Закрытая иерархия — компилятор знает все подтипы.
- Подтипы должны быть `final`, `sealed` или `non-sealed`.
- Идеально для **algebraic data types** и **exhaustive switch** без `default`.

## 1.23 Pattern matching

```java
// Java 16+ для instanceof
if (obj instanceof String s && !s.isBlank()) { use(s); }

// Java 21 для switch с exhaustiveness
String describe(Shape s) {
    return switch (s) {
        case Circle c   when c.r() > 10 -> "big circle";
        case Circle c                   -> "small circle";
        case Square q                   -> "square " + q.side();
        case Triangle t                 -> "triangle";
    };
}

// null-case (без него — NPE на null)
return switch (obj) {
    case null      -> "null";
    case Integer i -> "int " + i;
    default        -> "other";
};
```

## 1.24 Полезный API, который часто забывают

```java
Objects.requireNonNull(arg, "arg must not be null");
Objects.requireNonNullElse(a, defaultValue);
Objects.equals(a, b);                    // null-safe
List.of(1, 2, 3);                        // immutable
Map.of("a", 1, "b", 2);
Map.entry("a", 1);
Stream.of(1, 2, 3).toList();             // Java 16, immutable
Files.readString(path);
Math.floorDiv(-7, 2);                    // -4 (а не -3 как у /)
Integer.parseInt(s, 16);                 // hex
String.join(", ", list);
"abc".repeat(3);                         // "abcabcabc"
"  hi  ".strip();                        // unicode-aware trim
"  hi  ".stripLeading();
```

## 1.25 var (local-variable type inference)

```java
var list = new ArrayList<String>();      // ArrayList<String>
var map  = new HashMap<String, Integer>();
for (var e : map.entrySet()) { ... }
```

- Только локальные переменные, фор-каждый, лямбды (для параметров).
- Не для полей, параметров методов, возвращаемых типов.
- Не используй там, где ухудшается читаемость (`var x = service.foo()` — что такое x?).

## 1.26 Дополнительные частые вопросы

- В чём отличие `==` для примитивов и для ссылок?
- Что такое effectively final?
- Inner class vs static nested vs anonymous vs lambda?
- Зачем enum может иметь конструктор?
- Можно ли в enum реализовывать интерфейс? (Да.)
- Как создать singleton thread-safe? (Enum, holder idiom, DCL+volatile.)
- Что такое `serialVersionUID` и зачем?
- Чем `transient` отличается от `volatile`?
- Чем `Period` отличается от `Duration`?
- Как сделать защищённую копию для immutable объекта с mutable полем?
- В чём отличие `Optional.of` от `Optional.ofNullable`? (См. главу 3.)
- Что такое pattern matching и exhaustive switch?
- Как реализован Stream API "под капотом"? (Spliterator + ленивые операции.)
- Можно ли изменить `final` поле через рефлексию? (В Java 17+ модули блокируют для core JDK; для своих классов всё ещё можно через `setAccessible(true)`, но это антипаттерн.)
- Чем `String.intern()` полезен и опасен?
- Чем checked-исключение отличается от unchecked? Когда какие создавать?
- Можно ли объявить `static` метод в интерфейсе? (Да, с Java 8.)
- Что такое default-метод и зачем он нужен? (Эволюция интерфейсов без поломки реализаций.)
- Как diamond problem решается в интерфейсах с default? (Компилятор требует явного override через `Interface.super.method()`.)

---

# Глубокие объяснения — от "что" к "почему"

Этот раздел разворачивает важные концепции не в виде таблиц и буллетов, а как если бы я объяснял их коллеге у доски. Если выше — шпаргалка, то здесь — понимание.

## Путь вашего кода: от `.java` до работающего CPU

Когда вы пишете `Hello.java` и запускаете `java Hello`, между этим происходят шесть крупных шагов, и на каждом что-то может пойти не так.

**Шаг 1. Компиляция в байткод.** `javac` превращает исходник в `.class` — файл, содержащий **платформонезависимую** инструкцию для стековой машины. Это не инструкции ARM или x86; это промежуточный язык. Важно: `javac` делает только поверхностные оптимизации (константное свёртывание, пустой switch), никаких inlining и escape analysis — это заботы рантайма.

**Шаг 2. Запуск JVM и ClassLoader.** Запускается процесс `java`, который читает главный класс. Загрузка классов **ленивая** — класс не попадает в память, пока его кто-то не использует. Делает это иерархия ClassLoader'ов: **Bootstrap** (ядро JDK), **Platform** (модули java.xml, java.sql…), **Application** (ваш classpath). Каждый загрузчик **делегирует** запрос родителю — это принцип parent-first, который защищает JDK-классы от подмены.

**Шаг 3. Верификация байткода.** Это security-этап: JVM проверяет, что байткод не ломает типобезопасность и стек. Например, нельзя присвоить `int` в поле типа `String`, нельзя прыгнуть на адрес посреди инструкции. Именно поэтому JVM считается sandbox'ом для недоверенного кода.

**Шаг 4. Linking и инициализация.** Расставляются ссылки между классами, резолвятся `static` поля и `static {}` блоки. Порядок инициализации статики подчиняется правилам happens-before — это база для паттернов типа "holder idiom" (ленивый singleton через внутренний класс).

**Шаг 5. Интерпретация.** Сначала байткод просто **интерпретируется** — JVM читает каждую опкод-инструкцию и выполняет её. Это медленно (в 10-100 раз медленнее нативного кода), но быстро стартует. По мере работы JVM **собирает профиль**: какие методы вызываются часто, какие ветки `if` обычно истинны, какие виртуальные вызовы на самом деле всегда идут в один и тот же конкретный класс.

**Шаг 6. JIT-компиляция.** Когда счётчик вызовов метода переваливает порог (`-XX:CompileThreshold=10000` по умолчанию), запускается JIT. В HotSpot **два уровня**: C1 делает быструю компиляцию с базовыми оптимизациями, C2 — агрессивную. По умолчанию работает **tiered compilation**: сначала C1 даёт "более-менее быстрый код быстро", потом накапливается более богатый профиль, и C2 перекомпилирует в "очень быстрый код медленно". Если профиль подвёл (например, мы решили, что вызов всегда идёт в `ArrayList`, а пришёл `LinkedList`) — JVM делает **деоптимизацию**: выбрасывает JIT-код и возвращается к интерпретации. Это нормально.

**Важный вывод для собеседований.** Когда вас спрашивают "почему `final` помогает производительности" — ответ именно здесь: `final` даёт JIT гарантию, что метод не переопределён, и можно **безопасно заинлайнить** вызов без деоптимизации. Когда спрашивают про "warmup" перед бенчмарком — это время, нужное JIT, чтобы увидеть достаточно вызовов и вкомпилировать в C2.

## String immutability — полная картина, почему именно так

Строки в Java — immutable, и это не просто "так сделано". За этим стоит три слоя мотивации.

**Первый слой — безопасность.** Строки в Java используются везде, где важна идентичность: имена классов в ClassLoader, URL для SecurityManager, пути файлов, ключи в `HashMap`, credentials. Представьте, что `String` был бы изменяем: вы передаёте в метод `openFile("/etc/passwd")`, а в соседнем потоке кто-то успевает заменить содержимое строки на `/home/user/data`. SecurityManager уже проверил строку до её изменения. Это TOCTOU-атака (time-of-check-time-of-use). Immutable строка делает такую атаку невозможной.

**Второй слой — String pool.** Литералы строк складываются в специальную область в куче (до Java 7 — в PermGen, с Java 7 — в обычный heap). Если два участка кода пишут `"hello"`, обе ссылки указывают на один объект в пуле. Это экономит память. Но это возможно только потому, что строка неизменяема — если бы один код мог изменить `"hello"`, изменение "утекло" бы во все другие места.

**Третий слой — hashCode кеш.** `String.hashCode()` считается **один раз** и сохраняется в поле. Поэтому использование строки в качестве ключа `HashMap` не требует повторного перевычисления хеша при каждом `get`. Если бы строка была изменяема, кешированный hash стал бы невалидным после любой модификации.

**Следствие для памяти — Compact Strings (Java 9+).** Раньше внутри `String` был `char[]` (2 байта на символ, UTF-16). С Java 9 — `byte[]` + флаг кодировки. Если все символы вмещаются в LATIN-1 (первые 256 кодов Unicode) — используется 1 байт на символ. Реальный английский текст экономит ~50% памяти. Узнать, какая кодировка внутри, нельзя из API — это implementation detail.

**Подводный камень — `new String("abc")`.** Эта конструкция создаёт **новый объект**, не из пула. Почти никогда не нужна. Единственное исключение — `new String(bytes, charset)`, там действительно нужен новый объект.

**Метод `intern()`** — возвращает каноническую ссылку из пула. Полезно, если вы парсите много дубликатов строк (логи, XML теги) — сэкономите память. Но **внимание**: пул имеет ограниченный размер, и массовый `intern` может привести к OOM в string pool. В Java 11+ пул может менять размер (`-XX:StringTableSize`), по умолчанию — 65536 bucket'ов.

## Generics и type erasure — что реально происходит

В Java generic'и **стираются после компиляции**. `List<String>` и `List<Integer>` в рантайме — один и тот же класс `List`. Это наследие совместимости с коллекциями, написанными до Java 5. Новый язык, начинающий с чистого листа (Kotlin, Scala), мог бы сделать reified generics — Java не может.

**Что это значит практически.**

Когда вы пишете:
```java
public <T> T create() {
    return (T) new Object();   // unchecked cast
}
```
после компиляции это превращается просто в `return new Object()`. Никакой проверки типа T в рантайме не происходит. Каст `(T)` — чисто для компилятора, в байткоде его нет. Ошибка "подменённого типа" проявится только при использовании, и в стеке будет не ваш метод, а место вызова — это называется **heap pollution**.

**Почему нельзя `new T()`.** В рантайме T неизвестно. JVM не знает, какой конструктор вызвать. Решение — паттерн **Type Token**: передавайте `Class<T> clazz`, и внутри вызывайте `clazz.getDeclaredConstructor().newInstance()`. Именно так работает `Spring`, когда инжектит `List<User>` — он ищет `Class<User>` через `ResolvableType`.

**Почему нельзя `new T[10]`.** Массивы в Java **reified** (знают свой тип в рантайме). Если бы можно было `new T[10]`, этот массив не знал бы своего "настоящего" типа, и при попытке положить туда объект JVM не смогла бы проверить `ArrayStoreException`. Решение — либо `(T[]) new Object[10]` (unchecked), либо передавать `Class<T>` и через `Array.newInstance(clazz, 10)`.

**Почему `instanceof List<String>` не работает.** В рантайме это информация потеряна. Можно только `instanceof List<?>`. Если нужно узнать параметр типа — собрать его из `Field.getGenericType()` или `Method.getGenericReturnType()`, это дорогая рефлексия.

**Bridge methods — скрытая магия.** Когда вы переопределяете generic-метод в подклассе, компилятор генерирует **синтетический метод** с сигнатурой родителя, чтобы полиморфизм работал. Например:
```java
class Box<T> { void put(T t) {...} }
class StrBox extends Box<String> { void put(String s) {...} }
```
После компиляции `StrBox` имеет **два метода `put`**: один принимает `String`, другой — `Object` (bridge), который делает cast и вызывает первый. В стектрейсе можно увидеть эти bridge-методы. Они же причина, по которой перегрузка `foo(List<String>)` и `foo(List<Integer>)` не компилируется — после стирания это одинаковые сигнатуры.

**Wildcards и PECS на живом примере.** Рассмотрим метод "копировать из одной коллекции в другую":
```java
public static <T> void copy(List<? super T> dest, List<? extends T> src) {
    for (T item : src) dest.add(item);
}
```
Почему source — `? extends T`? Потому что мы **читаем** из него, и нам достаточно, чтобы элементы были T или его подтипами. Почему dest — `? super T`? Потому что мы **кладём туда** T (или его потомков), и контейнер должен принимать минимум T, а может и супер-тип. Мнемоника Producer-Extends-Consumer-Super (**PECS**) — `src` производит данные, `dest` их потребляет.

## equals/hashCode — почему это важнее, чем кажется

Договор между `equals` и `hashCode` кажется скучной формальностью, но его нарушение приводит к одному из самых коварных багов: объект **"исчезает"** из `HashMap`.

**Сценарий.** Вы кладёте `user` в `HashSet`. Потом меняете `user.id`, которое участвует в `hashCode`. Когда теперь вызываете `set.contains(user)`, хеш посчитается **заново** и укажет на другой bucket — где объекта нет. `contains` возвращает `false`, но объект физически **находится в сете**, просто в неправильном bucket. Вы не сможете его найти, и `clear()` не поможет заметить проблему. Коллекция в неконсистентном состоянии.

**Правило.** Объекты, используемые как ключи `HashMap`/`HashSet` или элементы `HashSet`, должны быть **эффективно immutable** по полям, участвующим в `equals`. Либо не мутируйте их, либо делайте `record`, либо `private final` поля.

**Трюк с BigDecimal.** `new BigDecimal("1.0").equals(new BigDecimal("1.00"))` возвращает `false`. Потому что `equals` учитывает `scale`. А `compareTo` — нет. В бизнес-логике (деньги), где `1.0 == 1.00`, надо либо **нормализовать** (`stripTrailingZeros().setScale(2)`), либо писать свой `equals` через `compareTo`. Иначе одна и та же сумма попадёт в `HashMap` дважды с разными ключами.

**Почему `Objects.hash(a, b, c)` не оптимален для hot-path.** Этот метод упаковывает аргументы в `Object[]` и итерирует. Для класса с 5+ полями — аллокация массива и boxing примитивов. В hot-path лучше написать руками:
```java
int result = 31 * a + b;
result = 31 * result + Objects.hashCode(c);
return result;
```
Число 31 — простое + легко умножается через `(x << 5) - x` (многие JIT это делают).

**Зачем `record` упрощает жизнь.** Он генерирует `equals`/`hashCode`/`toString`, которые учитывают все компоненты. Вы не можете забыть поле при добавлении нового (что часто забывают при ручной реализации после рефакторинга). Именно поэтому `record` для data-классов — это не просто синтаксический сахар, а инструмент против целого класса багов.

## Exceptions — модель, которую редко объясняют целиком

Java делит все "чрезвычайные ситуации" на три категории, и у каждой своя идеология.

**Error** — что-то сломалось на уровне JVM или окружения. `OutOfMemoryError`, `StackOverflowError`, `NoClassDefFoundError`. Ловить их практически никогда не нужно, потому что сделать с ними ничего нельзя. Единственное исключение — framework, оборачивающий пользовательский код (например, сервер), может ловить `Error` для логирования и корректного завершения.

**RuntimeException** — ошибка **программирования**. Вы сделали что-то не так: обратились к `null`, вышли за границу массива, передали невалидный аргумент. Идея: это баг, который должен быть пойман и исправлен в коде, а не обрабатываться при каждом вызове. Поэтому компилятор не заставляет добавлять `throws`.

**Checked Exception** — ожидаемая ошибка окружения, которую код **обязан обработать**: файл не открылся, сеть упала, SQL вернул ошибку. Идея James Gosling'а была: заставить разработчика **явно думать** о таких ситуациях. На практике это привело к двум проблемам. Первая — `throws Exception` расползается по всему коду "эпидемически". Вторая — `try { ... } catch (IOException e) { throw new RuntimeException(e); }` встречается повсеместно, фактически обходя систему. Современные фреймворки (Spring, Quarkus) почти полностью перевели checked в unchecked — SpringJdbc оборачивает `SQLException` в `DataAccessException`. Kotlin вообще отказался от checked-исключений.

**Стоимость исключения.** Создание `Exception` — это не только `new`, но и **сбор стектрейса**, который проходит все кадры стека и записывает имена классов/файлов/номера строк. Это может быть дорого (десятки микросекунд на глубоком стеке). Поэтому два антипаттерна:
1. **Исключение для control flow** — например, "выйти из рекурсии". Использование исключений для "нормальной" логики превращает код в "поток неявных gotos" и убивает производительность.
2. **`new MyException()` в тайт-лупе** — каждый сбор стектрейса стоит. Если исключение действительно нужно часто (валидация), имеет смысл использовать **stackless exceptions** (переопределить `fillInStackTrace` возвращающим `this`) или просто возвращать `Result<T, Error>` вместо бросания.

**`try-with-resources` и suppressed exceptions.** Раньше классическая проблема: в `try` падает SQL, и в `finally` при `connection.close()` тоже падает. Какое исключение увидит пользователь? До Java 7 — последнее, первое терялось. С `try-with-resources` — **первое** (основное), остальные подавлены и доступны через `e.getSuppressed()`. Это критично для диагностики: часто именно первое исключение — настоящая причина.


