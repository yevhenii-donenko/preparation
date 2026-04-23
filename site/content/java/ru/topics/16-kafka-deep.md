# 16. Kafka Deep Dive — поглиблено для Senior

> Доповнює топік 08. Фокус: внутрішня модель (log/segments/index), реплікація і ISR, exactly-once,
> consumer group rebalance протоколи, Kafka Streams, Schema Registry, моніторинг та tuning.

---

## 16.1 Базова модель — нагадування

```
topic ──── partition 0 ──── [m0][m1][m2][m3][m4]…   ← log (immutable, append-only)
       ──── partition 1 ──── [m0][m1][m2]…
       ──── partition 2 ──── …

Кожне повідомлення = (key?, value, headers, timestamp, offset)
Offset монотонно зростає в межах партиції.
Порядок гарантований ТІЛЬКИ всередині партиції.
```

**Producer** → `hash(key) % numPartitions` (default `Murmur2`) → партиція. `null` ключ → round-robin / sticky.

**Consumer group** → партиції розділяються між учасниками. Один partition → не більше одного consumer у групі. Якщо consumers > partitions — частина простоює.

---

## 16.2 Storage layer

Кожна партиція = директорія на брокері:

```
/var/kafka/orders-0/
  00000000000000000000.log     ← active segment
  00000000000000000000.index   ← offset → position у log
  00000000000000000000.timeindex← timestamp → offset
  00000000000003500000.log     ← старий сегмент (rolled)
  00000000000003500000.index
```

**Сегменти**:
- Rolled by `segment.bytes` (default 1 GB) або `segment.ms`.
- Індекси sparse (`index.interval.bytes` = 4 KB) — за O(log N) знаходять offset, далі лінійне сканування.
- `mmap`-ed → нульовий копіюючий read (sendfile при flush з socket).

**Page cache** робить майже всю магію перформансу. Kafka **сама не керує дисковим кешем** — покладається на ОС. Тому swap = смерть, ext4 / xfs з `noatime`, окремі диски під логи.

---

## 16.3 Реплікація: ISR, leader epoch, unclean leader

Кожна партиція має:
- **Leader** — приймає read/write.
- **Followers** — асинхронно тягнуть `FetchRequest`.
- **ISR (In-Sync Replicas)** — фолловери, які встигають за leader (lag < `replica.lag.time.max.ms`, default 30 s).

**`acks` варіанти продюсера:**
| `acks` | Гарантія | Latency |
|---|---|---|
| `0` | fire-and-forget, можлива втрата | мінімум |
| `1` | leader записав | середня |
| `all` (-1) | усі ISR записали (`min.insync.replicas`) | максимум, найбезпечніше |

**`min.insync.replicas`** (на topic) — мінімум ISR для запису. Якщо < — запис відхилено (`NotEnoughReplicasException`). Класична продакшн-формула: `replication.factor=3, min.insync.replicas=2, acks=all` → витримуємо втрату 1 брокера без втрати даних.

**Leader epoch** — лічильник, що інкрементиться при кожній зміні лідера. Захищає від того, що повертається старий лідер з даними, які newer лідер уже не має. Розв’язує "log divergence" проблему до KIP-101 (помилкові truncations).

**Unclean leader election** (`unclean.leader.election.enable`):
- `false` (default з 0.11) — якщо ISR пустий, запис недоступний (вибираємо availability < consistency = CP).
- `true` — обираємо лідером out-of-sync репліку → можлива втрата даних, але availability збережено (AP).

---

## 16.4 Producer internals

```
client thread → record accumulator (per-partition batches) → sender thread (async)
                       │
                       └─ batch.size, linger.ms, compression.type
```

