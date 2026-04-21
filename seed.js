// ─── seed.js ──────────────────────────────────────────────────────────────────
// Populates Firestore with a demo article for the Blog Article POC.
//
// Prerequisites:
//   npm install firebase-admin
//   export GOOGLE_APPLICATION_CREDENTIALS="/path/to/serviceAccountKey.json"
//
// Usage:
//   node seed.js
// ─────────────────────────────────────────────────────────────────────────────

import admin from 'firebase-admin';

// ── Init ──────────────────────────────────────────────────────────────────────
// Uses Application Default Credentials (service account key via env var).
// Alternatively, pass { credential: admin.credential.cert(require('./serviceAccountKey.json')) }
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  // databaseURL: 'https://YOUR_PROJECT_ID.firebaseio.com'  // only needed for RTDB
});

const db = admin.firestore();

// ── Demo Article ──────────────────────────────────────────────────────────────

const demoArticle = {
  title: 'The Architecture of Stillness',

  sections: [
    // ── Section 1: Single column — header + paragraph ─────────────────────
    {
      type: 'singleColumn',
      order: 1,
      blocks: [
        {
          type: 'header',
          level: 1,
          text: 'Finding Form in the Formless'
        },
        {
          type: 'paragraph',
          text:
            'There is a particular quality of light that arrives just before dusk — not golden, not grey, but something suspended between the two. Architects have chased this threshold for centuries, building rooms that exist purely to hold it. This article explores how structure and silence conspire to create spaces that feel inevitable.'
        },
        {
          type: 'paragraph',
          text:
            'The best rooms are not designed. They are discovered — first in the mind of the architect, then slowly uncovered through material, proportion, and the passage of ordinary time.'
        }
      ]
    },

    // ── Section 2: Two column — text + image ──────────────────────────────
    {
      type: 'twoColumn',
      order: 2,
      left: [
        {
          type: 'header',
          level: 2,
          text: 'Material Honesty'
        },
        {
          type: 'paragraph',
          text:
            'Raw concrete does not pretend to be marble. Exposed timber does not aspire to lacquer. When a material is used truthfully — for what it is, not what it might resemble — it stops being background and becomes participant.'
        },
        {
          type: 'paragraph',
          text:
            'Tadao Ando built his reputation on this principle. His walls are not finishes; they are the building itself, thinking in concrete.'
        }
      ],
      right: [
        {
          type: 'image',
          src: 'https://res.cloudinary.com/demo/image/upload/w_800,h_600,c_fill/sample.jpg',
          alt: 'Raw concrete wall with natural side-lighting casting soft shadows',
          caption: 'Light and concrete in dialogue — Naoshima, Japan.'
        }
      ]
    },

    // ── Section 3: Single column — image with caption ─────────────────────
    {
      type: 'singleColumn',
      order: 3,
      blocks: [
        {
          type: 'header',
          level: 3,
          text: 'In Detail'
        },
        {
          type: 'image',
          src: 'https://res.cloudinary.com/demo/image/upload/w_1200,h_900,c_fill/sample.jpg',
          alt: 'Close-up of hand-laid stone coursework with deep mortar joints',
          caption:
            'Every joint is a decision. The craft is in the spacing between things, not the things themselves.'
        }
      ]
    },

    // ── Section 4: Single column — video section ──────────────────────────
    {
      type: 'singleColumn',
      order: 4,
      blocks: [
        {
          type: 'header',
          level: 2,
          text: 'Seeing Through the Lens'
        },
        {
          type: 'paragraph',
          text:
            'Film captures what photography cannot: the movement of light across a surface over time. This short documentary traces a single afternoon inside a building designed around one window.'
        },
        {
          type: 'video',
          url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
        }
      ]
    }
  ]
};

// ── Write to Firestore ────────────────────────────────────────────────────────

async function seed() {
  try {
    const docRef = db.collection('articles').doc('demo-article-001');
    await docRef.set(demoArticle);
    console.log('✅  Seed complete — document written: articles/demo-article-001');
  } catch (err) {
    console.error('❌  Seed failed:', err);
    process.exit(1);
  } finally {
    // Terminate the admin SDK so the process exits cleanly
    await admin.app().delete();
  }
}

seed();
