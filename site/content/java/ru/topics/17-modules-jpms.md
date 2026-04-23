# Java Modules (JPMS) — углублённо

Модульная система Java (JPMS) появилась в **Java 9** (JEP 261, Project Jigsaw) как ответ на "JAR hell" и монолитный rt.jar. Это мощный, но редко используемый в бизнес-коде механизм — всё ещё обязан знать Senior.

## Зачем JPMS

**Проблемы до Java 9:**
- Classpath — плоский список JAR'ов без границ. Всё `public` доступно всем.
- Нет строгой инкапсуляции на уровне пакетов.
- `rt.jar` = 60+ MB монолит; нельзя взять часть.
- Reflection ломает любую внутреннюю инкапсуляцию.

**Что дали модули:**
1. **Строгая инкапсуляция** — `public` пакет не экспортируется наружу по умолчанию.
2. **Явные зависимости** — `requires` в `module-info.java`.
3. **Надёжная конфигурация** — JVM проверяет граф модулей при старте (cycles, split packages).
4. **Scalable JDK** — собрать минимальный JRE через `jlink`.

## `module-info.java`

Файл лежит в корне модуля (рядом с пакетами):

```java
module com.acme.payments {
    // Экспортируем пакеты наружу (наш публичный API)
    exports com.acme.payments.api;
    exports com.acme.payments.events to com.acme.billing, com.acme.audit;  // qualified export

    // Зависимости от других модулей
    requires java.sql;                   // явно тянем java.sql
    requires transitive com.acme.core;   // наши клиенты тоже получат com.acme.core
    requires static org.mapstruct;       // compile-only (аналог Maven 'provided')

    // Reflection: разрешаем доступ через рефлексию (Spring, Jackson, Hibernate)
    opens com.acme.payments.model;               // для всех
    opens com.acme.payments.dto to com.fasterxml.jackson.databind;

    // Service provider / consumer (ServiceLoader)
    uses com.acme.payments.spi.PaymentProcessor;
    provides com.acme.payments.spi.PaymentProcessor with com.acme.payments.stripe.StripeProcessor;
}
```

## Ключевые директивы

| Директива            | Назначение                                                                 |
|----------------------|----------------------------------------------------------------------------|
| `exports P`          | Пакет P доступен всем. Без `exports` — пакет внутренний.                   |
| `exports P to M1,M2` | Qualified export — только указанным модулям (friend-like).                 |
| `requires M`         | Этот модуль нужен нам. Транзитивно НЕ подтягивается нашим клиентам.        |
| `requires transitive M` | Наш клиент автоматически тоже получает M. Используй для API-интерфейсов.   |
| `requires static M`  | Нужен при компиляции, опционален в runtime (Lombok, annotations).          |
| `opens P`            | Разрешает reflection через `setAccessible(true)` для всех.                 |
| `opens P to M`       | Reflection только указанным модулям.                                        |
| `uses I`             | Declares dependency на SPI-интерфейс I (ServiceLoader).                    |
| `provides I with C`  | Реализуем SPI I классом C.                                                  |

## Типы модулей

1. **Named modules** — имеют `module-info.class`, живут на module path.
2. **Automatic modules** — обычный JAR без `module-info.class`, положенный на module path. Имя выводится из `Automatic-Module-Name` в манифесте или из имени файла. Экспортирует ВСЁ и видит весь unnamed module. **Промежуточный шаг при миграции.**
3. **Unnamed module** — всё на classpath. Видит всех. Экспортирует всё. Аналог "до Java 9".

**Правило**: named ⟶ не видит unnamed → критично при переходе. Для рефакторинга больших кодбаз обычно делают гибрид: свои модули — named, стороннее — automatic.

## `requires transitive` — типичное применение

Модуль `acme.persistence-api` объявляет интерфейсы, которые возвращают `java.sql.Connection`:

```java
module acme.persistence.api {
    exports acme.persistence.api;
    requires transitive java.sql;   // клиенты получают java.sql автоматически
}
```

Без `transitive` клиентам пришлось бы самим писать `requires java.sql` — это течёт абстракция.

## `opens` vs `exports`

| `exports`                         | `opens`                             |
|-----------------------------------|-------------------------------------|
| Компиляция + runtime              | Runtime reflection                  |
| Вызовы через обычный `new`/вызов  | `Field.setAccessible(true)` работает |
| Не даёт `setAccessible` для private | Даёт                                 |

**Нужно для Spring/Hibernate/Jackson/JPA**, потому что они делают `setAccessible(true)` для инжекта полей.

Либо используй `open module` — все пакеты открыты для reflection, но `exports` остаётся явным:

```java
open module com.acme.service {
    exports com.acme.service.api;
    requires spring.context;
}
```

## ServiceLoader через JPMS

