# 7. Базы данных, JPA / Hibernate, транзакции — детально

## 7.1 SQL — обязательный минимум

### Группы команд
- **DDL** — `CREATE`, `ALTER`, `DROP`, `TRUNCATE` (структура).
- **DML** — `SELECT`, `INSERT`, `UPDATE`, `DELETE`, `MERGE`.
- **DCL** — `GRANT`, `REVOKE`.
- **TCL** — `BEGIN`, `COMMIT`, `ROLLBACK`, `SAVEPOINT`.

### JOIN'ы

```
INNER JOIN  — пересечение
LEFT JOIN   — все из левой + матчи из правой (NULL, если нет)
RIGHT JOIN  — наоборот
FULL JOIN   — объединение
CROSS JOIN  — декартово произведение
SELF JOIN   — таблица сама с собой
```

### Порядок выполнения SELECT

`FROM → JOIN → WHERE → GROUP BY → HAVING → SELECT → DISTINCT → ORDER BY → LIMIT`. Поэтому в `WHERE` нельзя использовать алиас из `SELECT`, а в `HAVING` — можно.

### Агрегатные и оконные функции

```sql
-- агрегатные
SELECT customer_id, SUM(amount) FROM orders GROUP BY customer_id HAVING SUM(amount) > 1000;

-- оконные (window) — не схлопывают строки
SELECT id, amount,
       ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY created_at DESC) AS rn,
       SUM(amount)  OVER (PARTITION BY customer_id) AS total_per_customer
FROM orders;
```

`ROW_NUMBER` — уникальный номер. `RANK` — с разрывами при ties. `DENSE_RANK` — без разрывов. `LAG/LEAD` — предыдущая/следующая строка.

### Индексы

- **B-Tree** — дефолт. Хорош для `=`, `<`, `>`, `BETWEEN`, `ORDER BY`, `LIKE 'abc%'` (префикс).
- **Hash** — только для `=`. В PG — редко.
- **GIN/GiST** (PG) — full-text, JSONB, массивы.
- **Composite** — несколько колонок. **Порядок важен**: индекс `(a, b, c)` работает для `WHERE a=...`, `WHERE a=... AND b=...`, но не для `WHERE b=...`.
- **Covering / include** — индекс содержит все колонки запроса → не идём в таблицу.
- **Partial** — индекс с `WHERE` (например, только активные записи).
- **Unique** — обеспечивает уникальность.

**Когда индекс не используется:**
- Функция/преобразование над колонкой: `WHERE LOWER(email) = ...` (нужен функциональный индекс).
- Неявное приведение типа.
- Малая селективность (читать таблицу полностью дешевле).
- `LIKE '%abc'` (поиск с конца).
- `OR` без индекса на каждой колонке.
- Устаревшая статистика (`ANALYZE`).

### EXPLAIN

`EXPLAIN ANALYZE <query>` — реальный план + время. Смотри: тип скана (Seq Scan, Index Scan, Index Only Scan, Bitmap Scan), `rows`, `cost`, `actual time`, `loops`, тип join (Nested Loop, Hash, Merge).

### Нормализация

- **1НФ** — атомарные значения (нет массивов в колонке).
- **2НФ** — 1НФ + нет частичной зависимости от составного ключа.
- **3НФ** — 2НФ + нет транзитивных зависимостей (не-ключ зависит только от ключа).
- **BCNF** — усиление 3НФ.

Денормализация (дублирование данных) оправдана для read-heavy / OLAP, но требует поддержки консистентности (триггеры, события, materialized views).

## 7.2 Транзакции и ACID

- **Atomicity** — всё или ничего.
- **Consistency** — переход из валидного состояния в валидное (БД-инварианты, FK, CHECK).
- **Isolation** — параллельные транзакции изолированы.
- **Durability** — после commit данные не теряются (WAL, fsync).

### Аномалии

| Аномалия | Что |
|---|---|
| **Dirty read** | прочитал данные другой транзакции до её commit |
| **Non-repeatable read** | повторное чтение той же строки даёт другие значения (другая транзакция её обновила и закоммитила) |
| **Phantom read** | повторный запрос с тем же `WHERE` возвращает другой набор строк |
| **Lost update** | две транзакции читают и перезаписывают — изменения одной потеряны |
| **Write skew** | (для snapshot isolation) обе транзакции читают одинаково и принимают решения, нарушающие общий инвариант |

### Уровни изоляции (стандарт)

| Уровень | Dirty | Non-repeat | Phantom |
|---|---|---|---|
| READ UNCOMMITTED | возможно | возможно | возможно |
| READ COMMITTED ✅ default в PG/Oracle | нет | возможно | возможно |
| REPEATABLE READ ✅ default в MySQL | нет | нет | возможно (в стандарте; в MySQL/InnoDB — нет благодаря next-key locks) |
| SERIALIZABLE | нет | нет | нет |

PostgreSQL: REPEATABLE READ = snapshot isolation (нет non-repeatable, нет phantom, но возможен write skew). SERIALIZABLE = SSI (Serializable Snapshot Isolation), может откатывать транзакции.

### MVCC

PostgreSQL и InnoDB используют MVCC: каждая транзакция видит "снимок" БД на момент старта (или statement). Версии строк хранятся (в PG в той же таблице — отсюда vacuum). Читатели не блокируют писателей и наоборот.

### Блокировки

- **Pessimistic** — `SELECT ... FOR UPDATE`. Блокируем строку, другие ждут.
- **Optimistic** — поле `version`/`updated_at`. Не блокируем; при `UPDATE ... WHERE version = ?` если 0 строк затронуто → конфликт → ретрай. В JPA — `@Version`.

