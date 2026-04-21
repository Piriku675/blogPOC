# Blog Article POC

Structured content rendering from Firestore. Minimal, editorial design system.

---

## Project Structure

```
blog-poc/
├── public/
│   ├── article.html          ← Main article page
│   ├── css/
│   │   └── styles.css        ← Full design system
│   └── js/
│       ├── firebase-config.js ← ⚠️  Fill in your Firebase credentials
│       ├── data-service.js   ← Firestore fetch + validation
│       └── render.js         ← DOM rendering engine
├── seed.js                   ← Populates Firestore with demo article
├── firestore.rules           ← Security rules (public read, no client writes)
├── package.json
└── README.md
```

---

## Setup

### 1. Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com) and create a project.
2. Enable **Firestore Database** (start in production mode).
3. Deploy the security rules:
   ```bash
   firebase deploy --only firestore:rules
   ```

### 2. Configure the client

Open `public/js/firebase-config.js` and replace the placeholder values with your project's credentials (Firebase Console → Project Settings → Your apps → SDK snippet):

```js
const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  ...
};
```

### 3. Seed demo data

The seed script uses the Firebase Admin SDK with a service account key.

1. Generate a key: Firebase Console → Project Settings → Service accounts → **Generate new private key**
2. Save it as `serviceAccountKey.json` in the project root (**do not commit this file**)
3. Set the environment variable:
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="./serviceAccountKey.json"
   ```
4. Install dependencies and run:
   ```bash
   npm install
   npm run seed
   ```

You should see:
```
✅  Seed complete — document written: articles/demo-article-001
```

### 4. Serve the frontend

Any static server works. Examples:

```bash
# Python
python3 -m http.server 8080 --directory public

# Node (npx)
npx serve public

# VS Code Live Server
# Right-click article.html → Open with Live Server
```

Open `http://localhost:8080/article.html`.

---

## Firestore Data Structure

```
Collection: articles
  └── {articleId}
        ├── title: string
        └── sections: array
              └── {section}
                    ├── type: "singleColumn" | "twoColumn"
                    ├── order: number
                    │
                    ├── (singleColumn) blocks: array
                    ├── (twoColumn)   left: array
                    └── (twoColumn)   right: array
```

### Sub-block types

| type        | required fields          | optional    |
|-------------|--------------------------|-------------|
| `header`    | `text`, `level` (1–3)    | —           |
| `paragraph` | `text`                   | —           |
| `image`     | `src` (Cloudinary URL), `alt` | `caption` |
| `video`     | `url` (YouTube/Facebook) | —           |

---

## Security Rules Summary

- **Articles**: public read, no client-side writes
- **Everything else**: fully denied

Writes go through the Admin SDK (seed script / future server CMS) only.

---

## Design System

- **Fonts**: Playfair Display (display) + Source Serif 4 (body)
- **Palette**: warm off-white background, dark grey text, amber accent
- **Aspect ratios**: images `4:3`, videos `16:9` — enforced via CSS, not attributes
- **Layout**: centered, max `740px`, responsive padding
- **Columns**: two-column stacks to single on `≤ 640px`
