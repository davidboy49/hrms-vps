# HR Toch user guide

HR Toch is a small, simple HR system for employee records, attendance, schedules, leave, overtime and alerts. It works in a browser on a computer or phone, in Khmer or English (switch with the **ខ្មែរ / EN** buttons at the top).

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
4. **First time with a temporary password?** HR gives you a sheet or slip with your **username (your staff ID)** and a **temporary password**. Sign in with them, then the system asks you to **choose your own password** (at least 10 characters). You cannot use the app until you do. The temporary password stops working after **14 days**; if it has expired, ask HR to reset it.

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
1. On the check-in page press **Leave** (HR and managers: **Leave** in the menu), then press **Request leave**.
2. Choose the leave type, the dates and a reason. For **half a day**, choose *Morning only* or *Afternoon only* under the dates (for a longer leave you can do this for the first and the last day). A line under the form shows how many days the request uses and what your balance will be afterwards.
3. Send the request. Only your working days are counted; days off and public holidays are not. A half day counts 0.5.
4. Your balance cards at the top show days left per leave type. If you joined this year, your allowance is a share of the full year (the card says *pro-rated*). Some leave, such as Annual leave, cannot be taken until a few months after you join; the card then shows *Available from* a date. The status shows **Pending**, **Approved**, **Rejected** or **Cancelled**.
5. You can cancel a request while it is still pending.

If it says your sign-in is not linked to an employee record, ask HR to link it. If there is no **Request leave** button, your role does not have the permission *Request own leave*: an Admin can give it in **Settings → Roles** (the same for overtime: *Request own overtime*).

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

Then open **Settings → Company** to set the company name and logo. They appear in the sidebar and on the sign-in page. The same page lets an Admin set the **Check-in page language** to *Khmer only*, which hides the language switch on the staff check-in page (HR screens keep both languages).

### 4.2 Employees
- **Employees → Add** to create a record: photo, names (Khmer and English), department, designation, contract, joining date, pay rate, location, shift and weekly schedule.
- Use **search and filters**, and the **Import / Export** buttons to load many employees from a spreadsheet. A template can be downloaded from **Settings → Templates**.
- **Employees are never deleted.** When someone leaves, open their profile (or the **⋯** menu in the list) and press **Deactivate**. Choose the **reason** (Resigned, Terminated, ...) and the **last working day**; a short note is optional. Their login is turned off right away, waiting leave and overtime requests are cancelled, and they move to the **Deactivated** tab. Their attendance, leave and pay history is kept. You need the permission *Deactivate employees* (HR has it).
- To bring someone back, open the **Deactivated** tab, then **⋯ → Reactivate** (or the button on their profile). Choose the new status and start date, optionally add a note, and tick *Turn their login back on* if they should sign in again. You need the permission *Reactivate employees* (Admin has it; it can be given to a role in **Settings → Roles**). The profile keeps an **Employment history** of every deactivation and reactivation with the reason and who did it.
- Switching between *active* and *not active* is only possible with Deactivate and Reactivate, not in the edit form or the import.
- To let a person sign in and scan with their phone, create a user in **Settings → Users** and link it to their employee record. For many people at once, see 4.9.
- The list has a **Login** column showing who already has a login and who does not yet. In **Filter**, choose *Login* → *No login yet* to see only the people who still need one (then use 4.9).

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
- **Leave types** (button): name, code, paid or unpaid, days per year (or no limit), and the rules: a **waiting period** after joining (months before this leave can start, 0 = from the first day), **pro-rating** of the yearly allowance for people who join during the year (by the months left in the year, rounded to half a day), and whether **half days** are allowed. Starter types are Annual (pro-rated, 3 months waiting), Sick, Special and Unpaid. HR can still file an exception for someone inside the waiting period.
- **Half days:** an approved half day stays a working day with half of it off. The roster shows a ½ after the shift code, and attendance expects the person only for the other half, so they are not marked late for the morning they are off.
- **Everyone's balances** (button): each active employee's quota, used, waiting and left for a year, with an Excel download. There is no carry-over: each year starts fresh.
- **Telegram:** the HR group gets a message when someone requests leave and when a request is approved, rejected or cancelled (switch it on or off in Settings → Notifications).
- **Entitlements** (button): give one person a different yearly allowance.
- You can also file leave for someone from **Request leave → For**.
- Cancelling an approved request frees the days again.

### 4.7 Overtime
Open **Overtime**: approve or reject requests. **Overtime types** hold the pay multiplier (for example 1.5 for a normal day). Approved hours are stored; payroll is planned for a later version.

### 4.8 Announcements
**Announcements → New**: write a title and message, choose when it is active. Staff see it in the app, and it can also go to the Telegram group.

### 4.9 Creating logins for many employees
Use this when employees exist but have no login yet (for example when you first start using the system). You need the permission **Create logins for many employees at once** (HR has it by default).

