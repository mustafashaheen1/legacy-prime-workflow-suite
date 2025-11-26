# 🔥 Guía de Stripe en Modo Test - Todo Listo

## ✅ Estado de la Integración

**TODO ESTÁ CONFIGURADO Y LISTO PARA PROBAR** 🎉

### Lo que ya está hecho:
- ✅ Claves de Stripe en modo Test configuradas en las variables de entorno
- ✅ Backend completamente integrado con Stripe SDK
- ✅ Frontend integrado con el Payment Sheet nativo de Stripe
- ✅ Flujo de suscripción conectado al sistema de pagos
- ✅ Tipos de TypeScript actualizados para incluir IDs de Stripe

---

## 🧪 Cómo Probar el Flujo de Suscripción

### 1. **Crear una Cuenta de Empresa**

1. Abre la app y navega a **Signup** (Crear Cuenta)
2. Selecciona **"Cuenta de Empresa"**
3. Completa el formulario:
   - Nombre completo
   - Email
   - Contraseña
   - Nombre de la empresa
   - Número de empleados (ejemplo: 2, 5, 10)
4. Haz clic en **"Continuar"**

### 2. **Seleccionar un Plan**

La pantalla de suscripción te mostrará dos opciones:

**Plan Básico:**
- $10 base + $8 por cada empleado adicional
- Incluye: Dashboard, CRM, Gastos, Fotos, Estimados
- Límite: 20 proyectos activos

**Plan Premium (Recomendado):**
- $20 base + $15 por cada empleado adicional  
- Todo del Plan Básico + Programación, Chat, Reportes, Reloj
- Proyectos ilimitados

### 3. **Procesar el Pago**

#### **En Dispositivo Móvil (iOS/Android):**

Cuando hagas clic en **"Crear Cuenta"**:
1. Se abrirá el **Payment Sheet nativo de Stripe**
2. Ingresa una tarjeta de prueba:
   ```
   Número: 4242 4242 4242 4242
   Fecha: Cualquier fecha futura (ej: 12/25)
   CVC: Cualquier 3 dígitos (ej: 123)
   ZIP: Cualquier código (ej: 12345)
   ```
3. Confirma el pago
4. ✅ Tu cuenta se creará automáticamente

#### **En Web:**
- Se simula el pago exitoso (no se muestra Payment Sheet en web)
- La cuenta se crea de todos modos para fines de desarrollo

---

## 💳 Tarjetas de Prueba de Stripe

### ✅ Pago Exitoso
```
Número: 4242 4242 4242 4242
Fecha: 12/25
CVC: 123
```

### ❌ Pago Rechazado (para probar errores)
```
Número: 4000 0000 0000 0002
```

### 🔒 Requiere Autenticación 3D Secure
```
Número: 4000 0025 0000 3155
```

### 💰 Fondos Insuficientes
```
Número: 4000 0000 0000 9995
```

---

## 📊 Monitorear Pagos en Stripe

### Dashboard de Stripe:
1. Ve a: https://dashboard.stripe.com/test/payments
2. Inicia sesión con tu cuenta de Stripe
3. Verás todos los Payment Intents creados
4. Podrás ver el estado de cada pago:
   - ✅ `succeeded` - Pago exitoso
   - ⏳ `processing` - En proceso
   - ⚠️ `requires_payment_method` - Esperando método de pago
   - ❌ `canceled` - Cancelado

### En la Consola de la App:
Busca logs con estos prefijos:
```
[Subscription] Creating payment intent...
[Subscription] Payment intent created: pi_xxxxx
[Subscription] Initializing payment sheet...
[Subscription] Payment successful!
[Subscription] Creating company account...
```

---

## 🔍 Qué Pasa Tras Bastidores

1. **Usuario completa el formulario** → Se guardan los datos temporalmente
2. **Selecciona un plan** → Se calcula el precio basado en empleados
3. **Hace clic en "Crear Cuenta"**:
   - Se crea un Payment Intent en Stripe con el monto calculado
   - Se abre el Payment Sheet nativo (solo en móvil)
   - Usuario ingresa su tarjeta
   - Stripe procesa el pago
