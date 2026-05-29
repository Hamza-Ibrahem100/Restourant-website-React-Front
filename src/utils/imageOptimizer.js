/**
 * Utility to dynamically optimize Unsplash images by modifying query parameters.
 * Unsplash CDN supports on-the-fly resizing, quality compression, and modern format conversion (WebP/AVIF).
 */
export const getOptimizedImageUrl = (url, width = 400, quality = 60) => {
  if (!url) return 'https://images.unsplash.com/photo-1541014741259-de529411b96a?w=400&q=60'; // standard placeholder
  
  if (url.includes('unsplash.com')) {
    try {
      const urlObj = new URL(url);
      urlObj.searchParams.set('w', width);
      urlObj.searchParams.set('q', quality);
      urlObj.searchParams.set('auto', 'format');
      urlObj.searchParams.set('fit', 'crop');
      return urlObj.toString();
    } catch (e) {
      // Fallback if URL parsing fails
      if (url.includes('?')) {
        return url.replace(/w=\d+/, `w=${width}`).replace(/q=\d+/, `q=${quality}`);
      }
      return `${url}?w=${width}&q=${quality}&auto=format&fit=crop`;
    }
  }
  return url;
};
