# 🚀 Guía de Configuración e Integración de Stripe

## ✅ Estado Actual

### Backend - Completamente Integrado
- ✅ Rutas tRPC configuradas y funcionando
- ✅ 3 endpoints listos para usar:
  - `stripe.createPaymentIntent` - Crea un intento de pago
  - `stripe.createSubscription` - Crea suscripciones recurrentes
  - `stripe.verifyPayment` - Verifica el estado de un pago

### Frontend - Listo para Probar
- ✅ Pantalla de prueba creada: `/stripe-test`
- ✅ Variables de entorno configuradas
- ✅ Paquete `@stripe/stripe-react-native` instalado

## 🔑 Tus API Keys de Stripe

Tus keys están en las variables de entorno y están en **Modo Test**:
- `STRIPE_SECRET_KEY` - Para el backend (sk_test_...)
- `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Para el frontend (pk_test_...)

## 🧪 Cómo Probar el Flujo

### Opción 1: Usar la Pantalla de Prueba

1. **Abre la app** y navega a la ruta: `/stripe-test`

2. **Selecciona un plan** (Basic o Premium)

3. **Haz clic en "Crear Payment Intent"**
   - Esto creará un intento de pago en Stripe
   - Verás el ID del payment intent
   - NO procesa ningún pago real todavía

4. **Ve al Dashboard de Stripe**
   - https://dashboard.stripe.com/test/payments
   - Verás el payment intent creado
   - Estado: "requires_payment_method" (esperando tarjeta)

### Opción 2: Verificar un Pago

1. En la pantalla de prueba, clic en **"Verificar Pago Existente"**
2. Ingresa un Payment Intent ID (ejemplo: `pi_xxxxx`)
3. Verás el estado actual del pago

## 📱 Cómo Funciona el Flujo Completo

### Flujo Actual (Implementado)
```
Usuario selecciona plan
       ↓
App crea Payment Intent en Stripe
       ↓
Stripe devuelve client_secret
       ↓
App puede mostrar el estado
```

### Flujo Completo de Producción (Siguiente Paso)
```
Usuario selecciona plan
       ↓
App crea Payment Intent en Stripe
       ↓
Stripe devuelve client_secret
       ↓
App abre Payment Sheet nativo de Stripe
       ↓
Usuario ingresa tarjeta
       ↓
Stripe procesa el pago
       ↓
App recibe confirmación
       ↓
App crea cuenta/suscripción en la base de datos
```

## 🔧 Cómo Implementar el Payment Sheet (Próximo Paso)

Para completar el flujo de pago, necesitarás agregar el Payment Sheet nativo:

```typescript
import { useStripe } from '@stripe/stripe-react-native';

const { initPaymentSheet, presentPaymentSheet } = useStripe();

// 1. Crear Payment Intent (ya implementado)
const paymentIntent = await trpcClient.stripe.createPaymentIntent.mutate({
  amount: 49.99,
  currency: 'usd',
  companyName: 'Mi Compañía',
  email: 'usuario@email.com',
  subscriptionPlan: 'premium',
});

// 2. Inicializar Payment Sheet
await initPaymentSheet({
  paymentIntentClientSecret: paymentIntent.clientSecret,
  merchantDisplayName: 'Rork App',
});

// 3. Mostrar Payment Sheet
const { error } = await presentPaymentSheet();

