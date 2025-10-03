import { useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const Track = () => {
  const { bannerId } = useParams();
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email");

  useEffect(() => {
    const trackAndRedirect = async () => {
      if (!bannerId) {
        window.location.href = "/";
        return;
      }

      try {
        // Call the tracking edge function
        const { data, error } = await supabase.functions.invoke("track-banner-click", {
          body: {
            banner_id: bannerId,
            user_email: email,
            user_agent: navigator.userAgent,
            referrer: document.referrer,
          },
        });

        if (error) {
          console.error("Tracking error:", error);
        }

        // Redirect to the actual URL
        if (data?.redirect_url) {
          window.location.href = data.redirect_url;
        } else {
          window.location.href = "/";
        }
      } catch (error) {
        console.error("Error tracking click:", error);
        window.location.href = "/";
      }
    };

    trackAndRedirect();
  }, [bannerId, email]);

  // Return completely blank page - user won't see anything during redirect
  return null;
};

export default Track;
