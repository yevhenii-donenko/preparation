# 13. System Design

## 13.1 Шаблон ответа на System Design

Используй каждый раз — структура важна не меньше, чем содержание.

1. **Functional requirements** — что система делает (use cases).
2. **Non-functional requirements (NFR)** — масштаб, latency, availability, consistency, durability.
3. **Capacity estimation** — QPS, storage, bandwidth.
4. **API design** — базовые эндпоинты / методы.
5. **Data model** — сущности, схема, индексы.
6. **High-level architecture** — компоненты и их связи (рисуй схему).
7. **Deep dive** в 1–2 интересных места (масштабирование БД, очереди, кэш).
8. **Bottlenecks & scaling** — где узкое место, как масштабировать.
9. **Trade-offs** — почему выбрал именно так, что есть альтернативы.

Думай вслух. Уточняй. Не бойся менять решение по ходу.

## 13.2 Capacity estimation — как считать

**Числа полезны:**
- 1 день = 86 400 сек ≈ 10⁵.
- 1 месяц ≈ 2.5 · 10⁶ сек.
- 1 М/день ≈ 12 RPS.

**Latency reference (Jeff Dean):**
| Операция | Время |
|---|---|
| L1 cache | 0.5 нс |
| L2 cache | 7 нс |
| Mutex lock/unlock | 25 нс |
| Main memory ref | 100 нс |
| Compress 1KB (zippy) | 3 µс |
| Send 1KB по 1Gbps | 10 µс |
| SSD random read 4KB | 150 µс |
| Read 1MB sequentially из памяти | 250 µс |
| Round trip в одном DC | 500 µс |
| Read 1MB sequentially с SSD | 1 мс |
| Disk seek | 10 мс |
| Read 1MB sequentially с диска | 20 мс |
| Round trip CA → Netherlands | 150 мс |

**Объёмы:**
- 1 char ≈ 1 byte (ASCII), UTF-8 средне ~2 bytes.
- 1 photo ≈ 200KB-2MB.
- 1 видео-минута ≈ 5–50MB.
- 1 строка БД средне ≈ сотни bytes – KB.

## 13.3 Building blocks

### Load Balancer

- **L4** (TCP/UDP) — быстро, не видит контент. NLB.
- **L7** (HTTP) — может маршрутизировать по path/header/cookie, делать SSL termination, retry, sticky sessions. ALB, nginx, HAProxy, Envoy.
- Алгоритмы: round-robin, least connections, weighted, hashing (по IP/userId — для sticky).

### Reverse proxy / API Gateway

Edge-точка: SSL, auth, rate limit, routing, aggregation, request/response transformation.

### Cache

- **Уровни:** browser → CDN → edge cache → app cache → DB cache.
- **Стратегии:**
  - **Cache-aside (lazy loading):** приложение читает из кэша, при miss — читает БД и кладёт. Самая частая.
  - **Read-through:** кэш сам идёт в БД.
  - **Write-through:** запись идёт в кэш и БД синхронно.
  - **Write-back (write-behind):** запись в кэш, асинхронно в БД (риск потери).
  - **Write-around:** запись в БД минуя кэш (полезно, если данные читаются редко).
- **Eviction:** LRU, LFU, FIFO, TTL, ARC.
- **Инвалидация** — самая сложная часть ("two hard things in CS").
- **Thundering herd** — TTL истёк → много запросов одновременно идут в БД. Решение: блокировка/single-flight, jittered TTL, refresh-ahead, "request coalescing".
- Инструменты: Redis (in-memory KV), Memcached, Caffeine (in-process).

### CDN
- Кэширование статики на edge-нодах (рядом с пользователем).
- Push (загрузил) vs Pull (по первому запросу).
- Cache-Control headers.

### Database

