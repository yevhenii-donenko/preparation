# Networking в Java — углублённо

## Слои сетевого API в JDK

| Уровень                      | API                                                    | Когда                                  |
|------------------------------|--------------------------------------------------------|----------------------------------------|
| Низкий (blocking)            | `java.net.Socket`, `ServerSocket`                      | Custom protocols, TCP/UDP              |
| Низкий (non-blocking/NIO)    | `SocketChannel`, `ServerSocketChannel`, `Selector`     | Высоконагруженные серверы              |
| UDP                          | `DatagramSocket`, `DatagramChannel`                    | DNS, VoIP, gaming                      |
| HTTP (legacy)                | `HttpURLConnection`                                     | Устарело, избегай                      |
| HTTP (modern)                | `java.net.http.HttpClient` (Java 11+)                  | Любые HTTP вызовы                      |
| WebSocket (client)           | `java.net.http.WebSocket`                              | Клиент WebSocket                       |
| High-level                   | Netty, OkHttp, Spring WebClient, Retrofit              | Production фреймворки                  |

## HttpClient (Java 11+) — современный стандарт

Заменяет устаревший `HttpURLConnection`. Синхронный + асинхронный, HTTP/2 из коробки.

### Базовый синхронный запрос

```java
HttpClient client = HttpClient.newBuilder()
    .version(HttpClient.Version.HTTP_2)
    .connectTimeout(Duration.ofSeconds(5))
    .followRedirects(HttpClient.Redirect.NORMAL)
    .build();

HttpRequest request = HttpRequest.newBuilder()
    .uri(URI.create("https://api.example.com/users/42"))
    .header("Accept", "application/json")
    .header("Authorization", "Bearer " + token)
    .timeout(Duration.ofSeconds(10))
    .GET()
    .build();

HttpResponse<String> resp = client.send(request, HttpResponse.BodyHandlers.ofString());
int status = resp.statusCode();
String body = resp.body();
```

### Асинхронный запрос

```java
CompletableFuture<HttpResponse<String>> future =
    client.sendAsync(request, HttpResponse.BodyHandlers.ofString());

future.thenApply(HttpResponse::body)
      .thenAccept(System.out::println)
      .exceptionally(e -> { log.error("failed", e); return null; });
```

### POST с JSON

```java
String payload = """
    {"name": "Alice", "age": 30}
    """;

HttpRequest post = HttpRequest.newBuilder()
    .uri(URI.create("https://api.example.com/users"))
    .header("Content-Type", "application/json")
    .POST(HttpRequest.BodyPublishers.ofString(payload))
    .build();

HttpResponse<Void> resp = client.send(post, HttpResponse.BodyHandlers.discarding());
```

### BodyPublishers и BodyHandlers

| BodyPublisher                         | Откуда берём body для запроса              |
|---------------------------------------|--------------------------------------------|
| `ofString(str, charset)`              | Строка                                     |
| `ofByteArray(bytes)`                  | Массив байт                                |
| `ofFile(Path)`                        | Файл (не грузит целиком в память)         |
| `ofInputStream(() -> is)`             | Стрим                                      |
| `noBody()`                            | Без тела (GET, DELETE)                     |

| BodyHandler                           | Что делать с response body                 |
|---------------------------------------|--------------------------------------------|
| `ofString()`                          | Всё в `String`                             |
| `ofByteArray()`                       | В `byte[]`                                 |
| `ofFile(Path)`                        | Записать в файл                            |
| `ofLines()`                           | `Stream<String>` строк (lazy)              |
| `ofInputStream()`                     | Сырой `InputStream`                        |
| `discarding()`                        | Отбросить                                  |
| `buffering(delegate, bufferSize)`     | Буферизирующий wrapper                     |

### Best practice: **переиспользуй `HttpClient`**

Один `HttpClient` держит connection pool + HTTP/2 multiplexing. Создание нового на каждый запрос — анти-паттерн, потеря 100× производительности.

```java
// В Spring — @Bean
@Bean
public HttpClient httpClient() {
    return HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(5))
        .build();
}
```

### Прокси и аутентификация

```java
HttpClient client = HttpClient.newBuilder()
    .proxy(ProxySelector.of(new InetSocketAddress("proxy.corp", 8080)))
    .authenticator(new Authenticator() {
        @Override
        protected PasswordAuthentication getPasswordAuthentication() {
            return new PasswordAuthentication("user", "pass".toCharArray());
        }
    })
    .build();
```

