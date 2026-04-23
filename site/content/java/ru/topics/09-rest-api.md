# 9. REST, API, протоколы

## 9.1 REST — принципы

REST = **Representational State Transfer** (Roy Fielding, 2000). Архитектурный стиль, не протокол.

### Constraints
1. **Client-server** — разделение ответственности.
2. **Stateless** — сервер не хранит состояние клиента между запросами; вся информация — в запросе (auth, контекст).
3. **Cacheable** — ответы помечаются как cacheable / нет.
4. **Uniform interface** — единообразие: ресурсы (URI), представления (JSON/XML), HATEOAS.
5. **Layered system** — клиент не знает, общается ли он напрямую с сервером или через прокси.
6. **Code on demand** (опционально).

### Уровни Richardson Maturity Model
- **0** — RPC поверх HTTP (один URL).
- **1** — Ресурсы (`/orders`, `/users/{id}`).
- **2** — HTTP-методы и status codes используются по назначению.
- **3** — HATEOAS (гиперссылки в ответах).

Большинство "REST API" — уровень 2.

## 9.2 HTTP-методы и идемпотентность

| Метод | Семантика | Safe | Idempotent | Body |
|---|---|---|---|---|
| GET | Чтение | ✅ | ✅ | нет |
| HEAD | GET без body | ✅ | ✅ | нет |
| OPTIONS | Метаданные | ✅ | ✅ | нет |
| POST | Создание / действие | ❌ | ❌ | да |
| PUT | Полная замена / создание по id | ❌ | ✅ | да |
| PATCH | Частичное обновление | ❌ | (не обязан) | да |
| DELETE | Удаление | ❌ | ✅ | редко |

**Safe** — не меняет состояние. **Idempotent** — повтор даёт тот же результат (состояние БД).

## 9.3 Status codes

### 2xx Success
- `200 OK` — стандарт.
- `201 Created` — создан ресурс (часто + `Location: /orders/123`).
- `202 Accepted` — принято в обработку (асинхронно).
- `204 No Content` — успех, ответа нет (типично для PUT/DELETE).

### 3xx Redirection
- `301 Moved Permanently` — окончательно.
- `302 Found` / `307 Temporary Redirect`.
- `304 Not Modified` — для условных запросов с `If-None-Match`/`If-Modified-Since`.

### 4xx Client error
- `400 Bad Request` — невалидный запрос.
- `401 Unauthorized` — нет аутентификации (или невалидная).
- `403 Forbidden` — аутентифицирован, но нет прав.
- `404 Not Found` — ресурс отсутствует.
- `405 Method Not Allowed`.
- `406 Not Acceptable` — не можем отдать в нужном `Accept`.
- `409 Conflict` — конфликт состояния (например, версия).
- `410 Gone` — навсегда удалён.
- `415 Unsupported Media Type`.
- `422 Unprocessable Entity` — синтаксис ок, но семантика битая (валидация).
- `429 Too Many Requests` — rate limit.

### 5xx Server error
- `500 Internal Server Error` — generic.
- `501 Not Implemented`.
- `502 Bad Gateway`.
- `503 Service Unavailable` — временно (можно с `Retry-After`).
- `504 Gateway Timeout`.

## 9.4 Дизайн URL

- Существительные, множественное число: `/orders`, `/users/{id}/orders`.
- Действия — через HTTP-методы, не глаголы в URL. Исключения для нетривиальных операций: `/orders/{id}:cancel` (Google style) или `POST /orders/{id}/cancellation`.
- Версионирование: `/api/v1/...` (URL — практично) / `Accept: application/vnd.app.v2+json` (по media type — "правильно").
- Параметры фильтра: query string (`?status=NEW&limit=20`).
- Пагинация: offset/limit или cursor-based (надёжнее на больших данных).

## 9.5 OpenAPI / Swagger

- Описание API на YAML/JSON. Стандарт OpenAPI 3.x.
- Генерация документации, клиентов, сервер-стабов.
- В Spring — `springdoc-openapi`.
- Можно вести **API-first** (сначала контракт, потом код) или генерить из аннотаций.

## 9.6 Аутентификация и авторизация