4. **Si el pago es exitoso**:
   - Se genera un código de compañía único
   - Se crea el registro de Company con:
     - Plan seleccionado
     - Fecha de inicio/fin de suscripción
     - Stripe Payment Intent ID guardado
   - Se crea el usuario Admin
   - Se guarda todo en AsyncStorage
5. **Usuario es redirigido al Dashboard** ✅

---

## 🔄 Flujo de Empleados (Sin Pago)

Los empleados **NO pagan** cuando crean sus cuentas:

1. Admin recibe un **Código de Compañía** (ejemplo: `A3B7F9`)
2. Comparte el código con sus empleados
3. Empleado va a **Signup** → **"Cuenta de Empleado"**
4. Ingresa sus datos + el código de compañía
5. Su cuenta se vincula automáticamente a la empresa
6. **No se solicita pago** ✅

---

## 🎯 Lo Que Se Guarda en la Base de Datos

Cuando se crea una empresa con pago exitoso:

```typescript
Company {
  id: "A3B7F9",
  name: "Mi Empresa",
  subscriptionStatus: "active",
  subscriptionPlan: "pro", // o "basic"
  subscriptionStartDate: "2025-01-15T10:30:00Z",
  subscriptionEndDate: "2026-01-15T10:30:00Z",
  companyCode: "A3B7F9",
  stripePaymentIntentId: "pi_3abc123xyz", // ← ID del pago
  settings: {
    features: {
      crm: true,
      estimates: true,
      schedule: true,  // Solo Premium
      expenses: true,
      photos: true,
      chat: true,      // Solo Premium
      reports: true,   // Solo Premium
      clock: true,     // Solo Premium
      dashboard: true,
    },
    maxUsers: 5,
    maxProjects: 999, // Premium = ilimitado, Basic = 20
  }
}
```

---

## 🚨 Solución de Problemas

### Error: "No se pudo inicializar el método de pago"
**Causa:** Las claves de Stripe no están configuradas correctamente.  
**Solución:** Verifica que `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` esté en las variables de entorno y reinicia el servidor.

### Error: "Payment intent creation failed"
**Causa:** La clave secreta del backend no es válida.  
**Solución:** Verifica que `STRIPE_SECRET_KEY` esté correcta en las variables de entorno del backend.

### El Payment Sheet no se abre en móvil
**Causa:** El paquete `@stripe/stripe-react-native` no está instalado correctamente.  
**Solución:** Ejecuta `bun install @stripe/stripe-react-native` y reconstruye la app.

### Web no muestra el Payment Sheet
**Solución:** Esto es normal. En web se simula el pago. El Payment Sheet solo funciona en dispositivos móviles nativos.

---

## 🎉 Próximos Pasos (Opcional)

Si quieres mejorar la integración:

### 1. **Suscripciones Recurrentes**
Actualmente se crea un pago único. Para cobros mensuales automáticos:
- Crear productos en Stripe Dashboard
- Usar el endpoint `stripe.createSubscription` en vez de `createPaymentIntent`

### 2. **Webhooks**
Para recibir notificaciones automáticas cuando:
- Un pago falla
- Una suscripción se cancela
- Una tarjeta está por expirar

### 3. **Portal de Cliente**
Permitir que los clientes:
- Actualicen su método de pago
- Cambien de plan
- Vean su historial de facturas

---

## 📞 Recursos

- [Stripe Dashboard (Test Mode)](https://dashboard.stripe.com/test)
- [Documentación de Stripe](https://stripe.com/docs)
- [Stripe React Native SDK](https://stripe.dev/stripe-react-native)
- [Tarjetas de Prueba](https://stripe.com/docs/testing)

---

**🔥 ¡TODO ESTÁ LISTO! Ahora puedes probar el flujo completo de suscripción con pagos reales de Stripe en modo Test.**
