# Flujo de Inspección del Cliente

## Resumen

Cuando un contratista envía un enlace de inspección desde el CRM, el cliente recibe un SMS con un enlace personalizado que lo lleva a una experiencia guiada para recopilar información del proyecto.

## Flujo Completo

### 1. Envío del Enlace (Contratista)

**Ubicación:** CRM → Botón "Send Inspection Link"

- El contratista selecciona un cliente y hace clic en "Send Inspection Link"
- El sistema envía un SMS vía Twilio con un enlace personalizado
- El enlace contiene información del cliente y proyecto codificada en el token

**Endpoint:** `backend/trpc/routes/crm/send-inspection-link/route.ts`

### 2. Página de Bienvenida (Cliente)

**Ruta:** `/inspection/[token]`

- El cliente abre el enlace y ve una página de bienvenida personalizada
- Se explican los 3 pasos del proceso:
  1. Responder preguntas sobre el proyecto
  2. Subir archivos adicionales (opcional)
  3. Recibir estimado preliminar

### 3. Entrevista con AI (Cliente)

- **AI Conversacional:** El sistema inicia una conversación natural con el cliente
- **Preguntas Dinámicas:** El AI hace preguntas adaptadas a las respuestas del cliente:
  - Tipo de proyecto
  - Detalles del trabajo
  - Habitaciones/áreas involucradas
  - Medidas
  - Requerimientos especiales
  - Línea de tiempo
  - Presupuesto

- **Captura de Respuestas:** El AI utiliza la herramienta `saveScopeOfWork` para estructurar toda la información en un scope of work detallado

- **Grabación de Voz:** El cliente puede grabar notas de voz presionando el botón de micrófono

### 4. Subida de Archivos (Cliente)

**Opciones disponibles:**

1. **Tomar Foto:** Abre la cámara del dispositivo
   - Usa `expo-image-picker` con `launchCameraAsync`
   
2. **Elegir Fotos:** Abre la galería de fotos
   - Usa `expo-image-picker` con `launchImageLibraryAsync`
   - Permite selección múltiple
   
3. **Subir Planos:** Abre el explorador de archivos
   - Usa `expo-document-picker`
   - Acepta PDF e imágenes

**Tipos de archivos soportados:**
- Fotos: JPEG, PNG
- Videos: MP4
- Audio: M4A (grabaciones de voz)
- Planos: PDF, imágenes

### 5. Envío de Datos (Cliente)

Cuando el cliente presiona "Submit":

1. Se recopila toda la información:
   - Scope of Work generado por AI
   - Transcripción completa de la conversación
   - Lista de archivos subidos

2. Se envía al backend mediante `submitInspectionData` mutation

3. El cliente ve una pantalla de confirmación

**Endpoint:** `backend/trpc/routes/crm/submit-inspection-data/route.ts`

### 6. Recepción de Datos (Contratista)

**Actual:**
- Los datos se logean en la consola del backend
- Incluye: nombre del cliente, project ID, scope of work, transcripción, archivos

**Por Implementar:**
1. Guardar archivos en almacenamiento (Cloud Storage o sistema de archivos)
2. Crear o actualizar registro del proyecto
3. Generar estimado preliminar usando AI con el price list
4. Enviar notificación al contratista
5. Agregar entrada al timeline del proyecto

## Estructura de Datos

### Token del Enlace
```
client=John%20Doe&project=new
```

### Archivos Subidos
```typescript
{
  id: string;
  type: 'photo' | 'plan' | 'video';
  uri: string;
  name: string;
  mimeType: string;
}
```

### Scope of Work
```
Project Type: Kitchen Remodel

Details: Complete kitchen renovation including cabinets, countertops, and appliances

Rooms: Kitchen, Dining Area

Measurements: 15x20 feet

Special Requirements: Energy-efficient appliances preferred

Timeline: Start in 2 months

Budget: $50,000-$75,000
```

## Próximos Pasos

1. **Almacenamiento de Archivos:**
   - Implementar servicio de almacenamiento (AWS S3, Google Cloud Storage, etc.)
   - Guardar archivos con estructura: `projects/{projectId}/inspection/{fileId}`

2. **Generación de Estimado:**
   - Usar AI para analizar scope of work
   - Mapear items al price list
   - Generar estimado preliminar automáticamente

3. **Sistema de Notificaciones:**
   - Enviar push notification al contratista
   - Enviar email con resumen del proyecto
   - Actualizar contador de inspecciones pendientes en CRM

4. **Integración con Proyectos:**
   - Crear proyecto automáticamente si no existe
   - Agregar archivos a la carpeta del proyecto
   - Marcar cliente como "Inspection Completed"

5. **Follow-up Automático:**
   - Agendar follow-up en 24-48 horas
   - Enviar SMS de confirmación al cliente
   - Actualizar status en CRM

## Configuración Requerida

### Variables de Entorno

```env
# Twilio (para enviar SMS con el enlace)
EXPO_PUBLIC_TWILIO_ACCOUNT_SID=your_account_sid
EXPO_PUBLIC_TWILIO_AUTH_TOKEN=your_auth_token
EXPO_PUBLIC_TWILIO_PHONE_NUMBER=+1234567890

# URL de la app (para generar el enlace)
EXPO_PUBLIC_APP_URL=https://yourdomain.com
```

### Permisos en Dispositivo Móvil

La app solicita automáticamente:
- Permisos de cámara (para tomar fotos)
- Permisos de biblioteca de fotos (para seleccionar imágenes)
- Permisos de micrófono (para grabaciones de voz)

## Experiencia del Usuario

1. **Móvil First:** Diseñado específicamente para dispositivos móviles
2. **Progresivo:** Flujo paso a paso fácil de seguir
3. **Flexible:** El cliente puede omitir la subida de archivos si lo desea
4. **Conversacional:** Interfaz natural de chat con AI
5. **Visual:** Soporte completo para fotos, videos y documentos

## Beneficios

### Para el Contratista:
- Información estructurada y completa del proyecto
- Menos llamadas telefónicas de seguimiento
- Estimados más rápidos y precisos
- Mejor experiencia del cliente

### Para el Cliente:
- Proceso simple y rápido (5-10 minutos)
- Puede hacerlo en cualquier momento
- No necesita describir todo por teléfono
- Puede mostrar visualmente el proyecto
