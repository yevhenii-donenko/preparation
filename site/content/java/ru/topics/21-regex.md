# Регулярные выражения в Java

## Классы

- `java.util.regex.Pattern` — скомпилированный regex (неизменяемый, thread-safe).
- `java.util.regex.Matcher` — движок для конкретной строки. **НЕ thread-safe.**
- `String.matches`, `split`, `replaceAll` — под капотом создают `Pattern` каждый раз (без кэша).

## Базовый паттерн

```java
Pattern emailPattern = Pattern.compile(
    "^[\\w.+-]+@[\\w.-]+\\.[A-Za-z]{2,}$"
);

Matcher m = emailPattern.matcher("alice@example.com");
if (m.matches()) {
    System.out.println("valid");
}
```

**Правило**: `Pattern.compile` — один раз, как `static final`. `Matcher` — на каждый вызов (дёшево).

## Методы Matcher

| Метод              | Что делает                                                     |
|--------------------|---------------------------------------------------------------|
| `matches()`        | Полное совпадение строки.                                     |
| `find()`           | Найти следующее частичное совпадение. Можно в цикле.         |
| `lookingAt()`      | Префикс совпадает (нет обязательства до конца).               |
| `group()`          | Вся совпавшая подстрока.                                      |
| `group(int)`       | Группа по номеру (1-based; 0 — всё совпадение).              |
| `group(String)`    | Named group.                                                   |
| `start()/end()`    | Позиции начала/конца совпадения в исходной строке.           |
| `replaceAll(repl)` | Заменить все совпадения (внутри можно `$1`, `${name}`).      |
| `replaceFirst(r)`  | Только первое.                                                 |
| `reset()`          | Сброс к началу, переиспользование с той же строкой.          |

## Группы

### Unnamed

```java
Pattern p = Pattern.compile("(\\d{4})-(\\d{2})-(\\d{2})");
Matcher m = p.matcher("2025-03-14");
if (m.matches()) {
    String year  = m.group(1);
    String month = m.group(2);
    String day   = m.group(3);
}
```

### Named (Java 7+)

```java
Pattern p = Pattern.compile("(?<year>\\d{4})-(?<month>\\d{2})-(?<day>\\d{2})");
Matcher m = p.matcher("2025-03-14");
if (m.matches()) {
    String year = m.group("year");
}
```

### Non-capturing `(?:...)`

Когда нужна группировка, но не захват:
```java
Pattern.compile("(?:Mr|Mrs|Ms)\\.\\s+(\\w+)");  // группа 1 — имя
```

### Backreference

```java
// Повторяющееся слово: "hello hello"
Pattern.compile("\\b(\\w+)\\s+\\1\\b");
```

## Флаги

| Flag                            | Эффект                                                       |
|---------------------------------|-------------------------------------------------------------|
| `Pattern.CASE_INSENSITIVE`      | a ≈ A                                                        |
| `Pattern.MULTILINE`             | `^`, `$` match начало/конец каждой строки                    |
| `Pattern.DOTALL`                | `.` ловит `\n`                                               |
| `Pattern.UNICODE_CHARACTER_CLASS` | `\w`, `\d`, `\s` понимают Unicode                         |
| `Pattern.COMMENTS`              | Whitespace и `# комментарии` игнорируются в pattern         |
| `Pattern.LITERAL`               | Специальные символы — как литералы                          |

Включать встроенно: `(?i)` case-insensitive, `(?m)` multiline, `(?s)` dotall, `(?x)` comments.

```java
Pattern p = Pattern.compile("""
    (?x)                 # verbose mode
    (?<protocol>https?)  # scheme
    ://
    (?<host>[\\w.-]+)    # host
    (?::(?<port>\\d+))?  # optional port
    (?<path>/[^?#]*)?    # path
    """);
```

## Частые паттерны (cookbook)

| Задача                          | Паттерн                                       |
|---------------------------------|-----------------------------------------------|
| Цифры только                    | `\\d+`                                        |
| Буквы/цифры/подчёркивание       | `\\w+`                                        |
| Пробельные                      | `\\s+`                                        |
| Слово целиком                   | `\\bword\\b`                                  |
| Email (упрощённо)               | `[\\w.+-]+@[\\w.-]+\\.[A-Za-z]{2,}`           |
| UUID                            | `[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}` |
| IPv4                            | `(?:\\d{1,3}\\.){3}\\d{1,3}` (без валидации 0–255) |
| HTTP URL                        | `https?://[^\\s]+`                            |
| Часть даты ISO                  | `\\d{4}-\\d{2}-\\d{2}`                        |
| Только ASCII                    | `\\p{ASCII}+`                                 |
| Небуквенные                     | `[^\\p{L}]+`                                  |

