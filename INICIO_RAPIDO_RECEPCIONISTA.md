# 🚀 Inicio Rápido: Recepcionista Virtual

## Pasos Rápidos para Probar en 5 Minutos

### 1. Obtener Credenciales de Twilio (2 min)

1. Ve a [https://www.twilio.com/try-twilio](https://www.twilio.com/try-twilio)
2. Regístrate con tu email
3. Verifica tu teléfono
4. En el dashboard, copia:
   - **Account SID**
   - **Auth Token** 
5. Ve a **Phone Numbers** y obtén tu número de prueba gratis

### 2. Configurar Variables de Entorno (1 min)

Crea un archivo `.env` en la raíz del proyecto:

```env
EXPO_PUBLIC_TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxx
EXPO_PUBLIC_TWILIO_AUTH_TOKEN=tu_token_aqui
EXPO_PUBLIC_TWILIO_PHONE_NUMBER=+15551234567
```

### 3. Exponer tu Servidor Local (1 min)

```bash
# Terminal 1: Inicia tu app
npm start

# Terminal 2: Instala y ejecuta ngrok
npx ngrok http 8081
```

Copia el URL que te da ngrok (ejemplo: `https://abc123.ngrok.io`)

### 4. Configurar Twilio (1 min)

1. En Twilio Console → **Phone Numbers** → Tu número
2. En **Voice & Fax**:
   - **A CALL COMES IN**: Webhook
   - **URL**: `https://abc123.ngrok.io/api/twilio/assistant`
   - **HTTP**: POST
3. Guarda

### 5. ¡Prueba! (30 seg)

Llama al número de Twilio desde tu teléfono y habla con la asistente virtual 🎉

## URLs Importantes

- Twilio Console: https://console.twilio.com/
- Ngrok Dashboard: https://dashboard.ngrok.com/
- Guía Completa: Ver [GUIA_RECEPCIONISTA_VIRTUAL.md](./GUIA_RECEPCIONISTA_VIRTUAL.md)

## Verificar que Funciona

✅ La asistente responde al llamar
✅ Puedes hablar y ella escucha
✅ Te hace preguntas
✅ Se agrega al CRM automáticamente

## Solución Rápida de Problemas

**No contesta la llamada:**
- Verifica que ngrok esté corriendo
- Revisa que el webhook URL esté correcto en Twilio
- Chequea los logs en Twilio Console

**Error de credenciales:**
- Verifica que las variables de entorno estén correctas
- Reinicia tu servidor después de agregar el `.env`

**La asistente no entiende:**
- Habla claramente y espera a que termine de hablar
- Twilio funciona mejor en ambientes silenciosos
- Puedes cambiar el idioma en la configuración

## Siguiente Paso

Una vez que funcione, personaliza tu recepcionista en:
- **App** → **CRM** → **Call Assistant** → Configura tu saludo y preguntas

---

📖 **Guía Completa**: [GUIA_RECEPCIONISTA_VIRTUAL.md](./GUIA_RECEPCIONISTA_VIRTUAL.md)