### Basic
`Authorization: Basic base64(user:pass)`. Только по HTTPS. Простой, но шлёт credentials в каждом запросе.

### Bearer (JWT)

- **JWT** = `header.payload.signature` (base64url).
- **Header**: алгоритм (`HS256` HMAC, `RS256` RSA, `ES256` ECDSA).
- **Payload (claims)**: `iss`, `sub`, `aud`, `exp`, `iat`, `nbf`, `jti`, кастомные (`roles`, `email`).
- **Signature**: подпись header+payload секретом / приватным ключом.

**Особенности:**
- **Не зашифрован** — данные видны (только подписаны). Для шифра — JWE.
- **Stateless** — не нужно хранить сессии. Минус — нельзя отозвать без дополнительной инфраструктуры (короткий TTL + refresh token, или blacklist).
- Подписывать `RS256` для микросервисов (приватный ключ только у issuer; resource server проверяет публичным).

### OAuth2 / OIDC

**OAuth 2.0** — фреймворк авторизации (получение access token).  
**OIDC** — слой аутентификации поверх OAuth (id_token, OIDC discovery).

**Flows:**
- **Authorization Code + PKCE** — для SPA/мобильных. Браузер → /authorize → /callback с code → /token.
- **Client Credentials** — service-to-service. Клиент шлёт `client_id`/`client_secret`, получает access token.
- **Resource Owner Password Credentials** — устарел.
- **Implicit** — устарел.
- **Device Code** — для устройств без браузера (TV).

**Роли:**
- **Resource Owner** — пользователь.
- **Client** — приложение.
- **Authorization Server** — выдаёт токены (Keycloak, Auth0, Okta).
- **Resource Server** — наш API, валидирует токены.

### CSRF и CORS

- **CSRF (Cross-Site Request Forgery)** — атака, когда чужой сайт от имени залогиненного пользователя дёргает наш API через cookie. Защита — токен (Synchronizer Token Pattern) или SameSite cookies. **Для stateless JWT API не актуально.**
- **CORS (Cross-Origin Resource Sharing)** — браузерная политика. Сервер указывает в заголовках, какие origin'ы могут к нему обращаться. **Preflight** (`OPTIONS`) для нестандартных запросов.

## 9.7 HTTP/1.1 → HTTP/2 → HTTP/3

| | HTTP/1.1 | HTTP/2 | HTTP/3 |
|---|---|---|---|
| Транспорт | TCP | TCP | QUIC (UDP) |
| Multiplexing | нет (head-of-line блокирует) | да в одном TCP-соединении | да на уровне QUIC |
| Сжатие заголовков | нет | HPACK | QPACK |
| Server push | нет | да (deprecated в Chrome) | в QUIC |
| Установление | TCP+TLS handshake | TCP+TLS | 0-RTT возможно |

HTTP/2 решает HoL на уровне HTTP, но TCP HoL остаётся. HTTP/3 решает и его.

## 9.8 WebSocket / SSE

- **WebSocket** — двунаправленное persistent-соединение поверх TCP. Хорош для чатов, real-time games. Не "REST".
- **SSE (Server-Sent Events)** — однонаправленный stream от сервера к клиенту через `text/event-stream`. Проще WebSocket, авто-reconnect, идеален для нотификаций / progress.
- **Long polling** — долгий GET, ждущий событие. Простая альтернатива.

## 9.9 gRPC (обзорно)

- HTTP/2 + Protocol Buffers (бинарный протокол).
- Сильно типизированные контракты (`.proto`).
- 4 режима: unary, server streaming, client streaming, bidirectional streaming.
- Производительнее REST/JSON, но без браузерной поддержки напрямую (нужен gRPC-Web).
- Хорош для service-to-service.

## 9.10 GraphQL (обзорно)

- Один эндпоинт, клиент описывает, какие поля нужны.
- Решает over-fetching и under-fetching.
- Сложности: кэш (нет HTTP-кэша из коробки), N+1 (нужен dataloader), authorization, безопасность (запрос-бомба).

## 9.11 HATEOAS

Сервер возвращает гиперссылки на доступные действия, чтобы клиент не хардкодил URL. На практике редко применяется.

