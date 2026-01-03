# Team Chat Setup Guide

This guide explains how to set up the team chat feature for your construction management app.

## Overview

The team chat feature enables:
- **Admins** to chat with all team members
- **Employees** to chat with admins and other employees
- Real-time messaging between team members
- Support for text, images, files, and voice messages
- Individual (1-on-1) and group chats

## Step 1: Database Setup

### Run the SQL Schema

1. Open your Supabase dashboard: https://supabase.com/dashboard
2. Navigate to your project
3. Go to **SQL Editor**
4. Copy the contents of `/database/schema/team_chat.sql`
5. Paste into the SQL Editor
6. Click **Run** to execute the schema

This will create:
- `team_users` - Stores team members with roles
- `team_conversations` - Stores chat conversations
- `team_conversation_participants` - Maps users to conversations
- `team_messages` - Stores all messages

### Enable Realtime

1. In Supabase dashboard, go to **Database** → **Replication**
2. Enable replication for these tables:
   - `team_messages`
   - `team_conversations`
   - `team_conversation_participants`

## Step 2: Add Team Members

You need to manually add team members to the `team_users` table. Here are two options:

### Option A: Using Supabase Dashboard (Recommended for initial setup)

1. Go to **Table Editor** in Supabase
2. Select `team_users` table
3. Click **Insert row**
4. Fill in the details:
   - **id**: Auto-generated (UUID)
   - **email**: User's email
   - **name**: Full name
   - **role**: Either `admin` or `employee`
   - **avatar_url**: Profile image URL (optional)
   - **phone**: Phone number (optional)
   - **is_active**: `true`

Example rows to insert:

```sql
-- Insert admin
INSERT INTO team_users (email, name, role, avatar_url) VALUES
  ('admin@legacyprime.com', 'Admin User', 'admin', 'https://i.pravatar.cc/150?img=12');

-- Insert employees
INSERT INTO team_users (email, name, role, avatar_url) VALUES
  ('john.doe@legacyprime.com', 'John Doe', 'employee', 'https://i.pravatar.cc/150?img=1'),
  ('jane.smith@legacyprime.com', 'Jane Smith', 'employee', 'https://i.pravatar.cc/150?img=5'),
  ('mike.johnson@legacyprime.com', 'Mike Johnson', 'employee', 'https://i.pravatar.cc/150?img=3');
```

### Option B: Create an Admin Panel (Recommended for production)

You can create a simple admin panel to manage team members:
1. Add a new route `/admin/team-members`
2. Create a form to add/edit/remove team members
3. Use the Supabase client to insert/update/delete from `team_users`

## Step 3: Link User Authentication

The chat system needs to know which team member is currently logged in. Update your authentication system to:

1. When a user logs in, fetch their corresponding `team_users` record
2. Store this in your app context (e.g., in `AppContext`)
3. Pass the user's ID and role to the chat page

### Example Implementation

Update your `AppContext.tsx`:

```typescript
// Add to your User type
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'employee';
  avatar?: string;
  // ... other fields
}

// When user logs in, fetch from team_users:
const fetchTeamUser = async (email: string) => {
  const { data } = await supabase
    .from('team_users')
    .select('*')
    .eq('email', email)
    .eq('is_active', true)
    .single();

  return data;
};
```

## Step 4: Update Chat Page

The chat page is already set up to support team messaging, but you need to make sure it receives the current user's info.

Make sure your chat page has access to:
- `user.id` - The current user's ID from `team_users` table
- `user.role` - The user's role ('admin' or 'employee')

## Step 5: Test the Feature

### Testing Checklist

1. **Add Team Members**:
   - [ ] Add at least one admin user
   - [ ] Add at least two employee users

2. **Test as Admin**:
   - [ ] Log in as admin
   - [ ] Navigate to /chat page
   - [ ] Click "Start New Chat"
   - [ ] Verify you can see all team members (employees)
   - [ ] Start a chat with an employee
   - [ ] Send a text message
   - [ ] Verify message appears in conversation

3. **Test as Employee**:
   - [ ] Log in as employee
   - [ ] Navigate to /chat page
   - [ ] Click "Start New Chat"
   - [ ] Verify you can see admin and other employees
   - [ ] Start a chat with admin
   - [ ] Send a message
   - [ ] Verify message appears

4. **Test Real-time**:
   - [ ] Open app in two different browsers/tabs
   - [ ] Log in as different users in each
   - [ ] Send message from one
   - [ ] Verify it appears in real-time in the other

## API Endpoints

The following endpoints are available:

### GET /api/team/get-members
Fetches team members based on role
- Query params: `userId`, `userRole`
- Returns: List of team members

### POST /api/team/create-conversation
Creates a new conversation
- Body: `createdBy`, `participantIds`, `name`, `type`
- Returns: Conversation object

### GET /api/team/get-conversations
Fetches user's conversations
- Query params: `userId`
- Returns: List of conversations with last messages

### GET /api/team/get-messages
Fetches messages for a conversation
- Query params: `conversationId`, `userId`
- Returns: List of messages

### POST /api/team/send-message
Sends a message
- Body: `conversationId`, `senderId`, `type`, `content`
- Returns: Created message

## Security

The database is secured with Row Level Security (RLS) policies:
- Users can only see active team members
- Users can only view conversations they participate in
- Users can only send messages to conversations they're in
- Users can only read messages in their conversations

## Troubleshooting

### Issue: No team members showing up
- **Solution**: Make sure you've added users to `team_users` table with `is_active = true`

### Issue: Messages not sending
- **Solution**: Verify the user is a participant in the conversation by checking `team_conversation_participants` table

### Issue: Real-time not working
- **Solution**: Ensure you've enabled replication for `team_messages` table in Supabase

### Issue: "Database not configured" error
- **Solution**: Check that these environment variables are set:
  - `EXPO_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`

## Next Steps

After basic setup is working:

1. **Add profile pictures**: Allow users to upload avatars
2. **Add typing indicators**: Show when someone is typing
3. **Add read receipts**: Track when messages are read
4. **Add push notifications**: Notify users of new messages
5. **Add message search**: Search through conversation history
6. **Add file uploads**: Allow sharing documents and images
7. **Add message reactions**: Let users react to messages with emojis

## Support

If you encounter issues:
1. Check the browser console for error messages
2. Check the Supabase logs in the dashboard
3. Verify the database schema is correctly set up
4. Ensure environment variables are configured
