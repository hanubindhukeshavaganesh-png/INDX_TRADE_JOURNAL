# My trade journal

A private trade journal that lives on Netlify and stores everything in **your own Google Sheet**.

- **Dashboard**: gross profit, profit %, total trades, then the current month (profit, %, trades, wins, losses), a heatmap calendar, and the form to log a trade.
- **History**: every day with date, time, trade taken, lots, profit/loss, brokerage, net and day %. Filter by month, search by trade name, export CSV.
- **Brokerage rule**: net = profit/loss − brokerage. It reduces a profit and makes a loss bigger (loss ₹1,900 + brokerage ₹180 = −₹2,080).
- **Privacy**: the site asks for your PIN. The Google Sheet is only reachable through a secret key that never reaches the browser.

```
Browser  ->  Netlify site + function (checks your PIN)  ->  Google Apps Script (checks secret key)  ->  Your Google Sheet
```

Everything here is free (Netlify free plan, Google account).

---

## Setup (about 20 minutes, one time)

### Step 1: Create the Google Sheet and its backend

1. Go to <https://sheets.new> and name the sheet **Trade Journal**.
2. In the sheet, click **Extensions → Apps Script**.
3. Delete everything in the editor, then paste the full contents of `google-apps-script/Code.gs`. Click **Save**.
4. Create your secret key: click the gear icon **Project Settings** (left side) → scroll to **Script properties** → **Add script property**.
   - Property: `SCRIPT_KEY`
   - Value: a long random string (for example 30+ letters and numbers). **Save script properties.**
   - Keep this value handy, you need it in Step 3.
5. Go back to **Editor**, choose the function `setup` in the dropdown at the top and click **Run**. Google asks for permission the first time: **Review permissions → choose your account → Advanced → Go to (project) → Allow**. This creates the `Trades` and `Settings` tabs.
6. Click **Deploy → New deployment**.
   - Click the gear next to "Select type" → **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Click **Deploy** and copy the **Web app URL** (it ends with `/exec`).

> "Anyone" is safe here because every request must include your `SCRIPT_KEY`; requests without it are rejected.

### Step 2: Put the project on GitHub

Netlify is most reliable when it deploys from GitHub (this is also what makes the site stay live forever and update automatically).

1. Create a free account at <https://github.com> if you don't have one.
2. Create a **new private repository** named `trade-journal`.
3. Upload this whole folder's contents (`public`, `netlify`, `netlify.toml`, `google-apps-script`, `README.md`) using **Add file → Upload files**, then **Commit changes**. Make sure the `public` and `netlify` folders keep their structure.

### Step 3: Deploy on Netlify

1. Sign up at <https://app.netlify.com> (use "Sign up with GitHub").
2. **Add new site → Import an existing project → GitHub** → pick `trade-journal`.
3. Leave the build settings as they are (they come from `netlify.toml`) and click **Deploy**.
4. Open **Site configuration → Environment variables → Add a variable** and add these three:

   | Key | Value |
   |---|---|
   | `JOURNAL_PIN` | the PIN or passphrase you will type to open the journal (use something long, 8+ characters) |
   | `SCRIPT_URL` | the Web app URL from Step 1 (ends with `/exec`) |
   | `SCRIPT_KEY` | the same secret you saved in Apps Script |

5. Go to **Deploys → Trigger deploy → Deploy site** so the variables take effect.
6. Optional: **Site configuration → Change site name** to get a friendly address like `my-trades.netlify.app`.

### Step 4: Use it

1. Open your Netlify address. Enter your PIN (your browser remembers it on that device).
2. On the Dashboard, check the **starting capital** line (click **Edit** to set your real capital; profit % is calculated on it).
3. Add your first trade, then open your Google Sheet to see it appear in the `Trades` tab.

Bookmark the site on your phone and laptop. Add it to your phone's home screen for an app-like icon.

---

## Previewing on your computer (IDE)

You can open `public/index.html` straight from your IDE (double-click it, or use VS Code's Live Server). With no backend behind it, the pages switch to **preview mode**: a yellow banner appears and you see sample data kept only in your browser. You can add, edit and delete trades to try it out. Nothing reaches your Google Sheet, and **Reset sample data** in the banner starts the sample over.

Preview mode only turns on for `file://` and `localhost`. On your real Netlify address it never does, so your real data is never mixed with sample data.

To test the real connection locally instead, install the Netlify CLI (`npm i -g netlify-cli`), create a `.env` file in the project folder with `JOURNAL_PIN`, `SCRIPT_URL` and `SCRIPT_KEY`, and run `netlify dev`. It serves the site and the function together at `http://localhost:8888`.

---

## Good to know

- **Gross profit** at the top is your total after brokerage, matching your rule that brokerage is always deducted.
- **Wins / losses** count individual trades. A trade with a net of exactly ₹0 counts as neither.
- **Add and edit trades through the app.** Rows typed directly into the sheet need an ID in column A to show up, so it is best not to type rows by hand. Deleting rows or reading the sheet for your own analysis is fine.
- **Your copy of the data** is the Google Sheet itself. You can download it any time (File → Download) or use **Export CSV** on the History page.
- **Changing the Apps Script code later**: Deploy → Manage deployments → pencil icon → Version: New version → Deploy. The URL stays the same.
- **Forgot your PIN**: change `JOURNAL_PIN` in Netlify and redeploy.

## Troubleshooting

| Message | Fix |
|---|---|
| "Server is not configured" | One of the three Netlify variables is missing. Add it, then redeploy. |
| "Google Sheet backend returned an unexpected response" | In Apps Script, redeploy the Web app with **Who has access: Anyone**, and check `SCRIPT_URL` ends with `/exec`. |
| "Unauthorized" | `SCRIPT_KEY` in Netlify does not match the Script property in Apps Script. |
| Page says "Wrong PIN" | Re-enter it. It must match `JOURNAL_PIN` in Netlify exactly. |
| `/api` not found (404) | The `netlify` folder or `netlify.toml` was not uploaded to GitHub. Upload them and redeploy. |

## Files

```
public/               the website (index.html = Dashboard, history.html = History)
netlify/functions/    api.js, PIN check and bridge to Google
netlify.toml          Netlify settings
google-apps-script/   Code.gs, paste into your Google Sheet
```
