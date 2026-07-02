# 🧾 ERP Fiscal CFDI 4.0 México

**Sistema inteligente de facturación electrónica para pequeñas y medianas empresas**

## 📋 Descripción General

Plataforma SaaS cloud-based para gestión integral de facturación CFDI 4.0, diseñada específicamente para el mercado fiscal mexicano. Genera facturas válidas, timbres de pago, reportes de cobranza y análisis financiero con integración preparada para PACs.

### Características Principales

- ✅ **Facturación CFDI 4.0** - Generación de facturas conformes a SAT Anexo 20
- ✅ **Timbres de Pago** - Complementos de pago automáticos
- ✅ **Reportes de Cobranza** - Seguimiento de pagos y deudas
- ✅ **Reportes Fiscales** - IVA, retenciones, flujo de efectivo
- ✅ **Gestión de Clientes** - Base de datos completa con historiales
- ✅ **Catálogos SAT** - Biblioteca completa del Anexo 20 actualizada
- ✅ **Cloud-First** - Arquitectura moderna, escalable, segura
- ✅ **Integración PAC Ready** - Preparado para Finkok, Facturama, SW Sapien
- ✅ **Multi-empresa** - Soporte para múltiples RFC y sucursales
- ✅ **Generación de PDF** - Facturas y reportes en formato profesional

---

## 🎯 Propósito Estratégico

Esta herramienta proporciona un **plus competitivo** para empresas que necesitan:

1. **Automatizar** procesos fiscales complejos sin expertos especializados
2. **Cumplir** regulaciones SAT sin riesgo de errores
3. **Escalabilidad** desde startups hasta medianas empresas
4. **Visibilidad** real de cobranza y estados financieros
5. **Integración limpia** con proveedores de timbrado PAC

---

## 👥 Público Objetivo

- **Pequeñas Empresas (10-50 empleados)** - Facturación básica y reportes
- **Medianas Empresas (50-250 empleados)** - Múltiples sucursales, análisis avanzado
- **Despachos Contables** - Gestión de múltiples clientes (sub-tenants)
- **Emprendimientos** - Solución escalable desde día 1

---

## 🏗️ Arquitectura en Máximo Detalle

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENTE (Frontend)                     │
│                    React + TypeScript                       │
│              (Dashboard, Facturación, Reportes)             │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS/API REST
┌────────────────────────▼────────────────────────────────────┐
│                   API GATEWAY (Node.js)                     │
│    Authentication │ Rate Limiting │ Request Logging         │
└────────────┬───────────────────────────────────────┬────────┘
             │                                       │
    ┌────────▼──────────┐         ┌─────────────────▼────────┐
    │  Core Services    │         │  Data Services           │
    ├─────────────────┤         ├──────────────────────────┤
    │• Auth/JWT       │         │• PostgreSQL (Datos core) │
    │• Facturación    │         │• Redis (Cache/Sessions)  │
    │• Clientes       │         │• S3/Blob (XML, PDFs)     │
    │• Reportes       │         │• Catálogos SAT (Local)   │
    │• Cobranza       │         │                          │
    └────────┬────────┘         └──────────────────────────┘
             │
    ┌────────▼───────────────────────────────────────────┐
    │      MÓDULOS ESPECIALIZADOS (Microservicios)       │
    ├──────────────────────────────────────────────────┤
    │ • Parser CFDI (Lectura/Validación XML)            │
    │ • Generador CFDI (Creación XML según SAT)         │
    │ • Validador SAT (Catálogos, estructuras)          │
    │ • Generador PDF (Facturas profesionales)          │
    │ • OCR/CIF (Lectura de Constancias Fiscales)      │
    │ • Conector PAC (Interface para timbrado)          │
    └────────────────────────────────────────────────────┘