- **Vertical scaling** — больше CPU/RAM. Просто, но потолок.
- **Read replicas** — реплики для чтения; запись на master. **Eventual consistency** между master и replica.
- **Sharding (partitioning)** — разделить данные между нодами:
  - **Range** — по диапазонам ключей. Простая логика, но hot spots.
  - **Hash** — `hash(key) % N`. Равномерно, но resharding больно.
  - **Consistent hashing** — добавление/удаление ноды переносит только маленькую долю данных. Используется в Cassandra, Redis Cluster, DynamoDB.
- **Replication models:**
  - Single-leader (Postgres, MySQL).
  - Multi-leader (multi-region writes, конфликты).
  - Leaderless (Cassandra, Dynamo) — quorum read/write (`R + W > N`).

### Message Queue / Stream

- **Очередь** (RabbitMQ) — задачи, потребитель забирает и удаляет.
- **Лог** (Kafka) — события, можно перечитать; параллелизм через партиции и consumer groups.
- Использование: разгрузка медленных операций, decoupling сервисов, event-driven, batch.

### Search index

- **Elasticsearch / OpenSearch** — full-text, агрегации.
- Индекс отдельно от primary store; синхронизация через CDC / события.

## 13.4 Consistency / Availability / Partition

### CAP

При сети с partition (P) выбираешь: C (linearizable) или A (доступность). Без partition — оба.

### PACELC

Если **P**artition: выбор P/A или P/C.  
**E**lse: выбор **L**atency или **C**onsistency.

### Уровни consistency
- **Linearizable** — как будто система с одной точкой истины, операции упорядочены в реальном времени. Дорого.
- **Sequential** — все видят одинаковый порядок (но не обязательно реальное время).
- **Causal** — причинно-связанные операции упорядочены.
- **Eventual** — рано или поздно консистентно.
- **Read-your-writes**, **monotonic reads**, **monotonic writes**.

### Quorum (Dynamo)
N — реплик, W — на сколько писать, R — с скольких читать.
- `W + R > N` → пересечение → strong (для одной операции).
- `W = N, R = 1` → быстрый read, медленный write.
- `W = 1, R = N` → быстрый write.

## 13.5 Idempotency, retries, timeouts

- Любой удалённый вызов может: упасть, ответить таймаутом, ответить дублем (retry middleware).
- **Идемпотентность** — клиент шлёт `Idempotency-Key`; сервер хранит результат на N минут/часов.
- **Retry**: exponential backoff + jitter. Не ретраить 4xx (ошибка клиента).
- **Timeout** на каждом вызове. Без него — потенциальный deadlock.
- **Deadline propagation** — клиент сообщает оставшееся время, сервер не должен обрабатывать дольше.

## 13.6 Rate limiting

- **Token bucket** — токены добавляются с rate r, capacity b. Запрос потребляет токен. Bursty-friendly.
- **Leaky bucket** — фиксированный rate выхода. Сглаживает.
- **Fixed window counter** — счётчик в окно (минута); просто, но всплески на границе.
- **Sliding window log** — точно, но дорого по памяти.
- **Sliding window counter** — компромисс (Cloudflare).

Где: Edge (gateway), per-user, per-IP, per-API. Хранилище — Redis (атомарные `INCR` + `EXPIRE`).

## 13.7 Availability

- **Number of 9s:**
  - 99% = 3.65 дня в год даунтайма.
  - 99.9% (three 9s) = 8.76 часов.
  - 99.99% = 52.6 минут.
  - 99.999% (five 9s) = 5.26 минут.
- Достигается через redundancy, multi-AZ/region, авто-failover, healthcheck'и, graceful degradation.

## 13.8 Безопасность (high-level)

- **Defense in depth** — несколько слоёв.
- **Least privilege** — роли с минимально необходимыми правами.
- **Zero trust** — никому не доверяй, проверяй каждый запрос.
- TLS везде (mTLS между сервисами).
- Secrets в Vault.
- Logging без PII, маскирование.
- OWASP Top 10: injection, broken auth, sensitive data exposure, XML external entities, broken access control, security misconfig, XSS, insecure deserialization, vulnerable components, insufficient logging.

