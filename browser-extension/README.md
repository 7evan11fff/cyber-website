# Chrome Extension (Manifest V3)

This folder contains a lightweight browser extension that scans the current tab through the app's existing `POST /api/check` endpoint and shows:

- Toolbar badge grade (`A`-`F`, color-coded)
- Toolbar icon that updates per-tab to the current grade letter
- Popup header breakdown (good/weak/missing per header)
- **View Full Report** button that opens the scanner with the URL pre-filled
- Right-click context action **Scan this link** for any hyperlink

## Files

- `manifest.json` - MV3 manifest
- `background.js` - service worker that updates the toolbar badge and handles scan requests
- `popup.html`, `popup.js`, `popup.css` - quick breakdown UI

## Default API endpoint

By default, the extension calls:

`https://security-header-checker.vercel.app/api/check`

You can change this from the popup under **API endpoint settings**.

## Local install (unpacked)

1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select this folder: `browser-extension/`.
5. Pin the extension, browse to any `http://` or `https://` page, and click the icon.

## Notes

- The extension only requests minimal permissions needed for active-tab scanning, context-menu link scanning, and settings storage.
- CORS preflight is handled by the app's `/api/check` route for `chrome-extension://` origins.
