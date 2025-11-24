# Integración de OpenAI

Esta aplicación cuenta con una integración completa y segura con OpenAI en el backend. Todas las API keys se manejan de forma segura en el servidor.

## Configuración

### 1. Variables de Entorno

Debes configurar la siguiente variable de entorno en tu servidor:

```bash
OPENAI_API_KEY=tu_api_key_aqui
```

**IMPORTANTE**: Nunca expongas tu API key en el cliente. Todas las llamadas a OpenAI se realizan desde el backend.

## Rutas Disponibles

Todas las rutas están disponibles a través de tRPC en `trpc.openai.*`

### 1. Chat Completion (GPT-4)

Realiza conversaciones con GPT-4 o cualquier otro modelo de OpenAI.

```typescript
import { trpc } from '@/lib/trpc';

// En un componente React
const chatMutation = trpc.openai.chat.useMutation();

const sendMessage = async () => {
  const result = await chatMutation.mutateAsync({
    messages: [
      { role: 'system', content: 'Eres un asistente útil para construcción.' },
      { role: 'user', content: '¿Cómo calculo el concreto para una losa?' }
    ],
    model: 'gpt-4o', // opcional, por defecto 'gpt-4o'
    temperature: 0.7, // opcional, por defecto 0.7
    maxTokens: 1000, // opcional
  });

  if (result.success) {
    console.log('Respuesta:', result.message);
    console.log('Uso:', result.usage);
  }
};

// Fuera de React
import { trpcClient } from '@/lib/trpc';

const result = await trpcClient.openai.chat.mutate({
  messages: [
    { role: 'user', content: '¿Qué materiales necesito?' }
  ],
});
```

**Parámetros**:
- `messages`: Array de mensajes con `role` ('user', 'assistant', 'system') y `content`
- `model`: Modelo a usar (opcional, por defecto 'gpt-4o')
- `temperature`: Creatividad de la respuesta 0-1 (opcional, por defecto 0.7)
- `maxTokens`: Límite de tokens en la respuesta (opcional)

**Respuesta**:
```typescript
{
  success: boolean;
  message: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
  error?: string;
}
```

### 2. Speech-to-Text (Whisper)

Convierte audio a texto usando Whisper de OpenAI.

```typescript
import { trpc } from '@/lib/trpc';
import * as FileSystem from 'expo-file-system';

// En un componente React
const sttMutation = trpc.openai.speechToText.useMutation();

const transcribeAudio = async (audioUri: string) => {
  // Leer el archivo de audio y convertirlo a base64
  const audioBase64 = await FileSystem.readAsStringAsync(audioUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const result = await sttMutation.mutateAsync({
    audioBase64,
    language: 'es', // opcional, auto-detecta si no se especifica
    prompt: 'Transcripción de audio relacionado con construcción', // opcional, ayuda a mejorar precisión
  });

  if (result.success) {
    console.log('Transcripción:', result.text);
  }
};
```

**Parámetros**:
- `audioBase64`: Audio codificado en base64 (string)
- `language`: Código de idioma ISO (opcional, ej: 'es', 'en')
- `prompt`: Texto que ayuda al contexto (opcional)

**Respuesta**:
```typescript
{
  success: boolean;
  text: string;
  error?: string;
}
```

### 3. Text-to-Speech (TTS)

Convierte texto a audio usando las voces de OpenAI.

```typescript
import { trpc } from '@/lib/trpc';
import { Audio } from 'expo-av';

const ttsMutation = trpc.openai.textToSpeech.useMutation();

const speakText = async (text: string) => {
  const result = await ttsMutation.mutateAsync({
    text: '¡Hola! Este es un mensaje de audio generado.',
    voice: 'nova', // opcional: 'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'
    model: 'tts-1', // opcional: 'tts-1' o 'tts-1-hd'
  });

  if (result.success) {
    // Reproducir el audio
    const { sound } = await Audio.Sound.createAsync(
      { uri: `data:${result.mimeType};base64,${result.audioBase64}` }
    );
    await sound.playAsync();
  }
};
```

**Parámetros**:
- `text`: Texto a convertir en audio (string)
- `voice`: Voz a usar (opcional, por defecto 'nova')
  - Opciones: 'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'
- `model`: Modelo a usar (opcional, por defecto 'tts-1')
  - 'tts-1': Más rápido
  - 'tts-1-hd': Mayor calidad

**Respuesta**:
```typescript
{
  success: boolean;
  audioBase64: string;
  mimeType: string;
  error?: string;
}
```

### 4. Image Analysis (Vision)

Analiza imágenes usando GPT-4 Vision.

