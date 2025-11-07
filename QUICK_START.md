# 🚀 Quick Start Guide - Legacy Prime Workflow Suite

## Welcome!

This guide will help you get started with Legacy Prime Workflow Suite in under 5 minutes.

---

## 📱 Step 1: Install & Run

### Option A: Test on Your Phone (Recommended)

1. **Install Expo Go** on your phone:
   - iOS: [Download from App Store](https://apps.apple.com/app/expo-go/id982107779)
   - Android: [Download from Google Play](https://play.google.com/store/apps/details?id=host.exp.exponent)

2. **Start the development server**:
   ```bash
   bun install
   bun start
   ```

3. **Scan the QR code** from your terminal with:
   - iOS: Camera app
   - Android: Expo Go app

4. **App loads automatically** with demo data! 🎉

### Option B: Test in Browser

```bash
bun install
bun run start-web
```

Open browser to the provided URL (usually `http://localhost:8081`)

---

## 👤 Step 2: Explore Demo Data

The app automatically loads with comprehensive demo data:

### Default Login
- **User**: John Anderson (Admin)
- **Company**: Legacy Prime Construction
- **Role**: Full admin access

### What's Pre-Loaded
- ✅ 6 Active Projects ($2M+ total budget)
- ✅ 6 Clients (Leads & Active)
- ✅ 300+ Price List Items
- ✅ Expenses, Photos, Payments
- ✅ Team Chat Conversations
- ✅ Schedule with Tasks

---

## 🎯 Step 3: Try Key Features

### 1️⃣ View Project Dashboard (10 seconds)
1. App opens to **Dashboard** tab
2. See all 6 projects with budgets and progress
3. Tap any project to view details

### 2️⃣ Track an Expense (30 seconds)
1. Tap **Expenses** tab
2. Tap **+** button
3. Select project: "Downtown Office Complex"
4. Amount: $500
5. Category: Material
6. Store: "Home Depot"
7. Tap **Add Expense**
8. ✅ Budget automatically updates!

### 3️⃣ Add Project Photo (30 seconds)
1. Tap **Photos** tab
2. Tap camera icon
3. Allow camera permission
4. Take or select photo
5. Choose category: "Foundation"
6. Add note: "Progress update"
7. Tap **Save**
8. ✅ Photo added to project!

### 4️⃣ Clock In (20 seconds)
1. Tap **Clock** tab
2. Tap **Clock In** button
3. Allow location permission
4. Select project
5. ✅ Time tracking started with GPS!

### 5️⃣ Chat with Team (20 seconds)
1. Tap **Chat** tab
2. Select "Project Team - Downtown Office"
3. Type message: "Foundation looking good!"
4. Tap send
5. ✅ Message delivered!

### 6️⃣ Create Estimate (2 minutes)
1. Tap a project
2. Tap **Estimate** tab
3. Tap **New Estimate**
4. Search for items: "concrete"
5. Add "Concrete slab" (quantity: 100)
6. Add "Concrete finisher" (hours: 8)
7. Review subtotal and total
8. Tap **Save Estimate**
9. ✅ Estimate created!

---

## 🗺️ Navigation Guide

### Main Tabs
- **Dashboard** - View all projects
- **CRM** - Manage clients and leads
- **Clock** - Time tracking
- **Expenses** - Log project expenses
- **Photos** - Project documentation
- **Schedule** - Timeline view
- **Chat** - Team communication

### Project Details (tap any project)
- **Overview** - Budget, progress, details
- **Estimate** - Create/view estimates
- **Takeoff** - Digital measurements
- **Expenses** - Project-specific expenses
- **More** - Additional options

### Floating Chat Button
- Tap the floating **chat bubble** anywhere
- Ask AI about projects, schedules, or tasks
- Try: "What's the status of Downtown Office?"

---

## 👥 User Roles Explained

### Admin (John Anderson - Default)
- ✅ Full access to everything
- ✅ View reports and financials
- ✅ Create contracts and estimates
- ✅ Unrestricted AI chatbot

### Salesperson
- ✅ CRM and client management
- ✅ Create estimates (no costs)
- ✅ Schedule access
- ⛔ No financial reports
- ⛔ Limited chatbot (no pricing)

### Field Employee
- ✅ Clock in/out
- ✅ Add photos and expenses
- ✅ View schedule
- ⛔ No estimates or reports
- ⛔ Basic chatbot only

---

## 💡 Pro Tips

### Tip 1: Search Everything
Most screens have a search bar at the top. Use it to quickly find projects, clients, or expenses.

### Tip 2: Filter by Status
In CRM, filter clients by Lead/Project/Completed status for better organization.

### Tip 3: Bulk Operations
In Estimates, add multiple items quickly using the search and quantity fields.

### Tip 4: Daily Logs
Create daily logs from the project detail screen to document progress comprehensively.

### Tip 5: Export Reports
Generate PDF reports from the Reports screen for client meetings or accounting.

---

## 🛠️ Development Tips

### Reset Demo Data
```typescript
import { reseedData } from '@/lib/seed-data';
await reseedData();
```

### Check AsyncStorage
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

// View all keys
const keys = await AsyncStorage.getAllKeys();

// View specific data
const data = await AsyncStorage.getItem('payments');
console.log(JSON.parse(data));
```

### Debug Console Logs
Look for these prefixes in console:
- `[App]` - App initialization
- `[Seed]` - Data seeding
- `[Storage]` - Persistence operations
- `[Project]` - Project updates
- `[Expense]` - Expense tracking

---

## 📊 Demo Projects Overview

### 1. Downtown Office Complex
- Budget: $250,000
- Progress: 60%
- Status: Active
- Phase: Framing

### 2. Riverside Residential
- Budget: $320,000
- Progress: 45%
- Status: Active
- Phase: Foundation

### 3. Tech Campus Renovation
- Budget: $150,000
- Progress: 75%
- Status: Active
- Phase: Finishing

### 4. Luxury Villa Construction
- Budget: $450,000
- Progress: 25%
- Status: Active
- Phase: Preconstruction

### 5. Shopping Center Expansion
- Budget: $580,000
- Progress: 85%
- Status: Active
- Phase: Completing

### 6. Community Park Development
- Budget: $180,000
- Progress: 99%
- Status: Active
- Phase: Final Inspection

---

## 🎓 Learn More

### Documentation
- **[LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md)** - Pre-launch verification
- **[DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md)** - Technical documentation
- **[PRODUCTION_READY.md](PRODUCTION_READY.md)** - Readiness report

### External Resources
- [Expo Documentation](https://docs.expo.dev/)
- [React Native Docs](https://reactnative.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

## 🐛 Troubleshooting

### App Won't Load?
```bash
# Clear cache and restart
bunx expo start --clear
```

### Blank Screen?
- Check console for errors
- Verify all dependencies installed: `bun install`
- Try different device/simulator

### Data Not Showing?
- Check console for `[Seed]` logs
- Data loads automatically on first launch
- Try resetting AsyncStorage

### Permission Errors?
- Allow camera, location, and storage permissions
- Required for full functionality
- Check device settings if denied

---

## 📞 Get Help

- **Issues**: Create an issue on GitHub
- **Questions**: Check DEVELOPER_GUIDE.md
- **Support**: support@legacyprime.com

---

## ✅ Next Steps

1. ✅ Explore all tabs
2. ✅ Try creating a new project
3. ✅ Record a payment
4. ✅ Generate a report
5. ✅ Chat with AI assistant
6. ✅ Review fixture data structure
7. ✅ Read developer guide
8. ✅ Customize for your needs

---

**You're all set!** 🎉

Start exploring and building your construction management workflow.

**Version**: 1.0.0  
**Last Updated**: January 2025