Pessimistic — высокая контеншн, deadlocks. Optimistic — для редких конфликтов и read-heavy.

### Изоляция в Spring

```java
@Transactional(isolation = Isolation.REPEATABLE_READ)
```

## 7.3 JPA / Hibernate

### Архитектура

- **`EntityManager`** — основной API JPA, представляет **persistence context**.
- **Persistence context** = **первый уровень кэша**. В пределах одной транзакции один и тот же `id` всегда возвращает **тот же** Java-объект.
- **`SessionFactory`** (Hibernate) / **`EntityManagerFactory`** — тяжёлый, один на приложение.
- **Session** / `EntityManager` — лёгкий, один на транзакцию.

### Состояния сущности

```
new (transient) ── persist() ── managed ── remove() ── removed
                                  │
                              detach/clear/close
                                  ↓
                              detached ── merge() ── managed
```

- **Transient** — обычный POJO, не связан с EM.
- **Managed (persistent)** — отслеживается, dirty checking.
- **Detached** — был managed, но контекст закрыт. Изменения не применяются автоматически.
- **Removed** — помечен на удаление, удалится при flush/commit.

### Dirty checking

При `flush()` (или commit) Hibernate сравнивает текущее состояние managed-сущностей со снимком, сделанным при загрузке, и генерирует `UPDATE` для изменённых полей.

### Жизненный цикл операций

- `persist()` — пометить новый объект как managed (`INSERT` будет на flush).
- `merge()` — взять detached, скопировать поля в managed, вернуть managed (старый остаётся detached).
- `remove()` — пометить на удаление.
- `flush()` — синхронизировать изменения в БД (без commit).
- `clear()` — выбросить все managed (станут detached).
- `refresh()` — перечитать из БД, отбросить изменения в памяти.

### FetchType

- `EAGER` — грузить всегда (default для `@ManyToOne`, `@OneToOne`).
- `LAZY` — грузить по требованию (default для `@OneToMany`, `@ManyToMany`).

**Best practice:** **всегда LAZY**, в том числе для ToOne (явно `fetch = FetchType.LAZY`). EAGER приводит к лишним запросам и невозможности оптимизации.

**`LazyInitializationException`** — обращение к LAZY-полю вне транзакции/сессии (после закрытия EM). Решения:
- Загрузить в транзакции (JOIN FETCH / EntityGraph).
- DTO-проекция.
- Open Session In View (OSIV) — антипаттерн, скрывает проблемы.

### N+1 проблема

Загрузили `List<Order>` (1 запрос) → для каждого `order.getItems()` → ещё N запросов = N+1.

**Решения:**
- `JOIN FETCH` в JPQL: `SELECT o FROM Order o JOIN FETCH o.items WHERE ...`.
- `@EntityGraph`:
  ```java
  @EntityGraph(attributePaths = "items")
  List<Order> findByStatus(Status s);
  ```
- `@BatchSize(size = 50)` на коллекции — Hibernate загрузит коллекции пачками.
- `FetchMode.SUBSELECT`.
- Hibernate 6: `@FetchProfile`.
- DTO-проекция через `SELECT new com.x.OrderDto(...)`.

### Связи

- `@OneToOne` — обычно с одним FK; mappedBy на стороне без FK.
- `@ManyToOne` — самая частая, держит FK. Делать LAZY.
- `@OneToMany` — обычно `mappedBy = "parent"`. Без mappedBy — join-таблица (плохо).
- `@ManyToMany` — **избегать**. Лучше явная промежуточная сущность с двумя `@ManyToOne` (можно добавить поля, например `addedAt`).

### Cascade

`PERSIST`, `MERGE`, `REMOVE`, `REFRESH`, `DETACH`, `ALL`. **`orphanRemoval = true`** — если убрали из коллекции, сущность удаляется. Применять с осторожностью на child'ах, которые "принадлежат" родителю.

### Идентификаторы

- `@GeneratedValue(strategy = IDENTITY)` — auto-increment. Минус: Hibernate не может батчить INSERT'ы.
- `SEQUENCE` — последовательность БД, лучшая опция в PG; поддерживает batch insert и `allocationSize`.
- `TABLE` — отдельная таблица, медленно.
- `AUTO` — на усмотрение провайдера.
- UUID — `@GeneratedValue` + `@UuidGenerator` (Hibernate 6); UUIDv7 хорош для индексов (растущий).

### Кэши

- **L1 (persistence context)** — всегда есть, в рамках транзакции.
- **L2 (SessionFactory-level)** — общий, между транзакциями. Включается явно (`hibernate.cache.use_second_level_cache=true` + провайдер: Ehcache, Caffeine, Redis). `@Cacheable` на сущности. Стратегии: READ_ONLY, NONSTRICT_READ_WRITE, READ_WRITE, TRANSACTIONAL.
- **Query cache** — кэширует id'шники результатов запросов. Включать осторожно, легко получить deadlock инвалидации.

### Миграции (Liquibase / Flyway)

- **Flyway** — версионные SQL-скрипты `V1__init.sql`, `V2__add_email.sql`. Простой и предсказуемый.
- **Liquibase** — XML/YAML/JSON/SQL changesets, поддержка rollback, лучше для multi-DB.

Всегда вести миграции в репозитории, никогда не менять схему вручную.

## 7.4 Spring `@Transactional`

(см. также главу 6.13)

- Создаётся **прокси** → self-invocation не работает.
- **Propagation**:
  - `REQUIRED` (default) — присоединиться или создать.
  - `REQUIRES_NEW` — приостановить текущую, открыть новую (новое соединение из пула!). Для логирования/аудита, которые должны коммититься независимо.
  - `NESTED` — savepoint внутри текущей.
  - `MANDATORY` — обязана быть.
  - `NEVER` — не должна быть.
  - `SUPPORTS` / `NOT_SUPPORTED`.