Ключові параметри:
- `batch.size` (default 16 KB) — максимальний розмір батча на партицію.
- `linger.ms` (default 0) — чекати до X ms, щоб набрати батч. **+5–20 ms** часто дає ×3–10 throughput.
- `compression.type` — `none|gzip|snappy|lz4|zstd`. **`zstd`** — найкращий компроміс CPU/ratio в 2.1+.
- `buffer.memory` — пам’ять на акумулятор (default 32 MB). Якщо overflow → producer блокується або кидає (`max.block.ms`).
- `enable.idempotence=true` (default з 3.0) — кожен producer отримує `producerId` + sequence number; broker дедуплікує по `(pid, seq)` → захист від retry-дублів.
- `max.in.flight.requests.per.connection` — з ідемпотентністю має бути ≤ 5 (інакше можна порушити порядок).

**Idempotent producer** не = exactly-once для consumer, лише захист від дублів **продюсера** при retry в межах однієї сесії.

---

## 16.5 Exactly-Once Semantics (EOS)

Стек:
1. **Idempotent producer** (`enable.idempotence=true`) — без дублів при retry.
2. **Transactional producer** — атомарні записи в декілька партицій/топіків + commit consumer offsets.
3. **Consumer** з `isolation.level=read_committed` — бачить лише закомічені транзакції.

```java
producer.initTransactions();
try {
    producer.beginTransaction();
    producer.send(rec1);
    producer.send(rec2);
    producer.sendOffsetsToTransaction(offsets, consumerGroupMetadata);
    producer.commitTransaction();
} catch (KafkaException e) {
    producer.abortTransaction();
}
```

Це працює, бо `__transaction_state` topic зберігає стан транзакцій; брокер пише markers (`COMMIT` / `ABORT`) у партиції після фази 2 двофазного коміту.

**EOS це лише для Kafka→Kafka** (наприклад, Kafka Streams). Для Kafka→DB EOS вимагає external coordination (idempotency keys, outbox + Debezium тощо).

---

## 16.6 Consumer group rebalance

**Тригери:** consumer joins/leaves, partition added, broker restart, heartbeat timeout.

**Стратегії (`partition.assignment.strategy`):**
- `RangeAssignor` — діапазони послідовних партицій (legacy).
- `RoundRobinAssignor` — рівномірно по консьюмерах.
- `StickyAssignor` — мінімізує переміщення.
- **`CooperativeStickyAssignor`** (KIP-429, 2.4+) — incremental: revoke лише ті партиції, що дійсно міняють власника. **Stop-the-world rebalance уникнено.**

**Eager протокол** (старий):
1. Усі consumers віддають **усі** партиції.
2. Coordinator призначає заново.
3. Усі підіймаються.
- **Пауза** = весь rebalance + warmup (секунди-хвилини при великому стейті).

**Cooperative**:
1. Coordinator вираховує дельту.
2. Тільки consumers, що **втрачають** партицію, її revoke'ять.
3. Тільки consumers, що **отримують**, її assign'ять.
- Інші продовжують споживати.

**Static membership** (`group.instance.id`, KIP-345) — при короткому restart consumer не вибуває з групи (heartbeat timeout не спрацьовує) → немає rebalance взагалі.

---

## 16.7 Offset management

Offsets зберігаються в **`__consumer_offsets`** topic (compacted, key = `(group, topic, partition)`).

| Спосіб | Опис | Гарантія |
|---|---|---|
| `enable.auto.commit=true` | broker `auto.commit.interval.ms` | ❌ at-most-once або at-least-once з вікном дублів |
| Manual `commitSync()` | блокуючий, надійний | at-least-once |
| Manual `commitAsync()` | неблокуючий, callback | at-least-once, але порядок не гарантований |
| `sendOffsetsToTransaction()` | у транзакції з продакшеном | exactly-once (Kafka→Kafka) |

**Best practice:**
```java
try {
    while (running) {
        var records = consumer.poll(Duration.ofSeconds(1));
        process(records);
        consumer.commitAsync(this::onCommitDone);
    }
} finally {
    try { consumer.commitSync(); } finally { consumer.close(); }
}
```

---

## 16.8 Compaction vs Retention

