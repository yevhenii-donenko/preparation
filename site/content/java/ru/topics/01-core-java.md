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

