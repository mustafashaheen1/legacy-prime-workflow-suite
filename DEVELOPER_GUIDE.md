# 👨‍💻 Legacy Prime Workflow Suite - Developer Guide

## 🏗️ Project Architecture

### Tech Stack
- **Framework**: React Native + Expo (SDK 54)
- **Language**: TypeScript (strict mode)
- **Routing**: Expo Router (file-based)
- **Backend**: tRPC + Hono
- **State Management**: React Context + AsyncStorage
- **Styling**: React Native StyleSheet
- **AI Integration**: Custom AI SDK (@rork/toolkit-sdk)

### Project Structure
```
.
├── app/                       # Routes (Expo Router)
│   ├── (tabs)/               # Tab navigation
│   │   ├── dashboard.tsx     # Main dashboard
│   │   ├── crm.tsx          # Client management
│   │   ├── clock.tsx        # Time tracking
│   │   ├── expenses.tsx     # Expense tracking
│   │   ├── photos.tsx       # Photo documentation
│   │   ├── schedule.tsx     # Project schedule
│   │   └── chat.tsx         # Internal chat
│   ├── (auth)/              # Authentication screens
│   ├── project/[id]/        # Project details
│   └── _layout.tsx          # Root layout
├── backend/                  # Backend API
│   ├── hono.ts              # Server entry point
│   └── trpc/                # tRPC routes
├── components/              # Reusable components
├── contexts/                # React context providers
│   └── AppContext.tsx       # Main app state
├── hooks/                   # Custom hooks
│   └── usePermissions.ts    # Permission checking
├── lib/                     # Utilities
│   ├── trpc.ts             # tRPC client
│   ├── seed-data.ts        # Data seeding
│   └── permissions.ts      # Permission definitions
├── mocks/                   # Mock/fixture data
│   ├── data.ts             # Legacy mock data
│   ├── fixtures.ts         # Comprehensive fixtures
│   └── priceList.ts        # Master price list
├── types/                   # TypeScript types
│   └── index.ts            # All type definitions
└── constants/              # App constants
    └── colors.ts           # Color palette
```

## 🎯 Key Features Implementation

### 1. Role-Based Access Control

**File**: `lib/permissions.ts`, `hooks/usePermissions.ts`

```typescript
// Check permission
const { hasPermission } = usePermissions();
if (hasPermission('view:reports')) {
  // Show reports
}
```

**Available Roles:**
- `super-admin` - Full system access
- `admin` - Company-wide access
- `salesperson` - Sales and CRM access
- `field-employee` - Limited field operations

### 2. Data Seeding System

**File**: `lib/seed-data.ts`

The app automatically seeds data on first launch:
- Checks seed version to avoid duplicate seeding
- Loads fixture data into AsyncStorage
- Sets default company and user

```typescript
// Manually reseed data (for development)
import { reseedData } from '@/lib/seed-data';
await reseedData();
```

### 3. State Management

**File**: `contexts/AppContext.tsx`

All app state is managed through a single context:

```typescript
const {
  user,
  company,
  projects,
  clients,
  expenses,
  addProject,
  updateProject,
  // ... more state and actions
} = useApp();
```

**State Persistence:**
- User data → AsyncStorage
- Company data → AsyncStorage
- Conversations, payments, change orders → AsyncStorage
- Projects, clients, photos → In-memory (mock data)

### 4. Backend Integration

**File**: `backend/trpc/app-router.ts`

tRPC routes are organized by feature:

```typescript
export const appRouter = createTRPCRouter({
  auth: createTRPCRouter({
    login: loginProcedure,
  }),
  users: createTRPCRouter({
    createUser: createUserProcedure,
    getUsers: getUsersProcedure,
    updateUser: updateUserProcedure,
  }),
  payments: createTRPCRouter({
    addPayment: addPaymentProcedure,
    getPayments: getPaymentsProcedure,
  }),
  // ... more routes
});
```

**Usage in Client:**
```typescript
// In React component
const { data, isLoading } = trpc.users.getUsers.useQuery();

// Outside React
const users = await trpcClient.users.getUsers.query();
```

### 5. AI Integration

**Features:**
- Chat with context-aware AI
- Generate text and objects
- Create and edit images
- Speech-to-text

```typescript
import { useRorkAgent, generateText, generateObject } from '@rork/toolkit-sdk';

// For chat
const { messages, sendMessage } = useRorkAgent({
  tools: { /* custom tools */ }
});

// For simple generation
const text = await generateText("Summarize this project");
const data = await generateObject({
  schema: z.object({ title: z.string() }),
  messages: [{ role: 'user', content: 'Generate title' }]
});
```