- **Rollback**: только `RuntimeException`/`Error` по умолчанию. Для checked — `rollbackFor`.
- **`readOnly = true`** — Hibernate отключает dirty checking; некоторые БД могут оптимизировать.
- **Timeout** — секунды.
- **Изоляция** — пробрасывается на JDBC.

### Распространённые баги
- `@Transactional` на private/internal-методе — не сработает (прокси не видит).
- Try-catch внутри — заглушенное исключение → транзакция не откатится. Можно `TransactionAspectSupport.currentTransactionStatus().setRollbackOnly()`.
- Self-invocation.
- Ловишь `LazyInitializationException` после закрытия EM.

## 7.5 Соединения и пулы

- **HikariCP** — дефолт в Spring Boot. Самый быстрый.
- Параметры: `maximumPoolSize`, `minimumIdle`, `connectionTimeout`, `idleTimeout`, `maxLifetime`, `leakDetectionThreshold`.
- Размер пула: чаще всего 10–20. Больше — не лучше (контеншн на БД). Формула: `connections = ((cores * 2) + effective_spindle_count)`.

## 7.6 NoSQL — обзорно

| База | Тип | Когда |
|---|---|---|
| **Redis** | Key-Value, in-memory | Cache, distributed lock (Redlock — спорно), pub/sub, rate limiting, leaderboards |
| **MongoDB** | Document | Гибкая схема, иерархические данные, JSON |
| **Cassandra** | Wide-column | Write-heavy, high availability, time-series, отсутствие join'ов |
| **Elasticsearch** | Search | Full-text, аналитика, логи |
| **DynamoDB** | KV / Document | Managed, serverless |
| **Neo4j** | Graph | Связи "много к многим" глубокие, social graph |

### CAP

В случае **partition** (P), система должна выбрать между **C** (consistency) и **A** (availability):
- CP: Mongo (по умолчанию), HBase, etcd, ZooKeeper.
- AP: Cassandra, DynamoDB (eventual consistent режим).
- (Без партиции — CA, но это идеальный случай.)

**PACELC** расширяет: при partition — выбираем P/A или P/C; при отсутствии partition — выбираем Latency или Consistency.

### Eventual consistency

Записи могут не сразу быть видны на всех нодах. Подходит для систем, где допустима небольшая задержка консистентности (соц. сети, шопинг-история).

## 7.7 Часто спрашивают

- ACID. Уровни изоляции и аномалии.
- Что такое MVCC?
- Optimistic vs pessimistic lock.
- Зачем `@Version`?
- Как работает persistence context?
- Состояния сущности (transient/managed/detached/removed).
- В чём разница `persist` и `merge`?
- N+1 — что это, как обнаружить, как лечить.
- Когда использовать `JOIN FETCH` vs `@EntityGraph`?
- LAZY vs EAGER.
- `@Transactional` propagation: REQUIRED, REQUIRES_NEW, NESTED.
- Почему checked exception не откатывает транзакцию?
- Self-invocation и `@Transactional`.
- Как настроить пул соединений?
- Чем индекс B-Tree отличается от Hash?
- Почему `LIKE '%abc'` не использует индекс?
- Композитный индекс `(a,b,c)` — какие запросы используют?
- CAP-теорема. Когда NoSQL?
- Когда Redis, когда Mongo?
- Чем оконные функции отличаются от агрегатных?


---

# Дополнительные темы JPA / Databases (продолжение)

## 7.8 Полный пример сущности с правильными маппингами

```java
@Entity
@Table(name = "orders", indexes = {
    @Index(name = "idx_orders_customer", columnList = "customer_id"),
    @Index(name = "idx_orders_status_created", columnList = "status, created_at")
})
@Getter @Setter @NoArgsConstructor
public class Order {

    @Id
    @GeneratedValue
    @UuidGenerator                          // Hibernate 6
    private UUID id;

    @Version                                // optimistic locking
    private Long version;

    @Column(name = "customer_id", nullable = false)
    private UUID customerId;

    @Enumerated(EnumType.STRING)            // ВСЕГДА STRING, не ORDINAL
    @Column(nullable = false, length = 20)
    private Status status;

    @Column(name = "total_amount", precision = 19, scale = 2)
    private BigDecimal totalAmount;

    @CreationTimestamp                      // Hibernate, при INSERT
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp                        // Hibernate, при UPDATE
    @Column(name = "updated_at")
    private Instant updatedAt;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @BatchSize(size = 50)                   // защита от N+1 при загрузке коллекций
    private List<OrderItem> items = new ArrayList<>();

    @ManyToOne(fetch = FetchType.LAZY)      // LAZY всегда, даже для ToOne
    @JoinColumn(name = "customer_id", insertable = false, updatable = false)
    private Customer customer;

    // helper для bidirectional
    public void addItem(OrderItem item) {
        items.add(item);
        item.setOrder(this);
    }
}
```

⚠️ **Несколько критических правил:**
1. `@Enumerated(EnumType.STRING)` — иначе при добавлении новой константы в середину enum'а сломаются все старые записи.
2. `@OneToMany` — всегда `mappedBy`, иначе будет join-таблица.
3. Для `@ManyToOne` явно `LAZY`. Default EAGER приводит к проблемам.
4. Используй `Instant`/`OffsetDateTime`, не `Date`/`LocalDateTime` (без зоны опасно).
5. `@ManyToMany` — избегать; делать промежуточную сущность.

## 7.9 N+1 — все способы решения с примерами

