# 10. Тестирование

## 10.1 Пирамида тестирования

```
        / E2E \           <- мало, дорого, медленно, хрупко
       /-------\
      / Integr. \         <- умеренно
     /-----------\
    /   Unit      \       <- много, быстрые, дешёвые
   /---------------\
```

- **Unit** — один класс/метод в изоляции. Без БД/сети. Миллисекунды.
- **Integration** — несколько компонентов вместе, часто с реальной БД через Testcontainers.
- **E2E** — система целиком, через её внешние интерфейсы.

Антипаттерны: **Ice Cream Cone** (мало unit, много e2e), **Hourglass** (мало интеграционных).

## 10.2 JUnit 5 (Jupiter)

### Структура

- `@Test` — тест.
- `@BeforeEach` / `@AfterEach` — до/после каждого.
- `@BeforeAll` / `@AfterAll` — один раз (по умолчанию static, или `@TestInstance(PER_CLASS)`).
- `@Nested` — вложенные классы для логической группировки.
- `@DisplayName("...")` — читаемые имена.
- `@Disabled` / `@DisabledOnOs` / `@EnabledIfSystemProperty` — условное выполнение.
- `@Tag("slow")` + фильтрация в сборке.
- `@TestInstance(PER_CLASS)` — один экземпляр класса на все тесты.

### Параметризация

```java
@ParameterizedTest
@ValueSource(strings = {"", " ", "\t"})
void blank(String s) { assertTrue(s.isBlank()); }

@ParameterizedTest
@CsvSource({"1,1,2", "2,3,5"})
void add(int a, int b, int sum) { assertEquals(sum, a + b); }

@ParameterizedTest
@MethodSource("data")
void test(int x) { ... }
static Stream<Arguments> data() { ... }
```

### Extensions

JUnit 5 заменил `@RunWith` системой расширений: `@ExtendWith(MockitoExtension.class)`, `@ExtendWith(SpringExtension.class)`. Можно писать свои (`BeforeEachCallback`, `ParameterResolver` и т.д.).

### Assertions

Стандартные: `assertEquals`, `assertTrue`, `assertThrows`, `assertAll`, `assertTimeout`. Лучше — **AssertJ** (читаемые fluent-проверки, отличные сообщения):

```java
assertThat(orders)
    .hasSize(3)
    .extracting(Order::status)
    .containsExactly(NEW, PAID, SHIPPED);

assertThatThrownBy(() -> svc.foo())
    .isInstanceOf(IllegalStateException.class)
    .hasMessageContaining("invalid");
```

## 10.3 Mockito

```java
@ExtendWith(MockitoExtension.class)
class OrderServiceTest {
    @Mock PaymentClient client;
    @Mock OrderRepository repo;
    @InjectMocks OrderService svc;

    @Test
    void pays() {
        when(client.charge(any())).thenReturn(Receipt.ok());
        when(repo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Order o = svc.place(new Cart(...));

        assertThat(o.status()).isEqualTo(PAID);
        verify(client).charge(eq(100));
        verify(repo).save(any(Order.class));
        verifyNoMoreInteractions(client);
    }
}
```

### Mock vs Spy
- **`mock`** — полностью фейковый объект, все методы возвращают defaults (`null`/`0`/`false`).
- **`spy`** — оборачивает реальный объект, по умолчанию вызывает реальные методы; можно частично замокать через `doReturn(...).when(spy).method(...)`.

### Стаббинг
- `when(...).thenReturn(...)` — стандарт.
- `doReturn(...).when(...)` — для void / spy / final-методов.
- `thenThrow(...)`, `thenAnswer(...)`.
- Нельзя стаббить `equals`, `hashCode`, `final`-методы (без mock-maker-inline) и `static`/`private` (с Mockito 3.4+ можно через `mockStatic`).

### ArgumentCaptor

```java
ArgumentCaptor<Order> captor = ArgumentCaptor.forClass(Order.class);
verify(repo).save(captor.capture());
assertThat(captor.getValue().status()).isEqualTo(NEW);
```

### Антипаттерны
- Замокать всё — тест проверяет реализацию, а не поведение.
- `verify` на каждый вызов — хрупкость.
- Логика в тесте больше, чем в коде.

## 10.4 Spring testing

### Слайс-тесты (быстрые, поднимают часть контекста)

- `@WebMvcTest(OrderController.class)` — только web-слой, без сервисов/JPA.
- `@DataJpaTest` — только JPA-слой, in-memory БД (или с Testcontainers + `@AutoConfigureTestDatabase(replace = NONE)`).
- `@JsonTest` — Jackson-сериализация.
- `@RestClientTest` — для `RestTemplate`/`RestClient`.

