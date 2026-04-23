# I/O и NIO — углублённо

Java прошла три поколения I/O:
1. **java.io** (Java 1.0) — потоки байт/символов, blocking.
2. **java.nio** (Java 1.4) — Channels + Buffers, non-blocking.
3. **java.nio.file** / NIO.2 (Java 7) — новый Files API, Path, атрибуты, WatchService.

## java.io — базовые потоки

### Иерархия

```
InputStream  ─ FileInputStream, ByteArrayInputStream, ObjectInputStream
             └ BufferedInputStream (декоратор)
OutputStream ─ FileOutputStream, ByteArrayOutputStream, ObjectOutputStream
             └ BufferedOutputStream

Reader       ─ FileReader, CharArrayReader, StringReader
             └ BufferedReader, InputStreamReader(adapter)
Writer       ─ FileWriter, PrintWriter
             └ BufferedWriter, OutputStreamWriter
```

**Правило**: байты → `InputStream/OutputStream`; символы → `Reader/Writer`.
**Адаптеры**: `InputStreamReader` (bytes → chars с charset), `OutputStreamWriter`.

### Канонические паттерны

```java
// Чтение текста построчно, try-with-resources
try (var reader = Files.newBufferedReader(Path.of("in.txt"), StandardCharsets.UTF_8)) {
    String line;
    while ((line = reader.readLine()) != null) {
        process(line);
    }
}

// Запись, перезаписывая файл
Files.writeString(Path.of("out.txt"), content, StandardCharsets.UTF_8,
                  StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);

// Копирование байт с буферизацией
try (var in = new BufferedInputStream(new FileInputStream("a.bin"));
     var out = new BufferedOutputStream(new FileOutputStream("b.bin"))) {
    in.transferTo(out);   // Java 9+, внутренний 8 KB буфер
}
```

### Пора перестать использовать

- `new FileReader("f")` без charset — платформо-зависимый default. **Всегда** указывай `StandardCharsets.UTF_8`.
- `new BufferedReader(new InputStreamReader(new FileInputStream(...)))` — длинно. Используй `Files.newBufferedReader(Path)`.
- `ObjectOutputStream` — Java-сериализация **deprecated для external data** (security, версионирование). Используй Jackson/Protobuf/Avro.

## NIO.2 — Files API (рекомендуемый)

```java
Path p = Path.of("/var/log/app.log");

// Чтение целиком (подходит для < 10 MB)
String content = Files.readString(p, StandardCharsets.UTF_8);
List<String> lines = Files.readAllLines(p, StandardCharsets.UTF_8);
byte[] bytes = Files.readAllBytes(p);

// Стрим строк (lazy, память-эффективно)
try (Stream<String> stream = Files.lines(p, StandardCharsets.UTF_8)) {
    long errors = stream.filter(l -> l.contains("ERROR")).count();
}

// Прогулка по дереву
try (Stream<Path> walk = Files.walk(Path.of("src"))) {
    walk.filter(Files::isRegularFile)
        .filter(f -> f.toString().endsWith(".java"))
        .forEach(System.out::println);
}

// Атрибуты
BasicFileAttributes attrs = Files.readAttributes(p, BasicFileAttributes.class);
System.out.println(attrs.size() + " bytes, created " + attrs.creationTime());

// Копирование/перемещение
Files.copy(src, dst, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.COPY_ATTRIBUTES);
Files.move(src, dst, StandardCopyOption.ATOMIC_MOVE);
```

## Channels + Buffers (классический NIO)

Ключевая абстракция: **Channel** (двунаправленная труба к ресурсу) + **Buffer** (фиксированная область памяти для чтения/записи).

```java
try (FileChannel ch = FileChannel.open(Path.of("big.bin"), StandardOpenOption.READ)) {
    ByteBuffer buf = ByteBuffer.allocateDirect(64 * 1024);  // off-heap
    while (ch.read(buf) > 0) {
        buf.flip();           // switch to read-mode
        process(buf);
        buf.clear();          // ready to write again
    }
}
```

### Буфер: методы

| Метод       | Что делает                                                       |
|-------------|------------------------------------------------------------------|
| `flip()`    | Переключает буфер из write в read: `limit = position; position = 0`. |
| `clear()`   | `position = 0; limit = capacity`. Для нового write-цикла.        |
| `compact()` | Переносит непрочитанные данные в начало + готов к записи.        |
| `rewind()`  | `position = 0`. Перечитать буфер.                                |
| `mark()/reset()` | Запомнить/вернуться на позицию.                              |

**Direct vs Heap buffer:**
- `allocateDirect(n)` — вне Java heap, без лишней копии при передаче в OS. Хорошо для больших, долгих буферов. Дорогое создание.
- `allocate(n)` — на heap, быстрое создание, но JDK копирует в direct буфер перед syscall.

### Memory-mapped файл

```java
try (FileChannel ch = FileChannel.open(Path.of("huge.dat"), READ, WRITE)) {
    long size = ch.size();
    MappedByteBuffer mmap = ch.map(MapMode.READ_WRITE, 0, size);
    // Читаем/пишем как в обычную память:
    byte b = mmap.get(1024);
    mmap.put(2048, (byte) 42);
    mmap.force();  // flush в ОС
}
```

OS держит страницы файла в page cache → чтение/запись через обычные memory accesses. Идеально для больших read-only файлов (Kafka log segments, mmap-базы).

## Non-blocking I/O с Selector

Основа для сетевых серверов (до Netty/Loom):