## TCP через Socket

### Клиент

```java
try (Socket socket = new Socket("api.example.com", 443);
     var out = new PrintWriter(socket.getOutputStream(), true);
     var in = new BufferedReader(new InputStreamReader(socket.getInputStream()))) {

    out.println("GET / HTTP/1.1");
    out.println("Host: api.example.com");
    out.println();

    String line;
    while ((line = in.readLine()) != null) {
        System.out.println(line);
    }
}
```

### Сервер (blocking, thread-per-connection)

```java
try (ServerSocket server = new ServerSocket(8080)) {
    while (true) {
        Socket client = server.accept();          // blocks
        Thread.startVirtualThread(() -> handle(client));  // Java 21+
    }
}
```

С Virtual Threads такой код масштабируется до 100k+ соединений.

### Полезные опции Socket

```java
socket.setTcpNoDelay(true);           // отключить Nagle (latency-sensitive)
socket.setKeepAlive(true);            // TCP keepalive
socket.setSoTimeout(5000);            // read timeout
socket.setReuseAddress(true);         // SO_REUSEADDR для server restart
```

## UDP через DatagramSocket

```java
// Sender
try (DatagramSocket sock = new DatagramSocket()) {
    byte[] data = "hello".getBytes();
    DatagramPacket pkt = new DatagramPacket(data, data.length,
        InetAddress.getByName("192.168.1.1"), 5000);
    sock.send(pkt);
}

// Receiver
try (DatagramSocket sock = new DatagramSocket(5000)) {
    byte[] buf = new byte[1024];
    DatagramPacket pkt = new DatagramPacket(buf, buf.length);
    sock.receive(pkt);                // blocks
    String msg = new String(pkt.getData(), 0, pkt.getLength());
}
```

UDP — no ordering, no delivery guarantee, no congestion control. Используй когда latency критичен (VoIP, games), а дубли/потери — OK.

## WebSocket client (Java 11+)

```java
HttpClient client = HttpClient.newHttpClient();
WebSocket ws = client.newWebSocketBuilder()
    .buildAsync(URI.create("wss://example.com/feed"), new WebSocket.Listener() {
        @Override
        public CompletionStage<?> onText(WebSocket webSocket, CharSequence data, boolean last) {
            System.out.println("Received: " + data);
            webSocket.request(1);
            return null;
        }
        @Override
        public void onError(WebSocket webSocket, Throwable error) {
            log.error("WS error", error);
        }
    })
    .join();

ws.sendText("{\"type\":\"subscribe\"}", true);
```

## SSL/TLS

```java
HttpClient httpsClient = HttpClient.newBuilder()
    .sslContext(SSLContext.getDefault())  // использует cacerts JDK по умолчанию
    .build();
```

### Кастомный truststore (mTLS / self-signed)

```java
KeyStore trust = KeyStore.getInstance("PKCS12");
try (var is = Files.newInputStream(Path.of("truststore.p12"))) {
    trust.load(is, "changeit".toCharArray());
}

TrustManagerFactory tmf = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm());
tmf.init(trust);

SSLContext ctx = SSLContext.getInstance("TLSv1.3");
ctx.init(null, tmf.getTrustManagers(), new SecureRandom());

HttpClient client = HttpClient.newBuilder().sslContext(ctx).build();
```

**Никогда** не делай `X509TrustManager` с пустым `checkServerTrusted` — это отключение TLS-проверки и major security hole.

## DNS

```java
InetAddress[] addresses = InetAddress.getAllByName("google.com");
for (var a : addresses) {
    System.out.println(a.getHostAddress());
}

// Обратный DNS
InetAddress ip = InetAddress.getByName("8.8.8.8");
System.out.println(ip.getCanonicalHostName());
```

JDK кэширует DNS по умолчанию **навсегда** для положительных ответов (`networkaddress.cache.ttl=-1`). В Kubernetes это проблема — pod IP меняется. Правь:
```java
System.setProperty("networkaddress.cache.ttl", "30");
System.setProperty("networkaddress.cache.negative.ttl", "10");
```
или через `$JAVA_HOME/lib/security/java.security`.

## Таймауты — must-know