## 9.12 Версионирование API

- **URL** (`/v1/...`) — самое простое и читаемое.
- **Custom header** (`Api-Version: 2`).
- **Media type** (`Accept: application/vnd.app.v2+json`).
- **Query param** — антипаттерн.

Стратегии: `v1` навсегда поддерживается / параллельная разработка / breaking changes только с major bump.

## 9.13 Часто спрашивают

- Какие HTTP-методы идемпотентны? Безопасны?
- Чем PUT отличается от PATCH?
- Когда 401, когда 403?
- Когда 422 vs 400?
- Что такое HATEOAS?
- Что такое stateless и зачем?
- Как версионировать API?
- JWT — структура, как валидируется, как отозвать?
- OAuth2 flows — что использовать для SPA / для service-to-service?
- Чем JWT от OAuth отличается? (JWT — формат токена; OAuth — протокол выдачи).
- CSRF и CORS — что и зачем?
- HTTP/2 — главные отличия от HTTP/1.1.
- WebSocket vs SSE — когда что?
- gRPC vs REST — преимущества/недостатки.


---

# Дополнительные темы REST/API (продолжение)

## 9.14 Полный пример REST API дизайна

### Ресурсы и URL

```
GET    /api/v1/users                     # список (с фильтрами в query)
GET    /api/v1/users?status=active&page=0&size=20&sort=createdAt,desc
POST   /api/v1/users                     # создать
GET    /api/v1/users/{id}                # один
PUT    /api/v1/users/{id}                # полная замена
PATCH  /api/v1/users/{id}                # частичное обновление
DELETE /api/v1/users/{id}

# Вложенные ресурсы
GET    /api/v1/users/{id}/orders         # заказы пользователя
POST   /api/v1/users/{id}/orders

# Действие, которое не вписывается в CRUD
POST   /api/v1/orders/{id}/cancel        # или :cancel (Google style)
POST   /api/v1/users/{id}/password:reset
```

### Запрос/ответ

```http
POST /api/v1/orders HTTP/1.1
Host: api.example.com
Authorization: Bearer eyJhbGc...
Content-Type: application/json
Idempotency-Key: 8a4b2c30-...
Accept: application/json

{
  "customerId": "...",
  "items": [{"productId":"...","qty":2}]
}
```

```http
HTTP/1.1 201 Created
Location: /api/v1/orders/d7f...
Content-Type: application/json
ETag: "v1"

{
  "id": "d7f...",
  "status": "NEW",
  "total": {"amount": "19.99", "currency": "USD"},
  "_links": {
    "self":   {"href": "/api/v1/orders/d7f..."},
    "cancel": {"href": "/api/v1/orders/d7f.../cancel"}
  }
}
```

### Ошибки (RFC 7807 Problem Details)

```http
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/problem+json

{
  "type": "https://api.example.com/errors/validation",
  "title": "Validation failed",
  "status": 422,
  "detail": "The request body has invalid fields",
  "instance": "/api/v1/orders",
  "errors": {
    "items[0].qty": "must be > 0"
  },
  "traceId": "abc123..."
}
```

В Spring 6: `ProblemDetail` из коробки.

### Pagination

**Offset-based** (просто, но deep pagination медленный):
```
GET /api/v1/users?page=0&size=20&sort=createdAt,desc
```
Ответ:
```json
{
  "content": [...],
  "page": {"number": 0, "size": 20, "totalElements": 1234, "totalPages": 62}
}
```

