# PeopleDesk user guide

PeopleDesk is an HR system for employee records, attendance, schedules, leave, overtime and alerts. It works in a browser on a computer or phone, in Khmer or English (switch with the **ខ្មែរ / EN** buttons at the top).

---

## 1. Who can do what

| Role | What they can do |
|---|---|
| **Staff (Employee)** | Scan QR to check in and out, see their recent scans, request leave and overtime, read announcements |
| **Manager** | Everything above, plus view employees, attendance, the roster and all requests |
| **HR** | Manage employees, schedules, leave and overtime approvals, masterdata, announcements |
| **Admin** | Everything, plus users, company settings, Telegram and the audit log |

Staff who should check in with their phone need a **user account linked to their employee record** (see 4.2).

---

## 2. Signing in

1. Open the system address and enter your email and password.
2. Tick **Remember me** on your own phone so you stay signed in (staff stay signed in for 90 days and it renews while you use it).
3. Your first password is set by HR or Admin. It stays the same until you change it: **Settings → Account**.

If you forget your password, ask HR or Admin to reset it.

---

## 3. For staff (phone)

### 3.1 Check in and out
1. Scan the **QR code** at your workplace with your phone camera and open the link. Sign in if asked.
2. Allow **location** when the phone asks. The system checks you are at the workplace.
3. Press **Check in** (or **Check out**). You will see a confirmation with the time.

Tips:
- Turn on the phone's location (GPS) and wait a few seconds for it to settle. If it says your position is not accurate enough, step outdoors or near a window and try again.
- If it says you are too far, you are outside the allowed distance of the workplace.
- Scanning twice within a minute is ignored.
- Your last scans are listed under the scan button.

### 3.2 Request leave
1. Open **Leave** in the menu and press **Request leave**.
2. Choose the leave type, the dates and a reason.
3. Send the request. Only your working days are counted; days off and public holidays are not.
4. Your balance cards at the top show days left per leave type. The status shows **Pending**, **Approved**, **Rejected** or **Cancelled**.
5. You can cancel a request while it is still pending.

If it says your sign-in is not linked to an employee record, ask HR to link it.

### 3.3 Request overtime
1. Open **Overtime** and press **Request overtime**.
2. Choose the type, the date, the hours worked and a reason, then send it.
3. HR approves or rejects it. You can cancel while it is pending.

### 3.4 Announcements
Active announcements show when you open the app.

---

## 4. For HR

### 4.1 Setting up (do these once)
Open **Masterdata** and fill in, in this order:
1. **Departments**, **Designations**, **Contract types**, **Statuses**
2. **Locations**: add each workplace with its **latitude and longitude** and the allowed **radius in metres**. This is what the QR location check uses.
3. **Shifts**: start and end time, grace minutes and a colour for the roster.
4. **Holidays**: public holidays are not counted as work days or leave days.

Then open **Settings → Company** to set the company name and logo. They appear in the sidebar and on the sign-in page.

### 4.2 Employees
- **Employees → Add** to create a record: photo, names (Khmer and English), department, designation, contract, joining date, pay rate, location, shift and weekly schedule.
- Use **search and filters**, and the **Import / Export** buttons to load many employees from a spreadsheet. A template can be downloaded from **Settings → Templates**.
- To let a person sign in and scan with their phone, create a user in **Settings → Users** and link it to their employee record.

### 4.3 QR attendance
Open **Attendance → QR**.
- Choose, per location, a **fixed QR** (printed and put on the wall; the location check protects it) or a **rotating QR** (changes regularly; show it on a screen).
- Print or display the QR. If the code is ever leaked, reset it here and print a new one.

### 4.4 Attendance
- **Punches**: every raw scan, with search, filters and **Export** (an Excel file in your attendance-log format, with the days off, holidays and leave marked).
- **Daily**: one row per person per day with first in, last out, late minutes and status.
- **Devices**: ZKTeco devices and the QR source.

### 4.5 Schedules and days off
- **Attendance → Schedule templates**: build a weekly pattern (for example Mon–Sat work, Sunday off) and assign it to people.
- **Attendance → Roster**: a monthly grid. Click a day to change one person's day (day off, leave, a different shift), or use **weekly days off** for a person's usual days off.
- Lateness and the export use each person's real plan, so people are not marked absent on days off.

### 4.6 Leave
Open **Leave**:
- **Pending requests** can be approved (✓) or rejected (✗, with an optional reason). Approving marks those days as **leave** on the roster and in the attendance export.
- **Leave types** (button): name, code, paid or unpaid, days per year (or no limit). Starter types are Annual, Sick, Special and Unpaid.
- **Entitlements** (button): give one person a different yearly allowance.
- You can also file leave for someone from **Request leave → For**.
- Cancelling an approved request frees the days again.

### 4.7 Overtime
Open **Overtime**: approve or reject requests. **Overtime types** hold the pay multiplier (for example 1.5 for a normal day). Approved hours are stored; payroll is planned for a later version.

### 4.8 Announcements
**Announcements → New**: write a title and message, choose when it is active. Staff see it in the app, and it can also go to the Telegram group.

---

## 5. For Admin

### 5.1 Users
**Settings → Users**: create users, set the role, reset a password, disable someone who has left. Disabling signs them out immediately.

### 5.2 Telegram alerts
Alerts go to a Telegram group that you choose.
1. In Telegram, open **@BotFather**, send `/newbot` and follow the steps. Copy the **token** (keep it private).
2. Create a group, add the bot, and send `/start@YourBotName` in the group.
3. In PeopleDesk open **Settings → Notifications**. Paste the token and save, then press **Find chat** and pick the group (the chat ID starts with a minus sign).
4. Tick **Enabled**, choose what to send, save, and press **Send test message**.

What can be sent:
- Late check-ins
- Scans refused for distance
- Missing check-outs (a list in the evening)
- Announcements
- Every check-in and check-out (off by default; busy in a large company)

If the group stays silent, check that the bot is in the group and that Enabled is ticked.

### 5.3 Other settings
- **Attendance**: late grace minutes, and the thresholds used in the export.
- **Numbering**: how employee numbers are generated.
- **Audit**: who changed what and when.

---

## 6. Troubleshooting

| Problem | What to try |
|---|---|
| "Too far" or location not accurate | Turn on GPS, wait a few seconds, move near a window or outdoors. HR can check the location's latitude, longitude and radius. |
| Cannot scan or says not linked | The user must be linked to an employee record (Settings → Users). |
| Keeps asking to sign in | Tick **Remember me**; avoid private browsing mode. |
| Leave request refused: not enough balance | Check the balance cards. HR can change the entitlement. |
| Leave request refused: no working days | The dates are all days off or holidays. |
| No Telegram messages | Admin: check the token, chat ID, Enabled box, and the bot is in the group. Use the test button. |
| Wrong language | Use the **ខ្មែរ / EN** switch at the top. |

---

## 7. Good habits
- Give each person their own account; never share passwords.
- Disable accounts when people leave.
- Keep the QR and the Telegram bot token private; reset them if exposed.
- Review the roster at the start of each month.
