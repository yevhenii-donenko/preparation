# 2. Collections Framework — детально

## 2.1 Иерархия

```
Iterable
└── Collection
    ├── List       — упорядочен, дубликаты, индекс
    │   ├── ArrayList
    │   ├── LinkedList         (ещё и Deque)
    │   ├── Vector / Stack     (легаси, synchronized)
    │   └── CopyOnWriteArrayList
    ├── Set        — без дубликатов
    │   ├── HashSet
    │   ├── LinkedHashSet
    │   ├── TreeSet            (NavigableSet, отсортирован)
    │   └── EnumSet
    └── Queue / Deque
        ├── ArrayDeque
        ├── PriorityQueue
        ├── LinkedList
        └── BlockingQueue ...

Map (отдельная иерархия)
├── HashMap
├── LinkedHashMap
├── TreeMap            (NavigableMap)
├── Hashtable          (легаси)
├── ConcurrentHashMap
├── WeakHashMap
├── IdentityHashMap
└── EnumMap
```

## 2.2 List

### `ArrayList`
- Под капотом — массив (`Object[]`). Default capacity 10, growth `oldCap + oldCap >> 1` (×1.5).
- `get/set` — O(1); `add` в конец — амортизированно O(1); `add(i)`, `remove(i)` — O(n) (сдвиг).
- Не потокобезопасен. Fail-fast итератор (через `modCount`).
- Хорош для **чтения по индексу** и **итерации**.

### `LinkedList`
- Двусвязный список. `add/remove` в концы — O(1), по индексу — O(n).
- Жирная по памяти (на каждый элемент ноду с двумя ссылками).
- На практике почти всегда `ArrayDeque` лучше для очереди/стека.

### `CopyOnWriteArrayList`
- Каждая модификация создаёт **копию** массива.
- Чтение очень дешёвое и без блокировок; запись — дорогая.
- Подходит для случаев "много чтения, редкая запись" (listeners, observers).

## 2.3 Set

### `HashSet` / `LinkedHashSet`
- Реализованы поверх `HashMap`/`LinkedHashMap` — значение фиктивное (`PRESENT`).
- `LinkedHashSet` сохраняет порядок вставки (двусвязный список поверх).

### `TreeSet`
- Поверх `TreeMap` (Red-Black tree). Сортировка по `Comparable` или `Comparator`.
- `add/contains/remove` — O(log n).
- Дополнительно: `first`, `last`, `floor`, `ceiling`, `higher`, `lower`, `subSet`, `headSet`, `tailSet`.

### `EnumSet`
- Сверхкомпактен — внутри **bit vector** (long или long[]). Очень быстр. Только для enum.

## 2.4 Map

### `HashMap` (must-know на интервью)

**Структура:**
- Массив "бакетов" (`Node<K,V>[] table`) длины степени 2 (по умолчанию 16).
- Каждый бакет — связный список или дерево.
- При коллизиях ноды складываются в список, а если в одном бакете накопилось ≥ **TREEIFY_THRESHOLD = 8** нод **И** размер таблицы ≥ 64 — список превращается в **Red-Black tree** (поиск по бакету O(log n) вместо O(n)). Обратное преобразование при ≤ **UNTREEIFY_THRESHOLD = 6**.

**Хеширование:**
```java
static int hash(Object key) {
    int h = key.hashCode();
    return h ^ (h >>> 16);   // mix верхних 16 бит в нижние
}
int index = (n - 1) & hash;  // n — степень 2 → быстрее, чем %
```
"Перемешивание" нужно, чтобы плохие `hashCode` (с одинаковыми младшими битами) не давали все коллизии в один бакет.

**Resize:**
- При `size > capacity * loadFactor` (default load factor 0.75) таблица удваивается.
- Каждая нода либо остаётся на старом индексе, либо едет на `index + oldCap` (зависит от старшего бита хеша) → не нужно пересчитывать хеш.

**Почему load factor 0.75:** компромисс между плотностью (память) и частотой коллизий (производительность). Поэксп. подобрано.

**Что плохого, если плохой `hashCode`:** все ключи в один бакет → деградация до O(n) (или O(log n) после treeification, но treeify требует, чтобы ключи были `Comparable`).