### `@SpringBootTest`

Поднимает полный контекст. Медленно, но реалистично.
- `webEnvironment = MOCK | RANDOM_PORT | DEFINED_PORT | NONE`.
- С `RANDOM_PORT` инжектишь `@LocalServerPort` и используешь `TestRestTemplate`/`WebTestClient`.

### `@MockBean` vs `@Mock`
- **`@Mock`** (Mockito) — мок без Spring-контекста.
- **`@MockBean`** (Spring) — заменяет бин в контексте моком. Перезагружает контекст между тестами (если разные mock-конфигурации) → тормозит.

### Конфигурация теста
- `@TestConfiguration` — дополнительные бины только для тестов.
- `@TestPropertySource(properties = "...")`.
- `@DirtiesContext` — пересоздать контекст после теста (использовать редко).

## 10.5 Testcontainers

Docker-контейнеры из тестов: реальная PostgreSQL/Kafka/Redis вместо моков/in-memory.

```java
@Testcontainers
class IntegrationTest {
    @Container
    static PostgreSQLContainer<?> pg = new PostgreSQLContainer<>("postgres:16");

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", pg::getJdbcUrl);
        r.add("spring.datasource.username", pg::getUsername);
        r.add("spring.datasource.password", pg::getPassword);
    }
}
```

С `@ServiceConnection` (Spring Boot 3.1+) можно ещё проще:
```java
@Container @ServiceConnection
static PostgreSQLContainer<?> pg = new PostgreSQLContainer<>("postgres:16");
```

Singleton-контейнер на JVM:
```java
static final PostgreSQLContainer<?> PG = new PostgreSQLContainer<>("postgres:16");
static { PG.start(); }
```

## 10.6 WireMock

Заглушки HTTP — поднять "чужой" сервис в тестах:

```java
WireMockServer wm = new WireMockServer(8089);
wm.start();
wm.stubFor(get("/users/1").willReturn(okJson("{\"name\":\"Bob\"}")));
```

Можно запускать как сервис в Testcontainers.

## 10.7 Contract testing

Когда два сервиса общаются — обе стороны должны быть согласованы.
- **Pact** — consumer-driven contracts. Consumer пишет, чего ждёт от provider'а; provider проверяет, что соответствует.
- **Spring Cloud Contract** — описываешь контракт (Groovy/YAML), генерятся стабы для consumer'а и тесты для provider'а.

Решает проблему "synthetic" интеграционных тестов и неявного API breakage.

## 10.8 TDD / BDD

### TDD (Test-Driven Development)

**Red → Green → Refactor:**
1. Написал падающий тест.
2. Написал минимальный код, чтобы прошёл.
3. Отрефакторил без поломки тестов.

Плюсы: продуманный API, малые шаги, тесты как спека. Минусы: дисциплина, замедление на старте.

### BDD (Behavior-Driven Development)

`Given / When / Then`. Cucumber, JBehave — для feature-файлов с примерами на бизнес-языке.

## 10.9 Покрытие, мутационное тестирование

- **JaCoCo** — coverage. Не самоцель — 80% покрытие плохих тестов хуже, чем 50% хороших.
- **PIT (Pitest)** — мутационное: меняет байткод (мутации) и проверяет, ловят ли это тесты. Гораздо более честная метрика.

## 10.10 Best practices

- **AAA / Given-When-Then** — структура теста.
- Один логический assert на тест (или сгруппировать через `assertAll`).
- Имена тестов: что тестируем + при каком условии + ожидаемое (`shouldRejectOrder_whenStockEmpty`).
- Без `Thread.sleep` — `Awaitility`:
  ```java
  await().atMost(5, SECONDS).until(() -> counter.get() == 10);
  ```
- Изоляция: каждый тест независим.
- Тесты — это код: рефакторь, не дублируй (фабрики тестовых данных, builders).
- Не тестируй фреймворк (Spring/JPA не нужно покрывать).

## 10.11 Часто спрашивают

- Пирамида тестирования.
- Mock vs Spy. Когда что?
- `@MockBean` vs `@Mock`?
- Что такое slice-тест и зачем?
- Как тестировать репозиторий? Как контроллер?
- Testcontainers — зачем?
- Что такое contract testing?
- TDD — плюсы/минусы.
- Как тестировать асинхронный код? (`Awaitility`).
- Как тестировать `@Transactional` метод?
- Что такое мутационное тестирование?
- Как тестировать privatе-метод? (По правилу — никак, через публичный API.)
- Что такое flaky test? Как с ним бороться?