**SPI-интерфейс:**
```java
// module acme.payments.spi
module acme.payments.spi {
    exports acme.payments.spi;
}

// acme.payments.spi
public interface PaymentProcessor {
    PaymentResult charge(BigDecimal amount, String currency);
    default String id() { return getClass().getSimpleName(); }
}
```

**Провайдер:**
```java
module acme.payments.stripe {
    requires acme.payments.spi;
    provides acme.payments.spi.PaymentProcessor with acme.payments.stripe.StripeProcessor;
}
```

**Потребитель:**
```java
module acme.app {
    requires acme.payments.spi;
    uses acme.payments.spi.PaymentProcessor;
}

// Использование:
ServiceLoader<PaymentProcessor> loader = ServiceLoader.load(PaymentProcessor.class);
loader.stream().forEach(p -> log.info("Found: {}", p.get().id()));
```

## `jlink` — кастомный runtime

Собираем **минимальный JRE** только с нужными модулями:

```bash
jlink \
  --module-path $JAVA_HOME/jmods:mods \
  --add-modules com.acme.app \
  --launcher app=com.acme.app/com.acme.app.Main \
  --compress=2 \
  --strip-debug \
  --no-header-files \
  --no-man-pages \
  --output dist
```

Результат: `dist/bin/app` + `dist/lib/...` — весь runtime ~40–60 MB (вместо ~200 MB полного JRE). Отлично для Docker-образов.

## `jdeps` — анализ зависимостей

```bash
# Показать, какие JDK-модули использует наш JAR
jdeps --list-deps app.jar
# java.base
# java.logging
# java.sql

# Проверить, не используем ли мы internal API
jdeps --jdk-internals --classpath lib/* app.jar

# Сгенерировать черновик module-info
jdeps --generate-module-info ./mods app.jar
```

## Подводные камни

### 1. Split packages — фатально

Один пакет в двух модулях — **ошибка загрузки**:
```
Error: Module core and Module utils both contain package acme.common
```
**Решение**: убрать дублирующий пакет или переименовать.

### 2. Reflection ломается

Без `opens` фреймворки кидают:
```
Unable to make field private accessible: module acme.app does not "opens acme.app.model" to com.fasterxml.jackson.databind
```
**Решение**: `opens pkg to jackson`, либо `open module`, либо `--add-opens acme.app/acme.app.model=com.fasterxml.jackson.databind` при запуске.

### 3. Cyclic dependencies

Модули A → B → A — compile error. JPMS форсит ациклический граф. Приходится выносить общее в третий модуль.

### 4. Automatic module name стабильность

Если библиотека без `Automatic-Module-Name`, имя выводится из JAR: `commons-lang3-3.12.0.jar` → `commons.lang3`. При ребрендинге имя меняется. Лучше добавляй в свои JAR:
```
Automatic-Module-Name: com.acme.core
```
в `MANIFEST.MF`.

### 5. Classpath + module path одновременно

Если часть зависимостей на classpath — они попадают в unnamed module, который невидим для named-модулей. Чаще всего проект либо весь на module path, либо весь на classpath.

## Когда НЕ использовать JPMS

- Small/medium проект без необходимости в scalable runtime.
- Большинство Spring Boot / Quarkus приложений — остаются на classpath, и это нормально.
- При активном использовании reflection-heavy фреймворков + agressive legacy JARs — больше боли, чем пользы.

## Когда JPMS оправдан

- **Библиотека/framework** — чёткая граница API vs internals (Java SE, JUnit 5, JavaFX).
- **Desktop/CLI с `jlink`** — хочешь маленький дистрибутив.
- **Security-critical** — строгая инкапсуляция защищает internals.
- **Plugin-based архитектура** с ServiceLoader.

## Быстрая шпаргалка для собеседования

| Q                                                    | A                                                                           |
|------------------------------------------------------|------------------------------------------------------------------------------|
| Что такое модуль?                                   | Коллекция пакетов с `module-info.class`, exposing API через `exports`.       |
| Разница `exports` и `opens`?                         | `exports` — для compile/runtime вызовов, `opens` — для reflection.           |
| `requires` vs `requires transitive`?                 | `transitive` пробрасывает зависимость нашим клиентам.                        |
| Что делает `requires static`?                        | Compile-only, не обязателен в runtime.                                        |
| Automatic module?                                    | JAR на module path без module-info — выводится имя, экспортирует всё.         |
| Зачем `opens` нужен Spring/Hibernate?                | Они делают `setAccessible(true)` для инжекта приватных полей.                 |
| Зачем `jlink`?                                       | Собрать минимальный JRE только с нужными модулями. Меньше Docker-образ.       |
| Как найти зависимости проекта от JDK-модулей?       | `jdeps --list-deps app.jar`.                                                  |
| Split packages — что это?                            | Один пакет в двух модулях. JPMS это запрещает — рантайм-ошибка.              |
| Может ли named-модуль видеть classpath?              | Нет, unnamed module невидим для named модулей.                               |