### Проблема
```java
List<Order> orders = repo.findAll();
for (Order o : orders) {
    System.out.println(o.getItems().size());     // отдельный SELECT для каждого order
}
// 1 запрос на orders + N запросов на items = N+1
```

### Решение 1: JOIN FETCH в JPQL

```java
@Query("SELECT o FROM Order o LEFT JOIN FETCH o.items WHERE o.status = :s")
List<Order> findWithItems(@Param("s") Status s);
```

⚠️ С пагинацией (`Pageable`) `JOIN FETCH` работает плохо — Hibernate может выгружать всё в память. Используй `@EntityGraph` или двухшаговую стратегию.

### Решение 2: @EntityGraph

```java
@EntityGraph(attributePaths = {"items", "customer"})
List<Order> findByStatus(Status status);
```

Декларативно описываешь, что нужно догрузить.

### Решение 3: @BatchSize

```java
@OneToMany(mappedBy = "order")
@BatchSize(size = 50)
private List<OrderItem> items;
```

При обращении к `getItems()` Hibernate загрузит коллекции для до 50 родителей одним IN-запросом.

### Решение 4: @Fetch(SUBSELECT)

```java
@OneToMany(mappedBy = "order")
@Fetch(FetchMode.SUBSELECT)
private List<OrderItem> items;
```

Один SELECT с подзапросом на родительский запрос — все коллекции загружаются за 2 запроса (родители + items).

### Решение 5: DTO-проекция

```java
@Query("""
    SELECT new com.x.OrderSummaryDto(o.id, o.status, COUNT(i))
    FROM Order o LEFT JOIN o.items i
    WHERE o.status = :s
    GROUP BY o.id, o.status
""")
List<OrderSummaryDto> findSummariesByStatus(@Param("s") Status s);
```

### Как обнаружить N+1

```yaml
spring.jpa.properties.hibernate.generate_statistics: true
logging.level.org.hibernate.SQL: DEBUG
logging.level.org.hibernate.orm.jdbc.bind: TRACE   # значения параметров
```

Или библиотеки: **Hibernate Statistics**, **datasource-proxy**, **p6spy**, **Hypersistence Optimizer** (от Vlad Mihalcea).

## 7.10 Lifecycle сущности — пример

```java
Order o = new Order();                  // transient — нет id, не управляется EM
em.persist(o);                          // managed — будет INSERT на flush
em.flush();                             // INSERT в БД, но транзакция не закоммичена

o.setStatus(PAID);                      // managed → dirty checking → UPDATE на следующем flush

em.detach(o);                           // detached — изменения больше не отслеживаются
o.setStatus(CANCELLED);                 // не сработает в БД

Order merged = em.merge(o);             // detached → managed (с копированием полей в managed)

em.remove(merged);                      // помечен на DELETE
em.flush();                             // DELETE в БД
```

## 7.11 Транзакции — практические кейсы

### REQUIRES_NEW для аудита

```java
@Service @RequiredArgsConstructor
class OrderService {
    private final AuditService audit;

    @Transactional
    public void place(Order o) {
        repo.save(o);
        try {
            audit.log("order placed " + o.getId());     // даже если place упадёт — лог сохранится
        } catch (Exception e) {
            log.warn("audit failed", e);
        }
        // ...
    }
}

@Service
class AuditService {
    @Transactional(propagation = REQUIRES_NEW)         // отдельная транзакция
    public void log(String msg) { ... }
}
```

### Self-invocation проблема

```java
@Service
class OrderService {
    @Transactional
    public void method1() { method2(); }                // ❌ method2 будет в той же транзакции
                                                         // даже если у неё другая аннотация

    @Transactional(propagation = REQUIRES_NEW)
    public void method2() { ... }                       // не сработает — не через прокси
}
```

**Решение:** вынести `method2` в другой бин, или вызвать через self (`applicationContext.getBean(OrderService.class).method2()`).

### Откат checked exception

```java
@Transactional(rollbackFor = MyCheckedException.class)
public void op() throws MyCheckedException { ... }

// или
@Transactional
public void op() throws MyCheckedException {
    try { ... } 
    catch (MyCheckedException e) {
        TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
        throw e;
    }
}
```

### readOnly

```java
@Transactional(readOnly = true)             // Hibernate отключает dirty checking → быстрее
public List<UserDto> findAll() { ... }
```

## 7.12 Criteria API — type-safe динамические запросы

```java
public List<User> search(String name, Integer minAge, Status status) {
    CriteriaBuilder cb = em.getCriteriaBuilder();
    CriteriaQuery<User> q = cb.createQuery(User.class);
    Root<User> root = q.from(User.class);

    List<Predicate> preds = new ArrayList<>();
    if (name != null)    preds.add(cb.like(cb.lower(root.get("name")), "%" + name.toLowerCase() + "%"));
    if (minAge != null)  preds.add(cb.greaterThanOrEqualTo(root.get("age"), minAge));
    if (status != null)  preds.add(cb.equal(root.get("status"), status));

    q.where(cb.and(preds.toArray(Predicate[]::new)));
    q.orderBy(cb.desc(root.get("createdAt")));

    return em.createQuery(q).getResultList();
}
```

В Spring Data — лучше через `Specification`:

```java
public Specification<User> withFilters(String name, Integer minAge, Status status) {
    return (root, q, cb) -> {
        List<Predicate> p = new ArrayList<>();
        if (name != null)   p.add(cb.like(cb.lower(root.get("name")), "%"+name.toLowerCase()+"%"));
        if (minAge != null) p.add(cb.greaterThanOrEqualTo(root.get("age"), minAge));
        if (status != null) p.add(cb.equal(root.get("status"), status));
        return cb.and(p.toArray(Predicate[]::new));
    };
}

repo.findAll(withFilters(name, minAge, status), PageRequest.of(0, 20));
```

