/** Canva design ids live in the URL: canva.com/design/<id>/edit */
export function designIdFromUrl(url) {
  const match = String(url || '').match(/canva\.com\/design\/([A-Za-z0-9_-]+)/)
  return match ? match[1] : null
}

/** The formats the team actually posts in. */
export const CANVA_PRESETS = [
  { key: 'instagram-post', label: 'Instagram post (1080×1080)', width: 1080, height: 1080 },
  { key: 'instagram-story', label: 'Instagram story (1080×1920)', width: 1080, height: 1920 },
  { key: 'facebook-post', label: 'Facebook post (1200×630)', width: 1200, height: 630 },
  { key: 'linkedin-post', label: 'LinkedIn post (1200×1200)', width: 1200, height: 1200 },
  { key: 'poster', label: 'Affiche A3 staand', width: 3508, height: 4961 },
]
