# Scholar Sync — GraphQL API

**Por: Santiago Zapata Rodriguez**

Migración de una API REST a **GraphQL** usando **NestJS + TypeScript + TypeORM + PostgreSQL**.

El proyecto toma el backend existente de Scholar Sync y lo traduce a GraphQL, manteniendo toda la lógica de negocio original pero aprovechando las ventajas de GraphQL: consultas flexibles, un único endpoint, y tipado fuerte del schema.

---

## Tabla de contenidos

- [Descripción general](#descripción-general)
- [Tecnologías](#tecnologías)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Lógica de la aplicación](#lógica-de-la-aplicación)
- [Roles y permisos](#roles-y-permisos)
- [Configuración y ejecución](#configuración-y-ejecución)
- [Seed de datos](#seed-de-datos)
- [Cómo usar el Playground](#cómo-usar-el-playground)
- [Operaciones disponibles](#operaciones-disponibles)
- [Pruebas](#pruebas)
- [Elementos no desarrollados](#elementos-no-desarrollados)

---

## Descripción general

La API gestiona tres módulos conectados entre sí:

| Módulo | Entidad | Descripción |
|--------|---------|-------------|
| **Auth** | `AuthResponse` | Registro y login de usuarios con JWT |
| **Módulo 1** | `Course` | CRUD completo de cursos académicos |
| **Módulo 2** | `UserCourse` | Inscripciones (enrollments) de usuarios en cursos |

La relación entre módulos es la siguiente: un `User` puede estar inscrito en muchos `Course`, y un `Course` puede tener muchos `User` inscritos. Esta relación se gestiona a través de la entidad `UserCourse`, que además almacena el tipo de relación (`student`, `ta`, `professor`) y la fecha de inscripción.

---

## Tecnologías

| Tecnología | Versión | Uso |
|-----------|---------|-----|
| NestJS | 11 | Framework principal |
| @nestjs/graphql | 13 | Integración GraphQL (code-first) |
| @apollo/server | 4 | Servidor Apollo |
| TypeORM | 0.3 | ORM para PostgreSQL |
| PostgreSQL | 16 | Base de datos |
| Passport + JWT | — | Autenticación y autorización |
| class-validator | 0.15 | Validación de inputs |
| bcryptjs | 2.4 | Hash de contraseñas |
| Supertest + Jest | — | Pruebas E2E |

---

## Estructura del proyecto

```
src/
├── app.module.ts           # Módulo raíz — registra todos los módulos
├── main.ts                 # Punto de entrada — arranca el servidor en :9000
│
├── users/                  # Módulo de usuarios y autenticación
│   ├── decorators/
│   │   ├── auth.decorator.ts          # @Auth() — combina JWT + roles en uno
│   │   ├── current-user.decorator.ts  # @CurrentUser() — extrae user del contexto GQL
│   │   └── role-protected.decorator.ts# @RoleProtected() — guarda roles en metadatos
│   ├── dto/
│   │   ├── signup.input.ts            # Input para registro
│   │   ├── login.input.ts             # Input para login
│   │   └── update-user.input.ts       # Input para actualizar usuario
│   ├── entities/
│   │   └── user.entity.ts             # Entidad User + enum ValidRoles
│   ├── guards/
│   │   ├── graph-auth/
│   │   │   └── graphql-auth.guard.ts  # Adapta AuthGuard de Passport para GraphQL
│   │   └── user-role/
│   │       └── user-role.guard.ts     # Valida roles requeridos
│   ├── interfaces/
│   │   └── jwt-payload.interface.ts   # Forma del payload del token
│   ├── strategies/
│   │   └── jwt.strategy.ts            # Estrategia Passport para verificar JWT
│   ├── types/
│   │   └── auth-response.type.ts      # Tipo GQL { user, token }
│   ├── users.module.ts
│   ├── users.resolver.ts              # Queries y mutations de usuarios
│   └── users.service.ts               # Lógica de negocio de usuarios
│
├── courses/                # Módulo 1 — cursos
│   ├── dto/
│   │   ├── create-course.input.ts
│   │   ├── update-course.input.ts
│   │   └── enroll-user.input.ts       # Input para inscripción (Módulo 2)
│   ├── entities/
│   │   ├── course.entity.ts           # Entidad Course
│   │   └── user-course.entity.ts      # Entidad UserCourse (join table)
│   ├── courses.module.ts
│   ├── courses.resolver.ts            # Queries y mutations de cursos e inscripciones
│   └── courses.service.ts             # Lógica de negocio
│
├── seed/                   # Módulo de datos de prueba
│   ├── seed.service.ts                # Lógica del seed
│   ├── seed.resolver.ts               # Mutation executeSeed
│   └── seed.module.ts
│
test/
├── auth.e2e-spec.ts        # Pruebas E2E de autenticación
├── users.e2e-spec.ts       # Pruebas E2E de usuarios
├── courses.e2e-spec.ts     # Pruebas E2E de cursos e inscripciones
└── gql-helper.ts           # Helper para construir requests GraphQL
```

---

## Lógica de la aplicación

### Autenticación

El flujo de autenticación funciona así:

1. El usuario llama a `signup` con email, contraseña y nombre → se crea con rol `student` y se retorna un token JWT.
2. Para operaciones protegidas, el token se envía en el header `Authorization: Bearer <token>`.
3. El `GraphQlAuthGuard` intercepta la request, extrae el token del header y lo valida con `JwtStrategy`.
4. `JwtStrategy` decodifica el token, busca el usuario en BD y lo adjunta al contexto de la request.
5. El `UserRoleGuard` revisa si el usuario tiene los roles requeridos por el endpoint.
6. El decorator `@CurrentUser()` extrae el usuario ya validado del contexto para usarlo dentro del resolver.

La diferencia clave con REST es que en GraphQL hay un solo endpoint (`POST /graphql`), así que los guards no protegen rutas sino **resolvers** individuales.

### Gestión de Cursos (Módulo 1)

Los cursos son la entidad principal. Un admin puede crear, modificar y desactivar cursos. Cualquier usuario autenticado puede consultar el listado y el detalle de un curso (incluyendo quiénes están inscritos).

El borrado es **soft-delete**: en lugar de eliminar el registro, se cambia `isActive` a `false`. Esto preserva el historial de inscripciones.

### Inscripciones (Módulo 2)

La entidad `UserCourse` es la tabla de unión entre `User` y `Course`. Además de la relación, almacena:

- `relationType`: el rol dentro del curso (`student`, `ta`, `professor`)
- `enrolledAt`: fecha de inscripción (se asigna automáticamente)

Un student solo puede inscribirse a sí mismo. Un admin puede inscribir a cualquier usuario y asignarle cualquier tipo de relación (por ejemplo, inscribir a alguien como `ta`).

---

## Roles y permisos

| Operación | `student` | `admin` |
|-----------|-----------|---------|
| signup / login | ✅ | ✅ |
| Ver su propio perfil (`me`) | ✅ | ✅ |
| Ver perfil de otro usuario | ✅ | ✅ |
| Listar todos los usuarios | ❌ | ✅ |
| Actualizar su propio perfil | ✅ | ✅ |
| Actualizar perfil de otro | ❌ | ✅ |
| Desactivar usuario | ❌ | ✅ |
| Listar / ver cursos | ✅ | ✅ |
| Crear curso | ❌ | ✅ |
| Actualizar curso | ❌ | ✅ |
| Desactivar curso | ❌ | ✅ |
| Inscribirse a sí mismo | ✅ | ✅ |
| Inscribir a otro usuario | ❌ | ✅ |
| Ver sus inscripciones | ✅ | ✅ |
| Ver inscripciones de otro | ❌ | ✅ |
| Cancelar su inscripción | ✅ | ✅ |
| Cancelar inscripción ajena | ❌ | ✅ |

---

## Configuración y ejecución

### Requisitos

- Node.js >= 18
- PostgreSQL instalado y corriendo localmente

### 1. Instalar dependencias

```bash
npm install
```

### 2. Crear el archivo `.env`

Crear un archivo `.env` en la raíz del proyecto:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=TU_CONTRASEÑA
DB_NAME=scholar_sync_graphql
JWT_SECRET=supersecretkey
JWT_EXPIRES_IN=1h
```

### 3. Crear la base de datos

En SQL Shell (psql) o pgAdmin:

```sql
CREATE DATABASE scholar_sync_graphql;
```

### 4. Ejecutar el servidor

```bash
# Desarrollo (con hot reload)
npm run start:dev

# Producción
npm run build
npm run start:prod
```

El servidor arranca en `http://localhost:9000/graphql`.

Con `synchronize: true` activo, TypeORM crea las tablas automáticamente al arrancar.

---

## Seed de datos

El seed borra todos los datos existentes y recrea un conjunto de prueba limpio. Se ejecuta desde el Playground con:

```graphql
mutation {
  executeSeed
}
```

Crea los siguientes datos:

**Usuarios:**

| Email | Contraseña | Rol |
|-------|-----------|-----|
| admin@scholar.com | Admin123 | admin |
| student1@scholar.com | Student123 | student |
| student2@scholar.com | Student123 | student |

**Cursos:**
- Computación en Internet III (3 créditos)
- Bases de Datos Avanzadas (4 créditos)
- Arquitectura de Software (3 créditos)

> ⚠️ El seed elimina todos los datos antes de insertar. Solo usar en desarrollo.

---

## Cómo usar el Playground

Abrir `http://localhost:9000/graphql` en el navegador. Se abre Apollo Sandbox con tres paneles:

**Panel izquierdo** — donde se escribe la query o mutation.
**Panel derecho** — donde aparece la respuesta JSON.
**HTTP Headers (abajo)** — donde se pega el token para rutas protegidas.

Para rutas que requieren autenticación, primero hacer login, copiar el token de la respuesta y en HTTP Headers escribir:

```json
{
  "Authorization": "Bearer PEGAR_EL_TOKEN_AQUI"
}
```

El tab **SCHEMA** (derecha) muestra todos los tipos, queries y mutations disponibles con su documentación.

---

## Operaciones disponibles

### Auth — rutas públicas

```graphql
# Registrar usuario nuevo
mutation {
  signup(signUpInput: {
    email: "user@example.com"
    password: "Password123"
    firstName: "Juan"
    lastName: "Pérez"
  }) {
    token
    user { id email roles }
  }
}

# Iniciar sesión
mutation {
  login(loginInput: {
    email: "admin@scholar.com"
    password: "Admin123"
  }) {
    token
    user { id email roles }
  }
}
```

### Usuarios — requieren token

```graphql
# Perfil propio
query { me { id email firstName lastName roles isActive } }

# Listar todos (solo admin)
query { users { id email roles isActive } }

# Buscar por id
query { user(id: "uuid") { id email firstName lastName } }

# Actualizar (propio o cualquiera si admin)
mutation {
  updateUser(updateUserInput: {
    id: "uuid"
    firstName: "NuevoNombre"
  }) { id firstName lastName }
}

# Desactivar usuario (solo admin)
mutation { removeUser(id: "uuid") { id isActive } }
```

### Cursos — Módulo 1

```graphql
# Listar cursos activos
query {
  courses {
    id name credits description isActive startDate
    enrollments { id relationType user { email } }
  }
}

# Buscar por id
query {
  course(id: "uuid") {
    id name credits enrollments { relationType user { email } }
  }
}

# Crear (solo admin)
mutation {
  createCourse(createCourseInput: {
    name: "Nuevo Curso"
    credits: 3
    description: "Descripción del curso"
    startDate: "2026-08-01"
  }) { id name credits }
}

# Actualizar (solo admin)
mutation {
  updateCourse(updateCourseInput: {
    id: "uuid"
    name: "Nombre Actualizado"
    credits: 4
  }) { id name credits }
}

# Desactivar (solo admin)
mutation { removeCourse(id: "uuid") { id isActive } }
```

### Inscripciones — Módulo 2

```graphql
# Inscribirse a sí mismo (student)
mutation {
  enrollUser(enrollUserInput: { courseId: "uuid" }) {
    id relationType enrolledAt
    course { name }
    user { email }
  }
}

# Admin inscribe a otro usuario con rol ta
mutation {
  enrollUser(enrollUserInput: {
    courseId: "uuid"
    userId: "uuid-del-usuario"
    relationType: ta
  }) { id relationType user { email } }
}

# Ver mis inscripciones
query {
  myEnrollments {
    id relationType enrolledAt
    course { id name credits }
  }
}

# Admin ve inscripciones de otro usuario
query {
  myEnrollments(userId: "uuid") {
    id relationType course { name }
  }
}

# Cancelar inscripción
mutation { unenroll(enrollmentId: "uuid") { id } }
```

---

## Pruebas

El proyecto incluye pruebas E2E con Supertest que cubren los flujos principales. Requieren que la base de datos esté corriendo.

```bash
# Ejecutar todos los tests E2E
npm run test:e2e

# Ejecutar un archivo específico
npx jest --config test/jest-e2e.json test/auth.e2e-spec.ts
npx jest --config test/jest-e2e.json test/users.e2e-spec.ts
npx jest --config test/jest-e2e.json test/courses.e2e-spec.ts
```

Cobertura de pruebas:

- `auth.e2e-spec.ts` — signup exitoso, email duplicado, validación de email inválido, login correcto, credenciales incorrectas.
- `users.e2e-spec.ts` — perfil propio, listado solo admin, actualizar propio vs ajeno, soft-delete de usuario.
- `courses.e2e-spec.ts` — CRUD completo de cursos, inscripción, conflicto de inscripción duplicada, cancelación, errores de autorización.

---

## Elementos no desarrollados

- **Despliegue en nube**: el proyecto está preparado para Railway o Render usando la variable `DATABASE_URL`, pero el despliegue efectivo no se realizó por configuración de entorno de producción.
- **Refresh tokens**: se implementó solo el token de acceso. En producción lo ideal sería agregar un flujo de refresh token para no requerir login frecuente.
- **GraphQL Subscriptions**: no se implementaron suscripciones en tiempo real ya que el taller no las requiere.
- **Seed protegido por entorno**: actualmente el seed es accesible desde el Playground sin restricción. En una versión de producción debería deshabilitarse o protegerse con un guard de entorno.