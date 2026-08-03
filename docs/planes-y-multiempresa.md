# Planes de timbrado y multi-empresa

Reglas comerciales de GDM Facturación y cómo se sostienen en el sistema. Lo que
aquí se dice tiene que coincidir con tres lugares a la vez, y cuando cambie hay
que cambiarlo en los tres:

| Dónde | Archivo |
|---|---|
| Página pública | `frontend/src/pages/PublicHome.tsx` (constante `PLANS`) |
| Contrato | `backend/src/modules/contracts/contract-text.ts` |
| Alta de paquetes | `frontend/src/pages/AdminPackages.tsx` |

## Los cuatro planes

| Plan | Clave | Renta mensual | Timbres incluidos | Timbre extra |
|---|---|---|---|---|
| Esencial | `PKG_100` | $399 | 100 / mes | $2.50 |
| Pyme | `PKG_200` | $699 | 200 / mes | $2.25 |
| Empresarial | `PKG_500` | **$1,800** | 500 / mes | $2.00 |
| Uso libre | `PKG_FLEX` | sin renta | — | $4.99 |

Todos los precios son **más IVA**.

## Los timbres no se acumulan

Es la regla que más se malinterpreta de un plan mensual, así que quedó escrita en
tres lugares: en la tarjeta del plan, junto al número; en la respuesta del FAQ; y
en la cláusula 2.5 del contrato.

- El periodo corre del **día 1 al último día natural** del mes calendario.
- Al iniciar el mes, el contador **se reinicia al volumen contratado**, sin
  importar cuántos timbres se consumieron el mes anterior.
- Lo no consumido **se pierde**. No genera saldo a favor, crédito, descuento ni
  derecho a reembolso.
- Ejemplo: con un plan de 100 timbres, si se usaron 80, los 20 restantes no se
  traspasan. El mes siguiente vuelve a empezar con 100.
- Lo que se consume **por encima** del plan se cobra al precio de timbre extra
  de ese plan, en el corte del mes en que se consumió.

El plan **Uso libre** queda fuera de esta regla: no tiene volumen incluido ni
corte mensual de timbres, se paga sólo lo que se timbra.

Que esto esté en el contrato no es un formalismo. Un cliente que descubre en el
corte que perdió timbres que creía suyos tiene una reclamación legítima si nunca
se le dijo — y decirlo sólo en la letra chica es decirlo a medias, por eso
también va en la tarjeta del plan, junto al número que promete.

### Al cambiar de plan a media vigencia

No está implementado un prorrateo de timbres al cambiar de plan dentro del mismo
mes. Hoy el cambio surte efecto en el siguiente corte. Si se decide permitirlo a
mitad de mes, hay que definir antes qué pasa con los timbres ya consumidos del
plan anterior — es una decisión comercial, no técnica, y el contrato tendría que
reflejarla.

## Multi-empresa

Es la característica que distingue al plan **Empresarial**. Permite administrar
varios RFC bajo una misma cuenta.

### Qué se comparte y qué no

**Se comparte** una sola cosa, y es la que suele malentenderse:

- **La bolsa de timbres.** Los 500 timbres son **de la cuenta**, no de cada
  empresa. Tres RFC bajo el mismo plan se reparten los mismos 500 timbres; no
  son 500 por cada uno. Así está dicho en la cláusula 2.6 del contrato.

**Queda separado por empresa**, sin excepción:

- Certificado de sello digital (`.cer` y `.key`), cifrado por empresa
- Serie y folio de los comprobantes
- Clientes, proveedores, productos y mercancías
- Facturas, notas de crédito, complementos de pago
- Catálogos de Carta Porte: lugares, vehículos, operadores, aseguradoras
- Reportes: cada uno se calcula sobre la empresa activa

El aislamiento no es una convención de la interfaz: cada consulta del backend
filtra por `company_id`, y las que tocan datos fiscales lo exigen. Mezclar datos
de dos RFC no sería un error cosmético, sería un problema fiscal.

### ⚠️ Corrección — lo que sigue describe el objetivo, no lo que hay hoy

Un usuario **no puede pertenecer a varias empresas** en la versión actual:
`users.company_id` es una columna, no una tabla puente, y la empresa se graba en
el token al iniciar sesión. No existe el selector de empresa que se describía
aquí. El análisis completo y el plan para implementarlo están en
[multiempresa-analisis.md](multiempresa-analisis.md).

Lo que **sí** es cierto hoy: los datos están separados por empresa sin
excepción, y SUPER_ADMIN administra todas desde el panel de plataforma. Si una
misma persona debe operar dos RFC, se le crean dos accesos con correos
distintos.

### Cómo se configura

1. Entrar como **SUPER_ADMIN** → **Empresas**.
2. **Nueva empresa**, subiendo su Constancia de Situación Fiscal en PDF: de ahí
   salen RFC, razón social, régimen y código postal.
3. Asignarle el plan.
4. Cargar el **CSD propio de ese RFC** desde el perfil de la empresa. No se
   comparte el de otra: el sello es del RFC que emite.
5. Dar de alta a sus usuarios y asignarles su grupo de trabajo.

Cada usuario operativo queda asignado a esa empresa. Un usuario no puede
pertenecer a dos: ver la corrección de arriba.

### Lo que todavía no hay

- **Reportes consolidados** entre empresas. Cada reporte es de una empresa. Un
  consolidado tendría que resolver primero qué hacer con RFC de regímenes
  distintos y con operaciones entre las propias empresas del grupo.
- **Un tablero de consumo de timbres por empresa** dentro de la bolsa común.
  Hoy el consumo se ve por cuenta. Si varias empresas comparten la bolsa, saber
  cuál la está agotando es una petición previsible.

Ninguna de las dos está prometida en la página pública, y no debe prometerse
hasta que exista.
