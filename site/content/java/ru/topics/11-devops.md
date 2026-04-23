# 11. DevOps / Build / Инфраструктура (для Java-разработчика)

## 11.1 Maven vs Gradle

### Maven
- XML (`pom.xml`).
- **Convention over configuration**: стандартная структура (`src/main/java`, `src/test/java`, …).
- **Lifecycle**: `validate → compile → test → package → verify → install → deploy`. Каждый этап включает предыдущие.
- **Plugins** делают работу (`maven-compiler-plugin`, `maven-surefire-plugin`, …).
- **Dependency scopes**: `compile` (default), `provided` (есть в рантайме извне, например, servlet-api), `runtime` (нужен в рантайме, не для компиляции, например, JDBC-драйвер), `test`, `system` (антипаттерн), `import` (только для BOM).
- **BOM (Bill of Materials)** — `dependencyManagement` с версиями; модули наследуют без указания версии. Spring Boot starter parent — пример.
- **Transitive dependencies** — приходят сами; конфликты разруливает по правилу "ближайший в дереве выигрывает". `mvn dependency:tree`.

### Gradle
- Groovy/Kotlin DSL (`build.gradle` / `build.gradle.kts`).
- Гибче, быстрее (incremental build, daemon, build cache).
- **Configurations**: `implementation` (не виден потребителям модуля), `api` (виден), `runtimeOnly`, `compileOnly`, `testImplementation`.
- Таски, не lifecycle: `./gradlew build`, `./gradlew test`.

### Когда что
- Maven: стандарт, прозрачен, отлично с Spring Boot.
- Gradle: большие/сложные проекты, многомодульные с кастомной логикой, Android/Kotlin.

## 11.2 Docker

### Концепции
- **Image** — иммутабельный шаблон.
- **Layer** — каждая инструкция Dockerfile = слой; кэшируются.
- **Container** — запущенный экземпляр.
- **Registry** — хранилище образов (Docker Hub, ECR, GCR, Harbor).

### Dockerfile best practices

```dockerfile
# 1. Multi-stage build — собираем в одном, запускаем в другом
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app
COPY pom.xml mvnw ./
COPY .mvn .mvn
RUN ./mvnw dependency:go-offline       # кэш зависимостей отдельным слоем
COPY src src
RUN ./mvnw package -DskipTests

# 2. Минимальный runtime — JRE, distroless или alpine
FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/app.jar app.jar
RUN useradd -r -u 1000 app && chown app:app /app
USER app                                # не рут
EXPOSE 8080
ENTRYPOINT ["java","-jar","/app/app.jar"]
```

- Каждый `RUN`/`COPY` — слой; порядок важен для кэша (часто меняющиеся вещи в конец).
- `.dockerignore` — исключить лишнее (`target/`, `.git`, `node_modules`).
- **Distroless** (`gcr.io/distroless/java21`) — минимальный образ без shell, сложнее эксплуатировать → безопаснее.
- **Не root** обязательно (k8s pod-security).
- **Не хардкодить секреты** в Dockerfile.

### Spring Boot Layered Jar

`spring-boot-maven-plugin` поддерживает `layers.idx` → можно разложить jar по слоям (dependencies / spring-boot-loader / snapshot-dependencies / application). Зависимости меняются реже → кэш срабатывает чаще.

### Cloud Native Buildpacks / Jib

- `./mvnw spring-boot:build-image` — buildpacks от Paketo, без Dockerfile, оптимизированный образ.
- **Jib** (Google) — собирает образ напрямую из Maven/Gradle, без Docker daemon.

## 11.3 Kubernetes

### Объекты
- **Pod** — один или несколько контейнеров с общей сетью/storage. Минимальная единица.
- **ReplicaSet** — поддерживает N подов.
- **Deployment** — управляет ReplicaSet'ами; rolling update, rollback.
- **StatefulSet** — для stateful-приложений (БД, Kafka): стабильные имена, упорядоченный запуск, persistent volumes.
- **DaemonSet** — по одному поду на ноду (агенты логов, мониторинга).
- **Job / CronJob** — одноразовые / по расписанию.
- **Service** — стабильный endpoint (ClusterIP / NodePort / LoadBalancer).
- **Ingress** — L7-роутинг по hostname/path (nginx, traefik).
- **ConfigMap / Secret** — конфигурация и секреты.
- **PersistentVolume / PersistentVolumeClaim** — storage.
- **HorizontalPodAutoscaler (HPA)** — автоскейл по CPU/RAM/кастом метрикам.
- **Namespace** — изоляция ресурсов.