---

# Дополнительные темы Тестирование (продолжение)

## 10.12 Полные примеры JUnit 5

### Базовые

```java
@Test
@DisplayName("Should add two numbers")
void shouldAdd() {
    assertEquals(5, calc.add(2, 3));
}

@Test
void shouldThrow() {
    var ex = assertThrows(IllegalArgumentException.class, () -> svc.process(null));
    assertEquals("input is null", ex.getMessage());
}

@Test
void grouped() {
    User u = repo.findById(1L).orElseThrow();
    assertAll("user fields",
        () -> assertEquals("Bob", u.name()),
        () -> assertEquals(30,    u.age()),
        () -> assertNotNull(u.email()));
}

@Test
@Timeout(value = 100, unit = TimeUnit.MILLISECONDS)
void timed() { ... }
```

### Lifecycle

```java
@TestInstance(Lifecycle.PER_CLASS)               // один экземпляр класса на все тесты
class MyTest {

    @BeforeAll  void setupOnce() { ... }         // не обязан быть static при PER_CLASS
    @AfterAll   void teardownOnce() { ... }
    @BeforeEach void setup()  { ... }
    @AfterEach  void cleanup() { ... }

    @Test void t1() { ... }
    @Test void t2() { ... }
}
```

### Nested

```java
class OrderServiceTest {

    @Nested @DisplayName("when stock is empty")
    class WhenStockEmpty {
        @BeforeEach void prepare() { stock.empty(); }

        @Test void shouldRejectOrder() { ... }
        @Test void shouldNotChargePayment() { ... }
    }

    @Nested @DisplayName("when stock is available")
    class WhenStockAvailable { ... }
}
```

### Параметризация

```java
@ParameterizedTest
@ValueSource(strings = {"", " ", "\t", "\n"})
void blank(String s) { assertTrue(s.isBlank()); }

@ParameterizedTest
@CsvSource({
    "1, 1, 2",
    "2, 3, 5",
    "5, 5, 10"
})
void add(int a, int b, int expected) {
    assertEquals(expected, calc.add(a, b));
}

@ParameterizedTest
@EnumSource(value = Status.class, names = {"NEW", "PAID"})
void allowedStatuses(Status s) { assertTrue(svc.isAllowed(s)); }

@ParameterizedTest
@MethodSource("scenarios")
void test(Scenario s) { ... }
static Stream<Scenario> scenarios() {
    return Stream.of(
        new Scenario("ok",    valid(),   true),
        new Scenario("fail",  invalid(), false));
}
```

### Условное выполнение

```java
@Test @EnabledOnOs(OS.LINUX) void linuxOnly() {}
@Test @EnabledIfSystemProperty(named = "env", matches = "ci") void ciOnly() {}
@Test @DisabledIfEnvironmentVariable(named = "SKIP_SLOW", matches = "true") void slow() {}

@Test @Tag("integration")
void integration() {}
// Запуск только integration: -Dgroups=integration
```

## 10.13 AssertJ — fluent assertions

```java
import static org.assertj.core.api.Assertions.*;

assertThat(orders)
    .hasSize(3)
    .extracting(Order::status)
    .containsExactly(NEW, PAID, SHIPPED);

assertThat(user.getName()).startsWith("Bo").endsWith("b").hasSize(3);

assertThat(map)
    .hasSize(2)
    .containsKey("foo")
    .containsEntry("foo", "bar")
    .doesNotContainKey("baz");

assertThat(throwableLambda(() -> svc.foo()))
    .isInstanceOf(IllegalStateException.class)
    .hasMessageContaining("invalid")
    .hasCauseInstanceOf(IOException.class);

// Soft assertions — не падает на первом fail
SoftAssertions softly = new SoftAssertions();
softly.assertThat(user.name()).isEqualTo("Bob");
softly.assertThat(user.age()).isEqualTo(30);
softly.assertAll();

// Кастомное сравнение
assertThat(actual).usingRecursiveComparison()
    .ignoringFields("id", "createdAt")
    .isEqualTo(expected);
```

## 10.14 Mockito — углублённо

### Стаббинг

```java
when(repo.findById(1L)).thenReturn(Optional.of(user));
when(repo.findById(anyLong())).thenReturn(Optional.empty());

// Несколько последовательных вызовов
when(client.fetch()).thenReturn(v1, v2, v3);

// Throw
when(client.fetch()).thenThrow(new IOException());

// thenAnswer — возврат на основе аргументов
when(repo.save(any(User.class))).thenAnswer(inv -> {
    User u = inv.getArgument(0);
    u.setId(42L);
    return u;
});

// doReturn — для void / spy / final
doNothing().when(notifier).send(any());
doThrow(new IOException()).when(notifier).send(any());
doReturn(value).when(spyObj).method();
```