```

### Filosofía de Almacenamiento

La arquitectura está diseñada para ser **lightweight**:

**SE GUARDA en BD:**
- Configuraciones de empresa (RFC, razón social, etc.)
- Datos de clientes (RFC, contacto, saldo)
- Facturas emitidas (metadata: folio, fecha, monto, estatus)
- Pagos recibidos (complementos de pago)
- Usuarios y permisos

**NO SE GUARDA (o se sincroniza desde SAT):**
- ~~Catálogos SAT~~ → Cache local actualizado automáticamente
- ~~Datos de productos genéricos~~ → El usuario sube solo sus productos
- ~~Regímenes fiscales~~ → Cache de Anexo 20

**SE ALMACENA en Cloud Storage (S3/Blob):**
- XML CFDI completo (para auditoría)
- PDFs de facturas
- Constancias fiscales (CIF)
- Logs de timbrado

---

## 🔄 Flujo de Operación Principal

### Caso 1: Crear una Factura

```
1. Usuario accede a "Nueva Factura"
2. Sistema carga cliente (RFC + datos)
3. Usuario selecciona productos
4. Sistema valida información fiscal automáticamente
5. Sistema genera XML CFDI 4.0 válido
6. Usuario revisa PDF preview
7. Sistema prepara para timbrado (sin timbrar aún)
8. Usuario puede:
   a) Enviar a PAC para timbrado
   b) Guardar como borrador
   c) Descargar XML para timbrado manual
```

### Caso 2: Recibir Complemento de Pago

```
1. Cliente realiza pago parcial/total
2. Usuario accede a "Nuevo Pago" en factura
3. Sistema auto-rellena datos del pago
4. Usuario confirma cantidad y método
5. Sistema genera Complemento de Pago (CFDI)
6. Sistema actualiza estado de cobranza
7. Genera PDF de comprobante de pago
```

### Caso 3: Reporte de Cobranza

```
1. Usuario accede a "Reportes > Cobranza"
2. Sistema calcula:
   - Facturas vencidas
   - Pagos pendientes por cliente
   - Flujo de caja proyectado
   - Antigüedad de saldos