**`null`:** `HashMap` допускает один `null` ключ (бакет 0) и любое количество `null` значений. `Hashtable`/`ConcurrentHashMap` — нет.

**Не потокобезопасен.** В многопотоке параллельный resize мог приводить к **зацикливанию** (Java 7); в 8 это починили, но всё равно может потерять данные/получить непредсказуемое состояние.

### `LinkedHashMap`
- HashMap + двусвязный список по порядку вставки **или** по порядку доступа (`accessOrder=true`).
- Полезно для реализации **LRU-cache**: переопредели `removeEldestEntry`.

### `TreeMap`
- Red-Black tree. Все операции O(log n).
- Реализует `NavigableMap`: `firstKey`, `lastKey`, `floorEntry`, `ceilingEntry`, `subMap`, …
- Сортировка по `Comparable<K>` или `Comparator<? super K>`.

### `WeakHashMap`
- Ключи хранятся как `WeakReference`. Если нет других сильных ссылок на ключ — GC собирает, и запись уходит из мапы.
- Применение: кэши с привязкой к жизни ключа; внутренние реестры.

### `IdentityHashMap`
- Сравнение ключей через `==`, не `equals`. Хеш — `System.identityHashCode`.
- Применяется в сериализации, обходах графов, `JAXB`.

### `EnumMap`
- Под капотом массив, индекс — `ordinal()`. Сверхбыстрый.

### `ConcurrentHashMap` (Java 8+)
- Без сегментов (как было в Java 7). Каждый бакет защищён через **CAS** (для пустых) и **synchronized на голове бакета** (для непустых).
- Чтения — без блокировок, **слабо консистентны** (итератор не fail-fast).
- `null` ключи/значения **запрещены** (чтобы отличать "нет" от "есть со значением null" в concurrent среде).
- Полезные методы: `compute`, `computeIfAbsent`, `merge`, `forEach`, `reduce` — атомарны для одного ключа.
- `size()` приблизителен в момент вызова в нагруженной среде.

### Внимание: `computeIfAbsent` рекурсивно для того же ключа

В `HashMap` он "работает", но может испортить структуру. В `ConcurrentHashMap` — может **дедлокнуться**. Никогда не вызывайте `map.computeIfAbsent(k, ...)` внутри функции, которая снова обращается к `map` для **того же** ключа.

## 2.5 Очереди

- **`ArrayDeque`** — кольцевой буфер. Лучший выбор для стека/очереди в одном потоке (быстрее `LinkedList`, чем `Stack`).
- **`PriorityQueue`** — бинарная min-heap. `offer/poll` O(log n), `peek` O(1). Не упорядочена при итерации (только при `poll`).
- **`BlockingQueue`** (для concurrency):
  - `ArrayBlockingQueue` — bounded, FIFO, один lock на чтение/запись.
  - `LinkedBlockingQueue` — optionally bounded, два lock'а (выше throughput).
  - `SynchronousQueue` — без буфера; producer ждёт consumer'а. Используется в `newCachedThreadPool`.
  - `PriorityBlockingQueue` — приоритетная, unbounded.
  - `DelayQueue` — элементы доступны после задержки.
  - `LinkedTransferQueue` — `transfer` блокирует, пока кто-то не примет.

## 2.6 Iterator: fail-fast vs fail-safe

- **Fail-fast:** ловит модификацию коллекции во время итерации (через `modCount`) и кидает `ConcurrentModificationException`. Все стандартные коллекции (`ArrayList`, `HashMap` …).
- **Fail-safe:** работает на копии или слабо консистентной "снимочной" структуре, не бросает `CME`. `CopyOnWriteArrayList`, `ConcurrentHashMap`.

`CME` — не индикатор многопоточности; легко получить и в одном потоке: `for (var x : list) list.remove(x)`. Используй `Iterator.remove()` или `removeIf`.

## 2.7 Equals/HashCode в коллекциях

- `HashMap`/`HashSet` зависят от `hashCode` + `equals`.
- Если положил объект в `HashSet`, а потом изменил поле, участвующее в `hashCode` — ты "потерял" объект (он там есть, но `contains` вернёт `false`).
- В `TreeMap`/`TreeSet` используется `compareTo`/`Comparator`, а не `equals` → может расходиться (нерекомендуется).