## 📱 Mobile-Specific Features

### 1. Location Tracking (Clock In/Out)

Uses Expo Location API with background tracking:
- Requests foreground and background permissions
- Tracks location on clock in
- Stores coordinates with clock entries

### 2. Camera & Photo Management

- Camera integration for project photos
- Image picker for existing photos
- Photo categorization by construction phase

### 3. Offline Support

The app works offline with cached data:
- AsyncStorage for persistence
- Queue sync operations for when online
- Mock data for immediate UX

## 🎨 Design System

### Colors
Defined in `constants/colors.ts`:
- Primary blues for main actions
- Greens for success states
- Reds for warnings/errors
- Grays for neutral elements

### Typography
Standard React Native Text component with inline styles

### Components
Atomic design principle:
- Small, reusable components
- Composition over inheritance
- Props for customization

## 🧪 Testing Approach

### Unit Tests
Focus on:
- Permission logic
- Data transformations
- Utility functions

### Integration Tests
Focus on:
- User flows (login → create project → add expense)
- State management
- Backend API calls

### E2E Tests
Use Detox or Maestro for:
- Critical user paths
- Cross-platform compatibility

## 🚀 Deployment

### Development
```bash
npm start
# or
npx expo start
```

### Preview Builds
```bash
# iOS
eas build --platform ios --profile preview

# Android
eas build --platform android --profile preview
```

### Production Builds
```bash
# iOS
eas build --platform ios --profile production

# Android  
eas build --platform android --profile production
```

### Web Deployment
```bash
npx expo export:web
# Deploy static files to hosting service
```

## 🔧 Development Tips

### 1. Adding New Routes

Create file in `app/` directory:
```typescript
// app/new-feature.tsx
import { Stack } from 'expo-router';

export default function NewFeature() {
  return (
    <>
      <Stack.Screen options={{ title: 'New Feature' }} />
      {/* Your content */}
    </>
  );
}
```

### 2. Adding New Backend Endpoints

1. Create route file: `backend/trpc/routes/feature/action/route.ts`
2. Export procedure
3. Add to `backend/trpc/app-router.ts`

### 3. Adding New Types

Add to `types/index.ts`:
```typescript
export interface NewType {
  id: string;
  name: string;
  // ... more fields
}
```

### 4. Adding Fixture Data

Add to `mocks/fixtures.ts`:
```typescript
export const fixtureNewData: NewType[] = [
  { id: '1', name: 'Example' },
  // ... more fixtures
];
```

### 5. Debugging

**React Native Debugger:**
```bash
npm install -g react-native-debugger
```

**Console Logs:**
All features have extensive console logging:
- `[App]` - App initialization
- `[Seed]` - Data seeding
- `[Storage]` - Persistence operations
- `[Project]` - Project operations
- `[Expense]` - Expense tracking

**Inspect Storage:**
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

// View all keys
const keys = await AsyncStorage.getAllKeys();
console.log(keys);

// View specific item
const data = await AsyncStorage.getItem('user');
console.log(JSON.parse(data));
```

## 🔐 Security Best Practices

1. **Never commit secrets** - Use environment variables
2. **Validate all inputs** - Use Zod schemas
3. **Check permissions** - Before every sensitive operation
4. **Sanitize data** - Before displaying user input
5. **Use HTTPS** - For all API calls

## 📊 Performance Optimization

1. **Lazy loading** - Use React.lazy() for large components
2. **Memoization** - Use React.memo(), useMemo(), useCallback()
3. **FlatList** - For large lists instead of ScrollView
4. **Image optimization** - Use Expo Image with caching
5. **Bundle size** - Monitor with `npx expo export --dump-sourcemap`

## 🐛 Common Issues

### Issue: White screen on launch
**Solution**: Check console for errors, verify all providers are wrapped correctly

### Issue: Permission denied
**Solution**: Check role permissions in `lib/permissions.ts`

### Issue: Data not persisting
**Solution**: Verify AsyncStorage operations, check for errors in console

### Issue: Backend not responding
**Solution**: Ensure `process.env.EXPO_PUBLIC_TOOLKIT_URL` is set

### Issue: Build fails
**Solution**: Clear cache with `npx expo start -c`

## 📚 Additional Resources

- [Expo Documentation](https://docs.expo.dev/)
- [React Native Documentation](https://reactnative.dev/)
- [tRPC Documentation](https://trpc.io/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/amazing-feature`
2. Make changes
3. Test thoroughly
4. Commit: `git commit -m 'Add amazing feature'`
5. Push: `git push origin feature/amazing-feature`
6. Create Pull Request

---

**Last Updated**: January 2025  
**Maintainer**: Development Team
