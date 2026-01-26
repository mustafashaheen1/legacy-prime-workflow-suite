# Debug Guide: File Upload Not Working

## How to Debug This Issue

Since you ran the migrations, the database should be set up. Now we need to figure out why nothing happens when you click to upload a file.

### Step 1: Open Browser Console

1. Open the registration page in your browser
2. Open Developer Tools (F12 or right-click > Inspect)
3. Go to the "Console" tab
4. Clear the console (click the 🚫 icon or Ctrl+L)

### Step 2: Load the Registration Page

Navigate to the registration URL. You should see these logs in console:

```
[Registration Page] Component mounted/rendered
[Registration Page] Token from params: sub_reg_1234567890_abc123...
[Registration Page] Token type: string
[Registration] Validating token: sub_reg_1234567890_abc123...
[API] Looking up token in registration_tokens table: sub_reg_1234567890_abc123...
[Registration] Token validation response: { status: 200, data: { valid: true, ... } }
[Registration] Token is valid, ready for registration
```

**If you DON'T see these logs:**
- The page isn't loading correctly
- Check the Network tab for failed API calls
- Check for JavaScript errors in console

**If you see "Database not configured" error:**
- The migrations didn't run successfully
- Go back to Supabase dashboard and run the migrations again

### Step 3: Navigate to Step 2 (File Upload)

1. Fill out the form in Step 1 with any data:
   - Name: Test User
   - Company Name: Test Company
   - Email: test@example.com
   - Phone: 5551234567
   - Trade: (pick any)
2. Click "Next"

You should see these logs:

```
[Registration Page] Rendering Step 2 - File Uploads
[Registration Page] Current token value: sub_reg_1234567890_abc123...
[Registration Page] Current uploaded files: { license: 0, insurance: 0, w9: 0, certificate: 0, other: 0 }
```

**If you DON'T see these logs:**
- Step 2 isn't rendering
- There might be a validation error preventing navigation
- Check for error alerts

### Step 4: Click "Choose File" Button

Click the "Choose File" button under "License". You should see:

```
[BusinessFileUpload] pickDocument called - opening file picker...
[BusinessFileUpload] Component props: { type: 'license', label: 'License', hasToken: true, hasSubcontractorId: false }
[BusinessFileUpload] Calling DocumentPicker.getDocumentAsync...
```

**If you DON'T see "[BusinessFileUpload] pickDocument called":**
- The button click isn't triggering the function
- The button might be disabled
- Check if there's a transparent overlay blocking clicks
- Try clicking directly on the button text

**If you see the first log but not "Calling DocumentPicker":**
- JavaScript error occurred before reaching DocumentPicker call
- Look for error messages in console

### Step 5: Select a File

After the file picker opens, select a PDF or image file. You should see:

```
[BusinessFileUpload] DocumentPicker result: { canceled: false, hasAssets: 1 }
[BusinessFileUpload] Starting upload...
[BusinessFileUpload] Request body: { type: 'license', name: 'myfile.pdf', ... }
[BusinessFileUpload] Metadata response status: 200
[BusinessFileUpload] Got upload URL, uploading to S3...
[BusinessFileUpload] File blob created, size: 12345
[BusinessFileUpload] S3 upload response status: 200
[BusinessFileUpload] File uploaded successfully: abc-123-def-456
```

And you should see an alert: "File uploaded successfully"

**If you see "User canceled file picker":**
- You clicked "Cancel" in the file picker
- Try again and select a file

**If you see an error after "Starting upload":**
- There's an issue with the API call
- Check the error message in the console
- Check the Network tab for the API request details

## Common Issues and Solutions

### Issue 1: No Logs at All

**Problem:** Nothing appears in console when loading the page

**Solutions:**
1. Make sure you're looking at the correct console tab (not Network or Elements)
2. Make sure console filters aren't hiding messages (should show "All levels")
3. Try hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
4. Check if JavaScript is enabled in your browser

### Issue 2: Token is undefined or empty

**Problem:** Log shows `Token from params: undefined` or `Token from params: ""`

**Solutions:**
1. Check the URL - it should be `/register-subcontractor/sub_reg_...`
2. Make sure you're using the complete link from the email
3. Try generating a new invitation link

### Issue 3: Token validation fails

**Problem:** Logs show `valid: false` or error message

**Solutions:**
1. Check if token exists in database:
   - Go to Supabase dashboard
   - Go to Table Editor
   - Open `registration_tokens` table
   - Search for your token
2. Check if token expired (expires_at < now)
3. Check if token already used (used = true)
4. Generate a new invitation and try again

### Issue 4: File picker doesn't open

**Problem:** See "[BusinessFileUpload] pickDocument called" but file picker doesn't appear

**Solutions:**
1. Check browser console for permission errors
2. On web: Browser might be blocking file picker popup
3. Try using a different browser (Chrome, Firefox, Safari)
4. Check if there are pop-up blockers active

### Issue 5: Upload fails with 401 or 500 error

**Problem:** File picker works but upload API returns error

**Solutions:**
1. Check the error message in console
2. If "Invalid token": Token might have expired or been used
3. If "Database not configured": Migrations didn't run
4. Check Network tab for full error response
5. Check Supabase logs for API errors

## Testing Checklist

Run through this checklist to verify everything works:

- [ ] Generate invitation link (click "Send Invite")
- [ ] Email client opens with link
- [ ] Copy registration URL
- [ ] Open URL in browser
- [ ] See registration form (Step 1 of 3)
- [ ] Fill out all required fields
- [ ] Click "Next"
- [ ] See file upload section (Step 2 of 3)
- [ ] Click "Choose File" under License
- [ ] File picker opens
- [ ] Select a PDF or image file
- [ ] See upload progress spinner
- [ ] See "File uploaded successfully" alert
- [ ] File appears in list with name, size, icon
- [ ] Delete button shows for uploaded file
- [ ] Repeat for other file types
- [ ] Click "Review"
- [ ] See all uploaded files listed
- [ ] Click "Submit Registration"
- [ ] See success message
- [ ] Check /subcontractors page for new entry

## Share Debug Info

If it's still not working, share these details:

1. **Console Logs:**
   - Copy all logs from console
   - Include any error messages in red

2. **Network Tab:**
   - Open Network tab in dev tools
   - Filter by "Fetch/XHR"
   - Show which API calls were made
   - Show status codes and response bodies

3. **What You See:**
   - Does the page load?
   - Does Step 2 render?
   - Does file picker open?
   - What happens after selecting file?
   - Any error alerts?

4. **Browser Info:**
   - Which browser? (Chrome, Firefox, Safari, etc.)
   - Desktop or mobile?
   - Any browser extensions that might interfere?
