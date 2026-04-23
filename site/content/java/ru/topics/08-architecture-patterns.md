# 8. Архитектура и паттерны

## 8.1 Паттерны GoF

### Creational

- **Singleton** — один экземпляр на JVM. Реализации:
  - `enum Singleton { INSTANCE; }` — лучший: thread-safe, защищён от рефлексии и сериализации.
  - Eager static field.
  - Lazy с double-checked locking + `volatile`.
  - Holder idiom (lazy через static nested class).
  
  В Spring — singleton-бин (область видимости — контейнер, не JVM).

- **Factory Method** — метод, возвращающий объект, скрывая конкретный тип. Подкласс выбирает.
- **Abstract Factory** — фабрика семейств связанных объектов.
- **Builder** — поэтапная сборка сложного объекта. Особенно полезен для immutable объектов с многими полями. Альтернатива телескопическому конструктору.
- **Prototype** — клонирование. В Java — `clone()` (проблематично) или copy-конструктор/`Cloneable`.

### Structural

- **Adapter** — приводит несовместимые интерфейсы. (`InputStreamReader` адаптирует `InputStream` к `Reader`.)
- **Decorator** — добавляет функциональность объекту, не меняя класс. (`BufferedInputStream` оборачивает `InputStream`.)
- **Proxy** — суррогат с контролем доступа: virtual proxy (lazy load), security, caching, remote (RMI), AOP-прокси Spring.
- **Facade** — упрощённый интерфейс к сложной подсистеме. (Сервисы в Spring часто фасады.)
- **Composite** — единая работа с деревом и листом через общий интерфейс. (Swing-компоненты.)
- **Bridge** — отделить абстракцию от реализации, чтобы они менялись независимо.
- **Flyweight** — переиспользование "лёгких" объектов (`Integer.valueOf` cache, String pool).

### Behavioral

- **Strategy** — семейство алгоритмов за общим интерфейсом, выбираемых клиентом. Заменяет `if/switch` по типу.
- **Observer** — подписчики уведомляются при изменении состояния. (`PropertyChangeListener`, Spring Events, RxJava.)
- **Template Method** — алгоритм в базовом классе, шаги в подклассах.
- **Chain of Responsibility** — цепочка обработчиков. (Servlet Filter, Spring Security FilterChain, Netty pipeline.)
- **Command** — действие как объект; параметры, логирование, undo, очереди.
- **State** — поведение зависит от состояния; класс делегирует state-объекту.
- **Iterator** — обход коллекции без раскрытия структуры.
- **Mediator** — централизует коммуникацию между объектами.
- **Visitor** — операция над иерархией без изменения классов.
- **Memento** — снимок состояния для отката.

### Часто на интервью просят
- Привести пример Strategy в реальном коде.
- Decorator vs Proxy (по namespace функциональности и видимости клиенту).
- Adapter vs Bridge.
- Где использовал Builder.
- Как реализовать Singleton thread-safe.

## 8.2 SOLID, DRY, KISS, YAGNI, GRASP

