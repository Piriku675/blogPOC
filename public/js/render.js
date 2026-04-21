// ─── render.js ────────────────────────────────────────────────────────────────
// Rendering engine: takes a validated article object and builds the DOM.

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Renders a full article into the given container element.
 * @param {Object} article  - Validated article from data-service.js
 * @param {HTMLElement} container - Target mount point
 */
export function renderArticle(article, container) {
  container.innerHTML = '';

  // Article header
  const articleEl = document.createElement('article');
  articleEl.className = 'article';

  const titleEl = document.createElement('h1');
  titleEl.className = 'article-title';
  titleEl.textContent = article.title;
  articleEl.appendChild(titleEl);

  const titleDivider = buildDivider('title-divider');
  articleEl.appendChild(titleDivider);

  // Sections (already sorted by order in data-service)
  article.sections.forEach((section, index) => {
    const sectionEl = renderSection(section);
    articleEl.appendChild(sectionEl);

    // Insert divider between sections, not after the last one
    if (index < article.sections.length - 1) {
      articleEl.appendChild(buildDivider('section-divider'));
    }
  });

  container.appendChild(articleEl);
}

// ── Section Rendering ─────────────────────────────────────────────────────────

function renderSection(section) {
  const wrapper = document.createElement('section');
  wrapper.className = `section section--${section.type}`;
  wrapper.dataset.order = section.order;

  if (section.type === 'singleColumn') {
    const col = document.createElement('div');
    col.className = 'section__column';
    section.blocks.forEach(block => col.appendChild(renderBlock(block)));
    wrapper.appendChild(col);

  } else if (section.type === 'twoColumn') {
    const left = document.createElement('div');
    left.className = 'section__column section__column--left';
    section.left.forEach(block => left.appendChild(renderBlock(block)));

    const right = document.createElement('div');
    right.className = 'section__column section__column--right';
    section.right.forEach(block => right.appendChild(renderBlock(block)));

    wrapper.appendChild(left);
    wrapper.appendChild(right);
  }

  return wrapper;
}

// ── Block Rendering ───────────────────────────────────────────────────────────

function renderBlock(block) {
  switch (block.type) {
    case 'header':    return renderHeader(block);
    case 'paragraph': return renderParagraph(block);
    case 'image':     return renderImage(block);
    case 'video':     return renderVideo(block);
    default:
      console.warn(`renderBlock: unknown block type "${block.type}"`);
      return document.createDocumentFragment();
  }
}

function renderHeader(block) {
  const el = document.createElement(`h${block.level}`);
  el.className = `block block--header block--header-${block.level}`;
  el.textContent = block.text;
  return el;
}

function renderParagraph(block) {
  const el = document.createElement('p');
  el.className = 'block block--paragraph';
  el.textContent = block.text;
  return el;
}

function renderImage(block) {
  const figure = document.createElement('figure');
  figure.className = 'block block--image';

  const imgWrapper = document.createElement('div');
  imgWrapper.className = 'image-ratio-box';

  const img = document.createElement('img');
  img.src     = block.src;
  img.alt     = block.alt;   // always present — enforced by validator
  img.loading = 'lazy';
  img.decoding = 'async';

  imgWrapper.appendChild(img);
  figure.appendChild(imgWrapper);

  if (block.caption) {
    const caption = document.createElement('figcaption');
    caption.className = 'image-caption';
    caption.textContent = block.caption;
    figure.appendChild(caption);
  }

  return figure;
}

function renderVideo(block) {
  const wrapper = document.createElement('div');
  wrapper.className = 'block block--video';

  const ratioBox = document.createElement('div');
  ratioBox.className = 'video-ratio-box';

  const iframe = document.createElement('iframe');
  iframe.src             = resolveVideoEmbedUrl(block.url);
  iframe.title           = 'Embedded video';
  iframe.allowFullscreen = true;
  iframe.allow           = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
  iframe.setAttribute('loading', 'lazy');

  ratioBox.appendChild(iframe);
  wrapper.appendChild(ratioBox);
  return wrapper;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Converts a YouTube or Facebook watch URL into an embeddable src.
 */
function resolveVideoEmbedUrl(url) {
  try {
    const u = new URL(url);

    // YouTube — standard: youtube.com/watch?v=ID
    if (u.hostname.includes('youtube.com') && u.searchParams.has('v')) {
      return `https://www.youtube.com/embed/${u.searchParams.get('v')}`;
    }
    // YouTube — short: youtu.be/ID
    if (u.hostname === 'youtu.be') {
      return `https://www.youtube.com/embed${u.pathname}`;
    }
    // Facebook video
    if (u.hostname.includes('facebook.com')) {
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`;
    }
  } catch (_) {
    // malformed URL — fall through and return as-is
  }
  // Already an embed URL or unknown provider — use directly
  return url;
}

function buildDivider(className = '') {
  const hr = document.createElement('hr');
  hr.className = `divider ${className}`.trim();
  return hr;
}
