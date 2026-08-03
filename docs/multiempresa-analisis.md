# Multi-empresa: qué hay hoy, qué no, y qué costaría

Análisis pedido tras detectar que **un usuario no puede tener dos empresas**.
La observación es correcta y contradice lo que yo había descrito antes; esto
corrige aquella descripción.

## Lo que el sistema hace hoy

El aislamiento de datos por empresa **sí existe y es sólido**. Lo que no existe
es que un usuario pertenezca a varias.

```sql
CREATE TABLE users (
  ...
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  ...
);
```

`company_id` es una **columna, no una tabla puente**. Un usuario pertenece a una
empresa y sólo a una. No hay `user_companies` ni nada equivalente.

Y esa pertenencia se congela al iniciar sesión:

| Paso | Qué pasa |
|---|---|
| Login | `auth.service` lee `user.company_id` y lo mete en el JWT |
| Cada petición | `authentication.ts` saca `companyId` del token |
| Cada consulta | los servicios filtran por `req.user.companyId` |

O sea: **la empresa activa es un dato del token, decidido en el login.** No hay
forma de cambiarla sin emitir un token nuevo, y no hay endpoint que lo haga.

### Entonces, ¿es multi-tenant?

Sí, pero en un sentido más limitado del que sugiere la palabra:

- **Multi-tenant en los datos: sí.** Cada consulta filtra por empresa y los
  datos de dos RFC no se mezclan. Esto es lo que de verdad importa desde el
  punto de vista fiscal, y está bien hecho.
- **Multi-empresa por usuario: no.** Un usuario = una empresa.
- **Administración de varias empresas: sí, pero sólo para SUPER_ADMIN**, y
  desde el panel de plataforma (`/admin/companies`), no operando dentro de
  cada una.

### Corrección de lo que dije antes

Escribí que "un mismo usuario puede tener acceso a varias empresas y cambiar
entre ellas desde el selector de empresa, sin volver a iniciar sesión". **Eso no
es cierto y no lo verifiqué antes de escribirlo.** No existe tal selector: no
hay componente que lo dibuje ni endpoint que lo respalde. La descripción venía
de suponer cómo suele resolverse esto, no de leer el código.

Alcanzó a publicarse en la página y en el FAQ, así que se corrigió también ahí.

## La propuesta de la pantalla previa es la correcta

Elegir la empresa **antes** de entrar, y no con un selector dentro del sistema,
es mejor por una razón concreta y no por gusto: **evita la ambigüedad de en qué
empresa se está trabajando.**

Un selector dentro de la aplicación crea un estado que el usuario puede perder
de vista. Timbrar una factura creyendo estar en la empresa A cuando se está en
la B es un error fiscal que no se deshace: hay que cancelar el CFDI y volver a
emitirlo. Una pantalla de entrada obliga a una decisión consciente y deja el
nombre de la empresa visible de ahí en adelante.

Es también el patrón que usan los sistemas contables mexicanos, así que no hay
que enseñárselo a nadie.

## Qué haría falta

Lo bueno: **la parte cara ya está hecha.** Todas las consultas filtran por
`companyId`, así que la capa de datos no se toca. Lo que falta es cómo se
resuelve ese `companyId`.

### 1. Tabla puente

```sql
CREATE TABLE user_companies (
  user_id     UUID NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  work_group  VARCHAR(20),          -- puede diferir por empresa
  is_default  BOOLEAN DEFAULT false,
  PRIMARY KEY (user_id, company_id)
);
```

`work_group` va en la tabla puente, no en `users`, y esto no es un detalle: la
misma persona puede ser de Ventas en una empresa y de Tesorería en otra. Si el
grupo viviera en el usuario, asignarle una segunda empresa le daría en ella
permisos que no le corresponden.

La migración inicial copia lo que ya existe: una fila por cada usuario con su
`company_id` actual, marcada como `is_default`. Nadie pierde acceso.

`users.company_id` se conserva un tiempo como empresa por omisión. Borrarla en
la misma migración obligaría a cambiar todo de golpe; dejarla permite que el
código viejo siga funcionando mientras se migra.

### 2. Login en dos tiempos

| Hoy | Con el cambio |
|---|---|
| Login → token con `companyId` → dashboard | Login → token **sin** `companyId` → pantalla de selección → token **con** `companyId` → dashboard |

Con una sola empresa asignada, la pantalla se salta y entra directo. Es lo que
va a pasarle a todos los clientes actuales, así que para ellos no cambia nada.

### 3. Endpoint de selección

`POST /auth/select-company { companyId }` que valide contra `user_companies`
—no contra lo que mande el navegador— y emita el token definitivo.

**Esta validación es lo único verdaderamente delicado de todo el cambio.** Si el
endpoint aceptara cualquier `companyId` que le llegue, cualquier usuario podría
pedir el de otra empresa y entrar a sus datos fiscales. Debe consultarse la
tabla puente en cada llamada, sin excepción ni atajo por rol.

### 4. Pantalla de selección

Lista de tarjetas con nombre comercial y RFC de cada empresa. Sin buscador
mientras sean pocas.

### 5. La empresa activa, siempre visible

El nombre y el RFC en la barra superior, permanentes. Es la contraparte
necesaria de haber elegido: si se puede trabajar en varias, hay que poder ver en
cuál se está sin buscarlo.

### 6. Cambiar de empresa

Un elemento en el menú de usuario que devuelva a la pantalla de selección. Se
emite un token nuevo — no se "cambia" el actual — y se limpia el estado en
memoria del frontend, para que no queden datos de la empresa anterior en
pantalla.

## Esfuerzo y riesgo

| Parte | Riesgo |
|---|---|
| Migración + tabla puente | Bajo. Sólo agrega |
| Login en dos tiempos | **Medio.** Toca autenticación, que es donde un error deja a todos fuera o deja entrar a quien no debe |
| Endpoint de selección | Medio, por la validación de pertenencia |
| Pantalla + barra superior | Bajo |

Lo que **no** hay que tocar: los servicios, las consultas, los reportes, el
timbrado. Todos reciben `companyId` y les da igual de dónde salió. Por eso el
cambio es acotado a pesar de sonar grande.

## Recomendación

Hacerlo, pero **no ahora**. Primero cerrar el timbrado de complementos de pago y
notas de crédito, que es lo que impide operar. Multi-empresa es una función que
hoy no tiene a nadie esperándola: se necesita cuando aparezca el primer cliente
con dos RFC, y entonces conviene hacerla completa y no a medias.

Mientras tanto, la página ya no promete lo que el sistema no hace.

## Qué decirle hoy a un cliente con varios RFC

Que puede administrar varias empresas desde una cuenta, con los datos separados,
y que **por ahora cada usuario operativo trabaja en una empresa**. Si la misma
persona necesita operar dos, se le crean dos accesos con correos distintos. No
es elegante, pero funciona y es cierto — que es más de lo que se podía decir
antes de este análisis.