## 13.9 Классические задачи System Design

### URL shortener (TinyURL)
- API: `POST /shorten`, `GET /{shortCode}` → 301/302.
- Генерация кода: counter + base62, или hash(url) + collision handling, или KGS (Key Generation Service).
- Storage: KV (Redis для горячих + Postgres / DynamoDB для долгоживущих).
- Аналитика: async-event в Kafka → ClickHouse.
- Кэш горячих ссылок.

### Rate limiter
- Redis + Lua-скрипт для атомарности.
- Sliding window counter.
- Distributed: подумай про clock skew, hot keys.

### News feed (Twitter/Instagram)
- **Pull (fan-out on read)** — feed строится при запросе из постов друзей. Дёшево по записи, дорого по чтению.
- **Push (fan-out on write)** — пост → разослать в feed-кэши подписчиков. Быстро на чтение, дорого на запись (особенно для celeb с миллионами).
- **Hybrid** — push для обычных, pull для celeb.
- Feed-сервис, post-сервис, follow-сервис, отдельный timeline-кэш в Redis.

### Chat (WhatsApp)
- WebSocket / persistent connection.
- Сообщения через pub/sub (Kafka).
- Доставка: persist в БД → push в коннекшн получателя или Push-нотификация если оффлайн.
- "Прочитано" / "доставлено" — отдельные события.
- E2E encryption — клиентские ключи.

### Notification system
- Producer (любые сервисы) → message queue → notification-сервис.
- Шаблоны, локализация, channels (email, sms, push, in-app).
- Rate limiting на пользователя, dedup.
- Tracking: delivered/opened/clicked.

### Distributed cache (Redis-like)
- Consistent hashing для шардинга.
- Replication (master-replica), sentinel/cluster.
- Eviction (LRU/LFU).
- Persistence (RDB snapshot + AOF log).

### Search autocomplete
- Trie в памяти.
- Top-K запросов на префикс (precomputed).
- Ranking: частота, freshness, personalisation.
- Rebuild offline на свежих логах.

### Payment system
- Идемпотентность критична (`Idempotency-Key`).
- ACID транзакции, double-entry bookkeeping.
- Saga при взаимодействии с внешними процессорами.
- Outbox для надёжной публикации событий.
- Audit log, immutable.
- Сильная консистентность важнее latency.

### Distributed file storage (Dropbox/Google Drive)
- Файл → чанки (4MB) → дедупликация (хеш чанка).
- Метаданные (BD) отдельно от блобов (S3-like object store).
- Sync (delta), conflict resolution.
- Ссылки на шаринг — short URL + ACL.

### Booking (Uber/Booking.com)
- Geo-индекс (geohash, S2, R-tree).
- Strong consistency для seat/ride lock'а (avoid double-booking) — pessimistic lock или optimistic с retry.
- Eventual для аналитики и истории.

## 13.10 Чеклист "что не забыть упомянуть"

- ✅ Health checks / monitoring / alerting.
- ✅ Logging, tracing, метрики.
- ✅ CI/CD, blue/green / canary.
- ✅ Безопасность: TLS, auth, rate limit, validation.
- ✅ Backup и recovery (RPO/RTO).
- ✅ Cost (на проде дорогое — write-amplification, cross-region traffic).
- ✅ Multi-region / DR.

## 13.11 Часто спрашивают

- Как ты подходишь к System Design? (Шаблон выше.)
- Объясни CAP и PACELC.
- Cache: cache-aside vs write-through vs write-back. Когда что?
- Как инвалидировать кэш?
- Sharding strategies. Что плохого в hash-sharding при росте кластера?
- Как обеспечить exactly-once?
- Когда use SQL, когда NoSQL?
- Как масштабировать БД? (Replicas, sharding, denormalization, CQRS.)
- Что делать при hot key в БД/кэше?
- Что такое thundering herd?
- Как работает rate limiter с token bucket?
- Что такое consistent hashing и зачем?
- Как организовать асинхронную обработку сообщений с гарантиями?
- Trade-off между consistency и availability на конкретном примере.
- Как ты бы спроектировал X (см. список задач выше).

