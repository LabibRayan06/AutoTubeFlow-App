# **App Name**: AutoTubeFlow

## Core Features:

- Google Account Connection: Connect to user's Google account with YouTube Data API, Google Drive API, and Google Sheets API access.
- Google Sheet Creation: Creates a new Google Sheet with columns: URL, Title, Description, DateAdded, isProcessed, and VideoId.
- GitHub Account Connection: Connect to the user's GitHub account with repo and secret access.
- GitHub Repository Forking: Forks the specified GitHub repository into the user's account.
- GitHub Secrets Management: Adds GitHub Action secrets (YT_ACCESS_TOKEN, DRIVE_ACCESS_TOKEN, SHEETS_ACCESS_TOKEN, SHEET_ID) to the forked repo.
- URL Submission: Takes video url and stores information in the Google sheet.
- URL Validation and Data Entry: Checks if a submitted URL already exists in the Google Sheet and, if not, fetches video details and adds them to the sheet.

## Style Guidelines:

- Primary color: Soft blue (#A0CFEC) to convey trust and calmness associated with automated processes.
- Background color: Light grey (#F0F4F7), very desaturated, for a clean interface that keeps the focus on content.
- Accent color: Muted violet (#B1A2BF), to provide contrast without being too aggressive, while also suggesting 'automation'.
- Font: 'Inter', a sans-serif typeface that provides a clean and modern feel, suitable for both headers and body text.
- Simple, outlined icons to represent actions like connecting accounts, forking repositories, and submitting URLs.
- Clean and straightforward layout to ensure easy navigation and usability, with a focus on the video submission input field.
- Subtle transitions and loading animations to provide feedback during the data fetching and sheet update processes.