Любой сетевой вызов **обязан** иметь таймаут. Без него — hang до бесконечности.

| Тип таймаута        | HttpClient                            | Socket                          |
|---------------------|---------------------------------------|---------------------------------|
| Connect             | `.connectTimeout(Duration)` в builder | `socket.connect(addr, ms)`      |
| Read                | `.timeout(Duration)` в request        | `socket.setSoTimeout(ms)`       |
| Write               | (handled via OS buffers)              | (same)                          |
| Idle connection     | (connection pool)                     | TCP keepalive                   |

## Сравнение HTTP клиентов

| Клиент              | Async        | HTTP/2  | WebSocket | Memory footprint | Production use |
|---------------------|--------------|---------|-----------|------------------|----------------|
| HttpURLConnection   | no           | no      | no        | low              | legacy only    |
| Apache HttpClient 5 | yes (async module) | yes | yes   | medium           | widespread     |
| OkHttp              | yes          | yes     | yes       | low              | Android + JVM  |
| JDK HttpClient      | yes          | yes     | yes       | low              | JDK 11+ stdlib |
| Netty (low-level)   | yes          | yes     | yes       | low              | framework core |
| Spring WebClient    | yes (Reactor) | yes    | yes       | medium           | Spring апп      |

## Netty — краткий обзор

Основа многих JVM-сетевых фреймворков (Akka, Vert.x, gRPC, Spring WebFlux). Архитектура: reactor + pipelining handlers.

```java
EventLoopGroup boss = new NioEventLoopGroup(1);
EventLoopGroup worker = new NioEventLoopGroup();
try {
    new ServerBootstrap()
        .group(boss, worker)
        .channel(NioServerSocketChannel.class)
        .childHandler(new ChannelInitializer<SocketChannel>() {
            @Override
            protected void initChannel(SocketChannel ch) {
                ch.pipeline()
                  .addLast(new HttpServerCodec())
                  .addLast(new MyHandler());
            }
        })
        .bind(8080).sync().channel().closeFuture().sync();
} finally {
    boss.shutdownGracefully();
    worker.shutdownGracefully();
}
```

Нужен, когда: низкоуровневый протокол, экстремальная производительность, backpressure через Reactive Streams.

## Подводные камни

### 1. Один `HttpClient` для каждого запроса

Каждый создаёт пул, TCP коннекты, thread pool. 10× на request. **Один `HttpClient` на приложение** (или на логически связанные нагрузки).

### 2. Забыли `close()` Response InputStream

`HttpResponse.BodyHandlers.ofInputStream()` возвращает стрим — ты **обязан** его закрыть, иначе connection pool исчерпывается.

### 3. DNS caching forever

Как показано выше. Особенно больно при AWS service discovery.

### 4. `InetAddress.getLocalHost().getHostName()` в контейнере

Возвращает hostname из `/etc/hostname`. В Docker это — случайный ID. В Kubernetes — имя pod'а. Не годится для IP — используй network interfaces.

### 5. Нет таймаута — hang процесса

Любой blocking sync-call без таймаута — бомба. Всегда указывай.

### 6. Blocking I/O в reactive pipeline

`HttpClient.send()` блокирует. В `Flux.map(x -> client.send(...))` → блокирует поток Reactor. Используй `sendAsync` + `Mono.fromFuture`.

### 7. Невалидные сертификаты в dev

Самый вредный анти-паттерн — `TrustManager { checkServerTrusted(c,a) {} }`. Это попадает в prod. **Используй отдельный truststore для dev или Spring Profile.**

## Интервью-вопросы

1. Чем `HttpClient` лучше `HttpURLConnection`?
2. Как сделать async HTTP запрос?
3. Что такое HTTP/2 multiplexing? Использует ли JDK HttpClient?
4. Разница TCP и UDP? Когда выбирать UDP?
5. Что такое Socket options: `SO_KEEPALIVE`, `TCP_NODELAY`?
6. Как работает DNS caching в JDK и как его настроить?
7. Зачем `Selector` и non-blocking I/O?
8. Какие виды таймаутов в HTTP клиенте нужно задать?
9. Как безопасно работать с самоподписанным сертификатом?
10. Почему нельзя делиться `HttpClient` между unrelated контекстами? (Один на апп — OK; на процесс с несколькими SLA — можно несколько.)