## 2.8 Сложности (cheatsheet)

| Операция | ArrayList | LinkedList | HashMap | TreeMap | LinkedHashMap |
|---|---|---|---|---|---|
| get(i) / get(key) | O(1) | O(n) | O(1) avg | O(log n) | O(1) avg |
| add в конец | O(1)* | O(1) | O(1) avg | O(log n) | O(1) avg |
| add(i) / put | O(n) | O(n) | O(1) avg | O(log n) | O(1) avg |
| remove | O(n) | O(1) с iterator | O(1) avg | O(log n) | O(1) avg |
| contains | O(n) | O(n) | O(1) avg | O(log n) | O(1) avg |
| iteration | O(n) | O(n) | O(n + capacity) | O(n) | O(n) |

*амортизированно

## 2.9 Immutable и неизменяемые view

- `Collections.unmodifiableList(list)` — wrapper. Изменения исходного списка видны через wrapper!
- `List.of(...)`, `Set.of(...)`, `Map.of(...)` (Java 9+) — настоящие immutable, отказываются от `null`, бросают `UnsupportedOperationException` при модификации, более компактны.
- `List.copyOf(coll)` — иммутабельная копия.

## 2.10 Sequenced Collections (Java 21)

Новый интерфейс `SequencedCollection<E>` / `SequencedMap<K,V>` со стандартными методами `getFirst`, `getLast`, `addFirst`, `addLast`, `reversed()`. Реализован в `List`, `Deque`, `LinkedHashSet`, `LinkedHashMap`.

## 2.11 Частые вопросы

- Как устроен `HashMap`? (см. выше — must answer 5 минут детально).
- Что произойдёт при коллизии? (список → дерево).
- Что такое `loadFactor`? Почему 0.75?
- `HashMap` vs `Hashtable` vs `ConcurrentHashMap`?
- `ArrayList` vs `LinkedList` — что выбрать?
- Как работает `CopyOnWriteArrayList`?
- Что такое fail-fast и `ConcurrentModificationException`?
- Как реализовать LRU-cache? (`LinkedHashMap` с `accessOrder=true` + `removeEldestEntry`).
- Что вернёт `set.add(obj)`, если объект уже есть? (`false`).
- Можно ли изменять элемент `TreeSet` после вставки? (нет — нарушит инвариант дерева).


---

# Дополнительные темы Collections (продолжение)

## 2.12 ArrayList — детально внутри

```java
// Default
DEFAULT_CAPACITY = 10;
private Object[] elementData;
private int size;

// add(E)
ensureCapacityInternal(size + 1);   // resize если нужно
elementData[size++] = e;

// resize: newCapacity = oldCapacity + (oldCapacity >> 1);   // ×1.5
// Arrays.copyOf — копирование старого массива в новый
```

- `ArrayList(int initialCapacity)` — если знаешь размер заранее, передай — избежишь resize'ов.
- `trimToSize()` — урезать `elementData` до `size` (освободить хвост).
- `subList(from, to)` возвращает **view** в исходный список — изменения видны в обе стороны.
- `removeIf(predicate)` — оптимальный способ массового удаления (один проход).

## 2.13 HashMap — глубокий пример работы

```java
Map<String, Integer> m = new HashMap<>();
m.put("apple", 1);
m.put("orange", 2);
m.put("apple", 10);             // replace, возвращает старое 1

// Безопасный default
int count = m.getOrDefault("apple", 0);

// Вычислить если отсутствует (lazy compute)
m.computeIfAbsent("banana", k -> expensiveLoad(k));

// Атомарный merge — отлично для счётчиков
m.merge("apple", 1, Integer::sum);    // если есть — sum, иначе put 1

// Атомарный update
m.compute("apple", (k, v) -> v == null ? 1 : v + 1);

// Iteration
m.forEach((k, v) -> System.out.println(k + "=" + v));
```

### Важные тонкости

- В `HashMap` `put(null, ...)` работает (один null-ключ в bucket 0).
- `computeIfAbsent` возвращает значение (новое или существующее).
- `compute*` методы атомарны только в `ConcurrentHashMap`. В обычном `HashMap` они просто шорткаты.

### Treeification (Java 8+)

