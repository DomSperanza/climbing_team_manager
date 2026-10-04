# Privacy and rating forms: suggested answers

These follow what the app actually does (see `../public/privacy.html`). They're a best reading of each store's definitions, not legal advice. Read the questions as you answer them.

**The facts that decide every answer:**
- Nothing is sent to the developer. There's no server, analytics, crash reporting or ads.
- Team data goes between the phone and the team's Google Sheet, in the coach's own Google account, over HTTPS.
- A copy stays on the phone, encrypted and excluded from backups.

## Google Play — Data safety

Google defines "collected" as any data that leaves the device. Even though it only goes to the user's own Google account, the safe answer is **Yes**.

- **Does your app collect or share any of the required user data types?** Yes
- **Is all of the user data collected by your app encrypted in transit?** Yes
- **Do you provide a way for users to request that their data is deleted?** Yes. Coaches delete data in the app or in Google Sheets, and uninstalling removes the device copy.

**Data types.** For each one: *Collected*: yes. *Shared*: **no** (Google Sheets holds it for the user; nobody else receives it). *Processed ephemerally*: no. *Required or optional*: as listed. *Purpose*: **App functionality** only.

| Category → type | Required? | What it is |
|---|---|---|
| Personal info → **Name** | Required | Athlete and coach names in the roster |
| Personal info → **Email address** | Optional | Coach emails in the roster, and emails typed into the Share screen |
| Personal info → **Phone number** | Optional | Coach phone numbers in the roster |
| App activity → **Other user-generated content** | Required | Practice plans, notes, progress entries, attendance |

Leave everything else **unticked**: location, financial, health, messages, photos, audio, files, calendar, contacts, app activity/interactions, web browsing, app info and performance, and device IDs.

The coach's Google account itself is handled by Google's sign-in, and the app doesn't send it anywhere. If the form asks about it, it falls under **Email address** above.

## Apple — App Privacy

Apple defines "collected" as data that leaves the device where **you (the developer) or your partners** can access it beyond serving the request. SCC Coach's data goes only to the user's own Google account, which the developer can't access, and the app's privacy manifest already says it collects nothing. So:

- **Do you or your third-party partners collect data from this app?** **No, we do not collect data from this app.**
- The label then reads **"Data Not Collected"**.

If App Review disagrees, switch to **Yes** and declare:
- Contact Info → Name, Email Address, Phone Number;
- User Content → Other User Content.

For each: *Linked to the user*: yes. *Used for tracking*: **no**. *Purpose*: **App Functionality**.

## Content rating

**Play (IARC):**
- Category: *All other app types* (Reference/Productivity-style).
- Answer **No** to violence, sexuality, language, controlled substances, gambling and crude humour.
- *Does the app allow users to interact or exchange content with other users?* **No.** Coaches share a Google Sheet outside the app, and there's no chat, feed or public content.
- *Does the app share the user's location?* No. *Digital purchases?* No.
- The expected result is **Everyone / PEGI 3**.

**Apple:** answer **None** to every content description and **No** to:
- unrestricted web access;
- user-generated content with other users;
- gambling, contests, and medical info.

The result is **4+**.

**Target audience (Play):** **18+** only. The coaches are the users, and athletes never use the app.
