/**
 * Utility functions for video thumbnail generation and watched status tracking
 */

export function getCloudinaryThumbnail(url: string | undefined | null): string | null {
  if (!url) return null;
  const urlStr = String(url);
  if (!urlStr.includes('cloudinary.com') || !urlStr.includes('/video/upload')) {
    return null;
  }
  try {
    // Replace the video extension (e.g., .mp4, .mov, .mkv, .avi, .webm) at the end of the path with .jpg
    let thumbUrl = urlStr.replace(/\.[^/.]+$/, '.jpg');

    if (thumbUrl.includes('/video/upload/')) {
      const parts = thumbUrl.split('/video/upload/');
      let rest = parts[1];
      // Clean up any existing transformation prefixes to avoid duplicate paths
      rest = rest.replace(/f_auto,q_auto\/?,?/g, '').replace(/so_\d+,?\/?,?/g, '').replace(/^\/+/, '');
      return `${parts[0]}/video/upload/so_1,f_auto,q_auto,w_800,c_limit/${rest}`;
    }

    return thumbUrl;
  } catch (e) {
    console.error("Failed to parse Cloudinary video URL:", e);
    return null;
  }
}

export function markVideoAsWatched(id: string) {
  if (!id) return;
  try {
    const watched = localStorage.getItem('watched_videos');
    const list = watched ? JSON.parse(watched) : [];
    if (!list.includes(id)) {
      list.push(id);
      localStorage.setItem('watched_videos', JSON.stringify(list));
      // Dispatch a custom event to trigger instant visual updates across the UI
      window.dispatchEvent(new CustomEvent('video-watched-update'));
    }
  } catch (e) {
    console.error("Failed to write watched status to localStorage:", e);
  }
}

export function isVideoWatched(id: string): boolean {
  if (!id) return false;
  try {
    const watched = localStorage.getItem('watched_videos');
    const list = watched ? JSON.parse(watched) : [];
    return list.includes(id);
  } catch (e) {
    return false;
  }
}