При длине bucket'а ≥ `TREEIFY_THRESHOLD = 8` И `table.length >= MIN_TREEIFY_CAPACITY = 64` — список превращается в Red-Black tree (O(log n) вместо O(n) на bucket). Treeification требует, чтобы ключи были `Comparable`, иначе используется `System.identityHashCode` для упорядочения внутри дерева — деградация остаётся, но не катастрофическая.

### Resize механика

```
oldCap = 16, новый = 32
для каждой ноды:
  если (hash & oldCap) == 0 → остаётся на старом индексе
  иначе                     → едет на index + oldCap
```
Этот трюк работает потому, что `cap` — степень 2; не нужно пересчитывать `hash` для всех элементов.

## 2.14 LinkedHashMap — реализация LRU

```java
public class LRUCache<K,V> extends LinkedHashMap<K,V> {
    private final int max;
    public LRUCache(int max) {
        super(16, 0.75f, true);     // accessOrder = true
        this.max = max;
    }
    @Override
    protected boolean removeEldestEntry(Map.Entry<K,V> eldest) {
        return size() > max;
    }
}
```

`accessOrder=true` — порядок: от reading-Old к recently-accessed. `get/put` перемещают элемент в конец списка.

## 2.15 TreeMap — навигационный API

```java
TreeMap<Integer, String> m = new TreeMap<>();
m.put(10, "a"); m.put(20, "b"); m.put(30, "c");

m.firstKey();           // 10
m.lastKey();            // 30
m.floorKey(25);         // 20  ≤
m.ceilingKey(25);       // 30  ≥
m.higherKey(20);        // 30  >
m.lowerKey(20);         // 10  <
m.headMap(20);          // {10:a}
m.tailMap(20);          // {20:b, 30:c}
m.subMap(10, 25);       // [10, 25)
m.descendingMap();      // обратный порядок
```

Применение: задачи "ближайшее значение", диапазонные запросы, K-th элемент.

## 2.16 ConcurrentHashMap — атомарные операции

```java
ConcurrentHashMap<String, Long> counts = new ConcurrentHashMap<>();

counts.merge(key, 1L, Long::sum);                    // атомарный инкремент
counts.compute(key, (k, v) -> v == null ? 1L : v + 1L);

// computeIfAbsent — кэш с lazy load
Cache<String, Profile> profiles = new ConcurrentHashMap<>();
Profile p = profiles.computeIfAbsent(userId, this::loadFromDb);

// forEach с параллелизмом
map.forEach(parallelismThreshold, (k, v) -> ...);

// reduce
long total = map.reduceValues(parallelismThreshold, 0L, Long::sum);
```

⚠️ **Не вызывай** `computeIfAbsent`/`compute`/`merge` рекурсивно для того же ключа — может повиснуть (внутри bucket lock).

⚠️ `null` ключи и значения **запрещены** в `ConcurrentHashMap` (чтобы отличать "нет" от "есть с null").

## 2.17 BlockingQueue — producer/consumer пример

```java
BlockingQueue<Task> queue = new ArrayBlockingQueue<>(100);

// Producer
new Thread(() -> {
    while (true) {
        Task t = generate();
        queue.put(t);                    // блокирует, если очередь полная
    }
}).start();

// Consumer
new Thread(() -> {
    while (true) {
        Task t = queue.take();           // блокирует, если очередь пустая
        process(t);
    }
}).start();
```

Семантика методов:

| | Бросает исключение | Возвращает спец-значение | Блокирует | С таймаутом |
|---|---|---|---|---|
| Insert | `add(e)` | `offer(e)` | `put(e)` | `offer(e, t, u)` |
| Remove | `remove()` | `poll()` | `take()` | `poll(t, u)` |
| Examine | `element()` | `peek()` | n/a | n/a |

## 2.18 Безопасное удаление при итерации

```java
// ❌ ConcurrentModificationException
for (var x : list) if (cond(x)) list.remove(x);

// ✅ Iterator.remove
var it = list.iterator();
while (it.hasNext()) if (cond(it.next())) it.remove();

// ✅ Лучше — removeIf
list.removeIf(this::cond);
```

`removeIf` обычно быстрее (один проход, без сдвигов на каждое удаление в `ArrayList` — внутри использует "two-pointer compaction").