### Verify

```java
verify(client).charge(100);                            // ровно один раз
verify(client, times(2)).charge(any());
verify(client, never()).refund(any());
verify(client, atLeast(1)).fetch();
verify(client, atMost(3)).retry();

verifyNoInteractions(unusedMock);
verifyNoMoreInteractions(client);

// Порядок
InOrder inOrder = inOrder(repo, notifier);
inOrder.verify(repo).save(any());
inOrder.verify(notifier).send(any());
```

### ArgumentCaptor

```java
ArgumentCaptor<Order> captor = ArgumentCaptor.forClass(Order.class);
verify(repo).save(captor.capture());
Order saved = captor.getValue();
assertThat(saved.status()).isEqualTo(NEW);
```

### Mock vs Spy

```java
// Mock — пустой объект, все методы возвращают defaults
List<String> mock = mock(List.class);
mock.add("a");
mock.size();                  // 0!

// Spy — оборачивает реальный
List<String> spy = spy(new ArrayList<>());
spy.add("a");
spy.size();                   // 1, реальный вызов
verify(spy).add("a");

// Стаббинг spy — через doReturn (не when, иначе real method вызовется)
doReturn(100).when(spy).size();
```

### Mock статических методов (Mockito 3.4+)

```java
try (MockedStatic<Files> files = mockStatic(Files.class)) {
    files.when(() -> Files.readString(any())).thenReturn("fake content");
    // ... тест ...
} // авто-восстановление
```

### Mock конструктора

```java
try (MockedConstruction<MyClass> mc = mockConstruction(MyClass.class,
        (mock, ctx) -> when(mock.foo()).thenReturn("stubbed"))) {
    new MyClass().foo();      // "stubbed"
}
```

## 10.15 Spring Boot tests — слайсы

### `@SpringBootTest` — полный контекст

```java
@SpringBootTest(webEnvironment = RANDOM_PORT)
class OrderApiIntegrationTest {

    @LocalServerPort int port;
    @Autowired TestRestTemplate client;

    @Test
    void shouldCreateOrder() {
        var req = new CreateOrder(...);
        var res = client.postForEntity("/api/v1/orders", req, OrderDto.class);
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.CREATED);
    }
}
```

С `WebTestClient` (Spring 5+):
```java
@Autowired WebTestClient client;

client.post().uri("/orders")
    .contentType(APPLICATION_JSON)
    .bodyValue(req)
    .exchange()
    .expectStatus().isCreated()
    .expectBody().jsonPath("$.id").isNotEmpty();
```

### `@WebMvcTest` — только web слой

```java
@WebMvcTest(OrderController.class)
class OrderControllerTest {

    @Autowired MockMvc mvc;
    @MockBean  OrderService service;        // моки сервисов

    @Test
    @WithMockUser(roles = "USER")
    void shouldReturn404WhenNotFound() throws Exception {
        when(service.findById(any())).thenReturn(Optional.empty());

        mvc.perform(get("/api/v1/orders/{id}", "abc"))
           .andExpect(status().isNotFound());
    }

    @Test
    void shouldCreate() throws Exception {
        when(service.create(any())).thenReturn(new OrderDto(...));

        mvc.perform(post("/api/v1/orders")
                .contentType(APPLICATION_JSON)
                .content("{\"customerId\":\"...\"}"))
           .andExpect(status().isCreated())
           .andExpect(jsonPath("$.id").isNotEmpty());
    }
}
```

### `@DataJpaTest` — только JPA слой

```java
@DataJpaTest
@AutoConfigureTestDatabase(replace = NONE)               // не подменять на H2
@Testcontainers
class OrderRepositoryTest {

    @Container @ServiceConnection
    static PostgreSQLContainer<?> pg = new PostgreSQLContainer<>("postgres:16");

    @Autowired OrderRepository repo;
    @Autowired TestEntityManager em;

    @Test
    void shouldFindByStatus() {
        em.persist(new Order(...));
        em.flush();

        var found = repo.findByStatus(Status.NEW);
        assertThat(found).hasSize(1);
    }
}
```

Каждый тест в `@DataJpaTest` оборачивается в транзакцию, которая **откатывается** в конце.

### Другие слайсы
- `@JsonTest` — Jackson serialization тесты.
- `@RestClientTest(MyClient.class)` — для RestTemplate/RestClient.
- `@JdbcTest` — JDBC.
- `@WebFluxTest` — для WebFlux.

