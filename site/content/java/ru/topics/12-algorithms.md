# 12. Алгоритмы и Data Structures

## 12.1 Big-O — обязательная база

### Сложность
- **O(1)** — константа.
- **O(log n)** — бинарный поиск, балансированные деревья.
- **O(n)** — линейный обход.
- **O(n log n)** — эффективные сортировки (merge, heap, intro).
- **O(n²)** — вложенные циклы.
- **O(2ⁿ)**, **O(n!)** — экспоненциальные / факториальные (brute force).

### Амортизированная сложность
Усреднённая по серии операций. Например, `ArrayList.add` амортизированно O(1): резкий resize редок.

### Пространственная сложность
Учитывай рекурсивный стек! O(n) дополнительной памяти при рекурсии глубины n.

## 12.2 Структуры данных — кратко

| Структура | Доступ | Поиск | Вставка | Удаление | Применение |
|---|---|---|---|---|---|
| Массив | O(1) | O(n) | O(n) | O(n) | базовая |
| Динамический массив (ArrayList) | O(1) | O(n) | O(1)* | O(n) | список |
| Связный список | O(n) | O(n) | O(1) | O(1) | очередь, история |
| HashMap | — | O(1) | O(1) | O(1) | словарь |
| TreeMap (BBST) | — | O(log n) | O(log n) | O(log n) | сортированный словарь |
| Heap | O(1) для top | O(n) | O(log n) | O(log n) | top-K, Dijkstra |
| Stack | O(1) push/pop | O(n) | O(1) | O(1) | DFS, выражения |
| Queue | O(1) | O(n) | O(1) | O(1) | BFS |
| Trie | — | O(L) | O(L) | O(L) | автодополнение |
| Union-Find | — | ~O(α(n)) | ~O(α(n)) | — | связность |
| Граф (adj list) | — | O(V+E) | O(1) | O(V) | BFS/DFS |

*амортизированно

## 12.3 Алгоритмические шаблоны

### Two pointers
Для отсортированных массивов: два указателя движутся навстречу или вместе.
- Two Sum (sorted), 3Sum, container with most water, remove duplicates.

### Sliding window
Окно фиксированного/переменного размера.
- Longest substring without repeating chars, max sum subarray of size k, min window substring.

### Hash-based
Хэш-карта для O(1) lookup.
- Two Sum, anagrams, longest consecutive sequence, group anagrams.

### Binary search
Не только в массиве, но и "по ответу".
- Search in rotated array, find peak element, koko eating bananas, capacity to ship packages.
- Шаблон: `lo + (hi - lo) / 2` (избежать переполнения).
- Инвариант: чётко решить, что хранится в `lo`/`hi` (включительно/нет).

### DFS / BFS
- **DFS** — стек/рекурсия. Применение: путь, цикл, топ-сорт, компоненты связности.
- **BFS** — очередь. Кратчайший путь в невзвешенном графе, послойный обход.

### Backtracking
- Permutations, combinations, subsets, N-queens, sudoku, word search.
- Шаблон: выбор → рекурсия → откат.

### Dynamic Programming
- Идея: разбить на подзадачи + мемоизация.
- Top-down (рекурсия + memo) vs bottom-up (таблица).
- Классика: Fibonacci, climbing stairs, coin change, knapsack 0/1, longest common subsequence, longest increasing subsequence, edit distance, partition, house robber, regex matching.

### Greedy
- Локально оптимальный выбор → глобально оптимум (если задача доказуемо greedy).
- Activity selection, jump game, Huffman, interval scheduling, gas station.

### Heap
- Top-K largest/smallest, median of stream (two heaps), merge K sorted lists, Dijkstra.

### Union-Find (DSU)
- Связность, MST (Kruskal), redundant connection.

### Topological sort
- DFS post-order или Kahn's (BFS с in-degree).
- Применение: course schedule, build order.

### Графовые
- BFS/DFS, Dijkstra (положительные веса), Bellman-Ford (отрицательные), Floyd-Warshall (все пары), MST (Kruskal/Prim).