**Retention** (`cleanup.policy=delete`): за часом (`retention.ms`) або розміром (`retention.bytes`). Старі сегменти видаляються цілком.

**Compaction** (`cleanup.policy=compact`): зберігає **останнє** значення для кожного ключа. Викори­стовується для:
- Stateful Stream stores.
- Snapshot’ів.
- `__consumer_offsets`.

**Tombstones**: повідомлення з `value=null` для compacted topic — означає «видалити ключ». Після `delete.retention.ms` (default 24 год) tombstone теж видаляється.

Можна обидва: `cleanup.policy=compact,delete`.

---

## 16.9 Headers, Schema Registry

**Headers** — key-value метадані (`Headers.add("traceId", bytes)`). Не бере участь у hashing/order. Для tracing, idempotency keys, content-type.

**Schema Registry** (Confluent / Apicurio):
- Schemas (Avro / Protobuf / JSON Schema) реєструються по subject (`<topic>-value`).
- Producer пише `[magic byte (0)][schema id (4 bytes)][payload]`.
- Consumer читає id → fetch schema → десеріалізує.
- **Compatibility levels:** BACKWARD (новий consumer читає старе) / FORWARD / FULL / NONE. **BACKWARD** — найпоширеніший: дозволяє додавати поля з default, видаляти optional.

---

## 16.10 Kafka Streams (огляд)

DSL для stream-processing у JVM. Кожен застосунок = `KafkaStreams` instance, всередині — топологія операторів.

```java
StreamsBuilder b = new StreamsBuilder();
KStream<String, Order> orders = b.stream("orders");
KTable<String, Long> ordersByUser = orders
    .groupBy((k, v) -> v.userId())
    .count(Materialized.as("orders-by-user"));
ordersByUser.toStream().to("orders-by-user-output");
new KafkaStreams(b.build(), props).start();
```

Особливості:
- Stateful operators використовують **RocksDB** локально + **changelog topic** у Kafka для відновлення.
- **Tasks** = unit паралелізму. Кількість task = кількість partition найбільшого input topic.
- **Standby replicas** для гарячої заміни.
- **Exactly-once-v2** (`processing.guarantee=exactly_once_v2`).

---

## 16.11 Tuning checklist (production)

**Broker:**
- `num.network.threads = 3 * cores`, `num.io.threads = 8 * cores`.
- `log.flush.*` — НЕ міняти; покладатися на ОС.
- `socket.send.buffer.bytes / socket.receive.buffer.bytes` = 1 MB.
- Heap = 4–6 GB. Більше — page cache важливіше.
- `KAFKA_OPTS="-XX:+UseG1GC -XX:MaxGCPauseMillis=20 -XX:InitiatingHeapOccupancyPercent=35"`.

**Producer (high throughput):**
```properties
acks=all
enable.idempotence=true
compression.type=zstd
linger.ms=10
batch.size=131072        # 128 KB
buffer.memory=67108864   # 64 MB
max.in.flight.requests.per.connection=5
```

**Consumer:**
```properties
fetch.min.bytes=65536
fetch.max.wait.ms=500
max.poll.records=500
session.timeout.ms=10000
heartbeat.interval.ms=3000
max.poll.interval.ms=300000     # обробка batch повинна вкладатися
partition.assignment.strategy=org.apache.kafka.clients.consumer.CooperativeStickyAssignor
```

---

## 16.12 Моніторинг — must-have метрики

| Метрика | Що означає |
|---|---|
| `UnderReplicatedPartitions` | > 0 → replicas відстають → перевірити broker |
| `OfflinePartitionsCount` | > 0 → DOWNTIME, alert P1 |
| `ActiveControllerCount` | має бути рівно 1 на кластер |
| `RequestHandlerAvgIdlePercent` | < 30% → io threads перевантажені |
| `NetworkProcessorAvgIdlePercent` | < 30% → network threads bottleneck |
| `ConsumerLag` (per group) | growing → consumer відстає |
| `producer.record-error-rate` | > 0 → перевірити ACL/quotas |
| `producer.record-retry-rate` | високий → instability |
| `RecordsLagMax` (consumer) | головна SLO-метрика |