**Cursor-based** (быстрее на больших данных, нет проблемы дублей при insert'ах):
```
GET /api/v1/users?cursor=eyJpZCI6IjEyMyJ9&limit=20
```
Ответ:
```json
{
  "content": [...],
  "nextCursor": "eyJpZCI6IjE0MyJ9"
}
```

## 9.15 Кэширование (HTTP)

### Headers

```http
Cache-Control: public, max-age=3600, stale-while-revalidate=600
ETag: "v1"
Last-Modified: Wed, 21 Oct 2025 07:28:00 GMT
Vary: Accept-Encoding
```

### Conditional requests

```http
GET /api/v1/users/123
If-None-Match: "v1"

→ 304 Not Modified  (если не изменилось)
```

```http
PUT /api/v1/users/123
If-Match: "v1"

→ 412 Precondition Failed  (если ETag не совпал — кто-то поменял)
```

Это **optimistic concurrency** на уровне HTTP.

### Cache-Control directives

- `public` — может кэшировать любой прокси/CDN.
- `private` — только клиент.
- `no-cache` — клиент может хранить, но обязан валидировать.
- `no-store` — не хранить вообще.
- `max-age=N` — секунды.
- `s-maxage=N` — для shared cache.
- `must-revalidate` — после max-age обязательно перепроверить.
- `stale-while-revalidate=N` — отдай stale, обнови в фоне.

## 9.16 Content negotiation

Клиент сообщает, какой формат хочет:
```
Accept: application/json
Accept-Language: en-US,en;q=0.9
Accept-Encoding: gzip, br
```

Сервер отвечает:
```
Content-Type: application/json; charset=utf-8
Content-Language: en-US
Content-Encoding: gzip
Vary: Accept-Encoding   # для кэшей: разные ответы по этому хедеру
```

В Spring:
```java
@GetMapping(value = "/users/{id}", produces = {APPLICATION_JSON_VALUE, APPLICATION_XML_VALUE})
public User get(@PathVariable Long id) { ... }
```

## 9.17 OpenAPI / Swagger — пример

```yaml
openapi: 3.0.3
info:
  title: Orders API
  version: 1.0.0
paths:
  /orders/{id}:
    get:
      operationId: getOrder
      parameters:
        - name: id
          in: path
          required: true
          schema: {type: string, format: uuid}
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema: {$ref: '#/components/schemas/Order'}
        '404':
          description: Not Found
components:
  schemas:
    Order:
      type: object
      properties:
        id: {type: string, format: uuid}
        status: {type: string, enum: [NEW, PAID, SHIPPED]}
```

В Spring — **springdoc-openapi**:
```xml
<dependency>
    <groupId>org.springdoc</groupId>
    <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
    <version>2.x</version>
</dependency>
```
Доступно по `/swagger-ui.html`, схема — `/v3/api-docs`.

**API-first vs Code-first:**
- API-first — пишешь YAML, генеришь интерфейсы (`openapi-generator`). Контракт — источник истины.
- Code-first — генеришь YAML из аннотаций. Быстрее, но контракт зависит от кода.

## 9.18 JWT — детали и валидация

```
header.payload.signature
```

### Header (base64url)
```json
{"alg": "RS256", "typ": "JWT", "kid": "key-id-1"}
```

### Payload (Claims)
```json
{
  "iss": "https://auth.example.com",         // issuer
  "sub": "user-id-123",                      // subject
  "aud": ["api.example.com"],                // audience
  "exp": 1735689600,                         // expiration (epoch sec)
  "nbf": 1735603200,                         // not before
  "iat": 1735603200,                         // issued at
  "jti": "unique-token-id",                  // for revocation list
  "scope": "read:orders write:orders",
  "roles": ["USER"]
}
```

### Signature
```
RSASHA256(
  base64url(header) + "." + base64url(payload),
  privateKey
)
```

### Что проверяет resource server

1. Подпись валидна (по public key из JWKS issuer'а).
2. `exp` ещё не прошёл.
3. `nbf` ≤ сейчас.
4. `iss` — ожидаемый.
5. `aud` содержит наш service.
6. (опционально) `jti` не в blacklist.

### JWKS endpoint

OIDC issuer публикует JWKS на `/.well-known/jwks.json`:
```json
{
  "keys": [
    {"kid":"key-id-1","kty":"RSA","alg":"RS256","n":"...","e":"AQAB"}
  ]
}
```

Spring Security автоматически кэширует ключи и ротирует их.

### Алгоритмы

- **HS256** — HMAC SHA256, симметричный (секрет общий) — для self-contained API.
- **RS256** — RSA, асимметричный — issuer подписывает приватным ключом, любой проверяет публичным. Для микросервисов.
- **ES256** — ECDSA, короче ключи, та же безопасность.

⚠️ **Не используй "alg: none"** — историческая уязвимость.

### Проблемы JWT
- **Невозможность отозвать** до истечения exp. Решения: короткий TTL (15 мин) + refresh token; blacklist в Redis по `jti`.
- **Хранение токена на клиенте**: cookie (httpOnly, Secure, SameSite) безопаснее, чем localStorage (XSS).
- **Ротация ключей**: смена JWK без даунтайма (issuer выкатывает новый ключ за неделю до перехода).

## 9.19 OAuth2 / OIDC — flows детально

### Authorization Code + PKCE (для SPA / мобильных)

```
1. Browser → Authorization Server: 
     GET /authorize?client_id=...&redirect_uri=...&response_type=code
                 &code_challenge=<sha256(verifier)>&code_challenge_method=S256
                 &scope=openid profile&state=<random>
2. Пользователь логинится, даёт согласие.
3. AS → Browser (redirect): /callback?code=AUTH_CODE&state=<random>
4. Browser → AS: 
     POST /token { code: AUTH_CODE, code_verifier: <verifier>, ... }
5. AS → Browser: { access_token, id_token, refresh_token }
```

**PKCE** защищает от перехвата code: атакующий перехватил code, но не имеет verifier → не может обменять.

### Client Credentials (service-to-service)

```
ServiceA → AS: POST /token 
              client_id=A&client_secret=...&grant_type=client_credentials&scope=read:orders
AS → ServiceA: { access_token: "..." }
ServiceA → ServiceB: GET /api/orders (Authorization: Bearer ...)
```

### Token introspection vs JWT validation

- **JWT** — resource server проверяет локально (быстро).
- **Opaque token** — resource server вызывает `/introspect` на AS (медленно, но позволяет revocation).

Большинство публичных AS используют JWT с коротким TTL.

## 9.20 CORS — что и зачем

Браузер ограничивает cross-origin запросы (Same-Origin Policy). CORS — механизм разрешения.

### Simple request
```
GET /api/users
Origin: https://app.example.com
```
Сервер отвечает:
```
Access-Control-Allow-Origin: https://app.example.com
```

### Preflight (для нестандартных методов/headers)
```
OPTIONS /api/users
Origin: https://app.example.com
Access-Control-Request-Method: PUT
Access-Control-Request-Headers: Authorization, Content-Type
```
Сервер:
```
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE
Access-Control-Allow-Headers: Authorization, Content-Type
Access-Control-Max-Age: 3600                    # сколько кэшировать preflight
Access-Control-Allow-Credentials: true          # для cookies
```

⚠️ `Allow-Origin: *` несовместимо с `Allow-Credentials: true`.

В Spring:
```java
@Bean
public CorsConfigurationSource corsConfigurationSource() {
    var cfg = new CorsConfiguration();
    cfg.setAllowedOrigins(List.of("https://app.example.com"));
    cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "PATCH"));
    cfg.setAllowedHeaders(List.of("*"));
    cfg.setAllowCredentials(true);
    cfg.setMaxAge(3600L);
    var src = new UrlBasedCorsConfigurationSource();
    src.registerCorsConfiguration("/**", cfg);
    return src;
}
```

## 9.21 CSRF — когда нужно

**CSRF** атакует API, который аутентифицируется через cookie:
1. Юзер залогинен на bank.com (cookie живёт).
2. Открывает evil.com, где `<form action="bank.com/transfer" method=POST>`.
3. Браузер автоматически прикрепляет cookie → запрос проходит как от юзера.

**Защиты:**
- CSRF token (Synchronizer Token Pattern): сервер выдаёт, клиент шлёт в header/form.
- SameSite cookie: `SameSite=Strict|Lax`.
- Не использовать cookie для auth — JWT в Authorization header не подвержен.

Для **stateless JWT API** CSRF disabled.

## 9.22 Rate limiting — на API

Headers ответа стандартизированы:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1735693200
Retry-After: 60        (для 429 / 503)
```

При превышении — `429 Too Many Requests`.

## 9.23 HTTP/2, HTTP/3 — что важно знать

### HTTP/2
- Бинарный формат (vs текстовый HTTP/1).
- **Multiplexing** — много запросов в одном TCP-соединении (нет HoL на уровне HTTP).
- **HPACK** — сжатие headers.
- **Server Push** (deprecated в Chrome).
- Требует TLS на практике.

Проблема: TCP HoL остаётся (потеря пакета блокирует все потоки).

### HTTP/3
- Поверх **QUIC** (over UDP).
- Решает TCP HoL.
- 0-RTT establishment.
- Connection migration (смена IP без разрыва).

## 9.24 WebSocket

```
GET /ws HTTP/1.1
Upgrade: websocket
Connection: Upgrade
Sec-WebSocket-Key: ...

→ 101 Switching Protocols
```

После upgrade — двунаправленный binary/text frames.

В Spring:
```java
@Configuration
@EnableWebSocket
public class WsConfig implements WebSocketConfigurer {
    @Override public void registerWebSocketHandlers(WebSocketHandlerRegistry r) {
        r.addHandler(new MyHandler(), "/ws");
    }
}
```

Или **STOMP over WebSocket** для pub/sub:
```java
@MessageMapping("/chat")
@SendTo("/topic/messages")
public Message chat(Message m) { return m; }
```

## 9.25 SSE (Server-Sent Events)

```
GET /events HTTP/1.1
Accept: text/event-stream

→ 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

data: {"event":"orderCreated","id":"123"}

data: {"event":"orderPaid","id":"123"}
```

В Spring:
```java
@GetMapping(value = "/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
public Flux<ServerSentEvent<Event>> stream() { ... }
```

Браузер: `new EventSource("/events")`.

Когда: real-time обновления one-way (notifications, live прогресс). Проще WebSocket, переподключается автоматически.

## 9.26 gRPC vs REST — сравнение

| | REST/JSON | gRPC |
|---|---|---|
| Транспорт | HTTP/1.1 / 2 | HTTP/2 |
| Формат | JSON / XML | Protobuf (binary) |
| Контракт | OpenAPI (опционально) | `.proto` (обязательно) |
| Streaming | SSE / WebSocket (отдельно) | unary, server, client, bidirectional |
| Браузер | да | нет (нужен gRPC-Web) |
| Производительность | средняя | высокая |
| Читаемость | хорошая (text) | плохая (binary) |
| Tooling | универсальный | специфичный |

**Когда gRPC:** service-to-service в k8s, высокая нагрузка, строгие контракты.

## 9.27 GraphQL — кратко

```graphql
query {
  user(id: "1") {
    name
    email
    orders(status: ACTIVE) { id total }
  }
}
```

- Один эндпоинт, клиент описывает что нужно.
- Решает over/under-fetching.
- Сложности: HTTP-кэш не работает (POST), N+1 (нужен DataLoader), authorization on field-level, query complexity (защита от DoS).

В Spring — **spring-graphql** (на основе graphql-java).

## 9.28 Дополнительные частые вопросы

- Какие HTTP-методы идемпотентны? Какие safe?
- В чём разница PUT и PATCH?
- Что такое идемпотентность? Как её обеспечить для POST?
- Чем 401 от 403 отличается?
- Когда 422 vs 400?
- Когда 409?
- Что такое HATEOAS?
- Что такое stateless и зачем?
- Как правильно версионировать API?
- Что такое ETag?
- Как реализовать optimistic concurrency на REST? (`If-Match` + `ETag`.)
- Что делает `Cache-Control: no-cache` (это НЕ "не кэшировать")?
- JWT — структура, как валидируется, как отозвать.
- Чем JWT от opaque token отличается?
- Какой OAuth flow для SPA, для service-to-service, для мобильного?
- Что такое PKCE и зачем?
- Чем CSRF от XSS отличается?
- Зачем нужен SameSite cookie?
- Что такое CORS preflight?
- Что такое HTTP/2 multiplexing?
- WebSocket vs SSE vs long polling — когда что?
- gRPC vs REST — преимущества и недостатки.
- Что такое OpenAPI и зачем?
- Чем API-first от code-first отличается?
- Какие headers ratelimit стандартизированы?
- Что произойдёт при 503 + Retry-After?
- Как правильно реализовать pagination на больших данных? (cursor-based.)
- Когда GraphQL уместен, когда нет?