```typescript
import { trpc } from '@/lib/trpc';
import * as FileSystem from 'expo-file-system';

const imageAnalysisMutation = trpc.openai.imageAnalysis.useMutation();

// Opción 1: Usar URL de imagen
const analyzeImageUrl = async () => {
  const result = await imageAnalysisMutation.mutateAsync({
    imageUrl: 'https://example.com/image.jpg',
    prompt: '¿Qué daños estructurales ves en esta imagen?',
    maxTokens: 500,
  });

  if (result.success) {
    console.log('Análisis:', result.analysis);
  }
};

// Opción 2: Usar imagen en base64
const analyzeImageBase64 = async (imageUri: string) => {
  const imageBase64 = await FileSystem.readAsStringAsync(imageUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const result = await imageAnalysisMutation.mutateAsync({
    imageBase64,
    prompt: 'Describe los materiales de construcción en esta imagen',
    model: 'gpt-4o',
    maxTokens: 500,
  });

  if (result.success) {
    console.log('Análisis:', result.analysis);
  }
};
```

**Parámetros**:
- `imageUrl`: URL de la imagen (opcional, usar esto O imageBase64)
- `imageBase64`: Imagen codificada en base64 (opcional, usar esto O imageUrl)
- `prompt`: Pregunta o instrucción sobre la imagen (opcional, por defecto describe la imagen)
- `model`: Modelo a usar (opcional, por defecto 'gpt-4o')
- `maxTokens`: Límite de tokens en la respuesta (opcional, por defecto 500)

**Respuesta**:
```typescript
{
  success: boolean;
  analysis: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  error?: string;
}
```

## Ejemplos de Uso en la App

### Ejemplo 1: Asistente de Chat con Voz

```typescript
import { useState } from 'react';
import { View, Button, Text } from 'react-native';
import { Audio } from 'expo-av';
import { trpc } from '@/lib/trpc';

export default function VoiceAssistant() {
  const [recording, setRecording] = useState<Audio.Recording>();
  const [response, setResponse] = useState('');

  const sttMutation = trpc.openai.speechToText.useMutation();
  const chatMutation = trpc.openai.chat.useMutation();
  const ttsMutation = trpc.openai.textToSpeech.useMutation();

  const startRecording = async () => {
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') return;

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    setRecording(recording);
  };

  const stopRecording = async () => {
    if (!recording) return;

    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecording(undefined);

    if (!uri) return;

    // 1. Transcribir audio
    const audioBase64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const transcription = await sttMutation.mutateAsync({ audioBase64 });
    
    if (!transcription.success) return;

    // 2. Enviar al chat
    const chatResponse = await chatMutation.mutateAsync({
      messages: [
        { role: 'system', content: 'Eres un asistente de construcción.' },
        { role: 'user', content: transcription.text }
      ],
    });

    if (!chatResponse.success) return;

    setResponse(chatResponse.message);

    // 3. Convertir respuesta a voz
    const ttsResponse = await ttsMutation.mutateAsync({
      text: chatResponse.message,
      voice: 'nova',
    });

    if (ttsResponse.success) {
      const { sound } = await Audio.Sound.createAsync(
        { uri: `data:${ttsResponse.mimeType};base64,${ttsResponse.audioBase64}` }
      );
      await sound.playAsync();
    }
  };

  return (
    <View>
      <Button
        title={recording ? 'Detener' : 'Grabar'}
        onPress={recording ? stopRecording : startRecording}
      />
      {response && <Text>{response}</Text>}
    </View>
  );
}
```

### Ejemplo 2: Análisis de Imágenes de Obra

```typescript
import { trpc } from '@/lib/trpc';
import * as ImagePicker from 'expo-image-picker';

export default function ImageAnalysis() {
  const imageAnalysisMutation = trpc.openai.imageAnalysis.useMutation();

  const analyzePhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      base64: true,
    });

    if (result.canceled || !result.assets[0].base64) return;

    const analysis = await imageAnalysisMutation.mutateAsync({
      imageBase64: result.assets[0].base64,
      prompt: 'Analiza esta imagen de construcción e identifica: 1) Materiales visibles, 2) Posibles problemas de seguridad, 3) Estado de avance de la obra',
      maxTokens: 800,
    });

    if (analysis.success) {
      console.log('Análisis completo:', analysis.analysis);
    }
  };

  return <Button title="Analizar Foto" onPress={analyzePhoto} />;
}
```

## Seguridad

1. **API Keys**: Todas las API keys se almacenan de forma segura en variables de entorno del servidor
2. **Validación**: Todas las entradas se validan usando Zod antes de enviarlas a OpenAI
3. **Rate Limiting**: Considera implementar rate limiting en producción
4. **Logging**: Los errores se registran en el servidor para debugging

## Costos

Ten en cuenta los costos de la API de OpenAI:
- **GPT-4o**: ~$5 por 1M tokens de entrada, ~$15 por 1M tokens de salida
- **Whisper**: ~$0.006 por minuto de audio
- **TTS**: ~$15 por 1M caracteres
- **Vision**: ~$5-10 por 1M tokens (varía según resolución)

## Mejoras Futuras

1. **Streaming**: Implementar streaming para respuestas de chat en tiempo real
2. **Cache**: Cachear respuestas comunes para reducir costos
3. **Función Calling**: Usar function calling de OpenAI para integraciones más avanzadas
4. **Embeddings**: Implementar búsqueda semántica con embeddings
5. **Fine-tuning**: Entrenar modelos personalizados para tu dominio específico

## Soporte

Para más información sobre la API de OpenAI, visita: https://platform.openai.com/docs