Експортери: Kafka Exporter (Prometheus), Confluent Control Center, Cruise Control (балансування).

---

## 16.13 Поширені проблеми та рішення

| Проблема | Причина | Рішення |
|---|---|---|
| Consumer часто rebalances | `max.poll.interval` < часу обробки batch | зменшити `max.poll.records` або підняти interval |
| Дублі повідомлень | `enable.idempotence=false` + retry | увімкнути idempotence, дедуп на consumer |
| Out-of-order | `max.in.flight > 1` без idempotence | увімкнути idempotence (broker сам впорядкує) |
| Slow producer | `acks=all` + great latency between DC | моніторити RTT, налаштувати `min.insync.replicas` |
| Topic росте у розмірі | відсутній / некоректний `retention.ms` | задати retention, перевірити compaction |
| Hot partition | поганий ключ розподілу | змінити стратегію партиціонування |
| Високий end-to-end latency | малий `linger.ms` + великий `batch` | або зменшити батч, або знайти свою точку |

---

## 16.14 Spring Kafka — best practices (швидко)

```java
@Bean
ConcurrentKafkaListenerContainerFactory<String, OrderEvent> factory(
        ConsumerFactory<String, OrderEvent> cf,
        KafkaTemplate<String, Object> dlqTemplate) {
    var factory = new ConcurrentKafkaListenerContainerFactory<String, OrderEvent>();
    factory.setConsumerFactory(cf);
    factory.setConcurrency(3);                        // паралельні consumers
    factory.setBatchListener(false);
    factory.setCommonErrorHandler(new DefaultErrorHandler(
        new DeadLetterPublishingRecoverer(dlqTemplate),
        new ExponentialBackOffWithMaxRetries(3)));
    var container = factory.getContainerProperties();
    container.setAckMode(AckMode.MANUAL_IMMEDIATE);   // ручний ack
    container.setMissingTopicsFatal(false);
    return factory;
}

@KafkaListener(topics = "orders", groupId = "order-svc")
public void on(ConsumerRecord<String, OrderEvent> rec, Acknowledgment ack) {
    try {
        service.process(rec.value());
        ack.acknowledge();
    } catch (TransientException e) {
        throw e;          // піде в retry handler
    } catch (PoisonException e) {
        ack.acknowledge(); // skip + DLQ публікується через recoverer
    }
}
```

DLQ topic за конвенцією: `<topic>.DLT`. Заголовки `kafka_dlt-exception-fqcn`, `kafka_dlt-original-offset` додаються автоматично.

---

## 16.15 Часті інтерв’ю-питання

1. Як Kafka гарантує порядок? *Тільки в межах партиції; key → одна партиція.*
2. Що таке ISR і `min.insync.replicas`? *In-sync replicas; мінімум для запису з `acks=all`.*
3. Як Kafka реалізує exactly-once? *Idempotent producer + transactional producer + `read_committed` consumer.*
4. Eager vs cooperative rebalance? *Eager — STW; cooperative — incremental, без зупинки.*
5. Що відбувається при unclean leader election? *Out-of-sync replica стає лідером → можлива втрата даних.*
6. Compaction vs retention? *Compaction зберігає last value per key; retention видаляє старе.*
7. Як уникнути hot partition? *Кращий ключ; sticky partitioner; salt key.*
8. Що таке Schema Registry і compatibility BACKWARD? *Контроль еволюції схем; новий consumer читає старе.*
9. Чому `acks=1` небезпечний? *Leader записав, але до реплікації може впасти → втрата.*
10. Як Outbox + Debezium забезпечує надійну публікацію? *БД-транзакція пише в outbox, Debezium стрімить CDC у Kafka — атомарно з бізнес-операцією.*