### Probes

- **liveness** — жив ли pod; провал → рестарт.
- **readiness** — готов ли принимать трафик; провал → исключается из Service.
- **startup** — для медленно стартующих, отключает остальные probes до успеха.

В Spring Boot — `/actuator/health/liveness` и `/actuator/health/readiness`.

### Ресурсы и лимиты

```yaml
resources:
  requests: { cpu: "500m", memory: "512Mi" }
  limits:   { cpu: "1",    memory: "1Gi"  }
```

JVM ≥ 8u191 учитывает cgroup-лимиты (`-XX:+UseContainerSupport`). `-XX:MaxRAMPercentage=75` — оставить место под non-heap. **OOM-killer** убивает контейнер, превысивший memory limit.

### Rolling update

`maxUnavailable`, `maxSurge`. Pod должен корректно реагировать на `SIGTERM`:
1. Вынимается из Service.
2. Получает SIGTERM.
3. Завершает текущие запросы (graceful shutdown).
4. Через `terminationGracePeriodSeconds` — SIGKILL.

В Spring Boot: `server.shutdown=graceful`, `spring.lifecycle.timeout-per-shutdown-phase=30s`.

## 11.4 CI/CD

### Принципы
- **CI** — каждый коммит автоматически собирается и тестируется.
- **CD** — Continuous Delivery (готов к релизу одним кликом) / Continuous Deployment (автомат на prod).

### Pipeline (типичный)
1. Checkout.
2. Build + unit tests.
3. Линтер / static analysis (SonarQube, Checkstyle, SpotBugs).
4. Integration tests (с Testcontainers).
5. Build образ и push в registry.
6. Deploy в dev (auto), staging (auto), prod (manual approval).
7. Smoke / e2e tests после deploy.

### GitOps (как в этом репо)
- Желаемое состояние кластера в Git.
- Контроллер (Flux / Argo CD) синхронизирует с реальным.
- Pull-модель безопаснее push.

### Deployment strategies
- **Rolling** — по умолчанию.
- **Blue/Green** — два окружения, переключаем трафик.
- **Canary** — постепенно увеличиваем долю трафика на новую версию.
- **Shadow** — новая версия получает копию трафика, ответы не отдаются.

## 11.5 Observability — три кита

### Metrics (Прометеус-стиль)
- Counter (`http_requests_total`), Gauge (`heap_used`), Histogram (`http_request_duration_seconds`), Summary.
- Labels (для срезов): `{method="GET", status="200"}`. Не делать high-cardinality labels (например, user_id).
- В Spring — Micrometer как фасад → Prometheus / Datadog / NewRelic.
- `/actuator/prometheus` экспортирует.

### Logs
- **Структурные JSON-логи** (logstash-encoder для Logback) — легко парсятся.
- **Уровни**: TRACE/DEBUG (диагностика), INFO (важные события), WARN (потенциальная проблема), ERROR (ошибка).
- **MDC (Mapped Diagnostic Context)** — добавляет контекст (traceId, userId) в каждую запись.
- Не логировать PII, секреты.
- ELK / OpenSearch / Loki + Grafana.

### Traces (distributed tracing)
- Каждый запрос имеет **trace ID** + дерево **span'ов**.
- **OpenTelemetry** — стандарт.
- В Spring Boot 3 — Micrometer Tracing (Brave / OTel).
- Trace ID пробрасывается в HTTP/Kafka headers (`traceparent`).

## 11.6 Feature flags

- LaunchDarkly / Unleash / Flipt / самописные.
- Переключение фич без redeploy, A/B-тесты, canary.
- Тех.долг: убирать флаги после стабилизации.

## 11.7 Конфигурация и секреты

- **ConfigMap** — нешифрованная конфигурация.
- **Secret** — base64 (НЕ шифрование, просто кодирование).
- **Sealed Secrets** (Bitnami) — зашифрованные секреты в Git, расшифровка контроллером.
- **External Secrets Operator** — синхронизация из Vault / AWS Secrets Manager / Azure KV.

