# Логирование в Java — углублённо

## Фасад vs реализация

**SLF4J** (Simple Logging Facade for Java) — де-факто фасад. Код пишет против SLF4J, а на classpath подключается реализация:

| Фасад       | Реализация                          | Pros                                                   |
|-------------|-------------------------------------|--------------------------------------------------------|
| SLF4J       | Logback (от тех же авторов)         | Старейшая, стабильная, Spring Boot default             |
| SLF4J       | Log4j 2 (через `log4j-slf4j2-impl`) | Высокопроизводительная, async appenders                |
| SLF4J       | JUL (java.util.logging)             | Без внешних зависимостей, но медленный и неудобный     |
| SLF4J       | Simple                              | stdout, для тестов                                     |

```xml
<!-- Spring Boot по умолчанию тянет SLF4J + Logback -->
<dependency>
    <groupId>org.slf4j</groupId>
    <artifactId>slf4j-api</artifactId>
</dependency>
```

**Правило**: в код — только `org.slf4j.Logger`. Реализация — deployment concern.

## Использование SLF4J

```java
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class PaymentService {
    private static final Logger log = LoggerFactory.getLogger(PaymentService.class);

    public void charge(Long userId, BigDecimal amount) {
        log.info("Charging user {} for {}", userId, amount);
        try {
            // ...
        } catch (PaymentException e) {
            log.error("Payment failed for user {}: {}", userId, amount, e);  // последний arg — exception
            throw e;
        }
    }
}
```

### Правила

1. **Всегда параметризованное логирование**: `log.info("user {}", id)` вместо `log.info("user " + id)`. В первом случае конкатенация только если уровень включён.
2. **Exception — последний аргумент**: `log.error("failed for {}", id, ex)` → SLF4J увидит `Throwable` и залогирует stacktrace.
3. **Имя логгера — имя класса**: `LoggerFactory.getLogger(MyClass.class)`. Позволяет конфигурировать уровни по пакетам.
4. **Никогда не логируй secrets**: пароли, токены, PII, номера карт. Маскируй.

## Уровни

| Уровень | Когда                                                          |
|---------|----------------------------------------------------------------|
| TRACE   | Очень детально, для диагностики. Обычно off в prod.            |
| DEBUG   | Диагностика. Off в prod, on при разборе инцидента.             |
| INFO    | Бизнес-события: "order placed", "user logged in".              |
| WARN    | Что-то не так, но приложение работает. Retry, fallback.        |
| ERROR   | Исключение, failed critical path. Алертят.                     |

**Частая ошибка**: ВСЁ на INFO. Логи становятся шумом, цена $/GB растёт, debug невозможен.

## Logback — базовая конфигурация

`src/main/resources/logback-spring.xml` (или `logback.xml`):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>

    <property name="LOG_PATTERN"
              value="%d{yyyy-MM-dd HH:mm:ss.SSS} [%thread] %-5level %logger{36} - %msg%n"/>

    <!-- Console -->
    <appender name="STDOUT" class="ch.qos.logback.core.ConsoleAppender">
        <encoder>
            <pattern>${LOG_PATTERN}</pattern>
        </encoder>
    </appender>

    <!-- Rolling file -->
    <appender name="FILE" class="ch.qos.logback.core.rolling.RollingFileAppender">
        <file>logs/app.log</file>
        <rollingPolicy class="ch.qos.logback.core.rolling.SizeAndTimeBasedRollingPolicy">
            <fileNamePattern>logs/app.%d{yyyy-MM-dd}.%i.log.gz</fileNamePattern>
            <maxFileSize>100MB</maxFileSize>
            <maxHistory>7</maxHistory>
            <totalSizeCap>5GB</totalSizeCap>
        </rollingPolicy>
        <encoder>
            <pattern>${LOG_PATTERN}</pattern>
        </encoder>
    </appender>

    <!-- Async wrapper — не блокируем бизнес-поток -->
    <appender name="ASYNC_FILE" class="ch.qos.logback.classic.AsyncAppender">
        <appender-ref ref="FILE"/>
        <queueSize>512</queueSize>
        <discardingThreshold>0</discardingThreshold>
        <neverBlock>true</neverBlock>
    </appender>

    <!-- Уровни по пакетам -->
    <logger name="org.hibernate" level="WARN"/>
    <logger name="com.acme" level="DEBUG"/>

    <root level="INFO">
        <appender-ref ref="STDOUT"/>
        <appender-ref ref="ASYNC_FILE"/>
    </root>