if (!error) {
  // ✅ Pago exitoso
  console.log('Pago completado!');
} else {
  // ❌ Error o cancelado
  console.log('Error:', error.message);
}
```

## 💳 Tarjetas de Prueba de Stripe

### Pago Exitoso
```
Número: 4242 4242 4242 4242
Fecha: Cualquier fecha futura
CVC: Cualquier 3 dígitos
ZIP: Cualquier código
```

### Pago Rechazado
```
Número: 4000 0000 0000 0002
```

### Requiere Autenticación 3D Secure
```
Número: 4000 0025 0000 3155
```

### Insuficientes Fondos
```
Número: 4000 0000 0000 9995
```

## 📊 Monitorear Pagos

1. **Dashboard de Stripe**: https://dashboard.stripe.com/test/payments
2. **Logs en la consola**: Busca `[Stripe Test]` o `[Stripe]`
3. **Resultados en la app**: La pantalla de prueba muestra el resultado

## 🔄 Flujo de Suscripciones Recurrentes

Para suscripciones mensuales:

### 1. Crear Productos en Stripe Dashboard
```
1. Ve a: https://dashboard.stripe.com/test/products
2. Crea un producto: "Plan Premium"
3. Agrega un precio recurrente: $49.99/mes
4. Copia el Price ID (price_...)
```

### 2. Usar el Endpoint de Suscripción
```typescript
const subscription = await trpcClient.stripe.createSubscription.mutate({
  email: 'usuario@email.com',
  paymentMethodId: 'pm_xxxxx', // Del Payment Sheet
  priceId: 'price_xxxxx', // De tu producto en Stripe
  companyName: 'Mi Compañía',
});

console.log('Suscripción creada:', subscription.subscriptionId);
```

## 🚀 Pasar a Producción

Cuando estés listo para procesar pagos reales:

### 1. Activar tu Cuenta de Stripe
- Completa la verificación de negocio
- Proporciona información bancaria
- Activa tu cuenta

### 2. Cambiar a Claves de Producción
```env
# Backend
STRIPE_SECRET_KEY=sk_live_...

# Frontend
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### 3. Configurar Webhooks (Recomendado)
```
Endpoint: https://tu-dominio.com/api/webhooks/stripe
Eventos:
- payment_intent.succeeded
- payment_intent.payment_failed
- customer.subscription.created
- customer.subscription.deleted
```

## 🛠️ Troubleshooting

### Error: "No publishable key provided"
**Solución**: Verifica que `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` esté configurado y reinicia el servidor.

### Error: "Invalid API Key"
**Solución**: Verifica que las claves sean correctas y no mezcles test/live.

### Payment Intent se crea pero no se procesa
**Solución**: Necesitas implementar el Payment Sheet (ver sección arriba).

### Error de CORS
**Solución**: Verifica que tu backend acepte peticiones desde tu frontend.

## 📞 Recursos

- [Documentación de Stripe](https://stripe.com/docs)
- [Stripe React Native SDK](https://stripe.dev/stripe-react-native)
- [Testing en Stripe](https://stripe.com/docs/testing)
- [Payment Intents API](https://stripe.com/docs/api/payment_intents)

## ✨ Próximos Pasos Recomendados

1. ✅ **Probar la pantalla de prueba** (`/stripe-test`)
2. ⏳ **Implementar Payment Sheet** para pagos reales
3. ⏳ **Crear productos en Stripe Dashboard** para suscripciones
4. ⏳ **Integrar en el flujo de signup** (ya tienes la pantalla en `subscription.tsx`)
5. ⏳ **Configurar webhooks** para notificaciones automáticas
6. ⏳ **Probar con tarjetas de prueba**
7. ⏳ **Activar cuenta y pasar a producción**

---

## 🎯 Cómo Acceder a la Pantalla de Prueba

### Opción 1: Directamente desde el Navegador
```
http://localhost:8081/stripe-test
```

### Opción 2: Agregar botón en Dashboard
Puedes agregar un botón en el Dashboard que navegue a `/stripe-test`

### Opción 3: Desde Cualquier Pantalla
```typescript
import { router } from 'expo-router';

<TouchableOpacity onPress={() => router.push('/stripe-test')}>
  <Text>Probar Stripe</Text>
</TouchableOpacity>
```

---

**🎉 ¡Todo está listo para probar!** 

Navega a `/stripe-test` y haz clic en "Crear Payment Intent" para verificar que tu integración funciona correctamente.
