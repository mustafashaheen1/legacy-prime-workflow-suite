# Guía de Integración de Twilio

## Configuración Inicial

### 1. Obtener Credenciales de Twilio

1. Ve a [Twilio Console](https://console.twilio.com/)
2. Crea una cuenta o inicia sesión
3. Copia tu **Account SID** y **Auth Token**
4. Compra un número de teléfono de Twilio (o usa uno de prueba)

### 2. Configurar Variables de Entorno

Agrega estas variables a tu archivo `.env`:

```env
EXPO_PUBLIC_TWILIO_ACCOUNT_SID=tu_account_sid_aqui
EXPO_PUBLIC_TWILIO_AUTH_TOKEN=tu_auth_token_aqui
EXPO_PUBLIC_TWILIO_PHONE_NUMBER=+1234567890
```

**IMPORTANTE**: Reemplaza los valores con tus credenciales reales de Twilio.

## Funcionalidades Disponibles

### 1. Enviar SMS Individual

```typescript
import { trpc } from '@/lib/trpc';

const sendSMS = trpc.twilio.sendSms.useMutation();

// Usar en tu componente
await sendSMS.mutateAsync({
  to: '+1234567890',
  body: 'Hola, este es un mensaje de prueba'
});
```

### 2. Enviar SMS Masivo (Bulk SMS)

```typescript
const sendBulkSMS = trpc.twilio.sendBulkSms.useMutation();

await sendBulkSMS.mutateAsync({
  recipients: [
    { phone: '+1234567890', name: 'Juan Pérez' },
    { phone: '+0987654321', name: 'María García' }
  ],
  body: 'Hola {name}, tenemos una oferta especial para ti!'
});
```

### 3. Hacer Llamadas

```typescript
const makeCall = trpc.twilio.makeCall.useMutation();

await makeCall.mutateAsync({
  to: '+1234567890',
  message: 'Hola, este es un mensaje automático de Legacy Prime Construction'
});
```

### 4. Obtener Historial de Llamadas

```typescript
const callLogs = trpc.twilio.getCallLogs.useQuery({
  limit: 50
});
```

### 5. Crear Asistente Virtual

```typescript
const createAssistant = trpc.twilio.createVirtualAssistant.useMutation();

await createAssistant.mutateAsync({
  businessName: 'Legacy Prime Construction',
  greeting: 'Gracias por llamar a Legacy Prime Construction',
  webhookUrl: 'https://tu-dominio.com/api/twilio/assistant'
});
```

## Integración con el CRM

La integración ya está lista para funcionar con tu CRM existente. Aquí están los pasos para activarla:

### En el archivo `app/(tabs)/crm.tsx`:

1. **SMS Individual**: Ya funciona con el botón "SMS" de cada cliente
2. **SMS Masivo**: Ya funciona con el botón "SMS" cuando seleccionas múltiples clientes
3. **Llamadas**: Puedes agregar un botón de llamada para cada cliente
4. **Asistente Virtual**: Ya está configurado en el modal de "Call Assistant"

## Ejemplo de Uso en CRM

Para reemplazar el envío de SMS actual con Twilio:

```typescript
// En lugar de usar Linking.openURL para SMS
const sendSmsViaTwilio = async (client: Client, message: string) => {
  const sendSms = trpc.twilio.sendSms.useMutation();
  
  try {
    await sendSms.mutateAsync({
      to: client.phone,
      body: message.replace('{name}', client.name.split(' ')[0])
    });
    Alert.alert('Éxito', 'SMS enviado correctamente');
  } catch (error) {
    Alert.alert('Error', 'No se pudo enviar el SMS');
  }
};
```

## Costos y Límites

- **SMS**: ~$0.0075 por mensaje en USA
- **Llamadas**: ~$0.013 por minuto en USA
- **Cuenta de Prueba**: Incluye crédito gratis para probar

## Webhook para Asistente Virtual

Para que el asistente virtual funcione completamente, necesitas configurar un webhook que procese las respuestas del usuario. Ejemplo:

```typescript
// En backend/hono.ts o nuevo endpoint
app.post('/api/twilio/assistant', async (c) => {
  const { SpeechResult } = await c.req.parseBody();
  
  // Procesar la respuesta del usuario
  // Puedes usar IA aquí para generar respuestas
  
  const twiml = new twilio.twiml.VoiceResponse();
  twiml.say('Gracias por tu información. Te contactaremos pronto.');
  
  return c.text(twiml.toString(), 200, {
    'Content-Type': 'text/xml'
  });
});
```

## Próximos Pasos

1. Obtén tus credenciales de Twilio
2. Configura las variables de entorno
3. Prueba enviando un SMS de prueba
4. Configura webhooks para el asistente virtual (opcional)
5. Actualiza el CRM para usar Twilio en lugar de `Linking.openURL`

## Documentación de Twilio

- [Twilio SMS API](https://www.twilio.com/docs/sms)
- [Twilio Voice API](https://www.twilio.com/docs/voice)
- [TwiML](https://www.twilio.com/docs/voice/twiml)
