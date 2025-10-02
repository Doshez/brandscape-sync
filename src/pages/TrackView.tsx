import { useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const TrackView = () => {
  const { bannerId } = useParams();
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email");

  useEffect(() => {
    const trackView = async () => {
      if (!bannerId) return;

      try {
        // Call the tracking edge function
        await supabase.functions.invoke("track-banner-view", {
          body: {
            banner_id: bannerId,
            user_email: email,
            user_agent: navigator.userAgent,
            referrer: document.referrer,
          },
        });
      } catch (error) {
        console.error("Error tracking view:", error);
      }
    };

    trackView();
  }, [bannerId, email]);

  // Return a 1x1 transparent pixel
  return (
    <img 
      src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" 
      width="1" 
      height="1" 
      alt="" 
      style={{ display: 'none' }}
    />
  );
};

export default TrackView;