### `@MockBean` vs `@SpyBean`
Заменяет соответствующий бин в контексте. Контекст пересоздаётся при разных конфигурациях моков → тормозит тесты. Группируй тесты с одинаковыми моками в одном классе.

## 10.16 Testcontainers — полные паттерны

### Singleton container

```java
public abstract class IntegrationTestBase {
    static final PostgreSQLContainer<?> PG = new PostgreSQLContainer<>("postgres:16-alpine")
        .withReuse(true);                                // включить ~/.testcontainers.properties: testcontainers.reuse.enable=true

    static {
        PG.start();
    }

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url",      PG::getJdbcUrl);
        r.add("spring.datasource.username", PG::getUsername);
        r.add("spring.datasource.password", PG::getPassword);
    }
}
```

Все тесты, наследующие `IntegrationTestBase`, делят один контейнер → быстрее.

### `@ServiceConnection` (Spring Boot 3.1+)

```java
@SpringBootTest
@Testcontainers
class IntegrationTest {
    @Container @ServiceConnection
    static PostgreSQLContainer<?> pg = new PostgreSQLContainer<>("postgres:16");

    @Container @ServiceConnection
    static KafkaContainer kafka = new KafkaContainer(DockerImageName.parse("confluentinc/cp-kafka:7.5.0"));

    @Container @ServiceConnection
    static RedisContainer redis = new RedisContainer("redis:7");

    // Spring сам подхватит конфигурацию через connectionDetails
}
```

### Tests с реальными внешними сервисами через WireMock

```java
@Container
static GenericContainer<?> mock = new GenericContainer<>("wiremock/wiremock:3.0.0")
    .withExposedPorts(8080)
    .withClasspathResourceMapping("wiremock", "/home/wiremock", BindMode.READ_ONLY);

@DynamicPropertySource
static void props(DynamicPropertyRegistry r) {
    r.add("payment.url", () -> "http://localhost:" + mock.getMappedPort(8080));
}
```

## 10.17 WireMock standalone

```java
WireMockServer wm = new WireMockServer(WireMockConfiguration.options().port(8089));
wm.start();
WireMock.configureFor("localhost", 8089);

stubFor(get("/users/1")
    .willReturn(aResponse()
        .withStatus(200)
        .withHeader("Content-Type", "application/json")
        .withBody("{\"name\":\"Bob\"}")));

// верификация
verify(getRequestedFor(urlEqualTo("/users/1")));

// scenarios — стейтфул заглушки
stubFor(get("/flaky")
    .inScenario("retry")
    .whenScenarioStateIs(STARTED)
    .willReturn(serverError())
    .willSetStateTo("Cause Success"));

stubFor(get("/flaky")
    .inScenario("retry")
    .whenScenarioStateIs("Cause Success")
    .willReturn(ok()));
```

## 10.18 Async testing с Awaitility

```java
import static org.awaitility.Awaitility.*;

await().atMost(5, SECONDS)
       .pollInterval(100, MILLISECONDS)
       .untilAsserted(() -> {
           var order = repo.findById(id).orElseThrow();
           assertThat(order.status()).isEqualTo(PAID);
       });

// untilAsserted vs until
await().until(() -> counter.get() == 10);          // boolean condition
await().untilAsserted(() -> assertThat(...) ... ); // assertion-based
```

Особенно полезно при тестировании Kafka, async-обработки, eventual consistency.

## 10.19 Contract testing — Pact пример

### Consumer side

```java
@ExtendWith(PactConsumerTestExt.class)
class UserClientPactTest {

    @Pact(consumer = "order-service", provider = "user-service")
    public RequestResponsePact getUser(PactDslWithProvider builder) {
        return builder
            .given("user 1 exists")
            .uponReceiving("get user 1")
                .path("/users/1").method("GET")
            .willRespondWith()
                .status(200)
                .headers(Map.of("Content-Type", "application/json"))
                .body(new PactDslJsonBody().integerType("id", 1).stringType("name"))
            .toPact();
    }

    @Test
    @PactTestFor(pactMethod = "getUser")
    void test(MockServer server) {
        UserClient client = new UserClient(server.getUrl());
        User u = client.get(1L);
        assertThat(u.id()).isEqualTo(1L);
    }
}
```

Контракт публикуется в Pact Broker. Provider запускает тесты на основе этого контракта.

## 10.20 Best practices

### Структура AAA / Given-When-Then