## 11.8 Безопасность контейнеров (basics)

- Сканировать образы (Trivy, Snyk, Grype).
- Минимальные образы (distroless).
- Read-only filesystem (`securityContext.readOnlyRootFilesystem`).
- Без privileged-режима.
- Pod Security Standards (Restricted).
- NetworkPolicy для ограничения трафика.

## 11.9 Часто спрашивают

- Maven scopes: чем `provided` отличается от `runtime`?
- Что такое BOM?
- Multi-stage build — зачем?
- Чем distroless лучше alpine?
- Liveness vs readiness vs startup probe.
- Что такое HPA?
- Как настроить graceful shutdown в Spring Boot?
- Как правильно задать heap для контейнера?
- Что такое 12-factor app? (codebase, deps, config, backing services, build/release/run, processes, port binding, concurrency, disposability, dev/prod parity, logs, admin processes).
- Чем отличается Continuous Delivery от Continuous Deployment?
- Как ты следишь за приложением в проде? (Метрики, логи, трейсинг.)


---

# Дополнительные темы DevOps (продолжение)

## 11.10 Maven — полный pom.xml

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>

    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.3.0</version>
    </parent>

    <groupId>com.example</groupId>
    <artifactId>orders</artifactId>
    <version>1.0.0-SNAPSHOT</version>

    <properties>
        <java.version>21</java.version>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    </properties>

    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-data-jpa</artifactId>
        </dependency>
        <dependency>
            <groupId>org.postgresql</groupId>
            <artifactId>postgresql</artifactId>
            <scope>runtime</scope>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>org.testcontainers</groupId>
            <artifactId>postgresql</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
            </plugin>
        </plugins>
    </build>
</project>
```

### Dependency scopes

| Scope | Compile | Runtime | Test | Транзитивно? |
|---|---|---|---|---|
| `compile` (default) | ✅ | ✅ | ✅ | да |
| `provided` | ✅ | ❌ (есть извне) | ✅ | нет |
| `runtime` | ❌ | ✅ | ✅ | да |
| `test` | ❌ | ❌ | ✅ | нет |
| `system` | ✅ | ✅ | ✅ | нет (антипаттерн) |
| `import` | только в `dependencyManagement` для BOM |

Примеры:
- JDBC-драйвер — `runtime` (нужен в проде, не для компиляции).
- Servlet API в war под Tomcat — `provided` (Tomcat сам предоставит).
- JUnit, Mockito — `test`.

### Lifecycle (default)

```
validate → initialize → generate-sources → process-sources → generate-resources → process-resources →
compile → process-classes → generate-test-sources → process-test-sources → generate-test-resources →
process-test-resources → test-compile → process-test-classes → test → prepare-package → package →
pre-integration-test → integration-test → post-integration-test → verify → install → deploy
```

`mvn package` выполнит ВСЕ предыдущие фазы тоже.

Другие lifecycles: `clean` (`pre-clean → clean → post-clean`), `site`.

### BOM — Bill of Materials

```xml
<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-dependencies</artifactId>
            <version>3.3.0</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
    </dependencies>
</dependencyManagement>
```

После этого все зависимости из BOM можно подключать без указания версии. Это **версионная единость** — все Spring-модули одной согласованной версии.

### Полезные команды

```bash
mvn clean install
mvn -DskipTests package
mvn dependency:tree                  # все транзитивные зависимости
mvn dependency:tree -Dincludes=com.fasterxml*
mvn dependency:analyze               # неиспользуемые / отсутствующие
mvn versions:display-dependency-updates
mvn -X clean install                 # debug log
mvn help:effective-pom               # с учётом parent и profiles
```

### Профили

```xml
<profiles>
    <profile>
        <id>prod</id>
        <activation>
            <property><name>env</name><value>prod</value></property>
        </activation>
        <properties>
            <db.url>jdbc:postgresql://prod-db:5432/orders</db.url>
        </properties>
    </profile>
</profiles>
```

`mvn -Penv=prod package`.

## 11.11 Gradle — кратко

```kotlin
plugins {
    id("org.springframework.boot") version "3.3.0"
    id("io.spring.dependency-management") version "1.1.4"
    java
}

group = "com.example"
version = "1.0.0-SNAPSHOT"
java { toolchain { languageVersion.set(JavaLanguageVersion.of(21)) } }