3. Exporta a PDF/Excel
4. Envía alertas de facturas próximas a vencer
```

---

## 🗄️ Modelo de Datos Simplificado

```sql
Tablas Principales:
├── companies (RFC, nombre, régimen fiscal, datos bancarios)
├── users (email, password hash, rol, permisos)
├── customers (RFC, nombre, régimen, contacto, límite crédito)
├── products (SKU, descripción, clave SAT, precio, impuesto)
├── invoices (folio, fecha, cliente, monto, estatus, XML URL)
├── invoice_items (factura_id, producto, cantidad, precio, impuesto)
├── payments (factura_id, cantidad, fecha, método, complemento_url)
├── audit_logs (usuario, acción, tabla, timestamp, detalles)
└── sat_catalogs (clave, descripción, tipo, vigente)
```

**Nota:** Catálogos SAT se actualizan automáticamente desde fuente oficial. No son tabla principal, sino caché.

---

## 🚀 Fases de Desarrollo

### FASE 1️⃣: MVP Core (Semanas 1-4)
**Objetivo:** Facturación básica funcional

- [x] Estructura proyecto + BD
- [ ] Autenticación usuarios
- [ ] Módulo clientes CRUD
- [ ] Módulo productos CRUD
- [ ] Parser CFDI XML (lectura)
- [ ] Generador CFDI XML (creación)
- [ ] Validador contra catálogos SAT
- [ ] API REST endpoints básicos

**Entregable:** Sistema que genera XMLs CFDI válidos listos para timbrado

---

### FASE 2️⃣: Frontend + Reportes (Semanas 5-8)
**Objetivo:** Interface usable + primeros reportes

- [ ] Dashboard principal
- [ ] Vista de facturación (crear, editar, vista previa)
- [ ] Vista de clientes
- [ ] Vista de productos
- [ ] Generación PDF de facturas
- [ ] Reporte de cobranza básico
- [ ] Sistema de pagos simple

**Entregable:** Plataforma usable que genera facturas y reportes

---

### FASE 3️⃣: Integración PAC (Semanas 9-12)
**Objetivo:** Timbrado automático sin fricción

- [ ] Conector abstracto para PACs
- [ ] Integración Finkok
- [ ] Integración Facturama
- [ ] Integración SW Sapien
- [ ] Manejo de errores PAC
- [ ] Reintento automático

**Entregable:** Timbrado automático transparente al usuario

---

### FASE 4️⃣: Análisis Avanzado + Multi-empresa (Semanas 13+)
**Objetivo:** Herramienta profesional escalable

- [ ] Análisis financiero avanzado
- [ ] Proyecciones de flujo
- [ ] Reportes fiscales trimestrales
- [ ] Multi-RFC/sucursales
- [ ] Gestión de inventario básica
- [ ] Notificaciones y alertas
- [ ] Exportación a contabilidad

**Entregable:** Herramienta profesional lista para medianas empresas

---

## 💻 Stack Tecnológico

### Backend
```
Node.js + Express/NestJS
├── Authentication: JWT + bcrypt
├── Validation: Joi/Zod
├── Logging: Winston/Pino
├── Testing: Jest
└── ORM: Prisma/TypeORM
```

### Base de Datos
```
PostgreSQL 15+
├── Replicación para HA
├── Backups automáticos
├── Indexes optimizados
└── Migrations versionadas
```

### Frontend
```
React 18 + TypeScript
├── State: Redux Toolkit / Zustand
├── UI: Tailwind CSS
├── Forms: React Hook Form
├── Tables: TanStack React Table
├── Charts: Recharts / Chart.js
└── PDF: react-pdf / jsPDF
```

### Infraestructura
```
Docker + Kubernetes (escalable)
├── AWS / Azure / GCP (agnóstico)
├── CDN para assets estáticos
├── Load Balancer
├── SSL/TLS certificados
├── WAF (Web Application Firewall)
└── Monitoreo: Datadog / New Relic
```

### Servicios Externos
```
├── PACs: Finkok, Facturama, SW Sapien
├── Email: SendGrid / AWS SES
├── SMS: Twilio (notificaciones)
├── Storage: AWS S3 / Azure Blob
├── CDN: CloudFlare
└── Auth (opcional): Auth0
```

---

## 📊 SAT & Catálogos

El sistema incluye todos los catálogos del **Anexo 20 CFDI 4.0**:

```
SAT Catalogs (Sincronizados automáticamente):
├── c_ClaveProdServ (20,000+ productos)
├── c_ClaveUnidad (190 unidades)
├── c_FormaPago (17 formas)
├── c_MetodoPago (23 métodos)
├── c_RegimenFiscal (23 regímenes)
├── c_UsoCFDI (23 usos)
├── c_Impuesto (3 tipos)
├── c_TasaOCuota (100+ tasas)
├── c_Moneda (100+ monedas)
├── c_Pais (250+ países)
├── c_Estado (32 estados)
├── c_Localidad (2600+ ciudades)
├── c_Colonia (80,000+ colonias)
├── c_CodigoPostal (57,000+ CPs)
├── c_TipoComprobante (tipos CFDI)
├── c_Exportacion (regímenes export)
└── c_TipoIngreso/Egreso + más...
```

**Actualización automática:** El sistema verifica mensalmente catálogos nuevos desde SAT.

---

## 🔐 Seguridad & Cumplimiento

✅ Encriptación end-to-end (TLS 1.3)
✅ Hashing de contraseñas (bcrypt)
✅ JWT con refresh tokens
✅ Auditoría completa de operaciones (quién, qué, cuándo)
✅ GDPR compliant (privacidad de datos)
✅ Backup automático cada 6 horas
✅ Logs de timbrado con SAT
✅ Certificados SSL renovados automáticamente
✅ Rate limiting contra ataques
✅ Validación de certificados .pfx

---

## 📦 Estructura de Carpetas (Inicial)

```
ERP_CFDI_Mexico/
├── README.md (este archivo)
├── ARCHITECTURE.md (diseño detallado)
├── DATABASE.sql (script SQL)
├── .gitignore
├── .env.example
│
├── backend/
│   ├── src/
│   │   ├── app.ts
│   │   ├── config/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   ├── companies/
│   │   │   ├── customers/
│   │   │   ├── products/
│   │   │   ├── invoices/
│   │   │   ├── payments/
│   │   │   ├── reports/
│   │   │   ├── cfdi/
│   │   │   └── catalogs/
│   │   ├── middleware/
│   │   ├── utils/
│   │   ├── database/
│   │   │   ├── migrations/
│   │   │   └── seeds/
│   │   └── tests/
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.example
│   └── Dockerfile
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── store/
│   │   ├── types/
│   │   └── utils/
│   ├── package.json
│   └── Dockerfile
│
├── docs/
│   ├── CFDI_STRUCTURE.md (especificación CFDI 4.0)
│   ├── SAT_CATALOGS.md (catálogos disponibles)
│   ├── API_ENDPOINTS.md (documentación API)
│   ├── DATABASE_SCHEMA.md (modelo de datos)
│   ├── INTEGRATION_PAC.md (guía integración PACs)
│   ├── DEPLOYMENT.md (deployment en cloud)
│   └── SECURITY.md (políticas seguridad)
│
├── infrastructure/
│   ├── docker-compose.yml
│   ├── kubernetes/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   ├── configmap.yaml
│   │   └── secret.yaml
│   ├── terraform/ (IaC)
│   └── .env.example
│
└── scripts/
    ├── deploy.sh
    ├── migrate.sh
    ├── seed-catalogs.sh
    └── backup.sh
