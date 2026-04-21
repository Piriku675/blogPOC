// ─── data-service.js ─────────────────────────────────────────────────────────
// Initialises Firebase and fetches + validates article data from Firestore.

import firebaseConfig from './firebase-config.js';

// ── Init ──────────────────────────────────────────────────────────────────────

let db = null;

export function initFirebase() {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  db = firebase.firestore();
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

/**
 * Fetches a single article document from Firestore.
 * @param {string} articleId - The Firestore document ID.
 * @returns {Promise<Object>} Validated article object.
 */
export async function fetchArticle(articleId) {
  if (!db) throw new Error('Firebase has not been initialised. Call initFirebase() first.');

  const docRef = db.collection('articles').doc(articleId);
  const snapshot = await docRef.get();

  if (!snapshot.exists) {
    throw new Error(`Article "${articleId}" not found in Firestore.`);
  }

  const data = { id: snapshot.id, ...snapshot.data() };
  return validateArticle(data);
}

// ── Validation ────────────────────────────────────────────────────────────────

const VALID_SECTION_TYPES = ['singleColumn', 'twoColumn'];
const VALID_BLOCK_TYPES   = ['header', 'paragraph', 'image', 'video'];

function validateArticle(data) {
  if (!data.title || typeof data.title !== 'string') {
    throw new Error('Article is missing a valid "title" field.');
  }
  if (!Array.isArray(data.sections) || data.sections.length === 0) {
    throw new Error('Article must have at least one section.');
  }

  data.sections = data.sections.map((section, i) => validateSection(section, i));
  // Sort sections by order ascending
  data.sections.sort((a, b) => a.order - b.order);

  return data;
}

function validateSection(section, index) {
  const label = `Section[${index}]`;

  if (!VALID_SECTION_TYPES.includes(section.type)) {
    throw new Error(`${label}: "type" must be "singleColumn" or "twoColumn". Got: "${section.type}".`);
  }
  if (typeof section.order !== 'number') {
    throw new Error(`${label}: "order" must be a number. Got: "${section.order}".`);
  }

  if (section.type === 'singleColumn') {
    if (!Array.isArray(section.blocks) || section.blocks.length === 0) {
      throw new Error(`${label} (singleColumn): must have at least 1 block in "blocks".`);
    }
    section.blocks = section.blocks.map((b, bi) => validateBlock(b, `${label}.blocks[${bi}]`));

  } else if (section.type === 'twoColumn') {
    if (!Array.isArray(section.left) || section.left.length === 0) {
      throw new Error(`${label} (twoColumn): must have at least 1 block in "left".`);
    }
    if (!Array.isArray(section.right) || section.right.length === 0) {
      throw new Error(`${label} (twoColumn): must have at least 1 block in "right".`);
    }
    section.left  = section.left.map((b, bi)  => validateBlock(b, `${label}.left[${bi}]`));
    section.right = section.right.map((b, bi) => validateBlock(b, `${label}.right[${bi}]`));
  }

  return section;
}

function validateBlock(block, label) {
  if (!VALID_BLOCK_TYPES.includes(block.type)) {
    throw new Error(`${label}: "type" must be one of [${VALID_BLOCK_TYPES.join(', ')}]. Got: "${block.type}".`);
  }

  switch (block.type) {
    case 'header':
      if (!block.text || typeof block.text !== 'string') {
        throw new Error(`${label} (header): "text" is required.`);
      }
      if (![1, 2, 3].includes(Number(block.level))) {
        throw new Error(`${label} (header): "level" must be 1, 2, or 3. Got: "${block.level}".`);
      }
      block.level = Number(block.level);
      break;

    case 'paragraph':
      if (!block.text || typeof block.text !== 'string') {
        throw new Error(`${label} (paragraph): "text" is required.`);
      }
      break;

    case 'image':
      if (!block.src || typeof block.src !== 'string') {
        throw new Error(`${label} (image): "src" (Cloudinary URL) is required.`);
      }
      if (!block.alt || typeof block.alt !== 'string') {
        throw new Error(`${label} (image): "alt" text is required for accessibility.`);
      }
      break;

    case 'video':
      if (!block.url || typeof block.url !== 'string') {
        throw new Error(`${label} (video): "url" is required.`);
      }
      break;
  }

  return block;
}