## 13.12 Источники

- **"Designing Data-Intensive Applications"** — Martin Kleppmann (главная книга).
- **"System Design Interview"** — Alex Xu vol. 1 & 2.
- **github.com/donnemartin/system-design-primer** (на английском, всё бесплатно).
- ByteByteGo (YouTube + блог).
- High Scalability blog.


---

# Дополнительные темы System Design (продолжение)

## 13.13 Worked example: URL Shortener (полный разбор)

### 1. Functional requirements
- Создать short URL для long URL.
- Redirect short → long.
- (Optional) аналитика кликов, кастомные алиасы, expiration.

### 2. Non-functional
- 100M long URLs, 100:1 read/write ratio.
- 100M new / month → ~40 writes/sec.
- Read: 4000 RPS, peak ~10000 RPS.
- Latency redirect: < 100ms p99.
- Availability: 99.95%.
- Уникальность короткого кода.

### 3. Capacity estimation
- Storage: 100M urls × ~500 bytes = 50 GB / месяц → 600 GB / год.
- Read bandwidth: 4000 × 500 = 2 MB/s.
- Cache hot 20% → 12 GB кэша на год.

### 4. API
```
POST /api/shorten      { "long_url": "...", "alias": "?", "expires_at": "?" }
                       → 201 { "short": "abc1234" }

GET  /{short}          → 302 Location: <long_url>
DELETE /api/links/{short}
GET  /api/links/{short}/stats
```

### 5. Data model

```sql
CREATE TABLE links (
    id          BIGSERIAL PRIMARY KEY,
    short_code  VARCHAR(10) UNIQUE NOT NULL,
    long_url    TEXT NOT NULL,
    user_id     UUID,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    expires_at  TIMESTAMPTZ
);
CREATE INDEX idx_short ON links(short_code);
```

Аналитика — отдельно (события в Kafka → ClickHouse / DataLake).

### 6. Генерация короткого кода

**Опция A: hash(long_url) → base62**
- `MD5(long_url)[0..6]` → base62 (62⁷ ≈ 3.5·10¹²).
- Минусы: коллизии (нужно retry), один и тот же URL → один код (плохо для приватности/expiration).

**Опция B: counter + base62** ⭐
- Глобальный counter (Redis `INCR` или Snowflake).
- ID → base62 (короче).
- Уникальность гарантирована.

**Опция C: KGS (Key Generation Service)**
- Сервис заранее генерит и складывает в БД pool ключей.
- Service берёт следующий свободный (атомарно).
- Чисто, без коллизий, можно фильтровать (исключить плохие слова).

### 7. Architecture

```
[Client] → [CDN/LB] → [API Gateway] → [Short URL Service] → [Cache (Redis)] → [Postgres / DynamoDB]
                                          ↓
                                     [Kafka] → [Analytics worker] → [ClickHouse]
```

- **CDN** — для статики frontend.
- **LB** — round-robin между API инстансами.
- **Service** — stateless, scale horizontally.
- **Cache (Redis)** — горячие ссылки. Cache-aside.
- **Postgres** — primary. Sharding по `short_code` если вырастем.
- **Kafka** — события клика для аналитики.

### 8. Deep dive

**Read flow:**
1. `GET /abc1234`.
2. Service ищет в **Redis** → cache hit → 302.
3. Cache miss → **Postgres** → положить в Redis (TTL 24h) → 302.
4. Async: emit `LinkClicked` в Kafka.

**Write flow:**
1. Validate URL (длина, схема, не localhost / 192.168.*).
2. Получить ID (counter / KGS).
3. Encode → short_code.
4. Save в БД.
5. (Optional) write-through в кэш.

**Защита от abuse:**
- Rate limit: 10 RPS на IP, 100/час на user.
- Blacklist доменов.
- Капча для anonymous.

### 9. Scaling

