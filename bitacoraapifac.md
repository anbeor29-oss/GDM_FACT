# BITÁCORA — GDM Facturación Móvil (Android)

Histórico de decisiones y avance de la app Android.
Arquitectura: [READMEAPIFAC.md](READMEAPIFAC.md).
Formato: fecha, contexto, decisión, consecuencia.

---

## 2026-07-16 — Definición de alcance y arquitectura

### Contexto
Se pidió exportar GDM Facturación a Android, con una lista de trabajos que
incluía: *crear endpoints /api/v1, separar la lógica fiscal de la interfaz HTML,
incorporar autenticación, implementar permisos, integrar los dos comandos de
timbrado y generar OpenAPI/Swagger*. Más un orden de módulos que terminaba en
*Inventarios* y *Modo punto de venta*.

### Hallazgo: la mayor parte del trabajo pedido ya existía

Contrastado contra el repositorio (no contra la memoria):

| Supuesto de la petición | Realidad verificada |
|---|---|
| Crear endpoints `/api/v1` | **33 routers ya montados** |
| Separar lógica fiscal del HTML | **No hay HTML en el backend**: `res.render`/ejs/pug → 0 coincidencias. Ya es API pura + SPA React |
| Incorporar autenticación | Ya existe (JWT + `authenticateToken`) |
| Implementar permisos | Ya existen (rol + grupo de trabajo) |
| Integrar timbrado | Ya existe (SW Sapien: timbrar + cancelar) |

**La petición asumía un monolito con vistas HTML. No lo es.** El backend ya es
justo lo que un cliente móvil necesita, así que el proyecto cambia de naturaleza:
no es *construir* la API, es **documentarla, endurecerla y empaquetar el
frontend**.

### Hallazgo secundario: un log que miente

El arranque imprime `📚 API Docs: http://localhost:3000/api/docs`, pero **no hay
swagger instalado ni esa ruta existe** (`grep -iE "swagger|openapi"
backend/package.json` → vacío). El mensaje lleva tiempo mintiendo. Por eso
OpenAPI **sí** es trabajo real, y es la Fase 0: sin contrato formal, el cliente
Android se acopla a suposiciones.

### Contradicción resuelta

La lista pedía **Inventarios** y **Modo punto de venta**, pero ese mismo día se
retiraron de GDM_FAC por pertenecer a **GDM_ALMACEN** (ver BITACORA.md,
2026-07-16). Además la petición decía *"solo podrán facturar"*, lo que se
contradecía con su propia lista.

**Resuelto con el usuario: el Android es SOLO facturación.** Inventarios y POS
quedan fuera; si se necesitan en móvil, serán una app del producto ALMACEN.

### Decisiones

| Decisión | Elección | Razón |
|---|---|---|
| Tecnología | **Capacitor 8.4.2** | Reusa el React existente (~90%) y mantiene **una sola base** web+Android. Nativo/RN implicaba reescribir una UI de facturación que ya funciona y sostener dos bases en paralelo |
| Alcance | **Solo facturación** | Respeta la separación GDM_FAC / GDM_ALMACEN |
| Offline | **Caché de lectura** | Catálogos en el dispositivo; **timbrar siempre exige conexión** (PAC y SAT son remotos). Offline-first se descartó por ahora: exige idempotencia, conflictos de folio y facturas rechazadas días después |
| Base de datos | **La misma en Render** | Sin BD local de negocio: cero divergencia entre lo que ve la web y el teléfono |
| Lógica fiscal | **Solo en el backend** | El APK es UI + caché. Duplicar el cálculo fiscal en el cliente sería el error nº6 del README (lógica replicada) elevado a dos plataformas |

### Gotchas registrados

- **Versiones verificadas contra npm, no citadas de memoria**: Capacitor está en
  **8.4.2** (no en la 6.x que se habría supuesto). Camera 8.2.1, Filesystem
  8.1.2, Share 8.0.1, Preferences 8.0.1.
- **Idempotencia del timbrado es el riesgo más caro del móvil**: la conexión
  celular se corta a media petición y el reintento puede timbrar dos veces. Un
  timbre gastado no se recupera ni cancelándolo. **Hoy no existe clave de
  idempotencia** — la web lo sufre menos porque la conexión es estable.
- **Rate limiting no existe** y un cliente móvil es más fácil de atacar que un
  navegador (OWASP A05).
- **La sesión actual cierra al cerrar la pestaña** (decisión de negocio del
  2026-07-11). En móvil eso sería inusable: hay que redefinirla.
- **Camera/Share/Filesystem no se pueden probar en headless**: exigen dispositivo
  o emulador. Se documenta como verificación manual obligatoria.

### Consecuencia
Alcance y arquitectura cerrados; **sin código todavía**. El plan queda en 10
fases, empezando por OpenAPI (Fase 0) en vez de por el cliente, porque
documentar la API es prerrequisito de construir contra ella.

Quedan **5 preguntas abiertas** (ver READMEAPIFAC §9): notificaciones push vs
correo, sesión en móvil, definición de "productos del cliente frecuente",
factura global sin POS, y publicación en Play Store.