## 12.4 Сортировки

| Алгоритм | Время | Память | Стабильна? | Когда |
|---|---|---|---|---|
| Bubble | O(n²) | O(1) | да | учебная |
| Insertion | O(n²), best O(n) | O(1) | да | малые/почти отсортированные данные |
| Selection | O(n²) | O(1) | нет | редко |
| Merge | O(n log n) | O(n) | да | стабильность нужна, внешняя сортировка |
| Quick | avg O(n log n), worst O(n²) | O(log n) стек | нет | быстро in-place |
| Heap | O(n log n) | O(1) | нет | гарантия O(n log n) |
| Counting / Radix | O(n + k) | O(n + k) | да | малый диапазон ключей |

Java `Arrays.sort`:
- Примитивы — Dual-Pivot Quicksort (быстрый, нестабильный).
- Объекты — Timsort (адаптивный merge sort, стабильный).

## 12.5 Шаблоны решения задачи на интервью

1. **Уточни** условие. Размеры. Граничные случаи. Возможные nulls / negative / duplicates.
2. **Примеры** руками.
3. **Brute force** сначала — оценить сложность.
4. **Оптимизация** — какая структура данных подходит? Видишь паттерн (sorted → two pointers; lookup → hash; min/max top-k → heap)?
5. **Расскажи план**, потом кодь.
6. **Тест** на примерах + пограничные.
7. **Сложность** time/space.

## 12.6 Java-специфика

- `int` переполнение в `mid = (lo + hi) / 2` — используй `lo + (hi - lo) / 2`.
- `Long.parseLong` для больших чисел.
- `ArrayDeque` — лучший Stack/Queue.
- `PriorityQueue` — min-heap; для max — `Comparator.reverseOrder()`.
- `TreeMap.floorKey`/`ceilingKey` для быстрого поиска ближайшего.
- `Map.Entry` для пар; в современных решениях — `record Pair(...)`.
- Не бойся `HashMap<Long, ...>` для больших ключей — хорошо работает.

## 12.7 Топ-задач для повторения

**Easy:**
- Two Sum, Valid Parentheses, Reverse Linked List, Merge Two Sorted Lists, Best Time to Buy and Sell Stock, Valid Anagram, Invert Binary Tree, Maximum Depth of Binary Tree, Climbing Stairs.

**Medium:**
- Longest Substring Without Repeating Characters, 3Sum, Group Anagrams, Top K Frequent Elements, Product of Array Except Self, Longest Consecutive Sequence, Container With Most Water, Sort Colors, LRU Cache, Number of Islands, Course Schedule, Word Break, Coin Change, House Robber, Longest Palindromic Substring, Validate BST, Lowest Common Ancestor, Kth Largest Element, Find Median from Data Stream, Implement Trie.

**Hard (избранно):**
- Trapping Rain Water, Sliding Window Maximum, Word Ladder, Median of Two Sorted Arrays, Edit Distance, Regular Expression Matching, Serialize/Deserialize Binary Tree.

## 12.8 Ресурсы