repositories { mavenCentral() }

dependencies {
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    runtimeOnly  ("org.postgresql:postgresql")
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.testcontainers:postgresql")
}

tasks.withType<Test> { useJUnitPlatform() }
```

### Configurations

- `implementation` — нужно для компиляции и runtime, не "просачивается" в потребителей этого модуля.
- `api` — то же, но "просачивается" (используй редко, только если тип реально часть API).
- `compileOnly` — только для компиляции (как Maven `provided`).
- `runtimeOnly` — только в runtime (JDBC-драйвер).
- `testImplementation`, `testRuntimeOnly`.
- `annotationProcessor` — для аннотаций (Lombok, MapStruct).

### Преимущества Gradle
- Incremental build, build cache.
- Daemon (горячий процесс).
- Гибкий DSL.
- Composite builds, version catalogs (`gradle/libs.versions.toml`).

## 11.12 Docker — полный production Dockerfile

```dockerfile
# syntax=docker/dockerfile:1.7

# ================ build stage ================
FROM eclipse-temurin:21-jdk AS build
WORKDIR /workspace

# 1. Сначала только pom.xml (для кэша зависимостей)
COPY pom.xml mvnw ./
COPY .mvn .mvn
RUN --mount=type=cache,target=/root/.m2 ./mvnw -B dependency:go-offline

# 2. Потом исходники
COPY src src
RUN --mount=type=cache,target=/root/.m2 ./mvnw -B -DskipTests package

