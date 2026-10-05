# How to Get NOTION_TOKEN and NOTION_DATABASE_ID

## Step 1: Get NOTION_TOKEN (Integration Secret)

### 1.1 Create a Notion Integration

1. Go to **[Notion Integrations](https://www.notion.so/my-integrations)**
2. Click **"+ New integration"** button
3. Fill in the integration details:
   - **Name**: `Test Case Uploader` (or your preference)
   - **Associated workspace**: Select your workspace
   - **Logo**: (optional)
4. Click **"Submit"**

### 1.2 Copy Your Secret Token

5. On the integration page, you'll see:
   - **Internal Integration Secret** (starts with `secret_`)
   - Copy this entire value (e.g., `secret_abc123XYZ...`)
   - This is your **NOTION_TOKEN**

⚠️ **Important:**
- Keep this secret safe (like a password)
- Don't commit to Git
- Store in `.env` file only

### 1.3 Grant Permissions to Your Integration

6. On the integration page, scroll down to **Capabilities**
7. Enable these permissions:
   - ✅ **Read content**
   - ✅ **Update content**
   - ✅ **Create content** (if you need to create new entries)
   - ✅ **Insert content**
   - ✅ **Delete content**

---

## Step 2: Get NOTION_DATABASE_ID

### 2.1 Create or Open Target Database

1. Open **Notion workspace**
2. Create a new database or open existing one for test cases
3. Make sure the database has these properties:
   ```
   - Title (type: title)
   - Module (type: multi_select)
   - Type (type: select)
   - Bug List (type: select)
   - Status Chrome (type: select)
   - Status Firefox (type: select)
   - Status Safari (type: select)
   - Expected Result (type: rich_text)
   - Steps Reproduce (type: rich_text)
   - Test Data (type: rich_text)
   - Prerequisites (type: rich_text)
   ```

### 2.2 Share Database with Integration

4. Click **Share** button (top right)
5. Search for your integration name (e.g., "Test Case Uploader")
6. Click to add it
7. Grant **Edit** access
8. Click **Invite**

### 2.3 Copy Database ID from URL

9. Look at the browser URL when viewing the database:
   ```
   https://www.notion.so/workspace-name/[DATABASE_ID]?v=[VIEW_ID]
   ```

   **Option A: From URL**
   - Copy the **32-character hex string** after `/`
   - Format: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` (no hyphens)
   - This is your **NOTION_DATABASE_ID**

   **Option B: From Share Menu**
   - Click **Share**
   - Look for "Copy database link"
   - URL format: `https://www.notion.so/[DATABASE_ID]?...`
   - Extract the 32-char ID

   **Option C: From Notion API**
   - If URL has hyphens like: `abc123-def456-ghi789-jkl012-mno345`
   - Convert to no-hyphens: `abc123def456ghi789jkl012mno345`

### Example Database ID:
```
Valid: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
Invalid (with hyphens): a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6
```

---

## Step 3: Verify Integration Connection

### 3.1 Test the Connection

Run this command to verify:
```bash
curl -H "Authorization: Bearer YOUR_NOTION_TOKEN" \
  "https://api.notion.com/v1/databases/YOUR_DATABASE_ID" \
  -H "Notion-Version: 2022-06-28"
```

**Expected response:** Database details (not an error)

### 3.2 Or Use Python to Test:
```python
import requests

NOTION_TOKEN = "secret_your_token_here"
DATABASE_ID = "your_database_id_here"

headers = {
    "Authorization": f"Bearer {NOTION_TOKEN}",
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json",
}

response = requests.get(
    f"https://api.notion.com/v1/databases/{DATABASE_ID}",
    headers=headers
)

if response.status_code == 200:
    print("✓ Connection successful!")
    print(f"Database title: {response.json().get('title')}")
else:
    print(f"✗ Connection failed: {response.status_code}")
    print(response.text)
```

---

## Step 4: Set Environment Variables

### 4.1 Create .env file

In your project root, create `.env`:
```env
NOTION_TOKEN=secret_abc123XYZ...your_full_secret_token
NOTION_DATABASE_ID=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

### 4.2 Or Set System Environment Variables

**Linux/Mac:**
```bash
export NOTION_TOKEN="secret_abc123XYZ..."
export NOTION_DATABASE_ID="a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
```

**Windows (PowerShell):**
```powershell
$env:NOTION_TOKEN = "secret_abc123XYZ..."
$env:NOTION_DATABASE_ID = "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
```

**Windows (CMD):**
```cmd
set NOTION_TOKEN=secret_abc123XYZ...
set NOTION_DATABASE_ID=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6
```

---

## Step 5: Run Upload Script

```bash
python3 upload_testcases_to_notion.py
```

The script will:
1. Read `.env` file for credentials
2. Load `testcases.json` (repo root)
3. Upload each test case to Notion database
4. Show progress and any errors

---

## Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| `401 Unauthorized` | Wrong/expired token | Regenerate integration secret |
| `404 Not Found` | Wrong database ID | Verify database ID format (no hyphens) |
| `403 Forbidden` | Integration not shared with DB | Share database with integration, grant Edit access |
| `Rate limit exceeded` | Too many requests too fast | Script has 0.35s delay between requests |
| `Invalid property name` | Database missing required fields | Add missing properties to Notion database |

---

## Quick Reference

| Item | Example | Notes |
|------|---------|-------|
| Integration Secret | `secret_abc123xyz...` | Starts with `secret_` |
| Database ID | `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6` | 32 hex characters, NO hyphens |
| API Endpoint | `https://api.notion.com/v1/` | Used by script |
| Notion Version | `2022-06-28` | API version used |

---

## Additional Resources

- **Notion API Docs**: https://developers.notion.com
- **Notion Integration Setup**: https://www.notion.so/my-integrations
- **Database Properties**: https://developers.notion.com/reference/property-object

