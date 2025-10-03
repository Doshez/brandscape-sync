/**
 * Utility functions for banner tracking
 */

// Use Supabase URL for tracking to ensure it works without login
const APP_URL = "https://ddoihmeqpjjiumqndjgk.supabase.co";

/**
 * Wraps banner HTML content with tracking links and adds a tracking pixel for views
 */
export function wrapBannerWithTracking(
  bannerHtml: string,
  bannerId: string,
  userEmail?: string
): string {
  const emailParam = userEmail ? `?email=${encodeURIComponent(userEmail)}` : '';
  // Use direct edge function endpoint for click tracking
  const trackingUrl = `${APP_URL}/functions/v1/track-banner-click`;
  
  // Add tracking pixel for view tracking (1x1 transparent image)
  const viewTrackingPixel = `<img src="${APP_URL}/functions/v1/track-banner-view/${bannerId}${emailParam}" width="1" height="1" style="display:none;" alt="" />`;
  
  // Wrap any clickable elements (a tags and images) with tracking
  let wrappedHtml = bannerHtml;
  
  // Wrap images that aren't already in links
  wrappedHtml = wrappedHtml.replace(
    /<img(?![^>]*data-tracked)([^>]*)>/gi,
    (match) => {
      // Check if this img is already inside an <a> tag
      const beforeImg = bannerHtml.substring(0, bannerHtml.indexOf(match));
      const openATagsCount = (beforeImg.match(/<a[^>]*>/gi) || []).length;
      const closeATagsCount = (beforeImg.match(/<\/a>/gi) || []).length;
      
      // If img is already inside an <a> tag, don't wrap it
      if (openATagsCount > closeATagsCount) {
        return match;
      }
      
      return `<a href="${trackingUrl}" style="text-decoration:none;display:inline-block;">${match}</a>`;
    }
  );
  
  // Update existing links to go through tracking
  wrappedHtml = wrappedHtml.replace(
    /<a\s+([^>]*href=["'][^"']*["'][^>]*)>/gi,
    `<a $1 data-original-href="$1" href="${trackingUrl}">`
  );
  
  // Add view tracking pixel at the end
  wrappedHtml = `${wrappedHtml}${viewTrackingPixel}`;
  
  return wrappedHtml;
}

/**
 * Generates tracking URL for a banner
 */
export function getBannerTrackingUrl(bannerId: string, userEmail?: string): string {
  const emailParam = userEmail ? `?email=${encodeURIComponent(userEmail)}` : '';
  return `${APP_URL}/functions/v1/track-banner-click${emailParam}`;
}

/**
 * Generates view tracking pixel URL
 */
export function getViewTrackingPixelUrl(bannerId: string, userEmail?: string): string {
  const emailParam = userEmail ? `?email=${encodeURIComponent(userEmail)}` : '';
  return `${APP_URL}/functions/v1/track-banner-view/${bannerId}${emailParam}`;
}