Минусы: проигрывает по читаемости JPQL. Альтернативы: **QueryDSL**, **jOOQ**.

## 7.13 Кэш L2 — практический пример

```yaml
spring.jpa.properties:
  hibernate.cache.use_second_level_cache: true
  hibernate.cache.use_query_cache: true
  hibernate.cache.region.factory_class: org.hibernate.cache.jcache.JCacheRegionFactory
  hibernate.javax.cache.provider: org.ehcache.jsr107.EhcacheCachingProvider
```

```java
@Entity
@Cacheable
@org.hibernate.annotations.Cache(usage = CacheConcurrencyStrategy.READ_WRITE)
public class Country { ... }
```

Стратегии:
- `READ_ONLY` — для immutable данных (страны, валюты).
- `NONSTRICT_READ_WRITE` — допускает stale данные.
- `READ_WRITE` — обычная.
- `TRANSACTIONAL` — для XA-кэшей.

⚠️ L2 кэш и query cache часто приносят больше боли, чем пользы. Для высоконагруженных систем лучше явный кэш в Redis.

## 7.14 SQL — углублённо

### JOIN — все виды на одной картинке

```sql
-- INNER JOIN: только пересечение
SELECT * FROM users u INNER JOIN orders o ON o.user_id = u.id;

-- LEFT JOIN: все из users + матчи из orders (NULL если нет)
SELECT * FROM users u LEFT JOIN orders o ON o.user_id = u.id;

-- LEFT JOIN с фильтром "у кого нет orders"
SELECT * FROM users u LEFT JOIN orders o ON o.user_id = u.id WHERE o.id IS NULL;

-- FULL OUTER JOIN: все из обеих
SELECT * FROM a FULL OUTER JOIN b ON ...;

-- CROSS JOIN: декартово произведение
SELECT * FROM colors CROSS JOIN sizes;
```

### Window functions

```sql
-- Топ-3 заказа на пользователя
SELECT *
FROM (
  SELECT user_id, id, total,
         ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY total DESC) AS rn
  FROM orders
) t
WHERE rn <= 3;

-- Сравнение с предыдущим
SELECT date, sales,
       LAG(sales)  OVER (ORDER BY date) AS prev_day,
       sales - LAG(sales) OVER (ORDER BY date) AS diff
FROM daily_sales;

-- Бегущая сумма
SELECT date, amount,
       SUM(amount) OVER (ORDER BY date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cumsum
FROM transactions;
```

### CTE (Common Table Expression)

```sql
-- Простой CTE — как именованный подзапрос
WITH active_users AS (
  SELECT * FROM users WHERE status = 'ACTIVE'
)
SELECT * FROM active_users WHERE age >= 18;

-- Recursive CTE — для иерархий
WITH RECURSIVE org_tree AS (
  SELECT id, name, manager_id, 0 AS level
  FROM employees WHERE id = :ceo_id
  UNION ALL
  SELECT e.id, e.name, e.manager_id, ot.level + 1
  FROM employees e
  JOIN org_tree ot ON e.manager_id = ot.id
)
SELECT * FROM org_tree;
```

### EXPLAIN ANALYZE — что искать

```
Seq Scan on users  (cost=0..123 rows=10000) (actual=0..50 rows=12000 loops=1)
  Filter: (age > 18)
```
- **Seq Scan** — full table scan; ОК для малых таблиц или большой селективности.
- **Index Scan** — обходит индекс + читает из таблицы.
- **Index Only Scan** — данные из индекса, в таблицу не идём (covering index).
- **Bitmap Heap Scan** — собрал bitmap по индексу, потом обходит heap.
- **Nested Loop** — для маленьких join'ов.
- **Hash Join** — строит hash по меньшей таблице, обходит большую.
- **Merge Join** — обе таблицы отсортированы.

Сравнивай **planned rows** vs **actual rows** — если сильно расходятся → устаревшая статистика → `ANALYZE`.

### Когда индекс НЕ используется

- `WHERE LOWER(email) = ...` — нужен функциональный индекс `CREATE INDEX ON users (LOWER(email))`.
- Неявное приведение типа: `WHERE int_col = '5'` — может игнорироваться.
- `LIKE '%abc'` (поиск с начала строки невозможен по B-Tree).
- Низкая селективность (если больше ~10% таблицы — full scan дешевле).
- `OR` без индекса на каждой колонке.
- Использование функции от индексной колонки.

### Composite index — порядок имеет значение

Индекс `(a, b, c)`:
- ✅ `WHERE a = 1`
- ✅ `WHERE a = 1 AND b = 2`
- ✅ `WHERE a = 1 AND b = 2 AND c = 3`
- ✅ `WHERE a = 1 ORDER BY b`
- ❌ `WHERE b = 2`
- ❌ `WHERE a = 1 AND c = 3` — частично (используется только по a)

## 7.15 Транзакции, блокировки, MVCC — практически

### Optimistic locking с @Version

```java
@Entity
class Account {
    @Id Long id;
    BigDecimal balance;
    @Version Long version;
}

// При UPDATE Hibernate генерирует:
// UPDATE account SET balance=?, version=version+1 WHERE id=? AND version=?
// Если 0 строк затронуто → OptimisticLockException
```

Как обрабатывать:
```java
@Transactional
public void transfer(Long from, Long to, BigDecimal amount) {
    Account a = repo.findById(from).orElseThrow();
    Account b = repo.findById(to).orElseThrow();
    a.debit(amount);
    b.credit(amount);
    // на commit — UPDATE с проверкой version
}

// Retry при конфликте
@Retryable(value = OptimisticLockException.class, maxAttempts = 3, backoff = @Backoff(50))
public void transferWithRetry(...) { ... }
```

