/**
 * Utility functions for banner tracking
 */

// Use Supabase project URL for direct edge function calls (no auth required)
const SUPABASE_URL = "https://ddoihmeqpjjiumqndjgk.supabase.co";

/**
 * Wraps banner HTML content with tracking links and adds a tracking pixel for views
 */
export function wrapBannerWithTracking(
  bannerHtml: string,
  bannerId: string,
  userEmail?: string,
  includeViewPixel: boolean = true
): string {
  // Check if banner is already wrapped with tracking to prevent duplicates
  if (bannerHtml.includes('data-tracking-applied="true"') || bannerHtml.includes('<!-- tracking-applied -->')) {
    return bannerHtml;
  }
  
  // Only add email param if email is provided and not empty
  const emailParam = userEmail ? `&email=${encodeURIComponent(userEmail)}` : '';
  // Call edge function directly - no auth required  
  const trackingUrl = `${SUPABASE_URL}/functions/v1/track-banner-click?banner_id=${bannerId}${emailParam}`;
  
  // Add tracking pixel for view tracking (1x1 transparent image) - calls edge function directly
  // Fixed URL format: banner_id as query param, not path param
  // Use positioning to move pixel off-screen instead of hiding
  const viewTrackingPixel = includeViewPixel 
    ? `<!-- banner-view-pixel --><img src="${SUPABASE_URL}/functions/v1/track-banner-view?banner_id=${bannerId}${emailParam}" width="1" height="1" style="position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;" alt="" aria-hidden="true" role="presentation" />`
    : '';
  
  // Wrap any clickable elements (a tags and images) with tracking
  let wrappedHtml = bannerHtml;
  
  // Wrap images that aren't already in links
  wrappedHtml = wrappedHtml.replace(
    /<img(?![^>]*data-tracked)([^>]*)>/gi,
    (match, p1, offset) => {
      // Check if this img is already inside an <a> tag by looking at content BEFORE this position
      const beforeImg = wrappedHtml.substring(0, offset);
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
    (match, attrs) => {
      // Preserve link text and styling to avoid showing tracking URL
      return `<a ${attrs} data-original-href="${attrs}" href="${trackingUrl}" style="color:inherit;text-decoration:inherit;">`;
    }
  );
  
  // Add view tracking pixel at the end (only if includeViewPixel is true)
  if (viewTrackingPixel) {
    wrappedHtml = `${wrappedHtml}${viewTrackingPixel}`;
  }
  
  // Add marker to indicate tracking has been applied (prevents double-wrapping)
  wrappedHtml = `<!-- tracking-applied -->${wrappedHtml}`;
  
  return wrappedHtml;
}

/**
 * Generates tracking URL for a banner - calls edge function directly
 */
export function getBannerTrackingUrl(bannerId: string, userEmail?: string): string {
  const emailParam = userEmail ? `&email=${encodeURIComponent(userEmail)}` : '';
  return `${SUPABASE_URL}/functions/v1/track-banner-click?banner_id=${bannerId}${emailParam}`;
}

/**
 * Generates view tracking pixel URL - calls edge function directly
 */
export function getViewTrackingPixelUrl(bannerId: string, userEmail?: string): string {
  const emailParam = userEmail ? `&email=${encodeURIComponent(userEmail)}` : '';
  return `${SUPABASE_URL}/functions/v1/track-banner-view?banner_id=${bannerId}${emailParam}`;
}
