-- Insert a sample email signature for testing
INSERT INTO email_signatures (template_name, html_content, created_by, signature_type, is_active) 
VALUES (
  'Default Admin Signature',
  '<div style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
    <p><strong>Michael Odongo</strong><br>
    IT Administrator<br>
    CIO Africa<br>
    Email: michael.odongo@cioafrica.co</p>
    <p style="font-size: 12px; color: #666;">
    This email and any attachments are confidential and intended solely for the addressee.
    </p>
  </div>',
  (SELECT user_id FROM profiles WHERE email = 'michael.odongo@cioafrica.co' LIMIT 1),
  'admin',
  true
);

-- Update the banner to have some content
UPDATE banners 
SET html_content = '<div style="background: #f0f8ff; padding: 10px; text-align: center; border-radius: 5px;">
  <p style="margin: 0; color: #0066cc; font-weight: bold;">CIO100 Awards - Submit your nominations now!</p>
</div>'
WHERE name = 'CIO100' AND html_content = '';