- **Read**: scale Redis (cluster), read replicas Postgres.
- **Write**: вертикально (40 RPS не проблема); если миллионы writes — sharded counter / KGS.
- **Storage**: партицирование по time или sharding по `short_code` hash.
- **Hot keys**: вирусная ссылка → редирект через CDN с edge caching.

### 10. Trade-offs
- **Counter** простой, но единая точка для генерации.
- **Hash** не требует БД для генерации, но коллизии.
- **KGS** между ними; отдельный сервис.
- **Postgres vs Cassandra**: Postgres проще, scale до миллиардов записей; Cassandra для глобально распределённого write-heavy.
- **302 vs 301**: 301 кэшируется браузером навсегда → не сможем менять; 302 — каждый раз идёт на сервис → можем.

## 13.14 Worked example: Rate Limiter

### Требования
- Лимит N запросов в Y секунд на ключ (user_id / IP / API key).
- Распределённый (несколько инстансов API).
- Низкая latency (<5ms).

### Алгоритмы

**Fixed window counter** — простой, но всплески на границе:
```
| t=0..60s |   count=10
| t=60..120s | count=10
```
В t=59s могло быть 10, в t=61s ещё 10 → 20 в окне 2 сек.

**Sliding window log** — точно, но дорого:
- Храним timestamps всех запросов.
- При новом — удаляем старее (now - window).
- Считаем размер списка.

**Sliding window counter** — компромисс (Cloudflare):
- Считаем для текущего и предыдущего минутного окна.
- Linear interpolation: `prevCount * (1 - elapsedInCurrent/window) + curCount`.

**Token bucket** — bursty-friendly:
- bucket capacity = b (max bursts).
- refill rate = r tokens/sec.
- Запрос потребляет 1 token. Нет токенов → reject.
- Минимум state: `(tokens, lastRefillTime)`.

**Leaky bucket** — сглаживает:
- Очередь (FIFO) max size b.
- Обрабатывается с фиксированной скоростью r.
- Очередь полная → reject.

### Реализация на Redis (token bucket atomic via Lua)

```lua
-- KEYS[1] = ключ, ARGV = capacity, refill_rate, now
local bucket = redis.call('HMGET', KEYS[1], 'tokens', 'ts')
local tokens = tonumber(bucket[1]) or tonumber(ARGV[1])
local ts     = tonumber(bucket[2]) or tonumber(ARGV[3])
local elapsed = tonumber(ARGV[3]) - ts
tokens = math.min(tonumber(ARGV[1]), tokens + elapsed * tonumber(ARGV[2]))
local allowed = 0
if tokens >= 1 then
    tokens = tokens - 1
    allowed = 1
end
redis.call('HMSET', KEYS[1], 'tokens', tokens, 'ts', ARGV[3])
redis.call('EXPIRE', KEYS[1], 3600)
return allowed
```

### Тонкости distributed
- **Clock skew** между нодами — используй **серверное** время (Redis time).
- **Hot keys** — ключ суперпопулярный → один shard перегружен. Решения: shard ключа (`user:42:0`, `user:42:1`, …); локальный budget + sync.
- **Fail open vs closed** — Redis недоступен → пропускать (open) или блокировать (closed)?

## 13.15 Worked example: Newsfeed (Twitter)

### Подходы

**Pull (Fan-out on read)**
- Запрос feed → собираем посты от всех followees → сортируем → возвращаем.
- Дёшево по записи, дорого по чтению (особенно если пользователь подписан на тысячи).

**Push (Fan-out on write)**
- Пост → распространяем в timelines подписчиков (Redis sorted set по timestamp на user).
- Быстро на чтение, дорого на запись (celebrity с 10M подписчиков → 10M обновлений timeline).

**Hybrid** ⭐
- Push для обычных пользователей.
- Pull для celebrities (>100k followers) — их посты подмешиваются на read.

### Архитектура