## Split и replace

```java
String csv = "one,two,,three";
String[] parts = csv.split(",", -1);     // limit = -1 сохраняет пустые
// ["one", "two", "", "three"]

String result = "John Smith".replaceAll("(\\w+)\\s+(\\w+)", "$2, $1");
// "Smith, John"

// Функциональный replace (Java 9+)
String masked = Pattern.compile("\\d")
    .matcher("card 1234 5678")
    .replaceAll(mr -> "X");                 // "card XXXX XXXX"
```

## `Pattern.quote` — экранирование literal

Когда подставляем user input в regex, **обязательно** оборачиваем в `Pattern.quote`, иначе regex-инъекция:

```java
String userInput = "file.txt";   // точка — metachar!
Pattern p = Pattern.compile(Pattern.quote(userInput));
```

## Performance и catastrophic backtracking

Регексы NFA-движка Java могут экспоненциально взрываться на некоторых входах.

### Классический пример

```java
Pattern p = Pattern.compile("(a+)+b");
p.matcher("aaaaaaaaaaaaaaaaaaaaaaX").matches();   // вечность
```

Внутри есть "выбор" как распределить `a` между внешней и внутренней группой — 2^n комбинаций.

### Как избежать

1. **Possessive quantifiers**: `++`, `*+`, `?+` — не отдают назад:
   ```java
   Pattern.compile("(a++)+b");   // мгновенно фейлит на "aX"
   ```
2. **Atomic groups** `(?>...)` — также без backtracking:
   ```java
   Pattern.compile("(?>a+)+b");
   ```
3. **Избегать вложенных квантификаторов**: `(x+)+`, `(x*)*`, `(x|y)+` одинаковой природы.
4. **Anchors** (`^`, `$`, `\b`) — фиксируют позицию, режут search space.
5. **Timeout** на уровне потока — Java regex **не прерывается** Thread.interrupt. Либо custom matcher-wrapper с TimerTask, либо run в отдельном потоке с `future.get(timeout)`.

### ReDoS — security risk

Regex от пользователя → catastrophic input → DoS. Примеры: email validators `/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)...)/` — классика ReDoS.

**Защита**: не принимать regex от user; использовать RE2J (alternative engine без backtracking):
```xml
<dependency>
    <groupId>com.google.re2j</groupId>
    <artifactId>re2j</artifactId>
    <version>1.7</version>
</dependency>
```

## Pattern как static final — золотое правило

Плохо (создаёт Pattern каждый вызов):
```java
boolean isDigit(String s) {
    return s.matches("\\d+");                       // Pattern.compile внутри
}
```

Хорошо:
```java
private static final Pattern DIGITS = Pattern.compile("\\d+");
boolean isDigit(String s) {
    return DIGITS.matcher(s).matches();
}
```

Разница — 100×+ по CPU при горячем вызове.

## `split` ловушки

```java
"a,,b".split(",");        // {"a", "", "b"} — trailing empty отбрасываются!
"a,,b,".split(",");       // {"a", "", "b"}
"a,,b,".split(",", -1);   // {"a", "", "b", ""}
```

Правило: почти всегда указывай `limit = -1`.

## Lookahead / Lookbehind

Zero-width assertions — не "съедают" текст:

```java
// Positive lookahead: слово перед цифрой
"foo1 bar".matches(".*\\w+(?=\\d).*");

// Negative lookahead: "Java" не перед "Script"
"JavaBean".matches("Java(?!Script)\\w*");        // true
"JavaScript".matches("Java(?!Script)\\w*");      // false

// Positive lookbehind: "@" перед username
Pattern.compile("(?<=@)\\w+").matcher("hi @alice").find();   // "alice"
```

## Интервью-вопросы

1. Почему `Pattern.compile` дорого и куда его выносить?
2. Что такое catastrophic backtracking?
3. Разница capturing и non-capturing groups?
4. Зачем named groups?
5. `split("a,,", -1)` — что вернёт?
6. Что делает `Pattern.quote`?
7. Чем ReDoS опасен?
8. Как работают possessive quantifiers?
9. Thread-safe ли `Matcher`? (Нет. `Pattern` — да.)
10. Как сделать timeout на regex?