# Опционально: разложить layered jar для оптимизации Docker-слоёв
RUN java -Djarmode=layertools -jar target/*.jar extract --destination target/extracted

# ================ runtime stage ================
FROM eclipse-temurin:21-jre AS runtime
WORKDIR /app

# Non-root user
RUN groupadd -r app && useradd -r -g app -u 1000 app

# Скопировать слои отдельно — кэшируются
COPY --from=build /workspace/target/extracted/dependencies/ ./
COPY --from=build /workspace/target/extracted/spring-boot-loader/ ./
COPY --from=build /workspace/target/extracted/snapshot-dependencies/ ./
COPY --from=build /workspace/target/extracted/application/ ./

USER app
EXPOSE 8080

# tini как PID 1 (правильная обработка сигналов)
HEALTHCHECK --interval=30s --timeout=3s CMD curl -f http://localhost:8080/actuator/health/liveness || exit 1

ENTRYPOINT ["java", \
    "-XX:MaxRAMPercentage=75", \
    "-XX:+ExitOnOutOfMemoryError", \
    "-XX:+HeapDumpOnOutOfMemoryError", \
    "-XX:HeapDumpPath=/tmp/heap.hprof", \
    "org.springframework.boot.loader.launch.JarLauncher"]
```

### Best practices
- **Multi-stage build** — финальный образ маленький.
- **Non-root user** — обязательно для k8s pod-security.
- **`.dockerignore`** — исключить `target/`, `.git`, `node_modules`.
- **Layered jar** — зависимости меняются редко → отдельный слой.
- **Distroless** для ещё большей минимализации:
  ```dockerfile
  FROM gcr.io/distroless/java21-debian12 AS runtime
  ```
  Без shell, без curl — сложнее эксплуатировать.
- **Не клади секреты** в Dockerfile / image.
- **Не запускай как root**.
- **Health check** для k8s не обязателен (там probes), но полезен для docker-compose.

### `.dockerignore`

```
.git
.idea
target
build
node_modules
*.log
.env
.DS_Store
```

## 11.13 Альтернативы Dockerfile

### Buildpacks (Paketo)

```bash
./mvnw spring-boot:build-image -Dspring-boot.build-image.imageName=app:1.0
```

Buildpacks автоматически:
- Выбирают подходящий JRE.
- Создают многослойный образ.
- Применяют security best practices.
- Поддерживают memory calculator.

### Jib (Google)

```xml
<plugin>
    <groupId>com.google.cloud.tools</groupId>
    <artifactId>jib-maven-plugin</artifactId>
    <configuration>
        <to><image>registry/app:1.0</image></to>
        <container>
            <user>1000</user>
            <jvmFlags>
                <jvmFlag>-XX:MaxRAMPercentage=75</jvmFlag>
            </jvmFlags>
        </container>
    </configuration>
</plugin>
```

`mvn jib:build` — собирает образ без Docker daemon, пушит сразу в registry.

## 11.14 Kubernetes — полный пример Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: orders
  labels: {app: orders}
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate: {maxSurge: 1, maxUnavailable: 0}
  selector:
    matchLabels: {app: orders}
  template:
    metadata:
      labels: {app: orders}
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/path: "/actuator/prometheus"
        prometheus.io/port: "8080"
    spec:
      serviceAccountName: orders
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000
      terminationGracePeriodSeconds: 60
      containers:
      - name: orders
        image: registry/orders:1.0
        ports: [{containerPort: 8080, name: http}]
        env:
        - name: SPRING_PROFILES_ACTIVE
          value: prod
        - name: SPRING_DATASOURCE_PASSWORD
          valueFrom:
            secretKeyRef: {name: orders-db, key: password}
        envFrom:
        - configMapRef: {name: orders-config}
        resources:
          requests: {cpu: 500m, memory: 512Mi}
          limits:   {cpu: "1",  memory: 1Gi}
        livenessProbe:
          httpGet: {path: /actuator/health/liveness,  port: http}
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet: {path: /actuator/health/readiness, port: http}
          initialDelaySeconds: 10
          periodSeconds: 5
        startupProbe:
          httpGet: {path: /actuator/health/liveness,  port: http}
          failureThreshold: 30
          periodSeconds: 5
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities: {drop: ["ALL"]}
        volumeMounts:
        - {name: tmp, mountPath: /tmp}
      volumes:
      - {name: tmp, emptyDir: {}}
---
apiVersion: v1
kind: Service
metadata: {name: orders}
spec:
  selector: {app: orders}
  ports: [{port: 80, targetPort: 8080, name: http}]
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: orders
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt
spec:
  tls: [{hosts: [api.example.com], secretName: orders-tls}]
  rules:
  - host: api.example.com
    http:
      paths:
      - {path: /api/orders, pathType: Prefix, backend: {service: {name: orders, port: {number: 80}}}}
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata: {name: orders}
spec:
  scaleTargetRef: {apiVersion: apps/v1, kind: Deployment, name: orders}
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource: {name: cpu,    target: {type: Utilization, averageUtilization: 70}}
  - type: Resource
    resource: {name: memory, target: {type: Utilization, averageUtilization: 80}}
```

### Ключевые объекты

| Объект | Что |
|---|---|
| Pod | минимальная единица; обычно 1 контейнер |
| ReplicaSet | поддерживает N подов |
| Deployment | управляет ReplicaSet, rolling update |
| StatefulSet | для stateful (БД, Kafka): стабильные имена, упорядоченный запуск |
| DaemonSet | по 1 поду на ноду (логи, мониторинг) |
| Job/CronJob | разовая/по расписанию |
| Service | стабильный endpoint (ClusterIP/NodePort/LoadBalancer) |
| Ingress | L7 routing |
| ConfigMap/Secret | конфигурация/секреты |
| PVC/PV | storage |
| HPA/VPA | автоскейл |
| NetworkPolicy | firewall |

### Probes

- **livenessProbe** — жив ли pod; провал → рестарт.
- **readinessProbe** — готов принимать трафик; провал → исключается из Service (но не рестартится).
- **startupProbe** — для медленно стартующих, отключает остальные probes до успеха.

### Graceful shutdown — что важно

При scale down / rolling update:
1. Pod удаляется из Service endpoints.
2. SIGTERM → контейнер.
3. Spring Boot (с `server.shutdown=graceful`) останавливает приём новых запросов, ждёт завершения текущих.
4. После `terminationGracePeriodSeconds` → SIGKILL.

```yaml
# Spring Boot
server:
  shutdown: graceful
spring.lifecycle.timeout-per-shutdown-phase: 30s
```

### Resource requests/limits — практика

- **requests** — минимум, который pod гарантированно получит. Используется для scheduling.
- **limits** — максимум. Превысил memory → OOM-killed.
- Если только limits без requests — k8s выставит requests = limits.
- **CPU throttling** — превысил CPU limit → throttled (не убит).
- **Quality of Service classes:** Guaranteed (req=lim), Burstable (req < lim), BestEffort (нет req/lim) — порядок eviction.

## 11.15 Helm — basics

```
chart/
├── Chart.yaml
├── values.yaml
├── templates/
│   ├── deployment.yaml
│   ├── service.yaml
│   └── ingress.yaml
```

```yaml
# values.yaml
image:
  repository: registry/orders
  tag: 1.0
replicas: 3
resources:
  limits: {cpu: "1", memory: "1Gi"}
```

```yaml
# templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
spec:
  replicas: {{ .Values.replicas }}
  template:
    spec:
      containers:
      - name: app
        image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
        resources: {{- toYaml .Values.resources | nindent 12 }}
```

```bash
helm install orders ./chart -n prod -f values-prod.yaml
helm upgrade orders ./chart --reuse-values --set image.tag=1.1
helm rollback orders 1
```

## 11.16 GitOps — Flux/Argo CD

Принципы:
1. **Желаемое состояние в Git** (manifests, helm values).
2. **Контроллер в кластере** периодически опрашивает Git и применяет изменения.
3. Изменение = PR в Git, не `kubectl apply` руками.

Преимущества:
- Audit trail (Git history).
- Reproducibility.
- Pull > push (безопаснее, кластер не открыт во внешний мир).
- Disaster recovery (rebuild кластера из Git).

В этом репо как раз используется **Flux v2**.

## 11.17 CI/CD pipeline — пример GitHub Actions

```yaml
name: CI

on:
  push: {branches: [main]}
  pull_request: {branches: [main]}

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-java@v4
      with: {java-version: '21', distribution: 'temurin', cache: 'maven'}
    
    - name: Compile
      run: mvn -B compile
    
    - name: Unit tests
      run: mvn -B test
    
    - name: Integration tests
      run: mvn -B verify -Pintegration
    
    - name: SonarCloud
      run: mvn sonar:sonar -Dsonar.projectKey=...
      env: {SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}}
    
    - name: Build image
      if: github.ref == 'refs/heads/main'
      run: |
        docker build -t registry/app:${{ github.sha }} .
        docker push registry/app:${{ github.sha }}
    
    - name: Update GitOps repo
      if: github.ref == 'refs/heads/main'
      run: |
        # обновить tag в манифесте, commit + push в gitops-repo
```

## 11.18 Observability — три кита, детально

### Metrics (Prometheus + Micrometer)

```java
@Component @RequiredArgsConstructor
class OrderMetrics {
    private final MeterRegistry registry;

    private Counter ordersCreated;
    private Timer   orderProcessing;
    private Gauge   queueSize;

    @PostConstruct
    void init() {
        ordersCreated = Counter.builder("orders.created.total")
            .description("Number of orders created")
            .tag("service", "orders")
            .register(registry);

        orderProcessing = Timer.builder("orders.processing.duration")
            .publishPercentileHistogram()
            .register(registry);
    }
}
```

**Типы метрик:**
- **Counter** — только растёт (`http_requests_total`).
- **Gauge** — может в любую сторону (`heap_used_bytes`, `queue_size`).
- **Histogram** — распределение (`http_request_duration_seconds_bucket`).
- **Summary** — квантили на стороне клиента.

**Labels** — измерения. Пример: `http_requests_total{method="GET", status="200", endpoint="/api/orders"}`.

⚠️ **High-cardinality labels — катастрофа.** Не клади `user_id`, `order_id` в labels — таймсерия станет миллионы рядов и убьёт Prometheus.

**4 Golden Signals (Google SRE):**
1. **Latency** — длительность запросов.
2. **Traffic** — RPS.
3. **Errors** — % ошибок.
4. **Saturation** — насколько ресурсы загружены.

### Logging — структурные JSON

```yaml
# logback-spring.xml через logstash-encoder
<dependency>
    <groupId>net.logstash.logback</groupId>
    <artifactId>logstash-logback-encoder</artifactId>
</dependency>
```

```json
{
  "@timestamp": "2025-04-23T10:15:30.123Z",
  "level": "INFO",
  "logger": "com.x.OrderService",
  "thread": "http-nio-8080-exec-1",
  "traceId": "abc123",
  "spanId": "def456",
  "userId": "user-42",
  "message": "Order created",
  "orderId": "ord-1"
}
```

**MDC (Mapped Diagnostic Context)** — добавляет контекст в каждую log line:
```java
try (var ignored = MDC.putCloseable("userId", userId)) {
    log.info("processing");
}
```

В Spring Boot c Micrometer Tracing — `traceId`/`spanId` автоматически в MDC.

**Уровни:**
- TRACE — самая подробная, отключена в проде.
- DEBUG — диагностика, включается на время.
- INFO — важные события (старт, остановка, бизнес-эвенты).
- WARN — потенциальная проблема, но всё работает.
- ERROR — ошибка, требующая внимания.

### Tracing — distributed

```
Client → Gateway → Service A → Service B → DB
                              ↘ Cache
                              ↘ Service C
```

Каждый запрос = **trace** с tree из **span**'ов:
- `traceId` — общий для всего запроса.
- `spanId` — уникальный для каждой операции.
- `parentSpanId` — кто вызвал.

Header **`traceparent`** (W3C Trace Context) пробрасывается между сервисами:
```
traceparent: 00-{trace-id-32hex}-{span-id-16hex}-{flags-2hex}
```

**OpenTelemetry** — стандарт. Spring Boot 3 + Micrometer Tracing → автоинструментация HTTP, JDBC, Kafka.

```yaml
management:
  tracing:
    sampling:
      probability: 0.1               # 10% запросов
  zipkin:
    tracing:
      endpoint: http://zipkin:9411/api/v2/spans
```

## 11.19 12-factor app — quick check

1. **Codebase** — один codebase в Git, много deployments.
2. **Dependencies** — явное объявление (Maven/Gradle).
3. **Config** — в окружении, не в коде.
4. **Backing services** — БД/Kafka — attached resources.
5. **Build, release, run** — стадии разделены.
6. **Processes** — stateless.
7. **Port binding** — самодостаточный (Tomcat внутри Spring Boot).
8. **Concurrency** — масштаб через процессы.
9. **Disposability** — быстрый старт, graceful shutdown.
10. **Dev/prod parity** — окружения близки (Docker, Testcontainers).
11. **Logs** — stream в stdout, не в файлы.
12. **Admin processes** — миграции БД и т.д. — отдельные процессы.

## 11.20 Security базы

### Сканирование образов

```bash
trivy image registry/app:1.0
grype  registry/app:1.0
```

Включи в pipeline.

### Secrets management
- **Vault** (HashiCorp) — централизованный, с rotation.
- **Sealed Secrets** (этот репо) — зашифрованные secrets в Git, кластерный controller расшифровывает.
- **External Secrets Operator** — синхронизация из Vault/AWS SM/Azure KV.

### Pod Security Standards (k8s)
- **Restricted** — по умолчанию для prod: non-root, no privilege escalation, drop all caps, read-only root fs.

## 11.21 Дополнительные частые вопросы

- Maven scopes: чем `provided` от `runtime` отличается?
- Что такое BOM?
- Зачем multi-stage Docker build?
- Чем distroless лучше alpine?
- Liveness vs readiness vs startup probe.
- Что такое HPA?
- Как настроить graceful shutdown в Spring Boot?
- Как правильно задать heap для контейнера? (`MaxRAMPercentage`.)
- Чем Continuous Delivery от Continuous Deployment отличается?
- Что такое 12-factor app?
- Как организован GitOps? (Flux/Argo, push vs pull.)
- Что такое blue/green vs canary deployment?
- Как мониторить Java-приложение в проде? (метрики/логи/трейсы — три кита.)
- Чем Counter от Gauge отличается? Когда Histogram?
- Что такое cardinality в метриках? Почему high cardinality плохо?
- Что такое `traceparent` header?
- Что такое MDC и зачем?
- Как организовать секреты в k8s? (Sealed Secrets, External Secrets, Vault.)
- Что такое Quality of Service в k8s? (Guaranteed/Burstable/BestEffort.)
- Что произойдёт при OOMKilled?
- Что такое CPU throttling в k8s?
- Чем StatefulSet от Deployment отличается?
- Чем DaemonSet от Deployment отличается?
- Что такое Service mesh? (Istio, Linkerd — sidecar proxy для observability/security/traffic.)
- Чем `kubectl apply` от `kubectl create` отличается?
- Как настроить rolling update с zero downtime?