### Pessimistic locking

```java
@Lock(LockModeType.PESSIMISTIC_WRITE)
@Query("SELECT a FROM Account a WHERE a.id = :id")
Optional<Account> lockById(@Param("id") Long id);
```

Генерирует `SELECT ... FOR UPDATE` → блокирует строку до commit.

`PESSIMISTIC_READ` → `FOR SHARE` (читать можно, писать нет).

### Уровни изоляции в коде

```java
@Transactional(isolation = Isolation.REPEATABLE_READ)
public void op() { ... }
```

| Уровень | Гарантии |
|---|---|
| READ_UNCOMMITTED | разрешает dirty read |
| READ_COMMITTED | default в PG/Oracle, нет dirty read |
| REPEATABLE_READ | нет non-repeatable read |
| SERIALIZABLE | полная изоляция, может быть retry |

PostgreSQL: REPEATABLE_READ = snapshot isolation, может выдать **serialization failure** → ретрай.

### MVCC — как PostgreSQL это делает

- Каждая транзакция получает txid и snapshot.
- При UPDATE — создаётся новая версия строки; старая помечается удалённой (xmax).
- Параллельные читатели видят свою версию.
- **VACUUM** периодически чистит старые версии.
- Никогда не блокирует readers writers'ами и наоборот.

## 7.16 HikariCP — параметры

```yaml
spring.datasource.hikari:
  maximum-pool-size: 20
  minimum-idle: 5
  connection-timeout: 30000     # ms
  idle-timeout: 600000          # 10 мин
  max-lifetime: 1800000         # 30 мин (должен быть < wait_timeout БД)
  leak-detection-threshold: 60000   # warn, если соединение не вернулось > 60с
  pool-name: HikariMain
```

**Размер пула:** редко имеет смысл больше 20-30 для одной БД. Формула: `connections ≈ ((cores × 2) + effective_spindle_count)` на стороне БД.

## 7.17 Миграции — Liquibase / Flyway

### Flyway

```
src/main/resources/db/migration/
  V1__init.sql
  V2__add_email_to_users.sql
  V3__create_orders_table.sql
```

Простые именованные SQL. Spring Boot подхватывает автоматически.

### Liquibase

```yaml
# db/changelog/db.changelog-master.yaml
databaseChangeLog:
  - include: { file: changes/v1-init.yaml }
  - include: { file: changes/v2-add-email.yaml }
```

```yaml
# changes/v2-add-email.yaml
databaseChangeLog:
  - changeSet:
      id: add-email-column
      author: bob
      changes:
        - addColumn:
            tableName: users
            columns:
              - column:
                  name: email
                  type: varchar(255)
                  constraints: { nullable: false, unique: true }
      rollback:
        - dropColumn: { tableName: users, columnName: email }
```

Поддерживает rollback, conditions, контексты, multi-DB.

## 7.18 Дополнительные частые вопросы

- Что такое ACID, поясни каждое.
- Уровни изоляции — какие есть, что от чего защищают?
- Что такое MVCC?
- Чем optimistic от pessimistic locking отличается?
- Как реализуется optimistic locking в JPA? (`@Version`.)
- Что такое N+1 проблема? Как обнаружить и решить (5+ способов)?
- LAZY vs EAGER. Почему всегда LAZY?
- В чём разница `persist` и `merge`?
- В каких случаях `merge` отличается от `save` в Spring Data?
- Состояния сущности (transient/managed/detached/removed) — что произойдёт при `remove(detached)`?
- Что такое dirty checking?
- Что такое `@Transactional(readOnly = true)` и зачем?
- Что произойдёт при self-invocation `@Transactional` метода?
- Чем `REQUIRES_NEW` от `NESTED` отличается?
- Почему checked exception не откатывает транзакцию?
- Зачем нужна migration tool? Чем Flyway от Liquibase отличается?
- Когда индекс НЕ используется?
- В каком порядке колонок строить composite index?
- Что такое covering / partial index?
- Что покажет EXPLAIN ANALYZE?
- Чем оконные функции от агрегатных отличаются?
- Когда NoSQL? Какие проблемы решает каждая (Redis/Mongo/Cassandra/Elasticsearch)?
- Что такое CAP-теорема?
- Как настроить пул соединений?
- Что произойдёт при больше параллельных запросов, чем размер пула?
- Что такое soft delete и как реализовать в JPA? (`@Where`, `@SQLDelete`.)
- Что такое `@MappedSuperclass`? Чем от `@Inheritance` отличается?
- Какие стратегии наследования в JPA? (`SINGLE_TABLE`, `JOINED`, `TABLE_PER_CLASS`.)
- Зачем `@Embedded`/`@Embeddable`?
- Чем `@OneToMany(mappedBy)` от `@OneToMany` без `mappedBy` отличается?
- Что такое L1 / L2 кэш Hibernate? Когда использовать L2?

---

# Глубокие объяснения: как БД и JPA работают на самом деле

Большинство проблем в приложениях с БД — не от сложных SQL-запросов, а от непонимания, как работает транзакция, уровни изоляции и как JPA-механизмы (persistence context, lazy loading, dirty checking) влияют на запросы, которые реально уходят в БД.

## Транзакция изнутри: ACID в действии

ACID — это не четыре независимых свойства, а четыре угла взаимосвязанной системы.

**Atomicity (атомарность).** Либо все изменения применяются, либо ни одно. На уровне БД это реализовано через **write-ahead log (WAL)**: перед модификацией данных БД пишет в журнал "я собираюсь сделать X". Если транзакция падает, журнал используется для отката (rollback). Если сервер упал — после рестарта журнал используется для повторного применения незакоммиченных изменений.