```java
Selector selector = Selector.open();
ServerSocketChannel server = ServerSocketChannel.open();
server.bind(new InetSocketAddress(8080));
server.configureBlocking(false);
server.register(selector, SelectionKey.OP_ACCEPT);

while (true) {
    selector.select();   // блокируется до события
    for (var it = selector.selectedKeys().iterator(); it.hasNext();) {
        SelectionKey key = it.next();
        it.remove();
        if (key.isAcceptable()) {
            SocketChannel client = server.accept();
            client.configureBlocking(false);
            client.register(selector, SelectionKey.OP_READ);
        } else if (key.isReadable()) {
            handleRead((SocketChannel) key.channel());
        }
    }
}
```

Один поток обслуживает тысячи соединений — основа reactor-pattern (Netty, Vert.x).

## AsynchronousFileChannel / AsynchronousSocketChannel

True async I/O с CompletionHandler или CompletableFuture:

```java
try (AsynchronousFileChannel ch = AsynchronousFileChannel.open(Path.of("big.dat"), READ)) {
    ByteBuffer buf = ByteBuffer.allocate(1024);
    Future<Integer> f = ch.read(buf, 0);
    int read = f.get();   // или f.isDone(), или CompletionHandler
}
```

С приходом **Virtual Threads (Java 21)** async I/O в большинстве случаев не нужен — blocking-код в VT даёт тот же масштаб.

## WatchService — наблюдение за файлами

```java
WatchService ws = FileSystems.getDefault().newWatchService();
Path dir = Path.of("/etc/app/config");
dir.register(ws, StandardWatchEventKinds.ENTRY_MODIFY,
                 StandardWatchEventKinds.ENTRY_CREATE);

while (true) {
    WatchKey key = ws.take();
    for (WatchEvent<?> ev : key.pollEvents()) {
        System.out.println(ev.kind() + " -> " + ev.context());
    }
    if (!key.reset()) break;
}
```

На macOS это polling (10s латентность), на Linux — inotify, на Windows — ReadDirectoryChangesW.

## Сериализация

### Java Native Serialization — избегай

```java
// Security-кошмар: gadget chains, CVE-2015-4852 (Commons Collections)
try (var out = new ObjectOutputStream(new FileOutputStream("obj.bin"))) {
    out.writeObject(user);
}
```

**Проблемы**: уязвимости десериализации, нет versioning, нет языковой переносимости, `serialVersionUID` — адский ритуал. **JEP 154 (Java 17+) вводит deprecated warnings**; в будущем будет по умолчанию отключена.

### Альтернативы

| Формат         | Плюсы                                          | Когда                                          |
|----------------|------------------------------------------------|------------------------------------------------|
| JSON (Jackson) | Читаемо, schema-less, широко распространён     | REST API, конфиги, логи                         |
| Protobuf       | Компактно, быстро, schema, backward compat    | gRPC, интер-сервисное общение                  |
| Avro           | Schema, эволюция, JSON-совместимо             | Kafka messages, Hadoop                          |
| MessagePack    | Компактно, как binary JSON                     | Мобильные API, кэши                            |

## Подводные камни

### 1. Забытый try-with-resources

Утечка file descriptor'ов. OS рано или поздно падает: `Too many open files`.

### 2. Не указан charset

```java
new FileReader("in.txt")   // platform default — не UTF-8 на Windows!
```
Используй: `Files.newBufferedReader(p, StandardCharsets.UTF_8)`.

### 3. readAllBytes/readString на большом файле

`Files.readAllBytes(huge)` грузит весь файл в память. Для больших — используй stream API: `Files.lines(p)`.

### 4. Блокирующий I/O + пул CompletableFuture

`CompletableFuture.supplyAsync(() -> Files.readString(p))` блокирует поток ForkJoin common pool. Для async I/O либо отдельный пул, либо Virtual Threads, либо `AsynchronousFileChannel`.

### 5. Direct buffer leak

`ByteBuffer.allocateDirect(n)` живёт, пока GC не соберёт его reference. Если держать на long-lived structures — off-heap утечка. JVM флаг: `-XX:MaxDirectMemorySize=256m`.

### 6. Неправильный mode у Channel

`READ` vs `WRITE` vs `CREATE_NEW`. Читай [StandardOpenOption](https://docs.oracle.com/javase/8/docs/api/java/nio/file/StandardOpenOption.html) — их 11 штук.

### 7. Files.walk без close

`Files.walk(root)` возвращает `Stream<Path>`, держащий file handles. **Обязателен try-with-resources**.

## Производительность: bytes per second

| Подход                        | Typical throughput |
|-------------------------------|--------------------|
| `FileInputStream` byte-by-byte | 10–30 MB/s         |
| `BufferedInputStream` (8 KB)   | 200–500 MB/s       |
| `FileChannel` + direct buffer  | 1–2 GB/s           |
| `mmap`                         | ~memory speed (3–10 GB/s) |

Правило: для текста — `BufferedReader`, для больших бинарных — `FileChannel`/mmap.

## Интервью-вопросы

1. Разница `InputStream` и `Reader`?
2. Что делает `BufferedReader` и зачем он нужен?
3. `Files.lines()` — какие плюсы перед `readAllLines`?
4. Что такое direct ByteBuffer?
5. Когда выбирать mmap?
6. Почему Java Serialization нежелательна?
7. Разница NIO и NIO.2?
8. Чем `AsynchronousFileChannel` отличается от `FileChannel`?
9. Как работает Selector?
10. `flip()` vs `clear()` vs `compact()`?