```
[Client] → [Gateway]
              ├── [Post Service]   → [Posts DB]   → [Kafka: PostCreated]
              ├── [Follow Service] → [Follows DB]
              └── [Feed Service]   → [Timeline Cache (Redis)] → [DB]
                                         ↑
                              [Fan-out Worker (consumer of PostCreated)]
```

### Storage
- Posts: PostgreSQL / Cassandra (sharding by user_id).
- Timeline: Redis sorted set (score = timestamp, value = post_id).
- Posts content (text/media): отдельно (S3 для media).

### Optimization
- Lazy fetch для inactive users (не делай fan-out если 30 дней не заходил).
- Pagination: cursor-based.
- Edge cache для viral posts.

## 13.16 Worked example: Distributed cache (Redis-like)

- **Sharding:** consistent hashing — каждый shard отвечает за range hash-кольца.
- **Replication:** master + 2 replicas; read из любой, write в master, async replication.
- **Failover:** sentinel/raft consensus → promote replica.
- **Eviction:** LRU/LFU, TTL.
- **Persistence:**
  - **RDB** — snapshot на диск (раз в N минут).
  - **AOF** — append-only log каждой команды.

CAP: Redis Cluster — AP по умолчанию (eventual consistency), CP с особым тюнингом.

## 13.17 Распределённые ID

### UUID v4 (random)
- 128 бит, без координации.
- Минус: не sortable → плохо для индексов B-Tree (фрагментация).

### UUID v7 (timestamp + random) ⭐
- Sortable (top 48 bit — timestamp), отлично для индексов.
- Стандарт RFC 9562. Hibernate 6 поддерживает.

### Snowflake (Twitter)
- 64 бит: 41 timestamp + 10 worker_id + 12 sequence.
- Sortable, без координации (каждый worker генерит сам).
- Требует уникального worker_id (через ZooKeeper / k8s pod ordinal).

### Database sequence
- `BIGSERIAL` / sequence в Postgres → центральная.
- Нельзя scale на много нод без allocation chunks.

### KGS (Key Generation Service)
- Pre-generated pool в БД, сервисы выбирают батчами.

## 13.18 Consistent hashing — детально

Проблема **обычного hash + modulo** (`hash(key) % N`): при изменении `N` (добавили/удалили ноду) **все** ключи переезжают. Для distributed cache — катастрофа.

### Идея
1. Hash space = окружность 0..2³².
2. Ноды размещаются на окружности по hash(node_id).
3. Каждый ключ хешируется и **идёт по часовой стрелке** до ближайшей ноды.

### Virtual nodes
Каждая физическая нода представлена N виртуальными точками на кольце. Зачем:
- Равномерное распределение нагрузки.
- При добавлении/удалении переезжает 1/N доля ключей.

### Replication
Ключ хранится на **K следующих нодах** на кольце.

### Применение
- Cassandra, DynamoDB, Riak — partitioning.
- Memcached client (libketama).
- CDN edge selection.

## 13.19 Quorum — Dynamo style

`N` реплик. Чтобы операция считалась успешной:
- Write на **W** нод.
- Read с **R** нод.

`W + R > N` → strong read-your-writes (хотя бы одна common node).
- `W = N, R = 1` — fast reads, slow writes.
- `W = 1, R = N` — fast writes, slow reads.
- `W = R = N/2 + 1` — balanced.

Cassandra: `ONE`, `QUORUM`, `ALL`, `LOCAL_QUORUM` (для multi-DC).

## 13.20 CAP / PACELC — практически

### CAP
При **partition** выбираешь между:
- **C (linearizable)** — отказываем некоторым операциям, но ответ всегда верный.
- **A (availability)** — отвечаем всегда, но возможно stale data.

Партиция **редка** в одном DC, но **постоянна** для cross-region.

### Примеры
- **CP:** Mongo (default), HBase, etcd, ZooKeeper, Postgres (single master).
- **AP:** Cassandra, DynamoDB, Riak, Couchbase.
- **CA:** не существует в распределённой системе (партиция случается).