```java
@Test
void shouldRejectOrder_whenStockEmpty() {
    // given
    Stock stock = new Stock(0);
    OrderService svc = new OrderService(stock, ...);

    // when
    Throwable thrown = catchThrowable(() -> svc.place(new Order(...)));

    // then
    assertThat(thrown).isInstanceOf(StockEmptyException.class);
}
```

### Имена тестов

`shouldDoX_whenY_andZ` — читается как спека. Например: `shouldReturn404_whenOrderNotFound`.

### Тестовые данные — через builders/factories

```java
public class OrderTestData {
    public static Order.Builder anOrder() {
        return Order.builder()
            .id(UUID.randomUUID())
            .status(Status.NEW)
            .total(BigDecimal.TEN);
    }
}

// в тесте
Order o = anOrder().status(Status.PAID).build();
```

### Анти-паттерны
- Тест зависит от другого теста (порядок выполнения).
- `Thread.sleep(1000)` вместо Awaitility.
- Магические числа без имён.
- Один тест с 10+ assert'ами и нечитаемой логикой.
- Тестирование getter/setter.
- Замок дин фреймворка (Spring/JPA), а не своей логики.
- "тест ничего не падает = пройден" — проверь, что assert вообще исполнился.

## 10.21 Покрытие — JaCoCo

```xml
<plugin>
    <groupId>org.jacoco</groupId>
    <artifactId>jacoco-maven-plugin</artifactId>
    <version>0.8.x</version>
    <executions>
        <execution>
            <goals><goal>prepare-agent</goal></goals>
        </execution>
        <execution>
            <id>report</id>
            <phase>verify</phase>
            <goals><goal>report</goal></goals>
        </execution>
        <execution>
            <id>check</id>
            <goals><goal>check</goal></goals>
            <configuration>
                <rules><rule>
                    <element>BUNDLE</element>
                    <limits><limit>
                        <counter>LINE</counter><value>COVEREDRATIO</value><minimum>0.80</minimum>
                    </limit></limits>
                </rule></rules>
            </configuration>
        </execution>
    </executions>
</plugin>
```

⚠️ Покрытие — не цель. 80% слабых тестов хуже 50% хороших.

## 10.22 Mutation testing — Pitest

```xml
<plugin>
    <groupId>org.pitest</groupId>
    <artifactId>pitest-maven</artifactId>
    <version>1.x</version>
</plugin>
```

```bash
mvn org.pitest:pitest-maven:mutationCoverage
```

Меняет байткод (мутации: `<` → `<=`, `+` → `-`, удаление вызовов и т.д.) и запускает тесты. Если тесты не падают на мутации → они слабые.

Гораздо честная метрика, чем coverage.

## 10.23 Дополнительные частые вопросы

- Расскажи про пирамиду тестирования.
- Что такое slice-тест и зачем?
- Чем `@SpringBootTest` от `@WebMvcTest` отличается?
- Чем `@MockBean` от `@Mock` отличается?
- Mock vs Spy — когда что?
- Как тестировать private метод? (По хорошему — никак, через публичный API.)
- Как тестировать асинхронный код? (Awaitility, не sleep.)
- Что такое Testcontainers и зачем?
- Что такое contract testing? (Pact / Spring Cloud Contract.)
- Как реализовать contract test в Pact?
- Что такое flaky test? Как с ним бороться? (Изоляция, deterministic данные, await вместо sleep.)
- Как тестировать `@Transactional` метод?
- Чем `MockMvc` от `WebTestClient` отличается? (`MockMvc` — без HTTP-сервера, `WebTestClient` — с реальным сервером.)
- Как тестировать REST-клиент к стороннему сервису? (WireMock.)
- TDD — расскажи цикл red-green-refactor.
- Что такое мутационное тестирование? Зачем?
- Что лучше — coverage 80% или mutation score 60%?
- Что такое `@DirtiesContext` и когда нужен?
- Как тестировать Spring Security? (`@WithMockUser`, `@WithUserDetails`.)
- Как поднять отдельную БД для тестов? (Testcontainers с singleton container.)
- Как сделать "медленные" тесты выполняющимися отдельно? (`@Tag`, профили в Maven.)

---

# Глубокие объяснения: тесты, которые реально работают

Тестирование — не о coverage-метриках и не о количестве `assert`. Оно о **доверии к коду**. Хорошие тесты дают вам смелость рефакторить. Плохие тесты делают рефакторинг страшным, потому что ломаются при любом изменении. Разберём, как писать первые, а не вторые.

## Пирамида тестов — и почему её часто переворачивают вверх ногами

Классическая модель Mike Cohn: много unit-тестов (быстрые, дёшевые), меньше integration, ещё меньше E2E. Обоснование:

**Unit-тесты:** десятки ms, тестируют одну функцию. Когда ломается — точно знаете, что. Могут покрыть сотни edge-cases. В CI пробегают за секунды.

**Integration:** сотни ms — единицы секунд. Тестируют, как компоненты взаимодействуют (сервис + БД, сервис + external API). Ловят проблемы, которые unit не видит (SQL-запросы неправильные, маппинг сломан).

**E2E:** десятки секунд — минуты. Полная цепочка: UI → API → БД → внешние системы. Очень хрупкие (flaky), дорогие в поддержке.

**Antipattern — перевёрнутая пирамида.** Много E2E "для уверенности", мало unit-тестов. Результат: CI бежит часами, каждое изменение ломает половину тестов, команда боится менять код. Видел это в 4 из 5 enterprise-проектов.

**Правило 70/20/10.** 70% unit, 20% integration, 10% E2E. Unit быстрее дают feedback и покрывают больше scenarios.

## Что такое хороший unit-тест

Три свойства: **быстрый** (<100ms), **детерминированный** (не зависит от времени/сети/порядка), **изолированный** (можно запустить один, без настройки).

**AAA pattern** — структура:
```java
@Test
void shouldApplyDiscountForPremiumUser() {
    // Arrange
    User user = new User("Alice", Role.PREMIUM);
    Cart cart = new Cart(List.of(new Item("book", 100)));

    // Act
    BigDecimal total = pricer.calculate(cart, user);

    // Assert
    assertThat(total).isEqualTo(new BigDecimal("80"));
}
```

Имя теста — **поведение, которое проверяем**, не "имя метода + метода". `shouldApplyDiscountForPremiumUser`, не `calculate_test1`.

**Один тест — одна проверка.** Не пихайте 10 `assertEquals` в одну `@Test`. Когда падает — не понятно, что именно сломалось.

## Mock, Stub, Spy, Fake — разница, которую путают

**Stub** — возвращает заранее определённые значения. "Когда спросят `findById(1)`, верни этого user". Без проверок, что его вызвали.

**Mock** — stub + verification. "Проверь, что `emailService.send` был вызван один раз с этим email". Mockito по умолчанию создаёт mock.

**Spy** — оборачивает **реальный объект**, может частично переопределить. "Пусть реальный сервис работает, но `expensiveCall()` верни мой ответ".

**Fake** — упрощённая **работающая реализация**. In-memory repository вместо JPA, in-memory email service вместо SMTP. Отличается от stub — имеет логику.

**Когда что:**
- **Stub/Mock** — для внешних зависимостей (БД, HTTP, queue). Быстро, изолировано.
- **Fake** — для коллабораторов, которые хочется протестировать естественно без фиксации вызовов.
- **Spy** — редко. Обычно знак, что класс делает слишком много и его надо разбить.

**Антипаттерн — over-mocking.** Тесты, где замокано всё, проверяют только, что "метод вызвал метод". Они фиксируют реализацию, а не поведение. Рефакторинг ломает тесты, хотя поведение не менялось. Правило: **мокайте только на границах системы** (HTTP, БД, message broker). Внутри — используйте реальные объекты, если это быстро.

## Testcontainers — убили "IT тест флаки"

Раньше integration-тесты с БД были головной болью: нужна локальная Postgres, версия должна совпадать с prod, данные в БД между тестами загрязняются, на CI — отдельный setup. Testcontainers решил это в 2016-м.

**Суть.** В `@BeforeAll` поднимается **Docker-контейнер** (Postgres, Kafka, Redis — всё что есть Docker image). Тест получает адрес и порт. После тестов — контейнер убивается.

```java
@Testcontainers
class UserRepositoryTest {
    @Container
    static PostgreSQLContainer<?> pg = new PostgreSQLContainer<>("postgres:15");

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", pg::getJdbcUrl);
        r.add("spring.datasource.username", pg::getUsername);
        r.add("spring.datasource.password", pg::getPassword);
    }

    @Test
    void shouldSaveAndLoad() { ... }
}
```

**Что достигнуто:**
1. **Реальная БД** — не H2, который отличается синтаксисом.
2. **Изолированно** — каждый прогон на чистой БД.
3. **Работает в CI** — нужен только Docker.
4. **Версия контрольна** — в тесте указываете `postgres:15`, совпадает с prod.

**Оптимизация скорости.** Контейнер стартует 3-5 секунд. Если каждый тест поднимает свой — час CI превращается в пять часов. Решение — **singleton container**: один контейнер на всю JVM, между тестами чистим таблицы (`TRUNCATE` или Flyway migrate clean).