## 2.19 Immutable view vs immutable copy

```java
List<String> raw = new ArrayList<>(List.of("a", "b"));

// View — отражает изменения raw!
List<String> view = Collections.unmodifiableList(raw);
raw.add("c");
view.size();            // 3 — изменилось

// Copy — настоящая иммутабельная
List<String> copy = List.copyOf(raw);
raw.add("d");
copy.size();            // 3 — не меняется
```

`List.of(...)` / `Map.of(...)` — настоящая иммутабельность; не разрешает `null`; компактнее, чем `Collections.unmodifiableList`.

## 2.20 Sequenced Collections (Java 21)

Новые интерфейсы:
- `SequencedCollection<E>` — реализуют `List`, `Deque`, `LinkedHashSet`.
- `SequencedSet<E>`.
- `SequencedMap<K,V>` — реализует `LinkedHashMap`, `SortedMap` (TreeMap).

API:
```java
list.getFirst(); list.getLast();
list.addFirst(x); list.addLast(x);
list.reversed();        // view, не копия
map.firstEntry(); map.lastEntry();
```

## 2.21 Hashing — что делает плохой hashCode

Если `hashCode` всегда возвращает 0 — все ключи в одном бакете. До treeification это будет O(n) поиск. Treeification требует `Comparable` — иначе всё равно O(log n) с большой константой.

Хороший `hashCode`:
- Использует все значимые поля.
- Распределяет равномерно (`Objects.hash(...)` или паттерн `result = 31 * result + field;`).
- **Стабильный** в пределах одного запуска (не зависит от состояния, не использует random).

```java
@Override public int hashCode() {
    int result = 17;
    result = 31 * result + (name == null ? 0 : name.hashCode());
    result = 31 * result + age;
    return result;
}
```

`31` — простое число, `31 * x` оптимизируется в `(x << 5) - x`.

## 2.22 Производительность: cheatsheet выбора

| Сценарий | Структура |
|---|---|
| Список с быстрым доступом по индексу | `ArrayList` |
| Очередь / стек в одном потоке | `ArrayDeque` |
| Часто добавляешь/удаляешь в середине | `ArrayList` всё равно (LinkedList редко лучше из-за кэш-промахов) |
| Уникальные элементы, неважен порядок | `HashSet` |
| Уникальные элементы, порядок вставки | `LinkedHashSet` |
| Уникальные элементы, отсортированные | `TreeSet` |
| Map "ключ → значение" | `HashMap` |
| Map с порядком вставки/доступа | `LinkedHashMap` |
| Map отсортированная / навигационная | `TreeMap` |
| Concurrent map | `ConcurrentHashMap` |
| Read-mostly список с редкой записью | `CopyOnWriteArrayList` |
| Кэш с автоочисткой по памяти | `WeakHashMap` (или `Caffeine` для real-world) |
| Map по enum | `EnumMap` |
| Producer/consumer | `LinkedBlockingQueue` / `ArrayBlockingQueue` |
| Очередь с приоритетами | `PriorityQueue` |
| Очередь с задержкой | `DelayQueue` |

## 2.23 Дополнительные частые вопросы

- Чем `ArrayList(0)` отличается от `new ArrayList<>()`?
- Что произойдёт, если изменить ключ объекта после положения в `HashMap`/`HashSet`?
- Как работает `subList` — это копия или view?
- Что вернёт `set.add(obj)` если объект уже есть?
- Чем `EnumMap` лучше обычного `HashMap`?
- Чем `Vector` отличается от `ArrayList`?
- Для чего нужен `IdentityHashMap`?
- Что вернёт `null` ключ в `HashMap` vs `TreeMap` vs `ConcurrentHashMap`?
- Какие операции в `ConcurrentHashMap` атомарны?
- Чем `ArrayBlockingQueue` отличается от `LinkedBlockingQueue`?
- Что такое "weakly consistent" итератор?
- Чем `merge` отличается от `compute`?
- Когда выбрать `TreeMap` вместо `HashMap`?
- Как реализовать LRU кэш на стандартных коллекциях?
- Что плохого в `Collections.synchronizedMap` по сравнению с `ConcurrentHashMap`?

