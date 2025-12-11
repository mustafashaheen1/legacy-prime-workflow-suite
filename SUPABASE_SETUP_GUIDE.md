# Supabase Setup Guide for Legacy Prime Construction

This guide will walk you through setting up Supabase as your cloud database, migrating from local AsyncStorage to a synced cloud database.

## Table of Contents
1. [Create Supabase Project](#1-create-supabase-project)
2. [Run Database Setup](#2-run-database-setup)
3. [Configure Storage Buckets](#3-configure-storage-buckets)
4. [Set up Authentication](#4-set-up-authentication)
5. [Install Supabase in Your App](#5-install-supabase-in-your-app)
6. [Update Environment Variables](#6-update-environment-variables)
7. [Migrate Your Code](#7-migrate-your-code)

---

## 1. Create Supabase Project

### Step 1.1: Sign Up for Supabase
1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project"
3. Sign up with GitHub (recommended) or email

### Step 1.2: Create a New Project
1. Click "New Project"
2. Fill in the details:
   - **Name**: `legacy-prime-construction` (or your preferred name)
   - **Database Password**: Create a strong password (save this!)
   - **Region**: Choose closest to your users (e.g., `us-east-1` for US East Coast)
   - **Pricing Plan**: Start with Free tier
3. Click "Create new project"
4. Wait 2-3 minutes for project to initialize

### Step 1.3: Get Your Project Credentials
1. Go to **Project Settings** (gear icon in sidebar)
2. Click **API** tab
3. Copy and save these values:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)
   - **service_role key** (starts with `eyJ...`) - Keep this SECRET!

---

## 2. Run Database Setup

### Step 2.1: Open SQL Editor
1. In your Supabase dashboard, click **SQL Editor** in the left sidebar
2. Click **New query**

### Step 2.2: Run the Setup SQL
1. Open the `supabase-setup.sql` file from your project root
2. Copy ALL the SQL content
3. Paste it into the Supabase SQL Editor
4. Click **Run** (or press Cmd/Ctrl + Enter)
5. Wait for completion (should take 10-30 seconds)
6. You should see "Success. No rows returned" - this is correct!

### Step 2.3: Verify Tables Created
1. Click **Table Editor** in the left sidebar
2. You should see all your tables:
   - companies
   - users
   - projects
   - clients
   - expenses
   - photos
   - tasks
   - clock_entries
   - estimates
   - And many more...

---

## 3. Configure Storage Buckets

You need storage buckets for file uploads (photos, receipts, documents, etc.).

### Step 3.1: Create Storage Buckets
1. Click **Storage** in the left sidebar
2. Click **New bucket**
3. Create the following buckets:

#### Bucket 1: `photos`
- **Name**: `photos`
- **Public**: ✓ Yes (make files publicly accessible)
- Click **Create bucket**

#### Bucket 2: `receipts`
- **Name**: `receipts`
- **Public**: ✗ No (keep receipts private)
- Click **Create bucket**

#### Bucket 3: `documents`
- **Name**: `documents`
- **Public**: ✗ No (keep documents private)
- Click **Create bucket**

#### Bucket 4: `avatars`
- **Name**: `avatars`
- **Public**: ✓ Yes
- Click **Create bucket**

### Step 3.2: Set Storage Policies

For each PRIVATE bucket (receipts, documents), add these policies:

1. Click on the bucket name
2. Click **Policies** tab
3. Click **New policy**
4. Click **For full customization** → **Create policy**

**Policy for Authenticated Users:**
```sql
CREATE POLICY "Authenticated users can upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'receipts' AND auth.uid()::text = (storage.foldername(name))[1]);
```

Repeat for `documents` bucket (replace 'receipts' with 'documents').

---

## 4. Set up Authentication

### Step 4.1: Configure Auth Settings
1. Click **Authentication** in the left sidebar
2. Click **Settings** tab
3. Configure:
   - **Site URL**: Your app's URL (for web) or `exp://localhost:8081` for dev
   - **Redirect URLs**: Add `exp://localhost:8081` for Expo

### Step 4.2: Enable Email Auth
1. Go to **Authentication** → **Providers**
2. **Email** should be enabled by default
3. Configure email templates if desired

### Step 4.3: (Optional) Enable OAuth Providers
If you want social login:
- **Google**: Follow Supabase guide for Google OAuth
- **Apple**: Follow Supabase guide for Apple Sign In

---

## 5. Install Supabase in Your App

### Step 5.1: Install Dependencies
```bash
npm install @supabase/supabase-js --legacy-peer-deps
```

### Step 5.2: Create Supabase Client
Create a new file: `lib/supabase.ts`

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
```

---

## 6. Update Environment Variables

Add these to your `.env` file:

```env
# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...your-anon-key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...your-service-role-key

# Note: NEVER expose service_role_key to the frontend!
# Only use it in backend/server code
```

---

## 7. Migrate Your Code

### Step 7.1: Update AppContext to Use Supabase

Here's how to migrate from AsyncStorage to Supabase:

**OLD CODE (AsyncStorage):**
```typescript
const loadData = async () => {
  const storedUser = await AsyncStorage.getItem('user');
  setUserState(JSON.parse(storedUser));
};
```

**NEW CODE (Supabase):**
```typescript
import { supabase } from '@/lib/supabase';

const loadData = async () => {
  // Get current user
  const { data: { user: authUser } } = await supabase.auth.getUser();

  if (!authUser) return;

  // Fetch user data from database
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', authUser.id)
    .single();

  setUserState(user);

  // Fetch company data
  const { data: company } = await supabase
    .from('companies')
    .select('*')
    .eq('id', user.company_id)
    .single();

  setCompanyState(company);

  // Fetch projects
  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('company_id', user.company_id)
    .order('created_at', { ascending: false });

  setProjects(projects || []);
};
```

### Step 7.2: Update CRUD Operations

**OLD: Add Project (AsyncStorage)**
```typescript
const addProject = async (project: Project) => {
  const newProjects = [...projects, project];
  setProjects(newProjects);
  await AsyncStorage.setItem('projects', JSON.stringify(newProjects));
};
```

**NEW: Add Project (Supabase)**
```typescript
const addProject = async (project: Omit<Project, 'id' | 'created_at'>) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: userData } = await supabase
    .from('users')
    .select('company_id')
    .eq('id', user.id)
    .single();

  const { data, error } = await supabase
    .from('projects')
    .insert([
      {
        ...project,
        company_id: userData.company_id,
      }
    ])
    .select()
    .single();

  if (error) {
    console.error('Error adding project:', error);
    return;
  }

  setProjects([...projects, data]);
};
```

### Step 7.3: Set Up Real-time Subscriptions (Optional)

Enable real-time updates when data changes:

```typescript
useEffect(() => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Subscribe to projects changes
  const projectsSubscription = supabase
    .channel('projects-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'projects',
      },
      (payload) => {
        console.log('Project changed:', payload);
        loadProjects(); // Reload projects
      }
    )
    .subscribe();

  return () => {
    projectsSubscription.unsubscribe();
  };
}, []);
```

---

## 8. Authentication Implementation

### Step 8.1: Sign Up
```typescript
const signUp = async (email: string, password: string, companyName: string) => {
  // 1. Create auth user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
  });

  if (authError) throw authError;

  // 2. Create company
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .insert([{ name: companyName }])
    .select()
    .single();

  if (companyError) throw companyError;

  // 3. Create user profile
  const { data: user, error: userError } = await supabase
    .from('users')
    .insert([
      {
        id: authData.user!.id,
        email: authData.user!.email!,
        name: email.split('@')[0],
        role: 'admin',
        company_id: company.id,
      }
    ])
    .select()
    .single();

  if (userError) throw userError;

  return { user, company };
};
```

### Step 8.2: Sign In
```typescript
const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;

  // Load user data
  await loadData();

  return data;
};
```

### Step 8.3: Sign Out
```typescript
const signOut = async () => {
  await supabase.auth.signOut();
  // Clear local state
  setUserState(null);
  setCompanyState(null);
  setProjects([]);
  // ... clear other state
};
```

---

## 9. File Upload to Supabase Storage

### Upload Photos
```typescript
const uploadPhoto = async (uri: string, projectId: string) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // 1. Upload file to storage
  const fileName = `${user.id}/${Date.now()}.jpg`;
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('photos')
    .upload(fileName, {
      uri,
      type: 'image/jpeg',
      name: fileName,
    });

  if (uploadError) throw uploadError;

  // 2. Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('photos')
    .getPublicUrl(fileName);

  // 3. Create database record
  const { data, error } = await supabase
    .from('photos')
    .insert([
      {
        project_id: projectId,
        url: publicUrl,
        category: 'General',
        notes: '',
      }
    ])
    .select()
    .single();

  if (error) throw error;

  return data;
};
```

---

## 10. Testing Your Setup

### Test Database Connection
```typescript
const testConnection = async () => {
  const { data, error } = await supabase
    .from('companies')
    .select('count');

  if (error) {
    console.error('Connection failed:', error);
  } else {
    console.log('✅ Connected to Supabase!');
  }
};
```

### Test Auth
```typescript
const testAuth = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  console.log('Current user:', user);
};
```

---

## 11. Migration Strategy

### Option A: Fresh Start (Recommended for Testing)
1. Deploy the database
2. Create a new account
3. Start fresh with Supabase

### Option B: Migrate Existing Data
If you have existing AsyncStorage data you want to keep:

1. Export current data to JSON
2. Create migration script
3. Import to Supabase

**Export Script:**
```typescript
const exportData = async () => {
  const data = {
    user: await AsyncStorage.getItem('user'),
    company: await AsyncStorage.getItem('company'),
    projects: await AsyncStorage.getItem('projects'),
    clients: await AsyncStorage.getItem('clients'),
    // ... export all data
  };

  console.log(JSON.stringify(data, null, 2));
  // Copy this and save to a file
};
```

---

## 12. Common Issues & Solutions

### Issue: RLS Policy Blocking Access
**Solution**: Check that user is authenticated and belongs to correct company

### Issue: Storage Upload Fails
**Solution**: Check bucket permissions and file size limits

### Issue: Real-time Not Working
**Solution**: Enable real-time in Supabase dashboard under Database → Replication

---

## 13. Next Steps

After setup is complete:

1. ✅ Test authentication flow
2. ✅ Test CRUD operations
3. ✅ Test file uploads
4. ✅ Enable real-time subscriptions
5. ✅ Set up backup policy
6. ✅ Configure production environment
7. ✅ Set up monitoring and alerts

---

## 14. Security Best Practices

1. **Never expose service_role_key** in frontend code
2. **Use RLS policies** for all tables
3. **Validate data** on both client and server
4. **Use HTTPS** for all connections
5. **Rotate API keys** periodically
6. **Enable MFA** for Supabase dashboard
7. **Monitor logs** for suspicious activity

---

## 15. Cost Considerations

### Supabase Free Tier Includes:
- 500 MB database space
- 1 GB file storage
- 2 GB bandwidth
- 50,000 monthly active users
- 500,000 Edge Function invocations

### When to Upgrade:
- More than 500 MB of data
- Need more than 1 GB file storage
- Require advanced features (Point-in-time recovery, etc.)

---

## Support & Resources

- **Supabase Docs**: https://supabase.com/docs
- **Supabase Discord**: https://discord.supabase.com
- **React Native Guide**: https://supabase.com/docs/guides/getting-started/tutorials/with-expo-react-native

---

**You're all set!** 🎉

Your app now has a cloud database with:
- ✅ Real-time data sync across devices
- ✅ User authentication
- ✅ File storage
- ✅ Row-level security
- ✅ Automatic backups
- ✅ Scalable infrastructure
