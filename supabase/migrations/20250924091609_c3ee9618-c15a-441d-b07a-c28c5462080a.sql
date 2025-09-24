-- Fix security definer view issue by recreating the view without SECURITY DEFINER
DROP VIEW IF EXISTS public.banner_analytics;

-- Create view for banner analytics without SECURITY DEFINER (regular view)
CREATE VIEW public.banner_analytics AS
SELECT 
  b.id,
  b.name,
  b.is_active,
  b.created_at,
  b.current_clicks,
  b.max_clicks,
  COUNT(ae.id) as total_events,
  COUNT(CASE WHEN ae.event_type = 'click' THEN 1 END) as click_count,
  COUNT(CASE WHEN ae.event_type = 'impression' THEN 1 END) as impression_count,
  CAST(
    CASE 
      WHEN COUNT(CASE WHEN ae.event_type = 'impression' THEN 1 END) > 0 
      THEN ROUND((COUNT(CASE WHEN ae.event_type = 'click' THEN 1 END)::numeric / COUNT(CASE WHEN ae.event_type = 'impression' THEN 1 END)::numeric) * 100, 2)
      ELSE 0 
    END AS DECIMAL(5,2)
  ) as click_through_rate
FROM banners b
LEFT JOIN analytics_events ae ON b.id = ae.banner_id
GROUP BY b.id, b.name, b.is_active, b.created_at, b.current_clicks, b.max_clicks;

-- Grant access to the view
GRANT SELECT ON public.banner_analytics TO authenticated;