- **NeetCode 150** (https://neetcode.io) — структурированный список.
- **Blind 75** — классический минимум.
- **LeetCode** — тегирование по компании / шаблону.

## 12.9 Часто спрашивают (на coding-секции)

- Реализуй LRU cache (двусвязный список + HashMap, или `LinkedHashMap` с `accessOrder`).
- Inorder обход BST (рекурсивный + итеративный со стеком).
- Найти цикл в связном списке (Floyd's tortoise and hare).
- Кратчайший путь в графе (BFS).
- Топ-K частых (heap или quickselect).
- Реализуй BlockingQueue / семафор.


---

# Дополнительные темы Алгоритмы (продолжение)

## 12.10 Big-O — практические оценки

**Сравнение размеров входа vs время:**

| n | O(n) | O(n log n) | O(n²) | O(2ⁿ) |
|---|---|---|---|---|
| 10 | 10 | 33 | 100 | 1024 |
| 100 | 100 | 664 | 10⁴ | 10³⁰ |
| 10³ | 10³ | 10⁴ | 10⁶ | ∞ |
| 10⁶ | 10⁶ | 2·10⁷ | 10¹² | ∞ |
| 10⁹ | 10⁹ | 3·10¹⁰ | 10¹⁸ | ∞ |

**Грубое правило:** ~10⁸ простых операций ≈ 1 секунда.
- n ≤ 10 → можно brute force (n!).
- n ≤ 20 → 2ⁿ (bitmask DP).
- n ≤ 100 → O(n³).
- n ≤ 10⁴ → O(n²).
- n ≤ 10⁶ → O(n log n).
- n ≤ 10⁸ → O(n).
- больше → O(log n) или O(1).

## 12.11 Шаблоны решений с кодом

### Two pointers

```java
// Задача: пара чисел в отсортированном массиве с суммой target
int[] twoSum(int[] arr, int target) {
    int l = 0, r = arr.length - 1;
    while (l < r) {
        int sum = arr[l] + arr[r];
        if      (sum == target) return new int[]{l, r};
        else if (sum < target)  l++;
        else                    r--;
    }
    return new int[]{-1, -1};
}
```

### Sliding window (фиксированный)

```java
// Максимальная сумма подмассива длины k
int maxSumK(int[] a, int k) {
    int sum = 0;
    for (int i = 0; i < k; i++) sum += a[i];
    int max = sum;
    for (int i = k; i < a.length; i++) {
        sum += a[i] - a[i - k];
        max = Math.max(max, sum);
    }
    return max;
}
```

### Sliding window (переменный)

```java
// Самая длинная подстрока без повторяющихся символов
int longestUnique(String s) {
    Map<Character, Integer> last = new HashMap<>();
    int best = 0, l = 0;
    for (int r = 0; r < s.length(); r++) {
        char c = s.charAt(r);
        if (last.containsKey(c) && last.get(c) >= l) {
            l = last.get(c) + 1;
        }
        last.put(c, r);
        best = Math.max(best, r - l + 1);
    }
    return best;
}
```

### Hash для O(1) lookup

```java
// Two Sum (несортированный)
int[] twoSum(int[] a, int target) {
    Map<Integer, Integer> seen = new HashMap<>();
    for (int i = 0; i < a.length; i++) {
        int need = target - a[i];
        if (seen.containsKey(need)) return new int[]{seen.get(need), i};
        seen.put(a[i], i);
    }
    return new int[]{-1, -1};
}
```

### Binary search — шаблон

```java
int lowerBound(int[] a, int x) {       // первый индекс, где a[i] >= x
    int lo = 0, hi = a.length;
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;
        if (a[mid] < x) lo = mid + 1;
        else            hi = mid;
    }
    return lo;
}
```

**Binary search "по ответу"** — когда монотонная функция:

```java
// Min capacity for ship packages within D days
int shipWithinDays(int[] weights, int days) {
    int lo = Arrays.stream(weights).max().getAsInt();
    int hi = Arrays.stream(weights).sum();
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;
        if (canShip(weights, days, mid)) hi = mid;
        else                              lo = mid + 1;
    }
    return lo;
}
boolean canShip(int[] w, int days, int cap) { ... }
```

### DFS — рекурсия

```java
void dfs(Node n, Set<Node> visited) {
    if (visited.contains(n)) return;
    visited.add(n);
    for (Node next : n.neighbors) dfs(next, visited);
}
```

### BFS — кратчайший путь в невзвешенном графе

```java
int shortestPath(Node start, Node end) {
    Queue<Node> q = new ArrayDeque<>();
    Map<Node, Integer> dist = new HashMap<>();
    q.add(start); dist.put(start, 0);
    while (!q.isEmpty()) {
        Node cur = q.poll();
        if (cur.equals(end)) return dist.get(cur);
        for (Node n : cur.neighbors) {
            if (!dist.containsKey(n)) {
                dist.put(n, dist.get(cur) + 1);
                q.add(n);
            }
        }
    }
    return -1;
}
```

### Backtracking

```java
// Все перестановки
List<List<Integer>> permute(int[] nums) {
    List<List<Integer>> res = new ArrayList<>();
    backtrack(nums, new ArrayList<>(), new boolean[nums.length], res);
    return res;
}
void backtrack(int[] nums, List<Integer> cur, boolean[] used, List<List<Integer>> res) {
    if (cur.size() == nums.length) { res.add(new ArrayList<>(cur)); return; }
    for (int i = 0; i < nums.length; i++) {
        if (used[i]) continue;
        used[i] = true; cur.add(nums[i]);
        backtrack(nums, cur, used, res);
        used[i] = false; cur.remove(cur.size() - 1);
    }
}
```

### DP — bottom-up

```java
// Climbing stairs (Fibonacci)
int climb(int n) {
    if (n <= 2) return n;
    int a = 1, b = 2;
    for (int i = 3; i <= n; i++) {
        int c = a + b;
        a = b; b = c;
    }
    return b;
}

// Coin change (минимум монет на сумму)
int coinChange(int[] coins, int amount) {
    int[] dp = new int[amount + 1];
    Arrays.fill(dp, amount + 1);
    dp[0] = 0;
    for (int i = 1; i <= amount; i++) {
        for (int c : coins) {
            if (c <= i) dp[i] = Math.min(dp[i], dp[i - c] + 1);
        }
    }
    return dp[amount] > amount ? -1 : dp[amount];
}
```

### DP с мемоизацией

```java
Map<String, Integer> memo = new HashMap<>();
int solve(String s, int i) {
    if (i == s.length()) return 0;
    String key = i + ":" + s.charAt(i);
    if (memo.containsKey(key)) return memo.get(key);
    int result = ...;
    memo.put(key, result);
    return result;
}
```

### Heap — top-K

```java
// K самых частых элементов
int[] topKFrequent(int[] nums, int k) {
    Map<Integer, Integer> count = new HashMap<>();
    for (int n : nums) count.merge(n, 1, Integer::sum);

    PriorityQueue<int[]> heap = new PriorityQueue<>((a, b) -> a[1] - b[1]);  // min-heap по count
    for (var e : count.entrySet()) {
        heap.offer(new int[]{e.getKey(), e.getValue()});
        if (heap.size() > k) heap.poll();
    }
    int[] res = new int[k];
    for (int i = k - 1; i >= 0; i--) res[i] = heap.poll()[0];
    return res;
}
```

### Union-Find (Disjoint Set Union)

```java
class DSU {
    int[] parent, rank;
    DSU(int n) {
        parent = new int[n];
        rank   = new int[n];
        for (int i = 0; i < n; i++) parent[i] = i;
    }
    int find(int x) {
        if (parent[x] != x) parent[x] = find(parent[x]);    // path compression
        return parent[x];
    }
    boolean union(int x, int y) {
        int px = find(x), py = find(y);
        if (px == py) return false;
        if      (rank[px] < rank[py]) parent[px] = py;       // union by rank
        else if (rank[px] > rank[py]) parent[py] = px;
        else { parent[py] = px; rank[px]++; }
        return true;
    }
}
```

Применение: связность компонентов, MST (Kruskal), redundant connection, accounts merge.

### Topological sort (Kahn's)

```java
List<Integer> topoSort(int n, int[][] edges) {
    List<List<Integer>> g = new ArrayList<>();
    int[] indeg = new int[n];
    for (int i = 0; i < n; i++) g.add(new ArrayList<>());
    for (int[] e : edges) {
        g.get(e[0]).add(e[1]);
        indeg[e[1]]++;
    }
    Queue<Integer> q = new ArrayDeque<>();
    for (int i = 0; i < n; i++) if (indeg[i] == 0) q.add(i);

    List<Integer> order = new ArrayList<>();
    while (!q.isEmpty()) {
        int u = q.poll(); order.add(u);
        for (int v : g.get(u)) {
            if (--indeg[v] == 0) q.add(v);
        }
    }
    return order.size() == n ? order : List.of();   // если меньше — есть цикл
}
```

### Floyd's cycle detection (tortoise & hare)

```java
boolean hasCycle(ListNode head) {
    ListNode slow = head, fast = head;
    while (fast != null && fast.next != null) {
        slow = slow.next;
        fast = fast.next.next;
        if (slow == fast) return true;
    }
    return false;
}
```

## 12.12 Структуры с кодом

### LRU Cache

```java
class LRUCache {
    private final int capacity;
    private final LinkedHashMap<Integer, Integer> map;

    public LRUCache(int capacity) {
        this.capacity = capacity;
        this.map = new LinkedHashMap<>(capacity, 0.75f, true) {
            @Override
            protected boolean removeEldestEntry(Map.Entry<Integer, Integer> eldest) {
                return size() > LRUCache.this.capacity;
            }
        };
    }

    public int get(int key)              { return map.getOrDefault(key, -1); }
    public void put(int key, int value)  { map.put(key, value); }
}
```

### Trie

```java
class Trie {
    private static class Node {
        Map<Character, Node> children = new HashMap<>();
        boolean isEnd;
    }
    private final Node root = new Node();

    public void insert(String word) {
        Node cur = root;
        for (char c : word.toCharArray()) {
            cur = cur.children.computeIfAbsent(c, k -> new Node());
        }
        cur.isEnd = true;
    }

    public boolean search(String word) { return find(word, true); }
    public boolean startsWith(String p)  { return find(p, false); }

    private boolean find(String s, boolean exactEnd) {
        Node cur = root;
        for (char c : s.toCharArray()) {
            cur = cur.children.get(c);
            if (cur == null) return false;
        }
        return !exactEnd || cur.isEnd;
    }
}
```

### Min-Stack (стек с O(1) min)

```java
class MinStack {
    private final Deque<int[]> stack = new ArrayDeque<>();   // [value, currentMin]

    public void push(int x) {
        int min = stack.isEmpty() ? x : Math.min(x, stack.peek()[1]);
        stack.push(new int[]{x, min});
    }
    public void pop()    { stack.pop(); }
    public int top()     { return stack.peek()[0]; }
    public int getMin()  { return stack.peek()[1]; }
}
```

## 12.13 Java-специфика на coding interview

### Полезные API

```java
Arrays.sort(arr);                          // primitives — DualPivotQuick
Arrays.sort(objs);                         // objects — Timsort, stable
Arrays.sort(arr, from, to);                // диапазон
Arrays.parallelSort(arr);                  // параллельный
List.of(1, 2, 3);                          // immutable
Collections.reverse(list);
Collections.frequency(list, target);
Collections.binarySearch(sortedList, key);
Map.entry(k, v);                           // immutable Entry

// PriorityQueue (min-heap)
PriorityQueue<Integer> minHeap = new PriorityQueue<>();
PriorityQueue<Integer> maxHeap = new PriorityQueue<>(Comparator.reverseOrder());

// TreeMap навигация
TreeMap<Integer, String> tm = new TreeMap<>();
tm.floorKey(x);                            // <= x
tm.ceilingKey(x);                          // >= x

// Stack/Queue/Deque — используй ArrayDeque, не LinkedList/Stack
Deque<Integer> stack = new ArrayDeque<>();
stack.push(1); stack.pop(); stack.peek();

Deque<Integer> queue = new ArrayDeque<>();
queue.offer(1); queue.poll(); queue.peek();
```

### Подводные камни

- **Integer переполнение в `mid = (lo + hi) / 2`** — используй `lo + (hi - lo) / 2`.
- **Integer кэш** `[-128;127]` — `Integer a = 200; Integer b = 200; a == b` → `false`. В коде интервью всегда `equals`.
- **Деление по модулю** для отрицательных: `Math.floorMod(-1, 3) = 2`, а `(-1) % 3 = -1`.
- **`String.split(",")` отрезает trailing пустые** — используй `split(",", -1)`.
- **`Arrays.asList(arr)`** для int[] вернёт `List<int[]>`, не `List<Integer>`. Для примитивов: `Arrays.stream(arr).boxed().toList()`.
- **`Map.computeIfAbsent`** возвращает значение (новое или существующее) — удобно для построения "графа в HashMap".

## 12.14 Подход к задаче на интервью (10 шагов)

1. **Прочитай задачу полностью.** Не торопись.
2. **Уточни:** размеры, отрицательные? `null`? пустой ввод? дубликаты? возможно ли несколько ответов? sorted ли?
3. **Приведи пример руками** — простой и edge-case.
4. **Brute force** — расскажи, оцени сложность. "Это работает, но n²".
5. **Подумай вслух:** какая структура помогла бы? Видишь паттерн (sorted → two pointers; lookup → hash; min/max → heap; intervals → sort + sweep)?
6. **Расскажи план** прежде, чем кодить. "Я буду использовать sliding window, потому что..."
7. **Кодь чисто:** говорящие имена, без магических чисел, обработка edge case.
8. **Тестируй сам:** примеры из условия + edge.
9. **Сложность:** time + space.
10. **Можно ли лучше?** Trade-offs.

## 12.15 Списки задач (приоритеты)

### Top-50 если мало времени (NeetCode "blind 75" core)

**Arrays/Hashing:** Two Sum, Valid Anagram, Group Anagrams, Top K Frequent, Product Except Self, Longest Consecutive.  
**Two pointers:** Valid Palindrome, 3Sum, Container With Most Water.  
**Sliding window:** Best Time to Buy/Sell Stock, Longest Substring Without Repeating, Longest Repeating Character Replacement.  
**Stack:** Valid Parentheses, Min Stack, Daily Temperatures, Car Fleet.  
**Binary search:** Binary Search, Search in Rotated Sorted Array, Find Min in Rotated.  
**Linked List:** Reverse, Merge Two Sorted, Reorder, Has Cycle, Remove Nth From End, LRU Cache.  
**Trees:** Invert, Max Depth, Same Tree, Lowest Common Ancestor (BST), Validate BST, Kth Smallest, Level Order Traversal.  
**Tries:** Implement Trie, Add and Search Word.  
**Heap:** Kth Largest, Find Median from Data Stream.  
**Backtracking:** Subsets, Combination Sum, Permutations, Word Search.  
**Graphs:** Number of Islands, Clone Graph, Course Schedule, Pacific Atlantic.  
**DP 1D:** Climbing Stairs, House Robber, Coin Change, Longest Increasing Subsequence, Word Break.  
**DP 2D:** Unique Paths, Longest Common Subsequence.  
**Greedy:** Maximum Subarray, Jump Game, Gas Station.  
**Intervals:** Insert Interval, Merge Intervals, Non-overlapping, Meeting Rooms.

## 12.16 Дополнительные частые вопросы

- Что такое амортизированная сложность? Пример?
- Чем `HashMap` отличается от `TreeMap` по сложности?
- Когда `quicksort` вырождается в O(n²)?
- Какая сортировка стабильная?
- Чем `Arrays.sort` для примитивов и для объектов отличается? (Quicksort vs Timsort.)
- Когда DP, а когда greedy?
- Чем DFS от BFS отличается? Когда какой?
- Как находить кратчайший путь в невзвешенном графе? (BFS.)
- А во взвешенном с положительными весами? (Dijkstra.)
- Как найти цикл в связном списке за O(1) памяти? (Floyd's tortoise & hare.)
- Как реализовать LRU? (`LinkedHashMap` с accessOrder.)
- Какая сложность построения heap из массива? (O(n), а не O(n log n).)
- Какая сложность поиска в сбалансированном BST? (O(log n).)
- Что такое топологическая сортировка? Где используется?
- Какие задачи решаются через Union-Find?
- Что такое мемоизация vs табуляция в DP?
- Как найти K-й порядковый элемент в массиве за O(n)? (Quickselect.)