**Consistency (консистентность).** БД после транзакции в валидном состоянии: FK связи, CHECK ограничения, unique индексы соблюдены. Это ответственность приложения + БД-ограничений вместе. Сама БД не "знает" бизнес-логику — она только проверяет объявленные constraints.

**Isolation (изоляция).** Параллельные транзакции не "видят" промежуточные состояния друг друга. Это самая сложная часть, и именно здесь кроются большинство багов под нагрузкой. Подробнее ниже.

**Durability (долговечность).** После коммита данные гарантированно сохранены. Реализуется через fsync WAL-журнала на диск перед подтверждением коммита клиенту.

## Уровни изоляции — как выбирать правильно

Стандартные уровни (от слабого к сильному) и аномалии, которые они допускают:

| Уровень | Dirty read | Non-repeatable read | Phantom read |
|---|---|---|---|
| READ_UNCOMMITTED | возможно | возможно | возможно |
| READ_COMMITTED | нет | возможно | возможно |
| REPEATABLE_READ | нет | нет | возможно (в InnoDB — нет) |
| SERIALIZABLE | нет | нет | нет |

**Что значат аномалии.**
- **Dirty read**: тр.2 читает данные, которые тр.1 записала, но ещё не закоммитила. Если тр.1 откатится — тр.2 работала с мусором.
- **Non-repeatable read**: тр.1 читает строку, тр.2 в это время её меняет и коммитит, тр.1 снова читает — **другое значение**. Один запрос внутри транзакции даёт разные ответы.
- **Phantom read**: тр.1 делает `SELECT WHERE age > 18` → 10 строк. Тр.2 вставляет строку с age=25. Тр.1 повторяет — **11 строк**. Изменился набор.

