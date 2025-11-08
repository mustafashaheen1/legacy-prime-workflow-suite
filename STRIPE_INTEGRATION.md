# Integración de Stripe - Guía de Configuración

## 📋 Resumen

Esta aplicación ahora está integrada con **Stripe** para procesar pagos de suscripción cuando una compañía crea su cuenta.

## 🔑 Configuración de Variables de Entorno

Necesitas configurar las siguientes variables de entorno:

### Backend (Node.js)
Crea o actualiza tu archivo `.env` con:

```env
STRIPE_SECRET_KEY=sk_test_...
```

### Frontend (React Native/Expo)
Crea o actualiza tu archivo `.env` con:

```env
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

## 🎯 Cómo Obtener las Claves de Stripe

1. **Crea una cuenta en Stripe**
   - Ve a https://stripe.com
   - Regístrate o inicia sesión

2. **Obtén tus claves de API**
   - En el Dashboard de Stripe, ve a "Developers" → "API keys"
   - Copia la **Publishable key** (pk_test_...) para `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   - Copia la **Secret key** (sk_test_...) para `STRIPE_SECRET_KEY`
   
   ⚠️ **IMPORTANTE**: Nunca compartas tu Secret Key públicamente

## 📱 Flujo de Pago Implementado

### 1. Usuario crea cuenta de compañía
- El usuario completa el formulario de registro en `signup.tsx`
- Introduce: nombre, email, contraseña, nombre de compañía, número de empleados

### 2. Selección de Plan
- En `subscription.tsx`, el usuario ve dos planes:
  - **Basic**: $10 base + $8 por empleado adicional
  - **Premium**: $20 base + $15 por empleado adicional

### 3. Inicialización del Pago
- Al cargar la pantalla, se crea automáticamente un Payment Intent en Stripe
- Se inicializa el Payment Sheet con los datos del usuario

### 4. Confirmación y Pago
- Usuario presiona "Proceed to Payment"
- Se abre el Payment Sheet nativo de Stripe
- Usuario ingresa datos de tarjeta (o usa Apple Pay/Google Pay si está configurado)
- Stripe procesa el pago de forma segura

### 5. Creación de Cuenta
- Una vez el pago es exitoso:
  - Se crea la compañía en la base de datos
  - Se crea el usuario admin
  - Se genera un código único de compañía
  - Se guardan los datos en AsyncStorage
  - Usuario es redirigido al Dashboard

## 🔄 Endpoints Backend Creados

### 1. `trpc.stripe.createPaymentIntent`
- Crea un Payment Intent en Stripe
- Parámetros:
  - `amount`: Monto a cobrar
  - `currency`: Moneda (default: 'usd')
  - `companyName`: Nombre de la compañía
  - `email`: Email del usuario
  - `subscriptionPlan`: 'basic' o 'premium'

### 2. `trpc.stripe.createSubscription`
- Crea una suscripción recurrente en Stripe
- Parámetros:
  - `email`: Email del cliente
  - `paymentMethodId`: ID del método de pago
  - `priceId`: ID del precio en Stripe
  - `companyName`: Nombre de la compañía

### 3. `trpc.stripe.verifyPayment`
- Verifica el estado de un pago
- Parámetros:
  - `paymentIntentId`: ID del Payment Intent

## 🧪 Modo de Prueba

### Tarjetas de Prueba de Stripe

Para probar los pagos, usa estas tarjetas de prueba:

**Pago Exitoso:**
```
Número: 4242 4242 4242 4242
Fecha: Cualquier fecha futura
CVC: Cualquier 3 dígitos
```

**Pago Rechazado:**
```
Número: 4000 0000 0000 0002
Fecha: Cualquier fecha futura
CVC: Cualquier 3 dígitos
```

**Requiere Autenticación 3D Secure:**
```
Número: 4000 0025 0000 3155
Fecha: Cualquier fecha futura
CVC: Cualquier 3 dígitos
```

## 📊 Monitoreo de Pagos

Para ver los pagos procesados:
1. Ve a tu Dashboard de Stripe
2. Navega a "Payments" → "All payments"
3. Podrás ver todos los pagos con sus detalles y metadatos

## 🔒 Seguridad

- ✅ Las claves secretas nunca se exponen al cliente
- ✅ Los pagos se procesan directamente con Stripe
- ✅ Datos de tarjeta nunca pasan por nuestros servidores
- ✅ Se usa HTTPS para todas las comunicaciones

## 🚀 Pasar a Producción

Cuando estés listo para producción:

1. **Activa tu cuenta de Stripe**
   - Completa la verificación de negocio en Stripe
   - Proporciona información bancaria para recibir pagos

2. **Cambia a claves de producción**
   - En Stripe Dashboard, cambia de "Test mode" a "Live mode"
   - Actualiza tus variables de entorno con las claves de producción:
     - `STRIPE_SECRET_KEY=sk_live_...`
     - `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...`

3. **Configura Webhooks** (Opcional pero recomendado)
   - En Stripe Dashboard, ve a "Developers" → "Webhooks"
   - Crea un endpoint para recibir notificaciones de eventos
   - Eventos importantes: `payment_intent.succeeded`, `payment_intent.payment_failed`

## 🛠️ Troubleshooting

### Error: "No publishable key provided"
- Verifica que `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` esté configurado
- Reinicia el servidor de desarrollo después de agregar la variable

### Error: "Invalid API Key"
- Verifica que las claves sean correctas
- Asegúrate de no mezclar claves de test con claves de producción

### Payment Sheet no se abre
- Verifica que el Payment Intent se haya creado correctamente
- Revisa los logs del console para ver errores específicos

## 📚 Recursos Adicionales

- [Documentación de Stripe](https://stripe.com/docs)
- [Stripe React Native SDK](https://stripe.dev/stripe-react-native)
- [Payment Intents API](https://stripe.com/docs/api/payment_intents)
- [Testing en Stripe](https://stripe.com/docs/testing)
