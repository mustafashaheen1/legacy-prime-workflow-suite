# Guía: Cómo Configurar y Probar la Recepcionista Virtual

## 📋 Descripción General

La recepcionista virtual es un sistema de IA que:
- Contesta llamadas automáticamente 24/7
- Califica prospectos (leads) haciendo preguntas específicas
- Recopila información del cliente (nombre, teléfono, proyecto, presupuesto)
- Agrega automáticamente los prospectos serios al CRM
- Programa seguimientos automáticos

## 🛠️ Paso 1: Configurar Twilio

### 1.1 Crear Cuenta en Twilio

1. Ve a [https://www.twilio.com/](https://www.twilio.com/)
2. Crea una cuenta o inicia sesión
3. Completa la verificación de tu identidad si es requerido

### 1.2 Obtener Credenciales

1. Ve al **Dashboard de Twilio Console**: [https://console.twilio.com/](https://console.twilio.com/)
2. Copia estos valores:
   - **Account SID** (Ejemplo: ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx)
   - **Auth Token** (Click en "View" para revelarlo)

### 1.3 Comprar un Número de Teléfono

1. En Twilio Console, ve a **Phone Numbers** → **Buy a Number**
2. Selecciona tu país (USA, México, etc.)
3. Filtra por capacidades: ✅ Voice, ✅ SMS
4. Compra un número (costo aproximado: $1-2 USD/mes)
5. Copia el número comprado (Ejemplo: +15551234567)

### 1.4 Configurar Variables de Entorno

Crea o edita el archivo `.env` en la raíz de tu proyecto:

```env
# Credenciales de Twilio
EXPO_PUBLIC_TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
EXPO_PUBLIC_TWILIO_AUTH_TOKEN=tu_auth_token_aqui
EXPO_PUBLIC_TWILIO_PHONE_NUMBER=+15551234567
```

**IMPORTANTE**: 
- Reemplaza los valores con tus credenciales reales
- El número de teléfono debe incluir el código de país (por ejemplo, +1 para USA)
- NO compartas estas credenciales públicamente

## 🔧 Paso 2: Configurar el Webhook (Endpoint de Respuesta)

La recepcionista necesita un URL público para procesar las respuestas del usuario. Hay dos opciones:

### Opción A: Usar Ngrok (Para Pruebas Locales)

1. Instala ngrok: [https://ngrok.com/download](https://ngrok.com/download)
2. Ejecuta tu servidor backend:
   ```bash
   npm run start
   # o
   bun run start
   ```
3. En otra terminal, ejecuta:
   ```bash
   ngrok http 8081
   ```
4. Ngrok te dará un URL público como: `https://abc123.ngrok.io`
5. Tu webhook será: `https://abc123.ngrok.io/api/twilio/assistant`

### Opción B: Desplegar a Producción

Si ya tienes tu app desplegada (por ejemplo en Vercel, Railway, etc.):
- Tu webhook será: `https://tu-dominio.com/api/twilio/assistant`

## 📱 Paso 3: Configurar la Recepcionista en la App

1. Abre la app y ve a la pestaña **CRM**
2. Haz clic en el botón **"Call Assistant"** (arriba a la derecha)
3. Configura los siguientes campos:

### 3.1 Información del Negocio
- **Business Name**: Legacy Prime Construction (o el nombre de tu empresa)
- **Greeting Message**: 
  ```
  Gracias por llamar a Legacy Prime Construction. Soy la asistente virtual. ¿En qué puedo ayudarte hoy?
  ```

### 3.2 Preguntas de Calificación
Las preguntas predefinidas son:
1. ¿Qué tipo de proyecto de construcción te interesa?
2. ¿Cuál es tu presupuesto estimado para este proyecto?
3. ¿Cuándo estás buscando iniciar el proyecto?
4. ¿Es para una propiedad residencial o comercial?

### 3.3 Criterios de Lead Serio
Define qué hace que un prospecto sea "serio":
```
Presupuesto mayor a $10,000 y listo para comenzar en los próximos 3 meses
```

### 3.4 Automatizaciones
✅ **Auto-add to CRM**: Agregar automáticamente leads calificados al CRM
✅ **Auto-schedule follow-ups**: Programar seguimientos automáticos

4. Haz clic en **"Save Configuration"**

## 🔗 Paso 4: Conectar el Número de Twilio con el Webhook

1. Ve a Twilio Console → **Phone Numbers** → **Manage** → **Active Numbers**
2. Haz clic en tu número de teléfono
3. En la sección **Voice & Fax**:
   - **Configure with**: Webhooks, TwiML Bins, Functions, Studio, or Proxy
   - **A CALL COMES IN**: Webhook
   - **URL**: Pega tu webhook URL (por ejemplo: `https://abc123.ngrok.io/api/twilio/assistant`)
   - **HTTP**: POST
4. Haz clic en **Save**

## 🧪 Paso 5: Probar la Recepcionista Virtual

### Prueba Básica

1. Desde tu teléfono móvil, **llama al número de Twilio** que compraste
2. Deberías escuchar el mensaje de bienvenida:
   > "Gracias por llamar a Legacy Prime Construction. Soy la asistente virtual. ¿En qué puedo ayudarte hoy?"
3. Responde con tu solicitud, por ejemplo:
   > "Necesito remodelar mi cocina"

### Prueba Completa de Calificación

La asistente te hará las preguntas de calificación:

**Asistente**: "¿Qué tipo de proyecto de construcción te interesa?"
**Tú**: "Remodelación de cocina"

**Asistente**: "¿Cuál es tu presupuesto estimado para este proyecto?"
**Tú**: "Alrededor de 15 mil dólares"

**Asistente**: "¿Cuándo estás buscando iniciar el proyecto?"
**Tú**: "En las próximas 2 semanas"

**Asistente**: "¿Es para una propiedad residencial o comercial?"
**Tú**: "Residencial"

**Asistente**: "Por favor, proporciona tu nombre completo."
**Tú**: "Juan Pérez"

**Asistente**: "¿Cuál es tu número de teléfono?"
**Tú**: "555-123-4567"

**Asistente**: "Perfecto. Hemos registrado tu información. Un miembro de nuestro equipo te contactará pronto. ¡Gracias por llamar a Legacy Prime Construction!"

## ✅ Paso 6: Verificar en el CRM

1. Ve a la pestaña **CRM** en tu app
2. Verifica que el nuevo cliente aparezca en la lista:
   - **Nombre**: Juan Pérez
   - **Teléfono**: 555-123-4567
   - **Status**: Lead
   - **Source**: Phone Call (o similar)
   - **Notas**: Incluirá las respuestas a las preguntas de calificación

3. Revisa los **Call Logs**:
   - Haz clic en **"Call Logs"** (arriba a la derecha en CRM)
   - Deberías ver un registro de la llamada con:
     - Duración de la llamada
     - Estado (completed, busy, failed, etc.)
     - Timestamp
     - Información capturada

## 🔍 Paso 7: Monitorear y Ajustar

### Ver Registros de Llamadas en Twilio

1. Ve a Twilio Console → **Monitor** → **Logs** → **Calls**
2. Verás todas las llamadas:
   - Status: completed, busy, no-answer, failed
   - Duration: duración de la llamada
   - Cost: costo de la llamada

### Ver Transcripciones (Opcional)

Si habilitaste transcripciones en Twilio:
1. Ve a la llamada específica
2. Haz clic en **"Recordings"**
3. Verás la transcripción de la conversación

## 🎯 Funcionalidades Avanzadas

### 1. Integrar con el CRM Automáticamente

El código actual en `backend/trpc/routes/twilio/create-virtual-assistant/route.ts` genera el TwiML, pero necesitas crear el endpoint que procese las respuestas.

Crea el archivo `backend/twilio-webhook.ts`:

```typescript
import { Hono } from 'hono';
import twilio from 'twilio';

const app = new Hono();

app.post('/api/twilio/assistant', async (c) => {
  const body = await c.req.parseBody();
  const { SpeechResult, CallSid } = body;

  // Aquí procesarías la respuesta con IA
  // Por ejemplo, usando generateText de @rork/toolkit-sdk
  
  const twiml = new twilio.twiml.VoiceResponse();
  
  // Ejemplo de flujo conversacional
  if (!SpeechResult) {
    twiml.say('Lo siento, no escuché tu respuesta. ¿Puedes repetir?');
  } else {
    // Aquí analizarías la respuesta y generarías la siguiente pregunta
    twiml.say('Gracias por tu información. Un representante te contactará pronto.');
  }

  return c.text(twiml.toString(), 200, {
    'Content-Type': 'text/xml'
  });
});

export default app;
```

### 2. Enviar Notificaciones SMS Después de la Llamada

```typescript
// Después de agregar el lead al CRM
const sendSms = trpc.twilio.sendSms.useMutation();

await sendSms.mutateAsync({
  to: newClient.phone,
  body: `Hola ${newClient.name}, gracias por tu llamada. Un miembro de nuestro equipo te contactará en las próximas 24 horas. - Legacy Prime Construction`
});
```

### 3. Integrar con IA para Respuestas Inteligentes

Puedes usar la API de OpenAI o similar para generar respuestas dinámicas:

```typescript
import { generateText } from '@rork/toolkit-sdk';

const response = await generateText({
  messages: [
    { role: 'user', content: `El cliente dijo: "${SpeechResult}". Genera una respuesta profesional y empática para Legacy Prime Construction.` }
  ]
});

twiml.say(response);
```

## ❗ Solución de Problemas

### La llamada no se conecta
- Verifica que el webhook URL sea accesible públicamente
- Revisa que las credenciales de Twilio sean correctas
- Asegúrate de que el número de Twilio tenga capacidad "Voice"

### La asistente no responde
- Verifica los logs en Twilio Console
- Revisa que el webhook esté devolviendo TwiML válido
- Chequea los logs del servidor backend

### No se agregan clientes al CRM
- Verifica que `autoAddToCRM` esté habilitado
- Revisa que la lógica de procesamiento esté capturando correctamente los datos
- Chequea los permisos de la base de datos

### Costos inesperados
- Llamadas: ~$0.013 por minuto en USA
- SMS: ~$0.0075 por mensaje en USA
- Números: ~$1-2 por mes
- Revisa tu uso en Twilio Console → Billing

## 📚 Recursos Adicionales

- [Documentación de Twilio Voice](https://www.twilio.com/docs/voice)
- [TwiML Reference](https://www.twilio.com/docs/voice/twiml)
- [Twilio AI Assistant](https://www.twilio.com/docs/voice/ai-assistant)
- [TWILIO_INTEGRATION.md](./TWILIO_INTEGRATION.md) (archivo en tu proyecto)

## 💡 Consejos

1. **Prueba primero con cuenta de prueba**: Twilio ofrece crédito gratis para probar
2. **Usa mensajes claros**: La IA funciona mejor con instrucciones claras
3. **Monitorea los costos**: Revisa regularmente tu uso en Twilio Console
4. **Guarda las conversaciones**: Habilita grabaciones para revisar y mejorar
5. **Itera y mejora**: Ajusta las preguntas basado en las respuestas de los clientes

## 🎉 ¡Listo!

Ahora tu recepcionista virtual debería estar funcionando. Cada vez que alguien llame al número de Twilio:
1. ✅ La asistente responderá automáticamente
2. ✅ Calificará al prospecto con tus preguntas
3. ✅ Agregará los leads serios al CRM
4. ✅ Programará seguimientos automáticos
5. ✅ Te notificará para que puedas contactarlos

¿Preguntas? Revisa los logs en:
- **App CRM**: Botón "Call Logs"
- **Twilio Console**: Monitor → Logs → Calls
- **Backend logs**: Consola del servidor
