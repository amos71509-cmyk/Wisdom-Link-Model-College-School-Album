/**
 * Utility functions for fast image loading and bandwidth optimization
 */

export function getOptimizedImageUrl(url: string | undefined | null, width = 600, quality = 75): string {
  if (!url) return '';
  
  // Cloudinary optimization
  if (url.includes('cloudinary.com') && url.includes('/image/upload/')) {
    if (url.includes('/f_auto,q_auto')) {
      return url;
    }
    return url.replace('/image/upload/', `/image/upload/f_auto,q_auto,w_${width},c_limit/`);
  }
  
  // Unsplash optimization
  if (url.includes('images.unsplash.com')) {
    let cleanUrl = url;
    if (cleanUrl.includes('w=')) {
      cleanUrl = cleanUrl.replace(/w=\d+/, `w=${width}`);
    } else {
      cleanUrl += (cleanUrl.includes('?') ? '&' : '?') + `w=${width}`;
    }
    if (cleanUrl.includes('q=')) {
      cleanUrl = cleanUrl.replace(/q=\d+/, `q=${quality}`);
    } else {
      cleanUrl += `&q=${quality}`;
    }
    if (!cleanUrl.includes('auto=')) {
      cleanUrl += '&auto=format';
    }
    return cleanUrl;
  }
  
  return url;
}

/**
 * Preloads critical images into browser cache asynchronously
 */
export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    if (!src) return resolve();
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });
}