```

---

## 🎓 Conocimiento Requerido

Para trabajar en este proyecto necesitas:

### Obligatorio
- ✅ Node.js + TypeScript
- ✅ Express/NestJS
- ✅ PostgreSQL
- ✅ **CFDI 4.0 y SAT Anexo 20** (TU PUNTO FUERTE)
- ✅ XML (validación, generación)

### Muy Recomendado
- ✅ React + TypeScript
- ✅ Docker + Docker Compose
- ✅ Git avanzado
- ✅ Testing (Jest, Cypress)

### Bonito pero No Crítico
- Kubernetes
- CI/CD (GitHub Actions)
- AWS/Azure
- Diseño REST API avanzado

---

## ⚡ Próximos Pasos

1. **Ahora:** Leyendo este README ✓
2. **Siguiente:** Revisar `ARCHITECTURE.md` (diseño técnico)
3. **Luego:** Ejecutar `DATABASE.sql` en PostgreSQL local
4. **Después:** Iniciar backend con estructura básica
5. **Finalmente:** Comenzar desarrollo iterativo

---

## 📞 Contacto & Soporte

- **Usuario:** anbeor29@gmail.com
- **Propósito:** Herramienta de facturación profesional para PyMEs
- **Enfoque:** Cloud-first, SAT-compliant, PAC-ready
- **Objetivo Final:** Plus competitivo para empresa

---

## 📄 Licencia

Proyecto privado - Uso interno exclusivamente.

---

## ✅ Checklist de Primeros Pasos

- [ ] Revisar README.md (completado ✓)
- [ ] Revisar ARCHITECTURE.md
- [ ] Revisar DATABASE.sql
- [ ] Clonar repositorio en local
- [ ] Configurar PostgreSQL
- [ ] Ejecutar migraciones
- [ ] Instalar dependencias backend
- [ ] Instalar dependencias frontend
- [ ] Iniciar servidor local
- [ ] Verificar acceso a http://localhost:3000
- [ ] Crear primer usuario admin
- [ ] Cargar datos de prueba
- [ ] Validar parseo CFDI

---

**Última actualización:** Junio 7, 2026
**Versión:** 0.1.0 (Documentación Inicial)
**Estado:** 🟡 En Documentación