- **SOLID** — см. главу про Core Java.
- **DRY** (Don't Repeat Yourself) — одно знание в одном месте. Не путать с дубликатом кода: код может выглядеть одинаково, но представлять разные знания (тогда DRY не нарушен).
- **KISS** (Keep It Simple, Stupid) — простота побеждает.
- **YAGNI** (You Aren't Gonna Need It) — не делай функциональность "на будущее".
- **GRASP** — принципы распределения ответственности (Information Expert, Creator, Controller, Low Coupling, High Cohesion, Polymorphism, Pure Fabrication, Indirection, Protected Variations).

## 8.3 Архитектурные стили

### Layered (N-tier)

Controller → Service → Repository → DB. Просто, привычно. Минусы — зависимости направлены вниз "к БД", сложно тестировать, доменная логика течёт в сервисы.

### Hexagonal / Ports & Adapters

- **Ядро (domain)** не зависит ни от чего.
- **Порты** — интерфейсы (входящие — use cases, исходящие — repositories, gateways).
- **Адаптеры** — реализации портов (REST, JPA, Kafka).

Зависимости направлены **внутрь** к ядру (Dependency Inversion). Легко тестировать (моки на портах). Можно менять внешний мир, не трогая бизнес-логику.

### Clean Architecture (Uncle Bob) / Onion

Слои: Entities → Use Cases → Interface Adapters → Frameworks. Те же идеи, что и hexagonal.

### DDD (Domain-Driven Design)

- **Ubiquitous Language** — общий язык бизнеса и разработки.
- **Bounded Context** — область с консистентной моделью. Между контекстами — Anti-Corruption Layer.
- **Entity** — объект с identity (id), который живёт во времени.
- **Value Object** — без identity, immutable, равенство по значению (`Money`, `Address`).
- **Aggregate** — кластер связанных объектов с одной сущностью-корнем (Aggregate Root). Транзакционная граница.
- **Repository** — интерфейс получения/сохранения агрегата.
- **Domain Service** — логика, не принадлежащая ни одной сущности.
- **Domain Event** — факт, произошедший в домене ("OrderPlaced"). Лежит в основе event-driven систем.

### CQRS

**Command Query Responsibility Segregation** — разделение модели чтения и записи:
- Команды — изменяют состояние, через aggregate.
- Запросы — оптимизированные read-models, можно отдельные таблицы / БД.

Простой CQRS — две модели в одной БД. Полный CQRS — отдельные хранилища, синхронизация через события (eventual consistency).

### Event Sourcing

Хранится не текущее состояние, а **последовательность событий**. Состояние = свертка событий. Плюсы: полный аудит, time travel, легко строить новые проекции. Минусы: миграция событий, сложность, eventual consistency, сложные запросы.

Часто комбинируется с CQRS.

## 8.4 Паттерны устойчивости

- **Retry** — повтор с **exponential backoff + jitter**. Только для **идемпотентных** операций.
- **Circuit Breaker** — открывается после порога ошибок, "перегорает" → не идём в больной сервис, fail fast. Состояния: CLOSED → OPEN → HALF_OPEN. (Resilience4j.)
- **Bulkhead** — изоляция ресурсов (отдельный пул потоков на разные downstream'ы), чтобы один не съел всё.
- **Rate Limiter** — token bucket / leaky bucket.
- **Timeout** — на всё. Без таймаута — потенциальный deadlock.
- **Fallback** — деградация (закэшированный ответ, дефолт).

## 8.5 Микросервисы

### Когда они нужны

- Команды независимо релизят свои сервисы.
- Разные части системы имеют разный масштаб/нагрузку.
- Технологическое разнообразие.
- Большая организация (закон Конвея).

**Когда НЕ нужны:** маленькая команда, неустоявшаяся доменная модель, нет инфраструктуры (CI/CD, observability, k8s). **Начинай с модульного монолита.**

### Размер сервиса

Не "микро" в смысле "100 строк кода". Один **bounded context** = один сервис, обычно. Команда из 5–10 человек владеет.

### Service discovery

- **Client-side** — Eureka (Netflix), Consul.
- **Server-side** — Kubernetes Service + DNS, AWS ELB.
- В k8s обычно достаточно `Service` + DNS.

### API Gateway

Единая точка входа: routing, auth, rate limit, ssl termination, aggregation. Spring Cloud Gateway, Kong, Nginx, Envoy.

### Configuration

- **Spring Cloud Config**, Consul KV, Kubernetes ConfigMap/Secret.
- Секреты — Vault, AWS Secrets Manager, Sealed Secrets.

### Distributed tracing

- **OpenTelemetry** — стандарт. SDK в приложении → коллектор → бэкенд (Jaeger, Tempo, Zipkin).
- Trace ID + Span ID пробрасываются через заголовки (`traceparent`).
- В Spring — Micrometer Tracing.

### Идемпотентность и доставка

- **At-most-once** — может потеряться (нет ретраев).
- **At-least-once** — может задублироваться (нужна идемпотентность на стороне получателя).
- **Exactly-once** — миф в общем случае; достигается через at-least-once + идемпотентность (idempotency-key).

## 8.6 Распределённые транзакции

### 2PC (Two-Phase Commit)

- **Prepare** — координатор просит всех участников подготовиться, они отвечают yes/no.
- **Commit** — если все yes — commit, иначе abort.
- Минусы: блокирующий, координатор — SPOF, плохо масштабируется. На практике в микросервисах не используется.

### Saga

Длинный business-процесс как последовательность локальных транзакций; компенсирующие действия при отказе.

- **Choreography** (хореография) — каждый сервис слушает события и реагирует. Без центрального координатора. Просто, но сложно понимать "что происходит".
- **Orchestration** (оркестрация) — центральный сервис (saga orchestrator) дирижирует. Понятно, но появляется "божественный" компонент.

Пример: Order → Payment → Inventory → Shipping. Если Payment упал — компенсация (вернуть резерв inventory, отменить order).

### Outbox Pattern

Проблема: нужно атомарно записать в БД и опубликовать событие в Kafka. Решение:
1. В одной транзакции с бизнес-данными пишем событие в таблицу `outbox`.
2. Отдельный процесс (relay) читает `outbox` и публикует в Kafka.
3. Помечает событие отправленным (или удаляет).

Альтернатива — Debezium + CDC из WAL.

**At-least-once** доставка → потребитель должен быть идемпотентным.

### Inbox Pattern

Симметрично: получатель сохраняет идентификатор события в `inbox`-таблицу в той же транзакции, что и обработка. Если получили дубликат — пропускаем.

## 8.7 Kafka — must-know

### Концепции

- **Topic** — лог сообщений; разделён на **partitions** (параллелизм).
- **Partition** — упорядоченная последовательность; порядок гарантирован **только внутри партиции**.
- **Offset** — позиция сообщения в партиции.
- **Producer** — пишет в топик. Может выбрать партицию (по ключу — hash; round-robin без ключа).
- **Consumer Group** — группа потребителей; партиции **разделяются** между ними. Один потребитель в группе читает каждую партицию. Параллелизм ≤ числу партиций.
- **Replication** — каждая партиция реплицируется (factor, обычно 3). Один **leader**, остальные **followers**. **ISR** (in-sync replicas) — реплики, не отстающие сильно.
- **Retention** — хранится время (`retention.ms`) или размер (`retention.bytes`).
- **Compaction** — для compacted-топиков хранится последнее значение по ключу (для key-value стримов, audit, snapshots).

### Гарантии

- **At-most-once** — `acks=0`.
- **At-least-once** — `acks=all` + retry. Default.
- **Exactly-once** — идемпотентный producer (`enable.idempotence=true`) + транзакционный (`transactional.id`) + `read_committed` consumer. В пределах Kafka работает; end-to-end — только в kafka-streams.

### Порядок

В одной партиции — гарантирован. По одному ключу — все сообщения попадают в одну партицию (если не менялось их число) → порядок сохранён. По всему топику — нет.

### Consumer

- **Pull-модель** — потребитель сам опрашивает.
- Хранит offset в специальном топике `__consumer_offsets`.
- Commit: автоматический (`enable.auto.commit=true` — опасно, может потерять/задвоить) или ручной (`commitSync`/`commitAsync`).
- **Rebalancing** — при добавлении/удалении consumer'ов или партиций. Может быть болезненным; cooperative rebalancing с Kafka 2.4+ снижает stop-the-world.

### Kafka vs RabbitMQ

| | Kafka | RabbitMQ |
|---|---|---|
| Модель | Distributed log | Broker / queues |
| Хранение | Долгое (часы/дни/навсегда) | Короткое (до acknowledge) |
| Throughput | Очень высокий | Средний |
| Routing | Простой (топик + партиция) | Богатый (exchange'и) |
| Использование | Event streaming, integration log | Task queues, RPC, низкая латентность |

## 8.8 Идемпотентность и кэширование на уровне API

- **Idempotency-Key** — клиент передаёт UUID в заголовке; сервер хранит соответствие "ключ → результат" и при повторе возвращает тот же ответ.
- **ETag / If-Match** — оптимистичная конкуренция на REST.
- **Cache-Control / If-None-Match** — HTTP-кэш.

## 8.9 Часто спрашивают

- Чем монолит отличается от микросервисов? Когда что?
- Расскажи про hexagonal/clean architecture.
- Что такое DDD, aggregate, bounded context?
- Что такое Saga, какие виды?
- Как реализовать Outbox?
- Как Kafka гарантирует порядок?
- Чем consumer group отличается от topic?
- Что такое ISR?
- Когда Kafka, когда Rabbit?
- Что такое Circuit Breaker?
- Идемпотентность — что это и как реализовать?
- Назови 5–7 GoF-паттернов с примерами из практики.
- Чем Strategy отличается от State?
- Чем Decorator отличается от Proxy?
- В чём проблема общей БД для нескольких микросервисов? (database-per-service).
- Что такое CQRS / Event Sourcing? Когда применять?


---

# Дополнительные темы Архитектуры (продолжение)

## 8.10 GoF паттерны — примеры на Java

### Singleton (правильные реализации)

```java
// 1. Enum (best, защищён от reflection и сериализации)
public enum Config {
    INSTANCE;
    public String get(String key) { ... }
}

// 2. Holder idiom (lazy thread-safe)
public class Service {
    private Service() {}
    private static class Holder { static final Service INSTANCE = new Service(); }
    public static Service get() { return Holder.INSTANCE; }
}

// 3. DCL (если нужна параметризованная инициализация)
public class Service {
    private static volatile Service instance;
    public static Service get() {
        Service local = instance;
        if (local == null) {
            synchronized (Service.class) {
                local = instance;
                if (local == null) instance = local = new Service();
            }
        }
        return local;
    }
}
```

### Builder

```java
public final class Pizza {
    private final String size;
    private final List<String> toppings;
    private final boolean extraCheese;

    private Pizza(Builder b) {
        this.size = b.size;
        this.toppings = List.copyOf(b.toppings);
        this.extraCheese = b.extraCheese;
    }

    public static Builder builder(String size) { return new Builder(size); }

    public static class Builder {
        private final String size;
        private List<String> toppings = new ArrayList<>();
        private boolean extraCheese;

        Builder(String size) { this.size = size; }
        public Builder topping(String t)     { toppings.add(t); return this; }
        public Builder extraCheese(boolean v) { this.extraCheese = v; return this; }
        public Pizza build()                 { return new Pizza(this); }
    }
}

Pizza p = Pizza.builder("large").topping("pepperoni").topping("mushroom").extraCheese(true).build();
```

В реальной жизни — **Lombok** `@Builder`.

### Strategy

```java
interface DiscountStrategy { BigDecimal apply(BigDecimal price); }

class PercentDiscount implements DiscountStrategy {
    private final BigDecimal percent;
    public PercentDiscount(BigDecimal p) { this.percent = p; }
    public BigDecimal apply(BigDecimal price) {
        return price.multiply(BigDecimal.ONE.subtract(percent));
    }
}

class Order {
    BigDecimal totalWith(DiscountStrategy s) { return s.apply(price); }
}
```

В Spring часто реализуется через инъекцию `Map<String, Strategy>` или `List<Strategy>`:
```java
@Service
class CheckoutService {
    private final Map<String, DiscountStrategy> strategies;
    public CheckoutService(List<DiscountStrategy> all) {
        this.strategies = all.stream().collect(toMap(s -> s.code(), Function.identity()));
    }
    public BigDecimal apply(String code, BigDecimal price) {
        return strategies.get(code).apply(price);
    }
}
```

### Observer / Spring Events

```java
record OrderPlaced(UUID orderId) {}

@Component
class OrderService {
    private final ApplicationEventPublisher events;
    void place() { events.publishEvent(new OrderPlaced(id)); }
}

@Component
class EmailListener {
    @EventListener
    void on(OrderPlaced e) { send(...); }
}
```

### Template Method

```java
abstract class ReportGenerator {
    public final byte[] generate() {
        var data = fetch();
        var processed = process(data);
        return render(processed);
    }
    protected abstract Object fetch();
    protected abstract Object process(Object data);
    protected abstract byte[] render(Object data);
}
```

### Decorator

```java
interface Notifier { void send(String msg); }

class EmailNotifier implements Notifier { ... }

class LoggingNotifier implements Notifier {
    private final Notifier inner;
    public LoggingNotifier(Notifier inner) { this.inner = inner; }
    public void send(String msg) {
        log.info("sending {}", msg);
        inner.send(msg);
        log.info("sent");
    }
}

Notifier n = new LoggingNotifier(new RetryNotifier(new EmailNotifier()));
```

### Chain of Responsibility

```java
abstract class Handler {
    private Handler next;
    public Handler chain(Handler n) { this.next = n; return n; }
    public void handle(Request r) {
        if (canHandle(r)) process(r);
        else if (next != null) next.handle(r);
    }
    protected abstract boolean canHandle(Request r);
    protected abstract void process(Request r);
}
```

Spring Security FilterChain, Servlet Filter chain, Netty pipeline — все CoR.

### Adapter

```java
class LegacyXmlReader { Document read(File f) { ... } }

interface JsonReader { JsonNode read(File f); }

class XmlToJsonAdapter implements JsonReader {
    private final LegacyXmlReader xml = new LegacyXmlReader();
    public JsonNode read(File f) { return convert(xml.read(f)); }
}
```

### Proxy

Виды:
- **Virtual proxy** — lazy-инициализация (Hibernate proxy для LAZY).
- **Protection proxy** — security check.
- **Remote proxy** — RMI.
- **Smart proxy** — caching, logging (Spring AOP).

## 8.11 Hexagonal architecture — конкретный пример

```
src/main/java/com/x/orders/
├── domain/                    ← ядро, ничего не знает про Spring/JPA/REST
│   ├── Order.java             (entity, бизнес-методы)
│   ├── OrderId.java           (value object)
│   ├── Money.java
│   ├── ports/
│   │   ├── in/                ← use cases (входящие порты)
│   │   │   ├── PlaceOrderUseCase.java        interface
│   │   │   └── CancelOrderUseCase.java
│   │   └── out/               ← repositories, gateways (исходящие порты)
│   │       ├── OrderRepository.java          interface
│   │       └── PaymentGateway.java           interface
│   └── service/
│       └── OrderService.java  ← реализует use cases, использует ports.out
├── infrastructure/            ← адаптеры
│   ├── persistence/
│   │   ├── OrderJpaEntity.java
│   │   ├── OrderJpaRepository.java
│   │   └── OrderRepositoryImpl.java   (реализация ports/out)
│   ├── payment/
│   │   └── StripePaymentGateway.java  (реализация ports/out)
│   └── messaging/
│       └── KafkaEventPublisher.java
└── adapter/                   ← входящие адаптеры
    └── rest/
        ├── OrderController.java
        └── OrderDto.java
```

**Преимущества:**
- Бизнес-логика тестируется без поднятия Spring/БД.
- Меняешь Hibernate на jOOQ — трогаешь только `infrastructure/persistence`.
- REST → gRPC → CLI — добавляются как новые adapters, не меняя домен.

## 8.12 DDD — практически

### Entity vs Value Object

```java
// Entity — имеет identity
class Order {
    private OrderId id;       // identity
    private List<OrderItem> items;
    // equals/hashCode — по id
}

// Value Object — равен по значению, immutable
record Money(BigDecimal amount, Currency currency) {
    public Money add(Money other) { ... }
}

record Address(String street, String city, String zip) {}
```

### Aggregate

Кластер связанных сущностей с одной "точкой входа" — Aggregate Root. Всё взаимодействие извне — только через root.

```java
class Order {                              // Aggregate Root
    private OrderId id;
    private List<OrderItem> items;          // OrderItem — child entity, но извне недоступна

    public void addItem(Product p, int qty) {
        if (items.size() > 100) throw ...;  // инвариант агрегата
        items.add(new OrderItem(p.id(), p.price(), qty));
    }

    public Money total() {
        return items.stream().map(OrderItem::subtotal).reduce(Money.ZERO, Money::add);
    }
}
```

**Транзакционная граница** = aggregate. Один UPDATE на один aggregate в одной транзакции (избегаем lock contention).

### Repository

Возвращает aggregate root, не отдельные части:

```java
public interface OrderRepository {
    Optional<Order> findById(OrderId id);
    void save(Order order);
}
```

### Domain events

Факты, которые произошли в домене:

```java
record OrderPlaced(OrderId id, Instant at, Money total) {}
record OrderCancelled(OrderId id, Instant at, String reason) {}

class Order {
    private List<DomainEvent> events = new ArrayList<>();

    public void place() {
        this.status = PLACED;
        this.placedAt = Instant.now();
        events.add(new OrderPlaced(id, placedAt, total()));
    }

    public List<DomainEvent> pullEvents() {
        var copy = List.copyOf(events);
        events.clear();
        return copy;
    }
}
```

После сохранения сервис публикует events (в Kafka, ApplicationEventPublisher и т.д.).

### Bounded Context

Один контекст = одна модель. Между контекстами — Anti-Corruption Layer (ACL): преобразование чужой модели в свою, чтобы не "загрязнять" свой домен.

## 8.13 Saga — пример

### Orchestration

```java
@Service
class OrderSaga {
    public void execute(PlaceOrderCommand cmd) {
        OrderId id = orders.create(cmd);
        try {
            payments.charge(id, cmd.amount());                 // step 1
            try {
                inventory.reserve(id, cmd.items());            // step 2
                shipping.schedule(id);                         // step 3
                orders.markCompleted(id);
            } catch (Exception e) {
                payments.refund(id);                           // компенсация 1
                throw e;
            }
        } catch (Exception e) {
            orders.markFailed(id, e.getMessage());
            throw e;
        }
    }
}
```

В реале — асинхронно через сообщения; orchestrator реализуют через **Camunda**, **Temporal**, **AWS Step Functions**.

### Choreography

Каждый сервис подписан на события и публикует свои:

```
OrderService → OrderCreated → 
PaymentService → PaymentSucceeded → 
InventoryService → InventoryReserved → 
ShippingService → OrderShipped
```

Если что-то упало — публикуется `*Failed` событие, остальные компенсируют.

**Trade-off:** orchestration — централизованный контроль, легче дебагать; choreography — нет SPOF, но сложнее видеть полную картину.

## 8.14 Outbox Pattern — реализация

```java
@Entity @Table(name = "outbox")
class OutboxMessage {
    @Id @GeneratedValue UUID id;
    String aggregateType;       // "Order"
    String aggregateId;
    String type;                // "OrderPlaced"
    @Column(columnDefinition = "jsonb") String payload;
    Instant createdAt;
    Instant publishedAt;        // null = pending
}

@Service @Transactional
class OrderService {
    public void place(Order o) {
        repo.save(o);                                       // тот же EM, та же транзакция
        outbox.save(new OutboxMessage("Order", o.getId(), "OrderPlaced", json(o)));
    }
}

@Component
class OutboxRelay {
    @Scheduled(fixedDelay = 1000)
    @Transactional
    public void poll() {
        List<OutboxMessage> pending = outbox.findUnpublished(100);
        for (var m : pending) {
            try {
                kafka.send(m.getType(), m.getPayload()).get();
                m.setPublishedAt(Instant.now());
            } catch (Exception e) {
                log.warn("publish failed, will retry", e);
            }
        }
    }
}
```

Альтернатива — **Debezium** + CDC из WAL: автоматически публикует все INSERT в outbox-таблицу в Kafka.

**Inbox pattern** на стороне получателя — ID входящего сообщения сохраняется в `inbox`-таблицу в той же транзакции, что и обработка → дубликаты отбрасываются.

## 8.15 Kafka — глубоко

### Producer

```java
Properties p = new Properties();
p.put("bootstrap.servers", "broker1:9092,broker2:9092");
p.put("key.serializer",   StringSerializer.class.getName());
p.put("value.serializer", StringSerializer.class.getName());
p.put("acks",             "all");                   // ждать все ISR replicas
p.put("enable.idempotence", "true");                // exactly-once в пределах продюсера
p.put("retries",          Integer.MAX_VALUE);
p.put("max.in.flight.requests.per.connection", "5");
p.put("compression.type", "zstd");
p.put("linger.ms",        "5");                     // batch'ить
p.put("batch.size",       "32768");

try (KafkaProducer<String, String> producer = new KafkaProducer<>(p)) {
    producer.send(new ProducerRecord<>("orders", orderId, json), (md, ex) -> {
        if (ex != null) log.error("send failed", ex);
        else log.info("sent to {}-{}@{}", md.topic(), md.partition(), md.offset());
    });
}
```

**`acks` уровни:**
- `acks=0` — fire-and-forget, может терять.
- `acks=1` — leader подтвердил; может потеряться, если leader упадёт до replication.
- `acks=all` — все ISR подтвердили; durable.

**Идемпотентный producer:** Kafka присваивает producer ID и sequence number → не дублирует на retry.

### Consumer

```java
Properties p = new Properties();
p.put("bootstrap.servers", "...");
p.put("group.id",          "orders-processor");
p.put("enable.auto.commit", "false");                          // ручной commit
p.put("auto.offset.reset", "earliest");
p.put("isolation.level",   "read_committed");                  // не видим uncommitted msgs
p.put("max.poll.records",  "500");

try (KafkaConsumer<String, String> consumer = new KafkaConsumer<>(p)) {
    consumer.subscribe(List.of("orders"));
    while (true) {
        var records = consumer.poll(Duration.ofSeconds(1));
        for (var r : records) process(r);
        consumer.commitSync();                                  // commit после обработки (at-least-once)
    }
}
```

**Гарантии:**
- `commit перед обработкой` → at-most-once.
- `commit после обработки` → at-least-once + нужна идемпотентность.
- Для exactly-once — Kafka transactions + `read_committed`.

### Partition стратегии

- **По ключу:** `hash(key) % numPartitions` — все сообщения с одним ключом → одна партиция → порядок.
- **Round-robin:** без ключа.
- **Custom:** свой `Partitioner`.

⚠️ Если меняется число партиций — распределение ключей меняется → порядок ломается. Поэтому partitions заранее с запасом.

### Consumer group и rebalancing

Партиции делятся между consumer'ами в группе. Rebalance происходит при:
- Добавление/удаление consumer'а.
- Изменение числа партиций.
- Падение consumer'а (heartbeat timeout).

**Cooperative rebalancing** (Kafka 2.4+) — ребалансит по чуть-чуть, не STW для всех.

### Compaction

Для compacted-топиков Kafka хранит **последнее значение по ключу**. Используется для:
- Snapshot текущего состояния (audit, materialized view).
- Compacted log как DB.
- Stream-table duality (KStream vs KTable).

### Spring Kafka

```java
@Component
class OrderListener {
    @KafkaListener(topics = "orders", groupId = "processor")
    public void on(ConsumerRecord<String, OrderEvent> r,
                   Acknowledgment ack) {
        try {
            process(r.value());
            ack.acknowledge();
        } catch (Exception e) {
            // retry / DLT
        }
    }
}
```

Spring Kafka поддерживает **retry topics** и **dead letter topic** через `@RetryableTopic`.

## 8.16 Resilience4j — паттерны устойчивости

```java
// Circuit Breaker
CircuitBreaker cb = CircuitBreaker.of("payments", CircuitBreakerConfig.custom()
    .failureRateThreshold(50)
    .slowCallRateThreshold(50)
    .slowCallDurationThreshold(Duration.ofSeconds(2))
    .waitDurationInOpenState(Duration.ofSeconds(30))
    .permittedNumberOfCallsInHalfOpenState(5)
    .slidingWindowSize(20)
    .build());

Supplier<Receipt> guarded = CircuitBreaker.decorateSupplier(cb, () -> client.charge(amount));
Receipt r = Try.ofSupplier(guarded).recover(ex -> Receipt.fallback()).get();
```

**Состояния CB:**
- CLOSED — нормальная работа, считает ошибки.
- OPEN — превышен порог → fail-fast, без вызовов.
- HALF_OPEN — после waitDuration пропускает несколько вызовов; если успех — CLOSED, если фейл — OPEN.

**Другие модули:** RateLimiter, Retry, Bulkhead, TimeLimiter. Можно цеплять.

## 8.17 Идемпотентность — реализация

```java
@RestController
class PaymentController {
    @PostMapping("/payments")
    public Receipt pay(
        @RequestHeader("Idempotency-Key") String key,
        @RequestBody PaymentRequest req
    ) {
        return idempotency.executeOnce(key, () -> service.charge(req), Duration.ofHours(24));
    }
}

@Service
class IdempotencyService {
    @Transactional
    public <T> T executeOnce(String key, Supplier<T> action, Duration ttl) {
        return cache.get(key).orElseGet(() -> {
            T result = action.get();
            cache.put(key, result, ttl);
            return result;
        });
    }
}
```

Хранилище — Redis с TTL.

## 8.18 Дополнительные частые вопросы

- Объясни Strategy паттерн с примером из своей практики.
- Чем Decorator от Proxy отличается?
- Как реализовать Singleton thread-safe (3 способа)?
- Чем Adapter от Bridge отличается?
- Что такое Aggregate Root?
- Чем Entity от Value Object отличается?
- Что такое Bounded Context?
- В чём разница CQRS и Event Sourcing?
- Расскажи про Saga — orchestration vs choreography.
- Что такое Outbox pattern и зачем?
- Как Kafka гарантирует порядок?
- Чем consumer group отличается от topic?
- Что такое ISR?
- Что такое compaction в Kafka?
- Когда Kafka, когда RabbitMQ?
- Что такое exactly-once в Kafka? Как достигается?
- Как обработать "битое" сообщение в Kafka? (DLT — dead letter topic.)
- Что произойдёт при падении consumer'а?
- Чем idempotent producer от transactional отличается?
- Что такое Circuit Breaker? Состояния?
- Чем Bulkhead от Rate Limiter отличается?
- Как реализовать идемпотентность POST?
- Что такое at-least-once vs exactly-once? Как достичь exactly-once в распределённой системе?
- Чем 2PC от Saga отличается? Почему 2PC не используют в микросервисах?
- Что такое Anti-Corruption Layer?
- Расскажи про hexagonal architecture. В чём преимущество?
- Когда монолит vs микросервисы?
- Какие проблемы у "shared database" между сервисами?

