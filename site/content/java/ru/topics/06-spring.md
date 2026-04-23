# 6. Spring / Spring Boot — детально

## 6.1 IoC и DI

- **IoC (Inversion of Control)** — управление зависимостями делегировано контейнеру: не объект сам ищет зависимости (`new` / lookup), а контейнер их **внедряет**.
- **DI (Dependency Injection)** — конкретный механизм IoC.

### Виды инъекции

- **Constructor injection** ✅ — рекомендуется. Поля можно сделать `final`. Зависимости обязательны → fail-fast при старте. Удобно тестировать без Spring. С Spring 4.3+ `@Autowired` на единственном конструкторе можно опустить.
- **Setter injection** — для опциональных зависимостей или circular deps.
- **Field injection** (`@Autowired private Foo foo`) ❌ — плохо: нельзя `final`, скрытые зависимости, тестировать через рефлексию.

```java
@Service
public class OrderService {
    private final PaymentClient client;
    private final OrderRepository repo;

    public OrderService(PaymentClient client, OrderRepository repo) {
        this.client = client;
        this.repo = repo;
    }
}
```

### `BeanFactory` vs `ApplicationContext`

- `BeanFactory` — базовый контейнер, lazy-init по умолчанию.
- `ApplicationContext` — расширение: events, i18n, AOP, BPP, eager-init singleton'ов. На практике используется он.

## 6.2 Жизненный цикл бина

```
1. Instantiation                  (вызов конструктора)
2. Populate properties            (DI setter/field)
3. *Aware-интерфейсы              (BeanNameAware, ApplicationContextAware...)
4. BeanPostProcessor.before       (postProcessBeforeInitialization)
5. @PostConstruct
6. InitializingBean.afterPropertiesSet()
7. init-method (из @Bean(initMethod=...))
8. BeanPostProcessor.after        (здесь создаётся AOP-прокси!)
9. ... бин используется ...
10. @PreDestroy
11. DisposableBean.destroy()
12. destroy-method
```

**Важно:** AOP-проксирование происходит в `BeanPostProcessor.postProcessAfterInitialization`. Поэтому `@PostConstruct` ещё работает на "сыром" бине.

## 6.3 Bean scopes

- `singleton` (default) — один на контейнер.
- `prototype` — новый при каждом запросе. Spring **не управляет жизненным циклом** прототипа после создания (нет `@PreDestroy`).
- `request`, `session`, `application`, `websocket` — для веб-контекста.