1. Open **Employees → Create logins**. The page lists active employees who have no login yet.
2. Search or filter by department, then tick the people you want. The tick box in the header selects everyone shown. You can create up to **300 logins at a time**.
3. Choose the **role** (normally *Employee*). HR can only give roles without administrative powers; only an Admin can give others.
4. Press **Review and create**. A window shows how many logins will be created, example usernames, and who will be **skipped and why** (already has a login, resigned or deleted, staff ID that cannot be used as a username, or a username already taken).
5. Tick the box to confirm you understand the passwords are shown only once, then press **Create**.
6. The next screen shows the **temporary passwords**. Press **Download Excel** or **Print slips** (one slip per person, with the website address, username and password) **right away**. The passwords are not stored anywhere and cannot be shown again. Do not close the page before you have saved them.

What staff do: sign in with their **staff ID** as the username and the temporary password, then choose their own password. Hand out the slips in person and destroy the Excel file afterwards.

Notes:
- The username is the staff ID in lower case (for example EMP-0042 becomes `emp-0042`).
- Temporary passwords stop working after **14 days**. If someone loses theirs or it expires, open **Settings → Users** and use **Reset password**.
- You can run it again later for new hires: it only shows people who still have no login.
- Every batch is recorded in the audit log (who, how many, which role), without any passwords.

---

## 5. For Admin

### 5.1 Users
**Settings → Users**: create users, set the role, reset a password, disable someone who has left. Disabling signs them out immediately.

### 5.2 Telegram alerts
Alerts go to a Telegram group that you choose.
1. In Telegram, open **@BotFather**, send `/newbot` and follow the steps. Copy the **token** (keep it private).
2. Create a group, add the bot, and send `/start@YourBotName` in the group.
3. In HR Toch open **Settings → Notifications**. Paste the token and save, then press **Find chat** and pick the group (the chat ID starts with a minus sign).
4. Tick **Enabled**, choose what to send, save, and press **Send test message**.

What can be sent:
- Leave requests and what happens to them
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

### 5.4 Payroll (Payroll edition only)

If your company has the Payroll edition, **Payroll** appears in the menu for roles that have the *Payroll* permissions (Admin has them; give them to others in **Settings → Roles**).

Choose a **month** and press **Show**. For each employee you see the facts payroll is worked out from: scheduled days, days worked, absent days, paid and unpaid leave, work on a day off, late days and minutes, days with no clock-out, and approved overtime hours (also weighted by the overtime multiplier). **Download Excel** gives the same sheet with overtime split by type.

Check absences and days with no clock-out before paying. The current month counts up to yesterday. Amounts and deductions are not calculated here.

**Setup** (permission *Set up pay policy, allowance and deduction types*): press **Payroll setup** on the Payroll page.
- **Pay policy:** how a daily rate is worked out (monthly rate ÷ a fixed number of days, or ÷ the person's working days that month), working hours per day, and whether late minutes are deducted.
- **Allowance and deduction types:** create types such as Transport allowance or Advance repayment, fixed or a percent of base pay, and say whether an allowance is taxable and counts toward NSSF. *Add suggested types* gives a starting list.
- **Per person:** open the employee profile, **Allowances and deductions → Add**, choose the type, the amount (or leave it to use the default) and the dates. *End today* stops it and keeps the history.

These settings are stored for the pay run; they do not change anyone's pay yet.

## 6. Troubleshooting

| Problem | What to try |
|---|---|
| "Too far" or location not accurate | Turn on GPS, wait a few seconds, move near a window or outdoors. HR can check the location's latitude, longitude and radius. |
| Cannot scan or says not linked | The user must be linked to an employee record (Settings → Users). |
| Keeps asking to sign in | Tick **Remember me**; avoid private browsing mode. |
| Leave request refused: not enough balance | Check the balance cards. HR can change the entitlement. |
| Leave request refused: no working days | The dates are all days off or holidays. |
| No Telegram messages | Admin: check the token, chat ID, Enabled box, and the bot is in the group. Use the test button. |
| "Temporary password has expired" | Ask HR to reset the password in Settings → Users, then give the new temporary password to the person. |
| Lost the sheet of temporary passwords | The passwords cannot be shown again. Use **Reset password** for each person who needs one. |
| "Your user has been deactivated" when signing in or scanning | The employee was deactivated by HR (for example after resigning). If this is a mistake, ask someone with the *Reactivate employees* permission to reactivate them. |
| Wrong language | Use the **ខ្មែរ / EN** switch at the top. |

---

## 7. Good habits
- Give each person their own account; never share passwords.
- Disable accounts when people leave.
- Keep the QR and the Telegram bot token private; reset them if exposed.
- Review the roster at the start of each month.
