# Legacy Prime Workflow Suite — Feature Tracker
> Last updated: April 2026
> Track implementation status of all planned modules and their tasks.
> Status: ✅ Implemented | ❌ Not Implemented | 🔄 In Progress | 🔮 Future

---

## MODULE 1 — Schedule: Employee & Subcontractor Assignment

| # | Task | Status |
|---|---|---|
| 1 | Employee picker inside Gantt task modal | ✅ Implemented |
| 2 | Subcontractor picker inside Gantt task modal | ✅ Implemented |
| 3 | DB — store assigned employee IDs on task | ✅ Implemented |
| 4 | DB — store assigned subcontractor IDs on task | ✅ Implemented |
| 5 | Push notification to employee on assignment | ✅ Implemented |
| 6 | Twilio SMS to subcontractor on assignment | ✅ Implemented |
| 7 | Email to subcontractor on assignment | 🔄 In Progress (mailto: now, Resend later) |
| 8 | Employee-facing personal schedule view (assigned tasks only) | ✅ Implemented |
| 9 | Crew Schedule icon in schedule header (navigate to crew screen) | ✅ Implemented |
| 10 | Crew Schedule screen — admin weekly view + assign modal | ✅ Implemented |

---

## MODULE 2 — Schedule: Client View & Card Expansion

| # | Task | Status |
|---|---|---|
| 1 | Hide employee avatars on client shared schedule link | ❌ Not Implemented |
| 2 | Hide subcontractor names on client shared schedule link | ❌ Not Implemented |
| 3 | Show only visibleToClient tasks on shared view | ❌ Not Implemented |
| 4 | Show clientVisibleNote instead of internal notes on shared view | ❌ Not Implemented |
| 5 | Expandable single-day task cards (tap to show full notes) | ❌ Not Implemented |
| 6 | Chevron icon (expand/collapse indicator) on task cards | ❌ Not Implemented |

---

## MODULE 3 — Expenses: Business & Overhead Costs

| # | Task | Status |
|---|---|---|
| 1 | Business/Company Expense toggle on expense form | ❌ Not Implemented |
| 2 | Hide project picker when business expense is toggled ON | ❌ Not Implemented |
| 3 | Switch category list to OFFICE_OVERHEAD_CATEGORIES when toggled ON | ❌ Not Implemented |
| 4 | Allow saving expense without a project ID | ❌ Not Implemented |
| 5 | Save isCompanyCost + isOverhead flags to DB | ❌ Not Implemented |
| 6 | Dashboard overhead total card display | ❌ Not Implemented |

---

## MODULE 4 — CRM: Cleanup, Sales Assignment & Lead Management

| # | Task | Status |
|---|---|---|
| 1 | Remove unused CRM tabs (Dashboard, Clients, Project Settings) | ❌ Not Implemented |
| 2 | Job details field on add/edit lead modal | ❌ Not Implemented |
| 3 | Save job details to client.jobDetails | ❌ Not Implemented |
| 4 | Sales rep picker (salesperson role only) on add/edit lead modal | ❌ Not Implemented |
| 5 | Save assigned rep to client.assignedRep | ❌ Not Implemented |
| 6 | Cold Lead status option in lead status picker | ❌ Not Implemented |
| 7 | Cold Lead badge (muted gray style) on client cards | ❌ Not Implemented |
| 8 | Collapsible Cold Leads section in CRM list | ❌ Not Implemented |

---

## MODULE 5 — CRM: Appointment Calendar

| # | Task | Status |
|---|---|---|
| 1 | Appointments DB table (title, date, time, notes, client, rep) | ❌ Not Implemented |
| 2 | Calendar UI — view appointments by date | ❌ Not Implemented |
| 3 | Create appointment modal | ❌ Not Implemented |
| 4 | Edit appointment modal | ❌ Not Implemented |
| 5 | Delete appointment | ❌ Not Implemented |
| 6 | Link appointment to existing CRM client (optional) | ❌ Not Implemented |
| 7 | AI receptionist reads calendar for availability | 🔮 Future |

---

## SUMMARY

| Module | Total Tasks | Implemented | Remaining |
|---|---|---|---|
| 1 — Schedule Assignment | 10 | 9 | 1 in progress |
| 2 — Client View & Cards | 6 | 0 | 6 |
| 3 — Business Expenses | 6 | 0 | 6 |
| 4 — CRM Lead Management | 8 | 0 | 8 |
| 5 — Appointment Calendar | 7 | 0 | 7 |
| **TOTAL** | **37** | **8** | **29** |