## `@SpringBootTest` — медленный и вредный, если используется везде

`@SpringBootTest` поднимает **полный** Spring context — все бины, авто-конфигурации, БД. Для одного простого теста — 10-20 секунд на старт. Если все тесты такие — CI бежит полчаса.

**Пирамида Spring тестов:**

1. **Чистый unit-тест** — без Spring. Новый конструктор сервиса, моки зависимостей. Миллисекунды.
2. **`@WebMvcTest(UserController.class)`** — только controller + HTTP-слой. ~1 секунда.
3. **`@DataJpaTest`** — только JPA + БД. С Testcontainers — ~3 секунды.
4. **`@SpringBootTest`** — полный контекст. Только для end-to-end проверок внутри monolith.

**Правило.** 80% тестов — unit без Spring. 15% — sliced (`@WebMvcTest`, `@DataJpaTest`). 5% — `@SpringBootTest` для happy-path сценариев.

## Flaky tests — смерть команды

Flaky = тест, который иногда падает, иногда проходит без изменения кода. Больше всего убивает доверие: "ну, опять тест рандомно упал, ретрай". Через полгода никто не обращает внимание на красные тесты.

**Главные источники flakiness:**

1. **`Thread.sleep` для ожидания async результатов.** Работает на dev-машине (быстрая), падает на загруженном CI (медленная). Замена — Awaitility:
```java
await().atMost(5, SECONDS).until(() -> service.isReady());
```

2. **Недетерминированный порядок.** Тесты зависят от порядка выполнения (тест A оставляет данные, на которые полагается тест B). Решение: каждый тест создаёт свои данные + чистит после.

3. **Системное время.** Код вызывает `LocalDate.now()`. Тест может упасть на границе суток. Решение: **инжектить Clock** — `Clock clock`, в тесте `Clock.fixed(instant, zone)`.

4. **Случайность.** `Math.random()` внутри. Используйте `seedable Random` в тестах.

5. **Внешние зависимости.** HTTP к публичному API — сеть иногда лагает. Мокайте через WireMock.

**Если тест flaky — не игнорируйте, чините.** Добавляйте retries на flaky тесты — это **культура** допустимой ненадёжности. Команды с нулевой толерантностью к flakiness имеют намного более стабильный CI.

## Coverage — метрика, которая обманывает

Coverage 80% звучит как достижение. Реальность: coverage **не гарантирует качество**. Тест, который просто вызывает метод без `assert`, даёт 100% coverage. Так же как:
```java
@Test void test() { service.doSomething(); }
```
Покрыл метод, но ничего не проверил. Тесты такого вида обычно появляются при давлении "coverage должен быть 80%".

**Mutation testing (PIT)** — радикально лучше. Инструмент **изменяет код** (мутирует: меняет `>` на `>=`, `return x` на `return null`) и запускает тесты. Если все тесты всё ещё проходят — значит, они не ловят эту мутацию → тестам не хватает assert'ов.

**Coverage 80% + mutation score 30%** → тесты формальные, без смысла.
**Coverage 60% + mutation score 55%** → тесты качественные, проверяют поведение.

В реальности используйте coverage как **нижний bound** (не ниже X%) и mutation testing на критичной бизнес-логике (платежи, ценообразование).

## Contract testing — способ не сломать микросервисы

Проблема: сервис A вызывает сервис B. В интеграционных тестах A используется моки B. Реальный B меняет API. Тесты A зелёные, но в prod всё ломается.

**Contract test** — проверка, что A и B **договорились** о формате.

**Consumer-driven (Pact):**
1. Команда A пишет тест: "когда я отправляю `GET /users/1`, жду ответ `{...}`". Этот "договор" сохраняется в Pact Broker.
2. Команда B в CI проверяет: "соответствует ли мой реальный ответ договорам потребителей?". Если API сломан — CI B красный.

**Преимущество.** Обнаруживаете breaking change на стороне provider'а **до** деплоя. Реальные HTTP-запросы в тестах не нужны.

**Spring Cloud Contract** — альтернатива с более yaml-like синтаксисом. Обе работают.

## Что НЕ тестировать

- **Getter/setter.** Банально.
- **Mapstruct-мапперы** на уровне тривиальных полей. Проверь edge-case'ы (null, коллекции), остальное — дублирование.
- **Framework.** Spring уже протестирован. Не пишите тесты "а работает ли `@Autowired`".
- **Сгенерированный код** (proto, jOOQ).
- **Private методы через reflection.** Если private метод сложный — это знак, что нужен новый класс.