**Прототип в синглтоне**: если просто `@Autowired` положить prototype в singleton, то будет один экземпляр (получен один раз при создании singleton'а). Решения:
- `@Lookup`-метод.
- `ObjectProvider<T>` / `Provider<T>` — `provider.getObject()` каждый раз.
- `@Scope(value="prototype", proxyMode = ScopedProxyMode.TARGET_CLASS)` — CGLIB-прокси, который при каждом вызове идёт в контейнер.

## 6.4 `@Component` vs `@Bean` vs `@Configuration`

- `@Component` (и стереотипы `@Service`, `@Repository`, `@Controller`, `@RestController`) — class-level, регистрируется через component scan.
- `@Bean` — method-level в `@Configuration`-классе. Используется, когда:
  - класс не твой (нельзя пометить аннотацией);
  - нужна сложная инициализация;
  - нужно несколько вариантов одного типа.
- `@Configuration` — класс конфигурации. Spring **проксирует** его CGLIB'ом, чтобы вызовы `@Bean`-методов внутри возвращали singleton (а не создавали новый объект каждый раз). При `@Configuration(proxyBeanMethods=false)` (lite-mode) — без прокси, быстрее, но `@Bean`-методы не самосогласуются.

## 6.5 Разрешение конфликтов

- `@Primary` — кандидат "по умолчанию".
- `@Qualifier("name")` — выбор по имени.
- `@Profile("dev")` — активирует бин в указанном профиле.
- `@Conditional...` — `@ConditionalOnProperty`, `@ConditionalOnClass`, `@ConditionalOnMissingBean` (особенно важно в auto-configuration).

## 6.6 Circular dependencies

`A → B → A`. С Spring 6 / Boot 3 по умолчанию **запрещены**. Решения:
- Поменять дизайн (в идеале — вытащить общий код в третий бин).
- Setter injection.
- `@Lazy` на одном из аргументов.

С constructor injection циклы вообще нерешаемы без `@Lazy`.

## 6.7 Spring AOP

- **Cross-cutting concerns** — логирование, транзакции, безопасность, метрики, кэш.
- **Аспект** = pointcut (где) + advice (что делать).
- Виды advice: `@Before`, `@After`, `@AfterReturning`, `@AfterThrowing`, `@Around` (самый мощный, имеет `ProceedingJoinPoint`).

```java
@Aspect @Component
public class LoggingAspect {
    @Around("@annotation(Loggable)")
    public Object log(ProceedingJoinPoint pjp) throws Throwable {
        long t = System.nanoTime();
        try { return pjp.proceed(); }
        finally { log.info("{} took {}ns", pjp.getSignature(), System.nanoTime()-t); }
    }
}
```

### Как работает: прокси

- **JDK dynamic proxy** — для бинов, реализующих интерфейс. Прокси реализует тот же интерфейс.
- **CGLIB** — наследует класс. Используется, когда нет интерфейса, или включено `proxyTargetClass=true`. Не работает с `final` классами/методами.

### Self-invocation проблема

```java
@Service
class A {
    public void foo() { bar(); }     // обходит прокси!
    @Transactional public void bar() { ... }
}
```

`this.bar()` — прямой вызов, не через прокси, → `@Transactional` (и любой advice) **не сработает**. Решения:
- Вынести `bar` в отдельный бин.
- Инжектить `self`/`ApplicationContext` и звать через прокси.
- AspectJ (load-time weaving) — нет проксей, advice "вшивается" в байткод.

## 6.8 Spring Boot

### Auto-configuration

- Стартеры (`spring-boot-starter-web`, `-data-jpa`, `-security`, ...) подтягивают набор зависимостей и **auto-configurations**.
- Auto-configurations регистрируются в `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports` (раньше `spring.factories`).
- Каждая аннотирована `@AutoConfiguration` + `@Conditional...` — подключается только если выполнены условия (есть/нет класса, есть/нет бина, проперти включена, есть встроенный сервер и т.п.).
- `@EnableAutoConfiguration` (часть `@SpringBootApplication`) запускает механизм.

`spring-boot-starter-actuator` + `/actuator/conditions` — посмотреть, какие auto-config'и сработали и почему.

### `@SpringBootApplication`

Композитная аннотация:
- `@Configuration`
- `@EnableAutoConfiguration`
- `@ComponentScan` (по пакету и подпакетам класса)

### Externalized configuration

Порядок источников (от низшего приоритета к высшему):
1. Дефолты в коде.
2. `application.yaml` / `.properties` (внутри jar).
3. Профильные `application-{profile}.yaml`.
4. Внешний `application.yaml` рядом с jar / в `./config`.
5. OS environment variables.
6. Java system properties (`-D...`).
7. Command-line аргументы (`--server.port=...`).
8. `@TestPropertySource`.

`@ConfigurationProperties(prefix="app")` — типизированный bind с валидацией:
```java
@ConfigurationProperties("payment")
@Validated
public record PaymentProps(@NotBlank String url, @Positive int timeoutMs) {}
```

### Profiles

`spring.profiles.active=dev,local`. Один бин на профиль через `@Profile("dev")`. Группы профилей с Boot 2.4+.

### Actuator

Эндпоинты `/actuator/health`, `/actuator/metrics`, `/actuator/info`, `/actuator/env`, `/actuator/loggers`, `/actuator/prometheus` (через micrometer-registry-prometheus). По умолчанию открыт только `health`/`info`, остальное — через `management.endpoints.web.exposure.include`.

### Spring Boot 3 / Spring 6

- **Java 17 минимум**.
- **Jakarta EE namespace** (`javax.*` → `jakarta.*`).
- **GraalVM native image** поддержка (`spring-boot-starter-parent` + `native-maven-plugin`).
- **Observability**: `Micrometer Observation API` + auto-trace через Micrometer Tracing (Brave/OTel).
- **Problem Details (RFC 7807)** для ошибок.
- HTTP Interface clients (`@HttpExchange`) на основе RestClient.

## 6.9 Spring MVC

### Архитектура

```
Request
  → DispatcherServlet (front controller)
  → HandlerMapping (выбирает контроллер)
  → HandlerAdapter (вызывает)
  → Controller @RequestMapping
  → ReturnValueHandler (сериализация)
Response
```

Цепочка: Filter → DispatcherServlet → HandlerInterceptor.preHandle → Controller → postHandle → afterCompletion.

### Контроллеры

```java
@RestController
@RequestMapping("/api/v1/orders")
public class OrderController {
    @GetMapping("/{id}")
    public OrderDto get(@PathVariable UUID id) { ... }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public OrderDto create(@RequestBody @Valid CreateOrder cmd) { ... }
}
```

### Валидация

- JSR-303/Bean Validation (`@NotNull`, `@Size`, `@Email`, `@Positive`).
- `@Valid` на параметре — валидирует тело/объект.
- `@Validated` на классе — для group и method-level (валидация параметров методов сервиса).
- Ошибка → `MethodArgumentNotValidException` → обрабатывается в `@ControllerAdvice`.

### Обработка ошибок

```java
@RestControllerAdvice
public class GlobalErrorHandler {
    @ExceptionHandler(NotFoundException.class)
    public ResponseEntity<ProblemDetail> notFound(NotFoundException e) { ... }
}
```

С Spring 6 — `ProblemDetail` (RFC 7807) из коробки.

### Filter vs Interceptor vs ArgumentResolver

- **Filter** — Servlet API, всё подряд (даже статика). До DispatcherServlet.
- **Interceptor** — Spring, только контроллеры, есть доступ к handler.
- **HandlerMethodArgumentResolver** — кастомное разрешение аргументов контроллера (например, инжект текущего юзера).

## 6.10 Spring WebFlux (обзорно)

- Reactive non-blocking, основан на Reactor (`Mono`, `Flux`).
- Сервер: Netty (по умолчанию), Tomcat (NIO), Jetty.
- Backpressure — потребитель сообщает producer'у, сколько может принять.
- Когда нужен: высокий concurrency с blocking I/O, много long-lived соединений (SSE/WebSocket).
- С virtual threads (Java 21) часто можно остаться на классическом MVC.

## 6.11 Spring Data

- `JpaRepository<T, ID>` → готовые `save`, `findById`, `findAll`, `deleteById`, `existsById`.
- **Derived queries** — по имени метода: `findByEmailAndStatus(String email, Status s)`.
- **`@Query`** — JPQL/native.
- **`@Modifying`** + `@Query` — для `UPDATE`/`DELETE`.
- **Pagination**: `Pageable`, `Page<T>`, `Slice<T>` (без count-запроса).
- **Specifications** — Criteria API через `JpaSpecificationExecutor`.
- **Projections** — DTO-проекции (interface-based / class-based).
- **Auditing** — `@CreatedDate`, `@LastModifiedDate`, `@CreatedBy`, `@LastModifiedBy` + `@EnableJpaAuditing`.

## 6.12 Spring Security

### Архитектура

- **`SecurityFilterChain`** — цепочка фильтров (вместо устаревшего `WebSecurityConfigurerAdapter`).
- **`AuthenticationManager`** — управляет процессом auth, делегирует `AuthenticationProvider`.
- **`AuthenticationProvider`** — конкретная стратегия (DaoAuthenticationProvider, JwtAuthenticationProvider, ...).
- **`UserDetailsService`** — загружает пользователя по логину.
- **`SecurityContextHolder`** — `ThreadLocal` с `Authentication` текущего запроса.

### Современная конфигурация (Spring Security 6)

```java
@Bean
SecurityFilterChain api(HttpSecurity http) throws Exception {
    return http
        .csrf(c -> c.disable())                       // для stateless API
        .authorizeHttpRequests(a -> a
            .requestMatchers("/public/**").permitAll()
            .requestMatchers("/admin/**").hasRole("ADMIN")
            .anyRequest().authenticated())
        .oauth2ResourceServer(o -> o.jwt(Customizer.withDefaults()))
        .sessionManagement(s -> s.sessionCreationPolicy(STATELESS))
        .build();
}
```

### Авторизация на методах

```java
@PreAuthorize("hasRole('ADMIN') or #userId == authentication.name")
public User get(Long userId) { ... }
```

### OAuth2 / OIDC

- **Authorization Code + PKCE** — для SPA / мобильных.
- **Client Credentials** — машина-машина.
- **Resource Server** — валидирует JWT (issuer, signature, audience, expiration). Использует JWK Set с issuer'а.
- Spring поддерживает: `oauth2-client`, `oauth2-resource-server`, `oauth2-authorization-server`.

### CSRF / CORS

- **CSRF** нужен для browser-based session auth (cookie). Для stateless JWT API — disable.
- **CORS** настраивается через `CorsConfigurationSource` или `@CrossOrigin`.

## 6.13 Транзакции в Spring

См. также главу про БД/JPA. Основное здесь:

- `@Transactional` создаёт прокси (CGLIB/JDK). Self-invocation не работает (см. AOP).
- **Propagation:**
  - `REQUIRED` (default) — присоединиться или создать.
  - `REQUIRES_NEW` — приостановить текущую, начать новую (новое соединение!).
  - `NESTED` — savepoint внутри текущей.
  - `MANDATORY` — должна быть открыта, иначе исключение.
  - `NEVER` — должна отсутствовать.
  - `SUPPORTS` — присоединиться, если есть.
  - `NOT_SUPPORTED` — приостановить текущую.
- **Isolation** — пробрасывается на JDBC.
- **Rollback rules** — по умолчанию откат только на `RuntimeException` и `Error`. Checked — нет, если не указать `rollbackFor`.
- **`readOnly = true`** — Hibernate отключает dirty-checking, оптимизирует.
- **Timeout** — задаётся секундами.

## 6.14 Часто спрашивают

- IoC / DI на пальцах. Зачем нужен.
- Жизненный цикл бина (полная схема).
- `@Component` vs `@Bean` vs `@Configuration`. Зачем `@Configuration` проксируется.
- Что такое `@Conditional...` и как работает auto-configuration?
- Singleton vs prototype. Как использовать prototype в singleton?
- Как разруливать конфликты (`@Primary`, `@Qualifier`).
- Почему AOP не работает на self-invocation? Как починить?
- JDK proxy vs CGLIB.
- Чем `@PostConstruct` отличается от `InitializingBean.afterPropertiesSet`?
- Что произойдёт с `@Transactional` при self-invocation?
- Propagation: REQUIRED vs REQUIRES_NEW vs NESTED.
- Почему checked-исключение не откатывает транзакцию по умолчанию?
- Как Spring Boot понимает, какие auto-configurations подключить?
- Порядок property sources в Spring Boot.
- Чем `Filter` отличается от `Interceptor`?
- Чем отличается `@RestController` от `@Controller`?
- Как реализовать кастомную валидацию (`ConstraintValidator`)?
- Как тестировать Spring приложение (`@SpringBootTest`, slice-тесты)?


---

# Дополнительные темы Spring (продолжение)

## 6.15 Полный пример Spring Boot приложения

```java
@SpringBootApplication
public class App {
    public static void main(String[] args) {
        SpringApplication.run(App.class, args);
    }
}

// Контроллер
@RestController
@RequestMapping("/api/v1/orders")
@RequiredArgsConstructor
public class OrderController {
    private final OrderService service;

    @GetMapping("/{id}")
    public OrderDto get(@PathVariable UUID id) {
        return service.findById(id)
            .orElseThrow(() -> new NotFoundException("Order " + id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public OrderDto create(@RequestBody @Valid CreateOrder cmd) {
        return service.create(cmd);
    }

    @PatchMapping("/{id}/cancel")
    public ResponseEntity<Void> cancel(@PathVariable UUID id) {
        service.cancel(id);
        return ResponseEntity.noContent().build();
    }
}

// Сервис
@Service
@RequiredArgsConstructor
@Transactional
public class OrderService {
    private final OrderRepository repo;
    private final PaymentClient payment;
    private final ApplicationEventPublisher events;

    public Optional<OrderDto> findById(UUID id) {
        return repo.findById(id).map(OrderMapper::toDto);
    }

    public OrderDto create(CreateOrder cmd) {
        Order saved = repo.save(Order.from(cmd));
        events.publishEvent(new OrderCreatedEvent(saved.getId()));
        return OrderMapper.toDto(saved);
    }
}

// Репозиторий
public interface OrderRepository extends JpaRepository<Order, UUID> {
    List<Order> findByCustomerIdAndStatus(UUID customerId, Status status);

    @Query("SELECT o FROM Order o JOIN FETCH o.items WHERE o.id = :id")
    Optional<Order> findByIdWithItems(@Param("id") UUID id);
}

// Глобальная обработка ошибок
@RestControllerAdvice
public class GlobalErrorHandler {
    @ExceptionHandler(NotFoundException.class)
    public ResponseEntity<ProblemDetail> notFound(NotFoundException e) {
        var pd = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, e.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(pd);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ProblemDetail> validation(MethodArgumentNotValidException e) {
        var pd = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, "validation failed");
        pd.setProperty("errors", e.getBindingResult().getFieldErrors().stream()
            .collect(toMap(FieldError::getField, FieldError::getDefaultMessage)));
        return ResponseEntity.badRequest().body(pd);
    }
}
```

## 6.16 Полный жизненный цикл бина — с примером

```java
@Component
public class LifecycleDemo
    implements BeanNameAware, BeanFactoryAware, ApplicationContextAware,
               InitializingBean, DisposableBean {

    public LifecycleDemo() {
        System.out.println("1. Constructor");
    }

    @Autowired
    public void setDependency(SomeDep dep) {
        System.out.println("2. Setter injection (если есть)");
    }

    @Override public void setBeanName(String name)              { System.out.println("3. BeanNameAware"); }
    @Override public void setBeanFactory(BeanFactory bf)        { System.out.println("4. BeanFactoryAware"); }
    @Override public void setApplicationContext(ApplicationContext ctx) { System.out.println("5. ApplicationContextAware"); }

    // BeanPostProcessor.postProcessBeforeInitialization вызовется перед @PostConstruct

    @PostConstruct
    public void postConstruct() {
        System.out.println("6. @PostConstruct");
    }

    @Override public void afterPropertiesSet() {
        System.out.println("7. InitializingBean.afterPropertiesSet");
    }

    // init-method из @Bean(initMethod="..."), если задан → 8

    // BeanPostProcessor.postProcessAfterInitialization → 9 (тут создаётся AOP-прокси!)

    // ... бин используется ...

    @PreDestroy
    public void preDestroy() {
        System.out.println("10. @PreDestroy");
    }

    @Override public void destroy() {
        System.out.println("11. DisposableBean.destroy");
    }
}
```

## 6.17 Spring Configuration — углублённо

### `@Configuration` vs `@Configuration(proxyBeanMethods=false)`

```java
@Configuration                                  // полное проксирование (CGLIB)
class FullConfig {
    @Bean DataSource ds() { return new HikariDataSource(); }
    @Bean JdbcTemplate jdbc() { return new JdbcTemplate(ds()); }   // ds() возвращает один и тот же singleton
}

@Configuration(proxyBeanMethods = false)       // lite mode, нет прокси, быстрее старт
class LiteConfig {
    @Bean DataSource ds() { return new HikariDataSource(); }
    @Bean JdbcTemplate jdbc(DataSource ds) {   // тут уже надо инжектить через параметр
        return new JdbcTemplate(ds);
    }
}
```

### `@Bean` методы в `@Component`?

Можно, но без проксирования: каждый вызов `bean()` создаст новый объект. Только для special cases.

## 6.18 Profiles — детально

```yaml
# application.yml
spring:
  profiles:
    active: ${ENV:local}
---
spring:
  config:
    activate:
      on-profile: local
server:
  port: 8080
---
spring:
  config:
    activate:
      on-profile: prod
server:
  port: 80
```

Активация:
- `--spring.profiles.active=prod`
- `SPRING_PROFILES_ACTIVE=prod` (env var)
- `@ActiveProfiles("test")` в тестах
- В коде: `@Profile("dev")` на бинах/конфигах

Группы профилей (Boot 2.4+):
```yaml
spring.profiles.group:
  prod: prod, monitoring, sql-logs
```

## 6.19 Конфигурационные свойства — ConfigurationProperties

```java
@ConfigurationProperties(prefix = "payment")
@Validated
public record PaymentProps(
    @NotBlank String url,
    @Positive int timeoutMs,
    @NotEmpty Map<String, String> headers,
    Retry retry
) {
    public record Retry(@Min(0) int max, @Positive long delayMs) {}
}

// Регистрация
@SpringBootApplication
@EnableConfigurationProperties(PaymentProps.class)
public class App { ... }

// Использование
@Service
@RequiredArgsConstructor
class PaymentClient {
    private final PaymentProps props;
}
```

```yaml
payment:
  url: https://api.example.com
  timeout-ms: 5000
  headers:
    X-Tenant: foo
  retry:
    max: 3
    delay-ms: 500
```

Преимущества над `@Value`:
- Type-safe.
- Поддерживает вложенные структуры.
- Валидируется (`@Validated`).
- IDE подсказывает (через `spring-boot-configuration-processor` → `META-INF/spring-configuration-metadata.json`).

## 6.20 Spring Events

```java
// Событие
public record OrderCreatedEvent(UUID orderId, Instant at) {}

// Публикация
@Service @RequiredArgsConstructor
class OrderService {
    private final ApplicationEventPublisher publisher;
    public void create(...) {
        ...
        publisher.publishEvent(new OrderCreatedEvent(id, Instant.now()));
    }
}

// Подписка
@Component
class OrderEmailListener {
    @EventListener
    public void onCreated(OrderCreatedEvent e) {
        // sync, в том же потоке/транзакции
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void afterCommit(OrderCreatedEvent e) {
        // только если транзакция закоммитилась → послать email безопасно
    }

    @Async
    @EventListener
    public void async(OrderCreatedEvent e) {
        // в другом потоке (нужно @EnableAsync)
    }
}
```

`@TransactionalEventListener` — критично, чтобы не отправить email до commit'а транзакции.

## 6.21 Spring Async и Scheduling

```java
@SpringBootApplication
@EnableAsync
@EnableScheduling
public class App {
    @Bean
    public Executor taskExecutor() {
        ThreadPoolTaskExecutor ex = new ThreadPoolTaskExecutor();
        ex.setCorePoolSize(8);
        ex.setMaxPoolSize(16);
        ex.setQueueCapacity(100);
        ex.setThreadNamePrefix("async-");
        ex.initialize();
        return ex;
    }
}

@Service
class Reports {
    @Async
    public CompletableFuture<Report> generate() { ... }

    @Scheduled(cron = "0 0 * * * *")           // каждый час
    public void hourly() { ... }

    @Scheduled(fixedDelay = 5000)              // через 5 сек после завершения предыдущего
    public void poll() { ... }

    @Scheduled(fixedRate = 5000)               // каждые 5 сек, независимо от длительности
    public void heartbeat() { ... }
}
```

⚠️ `@Async`/`@Scheduled` работают через прокси — не вызывай из того же класса (self-invocation).

## 6.22 Validation — глубже

```java
public record CreateUser(
    @NotBlank @Size(min = 2, max = 50) String name,
    @Email                              String email,
    @Min(18) @Max(120)                  int age,
    @Pattern(regexp = "\\+?[0-9]{10,15}") String phone,
    @NotNull @Valid                     Address address    // вложенная валидация
) {}

// На контроллере
@PostMapping
public UserDto create(@RequestBody @Valid CreateUser cmd) { ... }

// На сервисе (нужно @Validated на классе)
@Service
@Validated
class UserService {
    public User load(@NotNull UUID id) { ... }   // валидация параметров метода
}
```

### Кастомный валидатор

```java
@Target({FIELD, PARAMETER})
@Retention(RUNTIME)
@Constraint(validatedBy = StrongPasswordValidator.class)
public @interface StrongPassword {
    String message() default "weak password";
    Class<?>[] groups() default {};
    Class<? extends Payload>[] payload() default {};
}

class StrongPasswordValidator implements ConstraintValidator<StrongPassword, String> {
    @Override public boolean isValid(String pwd, ConstraintValidatorContext ctx) {
        return pwd != null && pwd.length() >= 12 && pwd.matches(".*[A-Z].*") && pwd.matches(".*\\d.*");
    }
}
```

### Validation groups

```java
public record User(
    @NotNull(groups = Update.class) UUID id,
    @NotBlank(groups = {Create.class, Update.class}) String name
) {
    public interface Create {}
    public interface Update {}
}

@PostMapping
public void create(@RequestBody @Validated(User.Create.class) User u) { ... }
```

## 6.23 Auto-configuration — как написать свой starter

```java
@AutoConfiguration
@ConditionalOnClass(MyClient.class)
@ConditionalOnProperty(prefix = "myapp", name = "enabled", havingValue = "true", matchIfMissing = true)
@EnableConfigurationProperties(MyProps.class)
public class MyAutoConfiguration {

    @Bean
    @ConditionalOnMissingBean
    public MyClient myClient(MyProps props) {
        return new MyClient(props.url(), props.timeoutMs());
    }
}
```

Регистрация в `META-INF/spring/org.springframework.boot.autoconfigure.AutoConfiguration.imports`:
```
com.example.MyAutoConfiguration
```

(до Boot 2.7 — в `META-INF/spring.factories`)

`@Conditional`-варианты:
- `@ConditionalOnClass`/`Missing` — есть ли класс на classpath.
- `@ConditionalOnBean`/`Missing` — есть ли бин в контексте.
- `@ConditionalOnProperty` — установлено ли свойство.
- `@ConditionalOnWebApplication` / `Servlet` / `Reactive`.
- `@ConditionalOnExpression` — SpEL.

## 6.24 Spring Security — полный пример

```java
@Configuration
@EnableWebSecurity
@EnableMethodSecurity                          // включает @PreAuthorize
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
            .csrf(AbstractHttpConfigurer::disable)
            .cors(Customizer.withDefaults())
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(a -> a
                .requestMatchers("/actuator/health", "/public/**").permitAll()
                .requestMatchers("/admin/**").hasRole("ADMIN")
                .anyRequest().authenticated())
            .oauth2ResourceServer(o -> o.jwt(jwt ->
                jwt.jwtAuthenticationConverter(jwtAuthConverter())))
            .exceptionHandling(e -> e
                .authenticationEntryPoint(new BearerTokenAuthenticationEntryPoint()))
            .build();
    }

    @Bean
    public JwtAuthenticationConverter jwtAuthConverter() {
        var conv = new JwtGrantedAuthoritiesConverter();
        conv.setAuthorityPrefix("ROLE_");
        conv.setAuthoritiesClaimName("roles");
        var jac = new JwtAuthenticationConverter();
        jac.setJwtGrantedAuthoritiesConverter(conv);
        return jac;
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        var cfg = new CorsConfiguration();
        cfg.setAllowedOrigins(List.of("https://app.example.com"));
        cfg.setAllowedMethods(List.of("GET","POST","PUT","DELETE","PATCH"));
        cfg.setAllowedHeaders(List.of("*"));
        var src = new UrlBasedCorsConfigurationSource();
        src.registerCorsConfiguration("/**", cfg);
        return src;
    }
}

// Защита на уровне методов
@PreAuthorize("hasRole('ADMIN') or #userId == authentication.name")
public User get(Long userId) { ... }

@PreAuthorize("@authz.canEdit(#orderId, principal)")     // SpEL вызов другого бина
public void edit(UUID orderId) { ... }
```

```yaml
spring:
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: https://auth.example.com/realms/myapp
```

При старте приложение само сходит на `/.well-known/openid-configuration`, скачает JWKS и будет валидировать JWT.

## 6.25 Spring Data JPA — расширенно

### Derived queries

```java
List<User> findByEmail(String email);
List<User> findByEmailContainingIgnoreCase(String fragment);
List<User> findByAgeGreaterThanEqual(int age);
List<User> findByStatusInOrderByCreatedAtDesc(Collection<Status> statuses);
boolean existsByEmail(String email);
long countByStatus(Status status);

// distinct, top, first
List<User> findDistinctByLastName(String last);
User findFirstByOrderByCreatedAtDesc();
List<User> findTop5ByStatusOrderByCreatedAtDesc(Status s);
```

### Native vs JPQL

```java
@Query("SELECT u FROM User u WHERE u.active = true")
List<User> findAllActive();

@Query(value = "SELECT * FROM users WHERE active = true",
       nativeQuery = true)
List<User> findAllActiveNative();

// UPDATE/DELETE — обязательно @Modifying + @Transactional
@Modifying
@Query("UPDATE User u SET u.lastSeen = :ts WHERE u.id = :id")
int updateLastSeen(@Param("id") UUID id, @Param("ts") Instant ts);
```

### Pagination & Sort

```java
Page<User> findByStatus(Status s, Pageable p);

// в контроллере
@GetMapping
public Page<UserDto> list(
    @RequestParam Status status,
    @PageableDefault(size = 20, sort = "createdAt", direction = DESC) Pageable p
) {
    return repo.findByStatus(status, p).map(UserMapper::toDto);
}
```

`Page<T>` — содержит данные + total count (доп. count-запрос). `Slice<T>` — без count, проще, но не знает total.

### Projections

```java
// interface-based (динамическая)
public interface UserView {
    String getEmail();
    String getName();
    @Value("#{target.firstName + ' ' + target.lastName}")
    String getFullName();
}
List<UserView> findAllProjectedBy();

// class-based (DTO через конструктор)
@Query("SELECT new com.x.UserDto(u.id, u.email) FROM User u")
List<UserDto> findAllAsDto();
```

### Specifications — динамические запросы

```java
public interface UserRepository extends JpaRepository<User, UUID>,
                                        JpaSpecificationExecutor<User> {}

class UserSpecs {
    public static Specification<User> hasStatus(Status s) {
        return (root, q, cb) -> cb.equal(root.get("status"), s);
    }
    public static Specification<User> ageGte(int age) {
        return (root, q, cb) -> cb.greaterThanOrEqualTo(root.get("age"), age);
    }
}

repo.findAll(where(hasStatus(ACTIVE)).and(ageGte(18)));
```

### Auditing

```java
@SpringBootApplication
@EnableJpaAuditing
public class App { ... }

@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
abstract class Auditable {
    @CreatedDate    Instant createdAt;
    @LastModifiedDate Instant updatedAt;
    @CreatedBy      String   createdBy;
    @LastModifiedBy String   updatedBy;
}

@Bean
AuditorAware<String> auditor() {
    return () -> Optional.ofNullable(SecurityContextHolder.getContext().getAuthentication())
        .map(Authentication::getName);
}
```

## 6.26 Spring Boot Actuator

```yaml
management:
  endpoints:
    web:
      exposure:
        include: health, info, metrics, prometheus, loggers
  endpoint:
    health:
      show-details: when_authorized
      probes:
        enabled: true
  metrics:
    distribution:
      percentiles-histogram:
        http.server.requests: true
```

Эндпоинты:
- `/actuator/health` — overall + components.
- `/actuator/health/liveness`, `/readiness` — для k8s probes.
- `/actuator/metrics`, `/actuator/metrics/{name}`.
- `/actuator/prometheus` — для Prometheus scrape.
- `/actuator/loggers` — runtime изменение log levels.
- `/actuator/info` — build info, git info.
- `/actuator/env`, `/actuator/configprops` — конфигурация.
- `/actuator/threaddump`, `/actuator/heapdump`.

### Кастомный health indicator

```java
@Component
class KafkaHealthIndicator implements HealthIndicator {
    @Override public Health health() {
        try {
            kafkaAdmin.describeCluster(); 
            return Health.up().build();
        } catch (Exception e) {
            return Health.down(e).build();
        }
    }
}
```

### Кастомные метрики (Micrometer)

```java
@Component @RequiredArgsConstructor
class OrderMetrics {
    private final MeterRegistry registry;
    private Counter created;

    @PostConstruct
    void init() {
        created = Counter.builder("orders.created")
            .description("Number of orders created")
            .tag("service", "orders")
            .register(registry);
    }

    public void recordCreated() { created.increment(); }

    public <T> T timeIt(Supplier<T> action) {
        return Timer.builder("orders.create.time")
            .register(registry)
            .record(action);
    }
}
```

## 6.27 Дополнительные частые вопросы

- Чем `@Component` от `@Bean` отличается? Когда какой?
- Зачем `@Configuration` проксируется CGLIB'ом?
- Чем lite-mode `@Configuration` лучше/хуже?
- Полный жизненный цикл бина по шагам.
- Что такое `BeanPostProcessor` и где он применяется?
- Singleton vs prototype. Как использовать prototype в singleton?
- Как разруливать неоднозначность бинов?
- Что такое `@Lazy` и зачем нужен?
- Как Spring разруливает circular dependencies?
- Почему `@Transactional` не работает в private/local методе?
- Почему `@Transactional`/`@Async`/AOP не работает на self-invocation?
- В чём разница JDK proxy vs CGLIB? Когда какой?
- Что такое auto-configuration? Как написать свой starter?
- Что делает `@SpringBootApplication`?
- Как Spring Boot подгружает property files? В каком порядке?
- Чем `@Value` отличается от `@ConfigurationProperties`?
- Зачем `@Validated` на классе сервиса?
- Что такое `ProblemDetail` (Spring 6)?
- Чем `Filter` от `HandlerInterceptor` отличается?
- Как тестировать контроллер? (`@WebMvcTest`.)
- Как тестировать репозиторий? (`@DataJpaTest` + Testcontainers.)
- Чем `@MockBean` от `@Mock` отличается?
- Как реализовать кастомный health indicator?
- Как настроить Spring Security для stateless JWT API?
- Что такое `SecurityFilterChain` (Spring Security 6)?
- Что такое `@PreAuthorize` и `@PostAuthorize`?
- Как работают Spring Events? `@TransactionalEventListener`?
- Что произойдёт, если в `@PostConstruct` бросить исключение?
- Какие scopes есть у бинов?
- Как реализовать запуск кода при старте приложения? (`ApplicationRunner`, `CommandLineRunner`, `@EventListener(ApplicationReadyEvent.class)`.)

