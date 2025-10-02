import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const Track = () => {
  const { bannerId } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const trackAndRedirect = async () => {
      if (!bannerId) {
        navigate("/");
        return;
      }

      try {
        // Get user email from URL params if available
        const urlParams = new URLSearchParams(window.location.search);
        const userEmail = urlParams.get("email");
        
        // Call the tracking function
        const { data, error } = await supabase.functions.invoke("track-banner-click", {
          body: {
            banner_id: bannerId,
            user_email: userEmail,
            user_agent: navigator.userAgent,
            referrer: document.referrer,
          },
        });

        if (error) throw error;

        // Redirect to the banner's click URL
        if (data?.redirect_url) {
          window.location.href = data.redirect_url;
        } else {
          navigate("/");
        }
      } catch (error) {
        console.error("Error tracking click:", error);
        // Still try to redirect even if tracking fails
        navigate("/");
      }
    };

    trackAndRedirect();
  }, [bannerId, navigate]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Redirecting...</p>
      </div>
    </div>
  );
};

export default Track;