### PACELC
Расширяет CAP: **в отсутствие partition** — выбор Latency vs Consistency.
- Cassandra: PA + EL (доступность при разделе, latency без раздела).
- MongoDB: PC + EC (consistency всегда).
- DynamoDB: PA + EL.

## 13.21 Idempotency и retries — практика

```java
@RestController
class PaymentController {
    @PostMapping("/payments")
    public ResponseEntity<Receipt> pay(
        @RequestHeader("Idempotency-Key") String key,
        @RequestBody PaymentRequest req
    ) {
        return idempotency.executeOnce(key, () -> service.charge(req), Duration.ofHours(24));
    }
}
```

Хранилище — Redis с TTL.

**Retry с jitter:**
```
delay = base * 2^attempt + random(0, jitter)
```
**Без jitter** — все клиенты ретраят синхронно → "thundering herd".

**Когда не ретраить:** 4xx (кроме 408, 429), CancellationException.

## 13.22 Backpressure

Чтобы downstream не утонул, upstream должен замедлиться.

- **In-process** (Reactor / RxJava) — `request(n)` сообщает producer'у, сколько может принять.
- **HTTP** — `429 Too Many Requests` + `Retry-After`.
- **Kafka** — consumer не успевает → lag растёт; alerting; auto-scale consumer'ов.
- **Bounded queue + CallerRunsPolicy** в ExecutorService — естественный backpressure.

## 13.23 SLO / SLI / SLA

- **SLI (Indicator)** — что измеряем (latency p99, error rate).
- **SLO (Objective)** — наш target (99.9% < 200ms).
- **SLA (Agreement)** — что обещали клиенту (99.5% — с компенсацией при нарушении).

**Error budget:** 100% - SLO. Если SLO 99.9% — error budget = 0.1% / месяц = 43 минуты. Когда сожгли — фокус на стабильность, не на новые фичи.

## 13.24 Monitoring vs Observability

- **Monitoring** — заранее знаешь, что мерить (CPU, RPS, error rate).
- **Observability** — можешь докопаться до неизвестных проблем (high cardinality logs, traces, debug).

**Three pillars:** metrics, logs, traces. Сейчас добавляют **profiles** и **events**.

## 13.25 Dependency failures

- **Cascading failure:** один сервис упал → другие ждут → таймауты исчерпывают thread pool → они тоже падают.
- **Защита:** Circuit Breaker, timeouts, bulkheads (отдельный пул на каждый downstream), graceful degradation.

## 13.26 Дополнительные частые вопросы

- Как ты подходишь к System Design? (шаблон.)
- Capacity estimation — основные числа.
- Cache strategies — cache-aside vs write-through vs write-back.
- Что такое cache stampede / thundering herd?
- Как инвалидировать кэш?
- Sharding strategies. Что плохого в hash-sharding при росте кластера? (Consistent hashing.)
- Что такое consistent hashing и virtual nodes?
- Как обеспечить exactly-once?
- Когда SQL, когда NoSQL?
- Когда Redis, когда Memcached?
- Как масштабировать БД? (Vertical, replicas, sharding, denormalization, CQRS.)
- Что делать при hot key?
- Что такое thundering herd?
- Как работает rate limiter с token bucket?
- Чем 2PC от Saga отличается?
- Как ты бы спроектировал URL shortener / chat / news feed / payment?
- CAP-теорема: примеры систем CP, AP.
- Что такое linearizable consistency?
- Что такое eventual consistency?
- Что такое read-your-writes consistency?
- Что такое consistent prefix consistency?
- Что такое quorum read/write?
- Чем при "5 девяток" доступности нужно отличаться от "3 девяток"?
- Что такое error budget?
- Чем SLA от SLO отличается?
- Как ты обеспечил бы graceful degradation?
- Что такое bulkhead pattern?
- Что такое cascading failure и как защититься?
- Как мониторить distributed систему?
- Что такое OpenTelemetry?
- Как избежать downtime при выкатке?

