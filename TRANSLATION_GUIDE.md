# Translation Guide

This app now supports multi-language functionality with English and Spanish. Here's how to use it:

## For Users

### Switching Languages

1. Look for the language switcher button in the top-right corner of any tab (shows "EN" or "ES")
2. Tap the button to open the language selection modal
3. Choose your preferred language (English 🇺🇸 or Español 🇪🇸)
4. The app will immediately switch to the selected language
5. Your preference is saved and will persist across app restarts

## For Developers

### Using Translations in Components

Import the `useTranslation` hook from `react-i18next`:

```typescript
import { useTranslation } from 'react-i18next';

export default function MyComponent() {
  const { t } = useTranslation();
  
  return (
    <View>
      <Text>{t('common.dashboard')}</Text>
      <Text>{t('dashboard.title')}</Text>
    </View>
  );
}
```

### Translation Keys

All translation keys are organized in `/locales/en.json` and `/locales/es.json`:

- `common.*` - Common UI elements (buttons, labels, etc.)
- `dashboard.*` - Dashboard screen translations
- `crm.*` - CRM screen translations
- `clock.*` - Time clock translations
- `expenses.*` - Expenses screen translations
- `photos.*` - Photos screen translations
- `schedule.*` - Schedule screen translations
- `chat.*` - Chat screen translations
- `settings.*` - Settings translations
- `projects.*` - Project-related translations
- `estimates.*` - Estimate-related translations
- `forms.*` - Form field labels
- `messages.*` - Success/error messages

### Adding New Translations

1. Add the key and value to both `/locales/en.json` and `/locales/es.json`
2. Use nested objects to organize related translations:

```json
{
  "myFeature": {
    "title": "My Feature",
    "subtitle": "Feature description",
    "actions": {
      "save": "Save",
      "cancel": "Cancel"
    }
  }
}
```

3. Access nested translations with dot notation:

```typescript
t('myFeature.title')
t('myFeature.actions.save')
```

### Current Language Access

To get the current language or change it programmatically:

```typescript
import { useLanguage } from '@/contexts/LanguageContext';

export default function MyComponent() {
  const { currentLanguage, changeLanguage } = useLanguage();
  
  console.log('Current language:', currentLanguage); // 'en' or 'es'
  
  // Change language programmatically
  changeLanguage('es');
}
```

### Best Practices

1. **Always use translation keys** instead of hardcoded strings for user-facing text
2. **Keep translations consistent** - use the same terminology throughout
3. **Use descriptive key names** - `dashboard.createNewProject` is better than `dashboard.button1`
4. **Group related translations** - use nested objects for better organization
5. **Test both languages** - ensure all text is properly translated and fits in the UI
6. **Avoid concatenation** - use template strings in translations instead:
   ```json
   {
     "greeting": "Hello, {{name}}!"
   }
   ```
   ```typescript
   t('greeting', { name: 'John' })
   ```

### Example: Updating a Screen

Before (hardcoded text):
```typescript
<Text style={styles.title}>Dashboard</Text>
<TouchableOpacity>
  <Text>Add Project</Text>
</TouchableOpacity>
```

After (with translations):
```typescript
import { useTranslation } from 'react-i18next';

const { t } = useTranslation();

<Text style={styles.title}>{t('dashboard.title')}</Text>
<TouchableOpacity>
  <Text>{t('dashboard.addProject')}</Text>
</TouchableOpacity>
```

## Implementation Details

### Architecture

- **i18next** - Core internationalization framework
- **react-i18next** - React bindings for i18next
- **expo-localization** - Device locale detection
- **AsyncStorage** - Persists user's language preference
- **Context API** - Language state management with `@nkzw/create-context-hook`

### Files

- `/lib/i18n.ts` - i18n configuration
- `/locales/en.json` - English translations
- `/locales/es.json` - Spanish translations
- `/contexts/LanguageContext.tsx` - Language state management
- `/components/LanguageSwitcher.tsx` - Language switcher UI component

### Automatic Language Detection

The app automatically detects the device's language on first launch:
- If device language is Spanish, app starts in Spanish
- Otherwise, defaults to English
- User can override at any time using the language switcher