**Какой уровень в реальности.**
- **READ_COMMITTED** — default в PostgreSQL/Oracle. Хороший баланс для OLTP.
- **REPEATABLE_READ** — default в MySQL InnoDB. Даёт snapshot isolation — транзакция видит "снимок" БД на момент старта. Почти всегда достаточно.
- **SERIALIZABLE** — в PostgreSQL через SSI (Serializable Snapshot Isolation), в MySQL через блокировки. Дорого (много deadlock'ов и ретраев), но безопасно для финансовых операций.
- **READ_UNCOMMITTED** — почти никогда. Не даёт ничего полезного, только risk.

**MVCC (Multi-Version Concurrency Control)** — как PostgreSQL и MySQL InnoDB реализуют изоляцию без блокировок на чтение. Каждая запись имеет версию с xmin/xmax (диапазон транзакций, где она видна). Читатели видят "свою" версию, писатели создают новую. Blocking происходит только на уровне write-write, read-write — без блокировок. Это даёт огромную производительность и делает "SERIALIZABLE через блокировки" плохим выбором в PostgreSQL.

## N+1 проблема — самая частая боль JPA

Классический сценарий:
```java
List<Order> orders = orderRepo.findAll();
for (Order o : orders) {
    System.out.println(o.getCustomer().getName());   // lazy load!
}
```
Один запрос за orders + N запросов за customer'ов = **N+1 запросов**. На 1000 orders это 1001 roundtrip к БД, каждый ~5ms = 5 секунд вместо 10ms.

**Откуда приходит.** JPA-аннотации `@ManyToOne(fetch = LAZY)` создают прокси на связанную сущность. Первое обращение — **скрытый SQL**. Поэтому одна строка `o.getCustomer().getName()` в цикле превращается в SELECT.

**Решения, от простого к продвинутому:**

**1. `JOIN FETCH` в JPQL.** Загрузка за один запрос:
```java
@Query("SELECT o FROM Order o JOIN FETCH o.customer")
List<Order> findAllWithCustomer();
```

**2. `@EntityGraph`.** Декларативно, на уровне репозитория:
```java
@EntityGraph(attributePaths = {"customer", "items"})
List<Order> findAll();
```

**3. `Hibernate.initialize(...)`** внутри транзакции.

**4. Batch fetching** через `@BatchSize(size = 20)` — когда всё равно lazy, но хочется уменьшить roundtrips.

**Как обнаружить N+1:**
- Hibernate statistics (`spring.jpa.properties.hibernate.generate_statistics=true`) + тест, проверяющий количество запросов.
- **p6spy** — логирует реальный SQL с параметрами.
- Hypersistence Utils — проверяет N+1 автоматически в тестах.

## Persistence Context и Dirty Checking — почему объект "обновляется сам"

Когда вы делаете:
```java
@Transactional
void updateName(Long id, String name) {
    User u = userRepo.findById(id).get();
    u.setName(name);
    // никаких save()!
}
```
После выхода из метода в БД **улетает UPDATE**, хотя вы не звали save. Это не магия — это **dirty checking**.

**Как это работает.** При загрузке entity через `findById` JPA кладёт его в **persistence context** (он же L1 cache) и **запоминает снимок исходных значений**. При коммите транзакции JPA сравнивает текущее состояние entity с снимком. Если отличается — генерирует UPDATE. Отсюда название "dirty" (грязный — отличающийся от исходного).

**Что это значит практически:**
- Внутри `@Transactional` любые изменения managed entity улетят в БД. Забыли `.save()` — не страшно.
- **Вне транзакции** (detached) изменения теряются. `user.setName("x")` после закрытия транзакции не попадёт в БД.
- **Persistence context живёт в пределах транзакции** (или сессии в раскрытом сценарии Open-Session-In-View).

**Dirty checking имеет стоимость.** На commit JPA проверяет все managed entity. При 10 000 entities в контексте commit может занимать секунды. Решение — `flush()` + `clear()` в batch-операциях, либо `@QueryHint(name = "org.hibernate.readOnly", value = "true")` для read-only запросов (JPA не делает снимок).

## Transaction propagation — что происходит при вложенных `@Transactional`

Propagation определяет, как `@Transactional`-метод должен взаимодействовать с уже существующей транзакцией.

**REQUIRED (default).** "Использую существующую транзакцию, если нет — создаю новую". 99% случаев. **Ловушка**: если внутри падает исключение и ловится снаружи, исключение не откатывает, но транзакция уже помечена `rollbackOnly`, и внешний коммит упадёт с `UnexpectedRollbackException`.

**REQUIRES_NEW.** "Приостанавливаю существующую, создаю **независимую** новую". Используется, когда нужно что-то сохранить независимо от исхода внешней транзакции — например, audit log. **Важно**: требует отдельного **физического connection** (suspend текущего). При большом количестве вложенных вызовов пул соединений может закончиться.

**NESTED.** "Внутри транзакции создаю точку сохранения (SAVEPOINT)". Если вложенная падает — откатывается до savepoint, внешняя продолжается. Требует поддержки от JDBC driver и БД. Менее используется, чем REQUIRES_NEW, потому что логика нестандартная.

**MANDATORY.** "Требую существующую транзакцию, иначе ошибка". Полезно для методов, которые должны вызываться только в транзакции.

**NEVER / NOT_SUPPORTED / SUPPORTS** — экзотика для специфичных случаев.

## Connection pool — bottleneck, о котором забывают

БД-соединение — **дорогой ресурс**: ~1-5 MB памяти на БД-сервере, ~1 MB на приложении, handshake при открытии. Поэтому их кладут в пул (HikariCP в Spring Boot по умолчанию).

**Размер пула.** Частое заблуждение — "чем больше, тем лучше". На самом деле **формула**: `connections = ((core_count * 2) + effective_spindle_count)`. Для 8-core сервера с SSD — ~16 соединений. Больше — просто создают contention на CPU и блокировки в БД.

**Что происходит при исчерпании пула.** Следующий запрос ждёт `connectionTimeout` (default 30 сек в HikariCP), потом бросает `SQLException: Connection is not available`. Если у вас 200 HTTP-потоков и пул на 10 соединений — 190 потоков ждут, latency P99 взлетает.

**Главный принцип производительности.** Держите транзакции **короткими**. Каждый `@Transactional` метод должен:
1. Взять соединение.
2. Сделать работу.
3. Вернуть соединение.

Если внутри транзакции вызываете внешний HTTP API (5 секунд) или блокируетесь на `Thread.sleep` — соединение занято всё это время. Классический анти-паттерн: `@Transactional` на методе контроллера, который внутри ещё и вызывает внешний сервис.

## Индексы — как они устроены и когда не работают

B-tree индекс — дерево, отсортированное по значению колонки. Поиск O(log n). Этого достаточно, чтобы запрос `WHERE x = ?` стал быстрым.

**Когда индекс НЕ работает:**
- **Функция над колонкой**: `WHERE LOWER(name) = 'bob'` — индекс по `name` не работает, нужен функциональный индекс на `LOWER(name)`.
- **Неявное приведение типа**: поле `varchar`, запрос `WHERE x = 123` — БД может cast'ить и потерять индекс.
- **LIKE с wildcard в начале**: `WHERE name LIKE '%bob'` — индекс bесполезен. `WHERE name LIKE 'bob%'` — работает.
- **OR с разными колонками**: `WHERE a=1 OR b=2` — плохо. Лучше UNION двух SELECT'ов.
- **NULL**: в большинстве БД `IS NULL` может использовать индекс, но не всегда оптимально.

**Композитный индекс `(a, b, c)` работает для:**
- `WHERE a = ?`
- `WHERE a = ? AND b = ?`
- `WHERE a = ? AND b = ? AND c = ?`
- **НЕ работает** для `WHERE b = ?` в одиночку — левый префикс обязателен.

**Covering index.** Если все нужные колонки есть в индексе, БД может ответить на запрос **не читая таблицу** (index-only scan в PostgreSQL). Огромный выигрыш. Для этого — INCLUDE-колонки (PG) или просто включить их в композитный индекс.

**EXPLAIN ANALYZE** — показывает реальный план и время. Читать снизу вверх, смотреть на типы: `Seq Scan` (плохо для больших таблиц), `Index Scan` (хорошо), `Bitmap Heap Scan` (для OR/IN — OK), `Nested Loop` / `Hash Join` / `Merge Join`. Если видите `Seq Scan` на миллионной таблице — добавьте индекс.

## L2 cache Hibernate — когда и как

L1 cache = persistence context, scoped to transaction. L2 cache = shared across sessions, scoped to SessionFactory (i.e., application).

**Когда L2 полезен:**
- **Readonly reference data** (страны, категории, permissions) — загружается раз, живёт долго.
- **Очень частые запросы по ID** одних и тех же сущностей.

**Когда L2 вредит:**
- **Часто меняющиеся данные** — invalidation замедляет, consistency даёт сбои.
- **Cluster из нескольких инстансов** — нужен distributed cache (Hazelcast, Infinispan), который добавляет сложности.

**Реализации.** Ehcache, Caffeine, Hazelcast, Redis (через Redisson). Настройка — через `@Cache(usage = READ_WRITE)` на entity + провайдер в `application.yml`.

В большинстве Spring Boot приложений L2 не нужен. Если запросы медленные — сначала оптимизируйте индексы, N+1, размер persistence context. L2 — последнее средство.