</configuration>
```

### Spring profiles в logback

```xml
<springProfile name="prod">
    <root level="WARN"><appender-ref ref="ASYNC_FILE"/></root>
</springProfile>
<springProfile name="local | dev">
    <root level="DEBUG"><appender-ref ref="STDOUT"/></root>
</springProfile>
```

## Log4j 2 — когда выбирать

- Экстремально высокая нагрузка (async loggers через LMAX Disruptor — миллионы msg/sec).
- Plugin-based, гибче Logback.

`log4j2.xml`:
```xml
<Configuration status="WARN">
    <Appenders>
        <Console name="Console" target="SYSTEM_OUT">
            <PatternLayout pattern="%d [%t] %-5p %c - %m%n"/>
        </Console>
        <RollingFile name="File" fileName="logs/app.log"
                     filePattern="logs/app-%d{yyyy-MM-dd}-%i.log.gz">
            <PatternLayout pattern="%d [%t] %-5p %c - %m%n"/>
            <Policies>
                <TimeBasedTriggeringPolicy/>
                <SizeBasedTriggeringPolicy size="100MB"/>
            </Policies>
        </RollingFile>
    </Appenders>
    <Loggers>
        <!-- ASYNC root через Disruptor -->
        <AsyncRoot level="INFO">
            <AppenderRef ref="Console"/>
            <AppenderRef ref="File"/>
        </AsyncRoot>
    </Loggers>
</Configuration>
```

**Log4Shell (CVE-2021-44228)** — фундаментальный security-урок. С Log4j 2.17+ баг устранён, но **мораль**: не логируй untrusted input в шаблонах, которые могут быть интерполированы.

## MDC — контекст, который "липнет"

MDC (Mapped Diagnostic Context) — `ThreadLocal` словарь, попадающий в каждую log-запись из этого потока. Идеален для **correlation ID**.

```java
import org.slf4j.MDC;

public void handleRequest(HttpServletRequest req) {
    String correlationId = Optional.ofNullable(req.getHeader("X-Correlation-Id"))
                                    .orElse(UUID.randomUUID().toString());
    MDC.put("correlationId", correlationId);
    MDC.put("userId", currentUserId());
    try {
        process(req);
    } finally {
        MDC.clear();   // КРИТИЧНО — thread-pool переиспользует поток
    }
}
```

И в pattern:
```xml
<pattern>%d [%X{correlationId}] [%X{userId}] %-5level %logger - %msg%n</pattern>
```

### Передача MDC через потоки

`ThreadLocal` не наследуется в новом потоке — async-обработка теряет correlation ID.

```java
// Снимок MDC
Map<String, String> contextSnapshot = MDC.getCopyOfContextMap();

CompletableFuture.runAsync(() -> {
    MDC.setContextMap(contextSnapshot != null ? contextSnapshot : Map.of());
    try {
        doWork();
    } finally {
        MDC.clear();
    }
}, executor);
```

Для Spring / Reactor есть готовые утилиты: `MDCTaskDecorator`, Project Reactor hooks через `Context.of("mdc", ...)`.

### MDC + Virtual Threads

Java 21 Virtual Threads работают с `ThreadLocal`, но каждый VT имеет свой — **контекст не пропадает**. Однако при массовом создании VT — оверхед на создание ThreadLocal. Рекомендуется `ScopedValue` (JEP 446, Java 23 preview).

## Structured logging — JSON

Production-нормa — логи в JSON (парсятся Elasticsearch/Loki/Splunk без regex-magic).

### Logback + logstash-encoder

```xml
<dependency>
    <groupId>net.logstash.logback</groupId>
    <artifactId>logstash-logback-encoder</artifactId>
    <version>7.4</version>
</dependency>
```

```xml
<appender name="JSON" class="ch.qos.logback.core.ConsoleAppender">
    <encoder class="net.logstash.logback.encoder.LogstashEncoder">
        <customFields>{"service":"payments","env":"prod"}</customFields>
    </encoder>
</appender>
```

Вывод:
```json
{"@timestamp":"2026-03-14T10:15:30.123Z","level":"INFO","logger":"PaymentService","message":"Charged user 42","correlationId":"abc-123","service":"payments"}
```

### Добавление structured fields

```java
import net.logstash.logback.argument.StructuredArguments.*;

log.info("Order placed",
    kv("orderId", order.getId()),
    kv("amount", order.getAmount()),
    kv("userId", order.getUserId()));
```

## Async appenders — зачем

Обычный `FileAppender` блокирует каждый `log.info()` на I/O (~200–500 микросекунд). На highload это съедает латенси.

**AsyncAppender** (Logback) / **AsyncRoot** (Log4j 2) — кладёт event в очередь, отдельный поток флашит на диск.

**Pitfalls:**
- `queueSize` маленькая → потеря событий при burst. Ставь 8k–32k.
- `discardingThreshold > 0` → при переполнении выбрасывает TRACE/DEBUG сначала. OK.
- `neverBlock=false` → при заполнении очереди блокирует producer. Безопасно для данных, вредно для латенси.
- JVM crash → очередь теряется. Критичные ошибки дублируй sync.

## Pitfalls production-логирования

### 1. Логирование `toString()` большого объекта

```java
log.debug("Loaded user: {}", user);  // user.toString() включает все collections
```
Если DEBUG off — вызов `toString` не происходит (SLF4J ленив). НО если on — может быть O(n) на больших коллекциях. Используй `log.isDebugEnabled()` для явно дорогих случаев.

### 2. Логирование in-loop

```java
for (Order o : orders) {
    log.info("Processing {}", o.getId());  // 1M строк в лог
}
```
Лучше: `log.info("Processing {} orders", orders.size())` + DEBUG per item.

### 3. PII / секреты в логах

GDPR/PCI. Маскируй:
```java
log.info("Card: {}", CardMasker.mask(card));
```
Или в паттерне: regex-replace через `%replace(%msg){'pattern','mask'}`.

### 4. Stack trace без контекста

```java
try { ... } catch (Exception e) {
    log.error("Error", e);   // плохо — что за ордер?
}
```
Лучше:
```java
log.error("Failed to process order {} for user {}", orderId, userId, e);
```

### 5. Две логгирующих библиотеки на classpath

SLF4J + JCL + JUL + Log4j 1.x. Бесконечный цикл bindings. Используй `slf4j-api` + один binding, всё остальное — через bridges (`jcl-over-slf4j`, `log4j-over-slf4j`, `jul-to-slf4j`).

### 6. Слишком много MDC

Каждое значение тянется во все log events. Держи compact: correlationId, userId, tenantId. Всё остальное — через parameterized logging.

### 7. Changing log level in production without restart

Logback поддерживает `scan="true"`:
```xml
<configuration scan="true" scanPeriod="30 seconds">
```
+ Spring Boot Actuator `/actuator/loggers` — менять уровни runtime.

## Быстрая шпаргалка

| Вопрос                                      | Ответ                                                                       |
|---------------------------------------------|----------------------------------------------------------------------------|
| SLF4J — это что?                           | Фасад. Не логирует сам. Делегирует Logback/Log4j2.                         |
| Почему `log.info("x {}", y)` лучше?         | Ленивая конкатенация — не вычисляется при выключенном уровне.              |
| Что такое MDC?                             | `ThreadLocal` контекст, добавляемый в каждую строку лога.                   |
| Как передать MDC в async?                   | `MDC.getCopyOfContextMap()` → `MDC.setContextMap()` в callable.             |
| Зачем AsyncAppender?                        | Не блокировать бизнес-поток на I/O.                                         |
| Почему JSON-логи?                           | Парсятся автоматически, поиск по полям, нет regex-ужаса.                    |
| Как менять уровень без рестарта?            | Logback `scan="true"` или Spring Boot `/actuator/loggers`.                 |
| Log4Shell — что за CVE?                     | RCE через подстановку JNDI-lookup в логируемую строку. Пофикшено в 2.17+.  |
| Разница WARN и ERROR?                       | WARN — app работает; ERROR — сбой операции, вероятно алерт.                 |
| Что такое appender?                         | Куда пишутся логи: console, file, Kafka, Elasticsearch.                    |
