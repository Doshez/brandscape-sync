import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, CheckCircle, AlertCircle, Globe, Mail, Server, ExternalLink, Edit, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from 'zod';
import { SendGridSetup } from './SendGridSetup';

interface EmailRoutingSetupProps {
  profile: any;
}

interface Domain {
  id: string;
  domain_name: string;
  is_verified: boolean;
}

interface RelayConfig {
  id: string;
  domain: string;
  relay_secret: string;
  is_active: boolean;
}

interface User {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  department?: string;
}

interface EmailSignature {
  id: string;
  template_name: string;
  html_content: string;
  is_active?: boolean;
}

interface Banner {
  id: string;
  name: string;
  html_content: string;
  is_active?: boolean;
}

interface UserAssignment {
  id: string;
  user_id: string;
  signature_id?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
  user?: User;
  signature?: EmailSignature;
  banners?: Banner[];
}

// Input validation schema
const assignmentSchema = z.object({
  user_id: z.string().uuid({ message: "Invalid user ID format" }),
  signature_id: z.string().uuid({ message: "Invalid signature ID format" }),
  banner_ids: z.array(z.string().uuid({ message: "Invalid banner ID format" }))
    .min(1, { message: "At least one banner is required" })
    .max(4, { message: "Maximum 4 banners allowed" })
});

export const EmailRoutingSetup: React.FC<EmailRoutingSetupProps> = ({ profile }) => {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [selectedDomain, setSelectedDomain] = useState('');
  const [relayConfig, setRelayConfig] = useState<RelayConfig | null>(null);
  const [loading, setLoading] = useState(false);
  
  // User management state
  const [users, setUsers] = useState<User[]>([]);
  const [signatures, setSignatures] = useState<EmailSignature[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [assignments, setAssignments] = useState<UserAssignment[]>([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedSignature, setSelectedSignature] = useState('');
  const [selectedBanners, setSelectedBanners] = useState<string[]>([]);
  
  // Edit state
  const [editingAssignment, setEditingAssignment] = useState<UserAssignment | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  
  // Test email state
  const [testUserId, setTestUserId] = useState('');
  const [testRecipientEmail, setTestRecipientEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  
  // Smart host configuration edit state
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [editPassword, setEditPassword] = useState('');

  useEffect(() => {
    if (profile?.is_admin) {
      fetchDomains();
      fetchRelayConfig();
      fetchUsers();
      fetchSignatures();
      fetchBanners();
      fetchAssignments();
    }
  }, [profile]);

  const fetchDomains = async () => {
    const { data } = await supabase
      .from('domains')
      .select('id, domain_name, is_verified')
      .eq('is_verified', true);
    
    if (data) {
      setDomains(data);
      if (data.length > 0 && !selectedDomain) {
        setSelectedDomain(data[0].domain_name);
      }
    }
  };

  const fetchRelayConfig = async () => {
    const { data } = await supabase
      .from('smtp_relay_config')
      .select('*')
      .eq('is_active', true)
      .maybeSingle();
    
    if (data) {
      setRelayConfig(data);
      setSelectedDomain(data.domain);
    }
  };

  // User management functions
  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('first_name');
      
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to fetch users');
    }
  };

  const fetchSignatures = async () => {
    try {
      const { data, error } = await supabase
        .from('email_signatures')
        .select('*')
        .eq('is_active', true)
        .order('template_name');
      
      if (error) throw error;
      setSignatures(data || []);
    } catch (error) {
      console.error('Error fetching signatures:', error);
      toast.error('Failed to fetch signatures');
    }
  };

  const fetchBanners = async () => {
    try {
      const { data, error } = await supabase
        .from('banners')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      setBanners(data || []);
    } catch (error) {
      console.error('Error fetching banners:', error);
      toast.error('Failed to fetch banners');
    }
  };

  const fetchAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from('user_email_assignments')
        .select(`
          id,
          user_id,
          signature_id,
          is_active,
          created_at,
          updated_at
        `)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Fetch related data separately
      const assignmentsWithDetails = await Promise.all(
        (data || []).map(async (assignment) => {
          // Fetch user details
          const { data: userData } = await supabase
            .from('profiles')
            .select('id, email, first_name, last_name, department')
            .eq('id', assignment.user_id)
            .single();

          // Fetch signature details
          const { data: signatureData } = await supabase
            .from('email_signatures')
            .select('id, template_name, html_content')
            .eq('id', assignment.signature_id)
            .single();

          // Fetch banner assignments
          const { data: bannerAssignments } = await supabase
            .from('user_banner_assignments')
            .select(`
              banner:banners(id, name, html_content)
            `)
            .eq('user_assignment_id', assignment.id);

          return {
            ...assignment,
            user: userData,
            signature: signatureData,
            banners: bannerAssignments?.map(ba => ba.banner).filter(Boolean) || []
          };
        })
      );
      
      setAssignments(assignmentsWithDetails);
    } catch (error) {
      console.error('Error fetching assignments:', error);
      toast.error('Failed to fetch assignments');
    }
  };

  const createUserAssignment = async () => {
    // Input validation with zod
    const validationResult = assignmentSchema.safeParse({
      user_id: selectedUser,
      signature_id: selectedSignature,
      banner_ids: selectedBanners
    });

    if (!validationResult.success) {
      const errors = validationResult.error.issues.map(e => e.message).join(', ');
      toast.error(`Validation error: ${errors}`);
      return;
    }

    try {
      setLoading(true);

      if (isEditing && editingAssignment) {
        // Update existing assignment
        await updateUserAssignment();
      } else {
        // Create new assignment
        await createNewAssignment();
      }
    } catch (error) {
      console.error('Error managing assignment:', error);
      toast.error('Failed to save user assignment');
    } finally {
      setLoading(false);
    }
  };

  const createNewAssignment = async () => {
    // Deactivate previous assignments for this user
    await supabase
      .from('user_email_assignments')
      .update({ is_active: false })
      .eq('user_id', selectedUser);

    // Create new assignment
    const { data: assignment, error: assignmentError } = await supabase
      .from('user_email_assignments')
      .insert({
        user_id: selectedUser,
        signature_id: selectedSignature,
        is_active: true
      })
      .select()
      .single();

    if (assignmentError) throw assignmentError;

    // Add banner assignments
    const bannerAssignments = selectedBanners.map((bannerId, index) => ({
      user_assignment_id: assignment.id,
      banner_id: bannerId,
      display_order: index + 1
    }));

    const { error: bannerError } = await supabase
      .from('user_banner_assignments')
      .insert(bannerAssignments);

    if (bannerError) throw bannerError;

    toast.success('User assignment created successfully');
    resetForm();
    fetchAssignments();
  };

  const updateUserAssignment = async () => {
    if (!editingAssignment) return;

    // Update signature
    const { error: signatureError } = await supabase
      .from('user_email_assignments')
      .update({
        signature_id: selectedSignature,
        updated_at: new Date().toISOString()
      })
      .eq('id', editingAssignment.id);

    if (signatureError) throw signatureError;

    // Remove existing banner assignments
    await supabase
      .from('user_banner_assignments')
      .delete()
      .eq('user_assignment_id', editingAssignment.id);

    // Add new banner assignments
    const bannerAssignments = selectedBanners.map((bannerId, index) => ({
      user_assignment_id: editingAssignment.id,
      banner_id: bannerId,
      display_order: index + 1
    }));

    const { error: bannerError } = await supabase
      .from('user_banner_assignments')
      .insert(bannerAssignments);

    if (bannerError) throw bannerError;

    toast.success('User assignment updated successfully');
    resetForm();
    fetchAssignments();
  };

  const startEditAssignment = (assignment: UserAssignment) => {
    setEditingAssignment(assignment);
    setIsEditing(true);
    setSelectedUser(assignment.user_id);
    setSelectedSignature(assignment.signature_id || '');
    setSelectedBanners(assignment.banners?.map(b => b.id) || []);
  };

  const cancelEdit = () => {
    resetForm();
  };

  const resetForm = () => {
    setEditingAssignment(null);
    setIsEditing(false);
    setSelectedUser('');
    setSelectedSignature('');
    setSelectedBanners([]);
  };

  const removeAssignment = async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from('user_email_assignments')
        .update({ is_active: false })
        .eq('id', assignmentId);

      if (error) throw error;

      toast.success('User assignment removed successfully');
      fetchAssignments();
    } catch (error) {
      console.error('Error removing assignment:', error);
      toast.error('Failed to remove user assignment');
    }
  };

  const sendTestEmail = async () => {
    if (!testUserId || !testRecipientEmail) {
      toast.error('Please select a user and enter recipient email');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(testRecipientEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setSendingTest(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-test-email', {
        body: {
          recipientEmail: testRecipientEmail,
          senderUserId: testUserId
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(`Test email sent successfully to ${testRecipientEmail}`);
        // Reset form
        setTestRecipientEmail('');
      } else {
        throw new Error(data.error || 'Failed to send test email');
      }
    } catch (error: any) {
      console.error('Error sending test email:', error);
      toast.error('Failed to send test email: ' + (error.message || 'Unknown error'));
    } finally {
      setSendingTest(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const createRoutingDomain = async () => {
    if (!selectedDomain) {
      toast.error('Please select a domain first');
      return;
    }

    setLoading(true);
    try {
      // Generate routing configuration
      const routingSecret = crypto.getRandomValues(new Uint8Array(32))
        .reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');

      // Check if config already exists
      const { data: existingConfig } = await supabase
        .from('smtp_relay_config')
        .select('id')
        .eq('domain', selectedDomain)
        .maybeSingle();

      if (existingConfig) {
        // Update existing config
        const { data, error } = await supabase
          .from('smtp_relay_config')
          .update({
            relay_secret: routingSecret,
            is_active: true,
            updated_at: new Date().toISOString()
          })
          .eq('domain', selectedDomain)
          .select()
          .single();
        
        if (error) throw error;
        setRelayConfig(data);
      } else {
        // Deactivate all existing configs
        await supabase
          .from('smtp_relay_config')
          .update({ is_active: false })
          .eq('is_active', true);

        // Create new config
        const { data, error } = await supabase
          .from('smtp_relay_config')
          .insert({
            domain: selectedDomain,
            relay_secret: routingSecret,
            is_active: true
          })
          .select()
          .single();
        
        if (error) throw error;
        setRelayConfig(data);
      }

      toast.success('Email routing domain configured successfully');
    } catch (error: any) {
      toast.error('Failed to configure routing domain: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!profile?.is_admin) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Only administrators can configure email routing domains.
        </AlertDescription>
      </Alert>
    );
  }

  const smartHost = selectedDomain ? `smtp-relay.${selectedDomain}` : '';
  const relayEndpoint = 'ddoihmeqpjjiumqndjgk.supabase.co';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="h-6 w-6" />
            Email Routing Domain Setup
          </h2>
          <p className="text-muted-foreground">
            Configure your domain to route emails through the smart host system
          </p>
        </div>
      </div>

      {domains.length === 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You need to have at least one verified domain before setting up email routing. 
            Please add and verify a domain in the Domain Manager first.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="setup" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="setup">Domain Setup</TabsTrigger>
          <TabsTrigger value="dns">DNS Configuration</TabsTrigger>
          <TabsTrigger value="sendgrid">SendGrid Setup</TabsTrigger>
          <TabsTrigger value="routing">Routing Rules</TabsTrigger>
          <TabsTrigger value="users">User Management</TabsTrigger>
          <TabsTrigger value="test">Test Email</TabsTrigger>
        </TabsList>

        <TabsContent value="setup" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="h-5 w-5" />
                Configure Routing Domain
              </CardTitle>
              <CardDescription>
                Select a verified domain and configure it for email routing through the smart host
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="domain-select">Select Verified Domain</Label>
                <select
                  id="domain-select"
                  className="w-full p-2 border rounded-md"
                  value={selectedDomain}
                  onChange={(e) => setSelectedDomain(e.target.value)}
                  disabled={domains.length === 0}
                >
                  <option value="">Select a domain...</option>
                  {domains.map((domain) => (
                    <option key={domain.id} value={domain.domain_name}>
                      {domain.domain_name}
                    </option>
                  ))}
                </select>
              </div>

              <Button 
                onClick={createRoutingDomain}
                disabled={!selectedDomain || loading || domains.length === 0}
                className="w-full"
              >
                {loading ? 'Configuring...' : 'Configure Email Routing'}
              </Button>

              {relayConfig && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Email routing configured for domain: <strong>{relayConfig.domain}</strong>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dns" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>DNS Records Configuration</CardTitle>
              <CardDescription>
                Add these DNS records to enable smart host routing for your domain
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedDomain ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Please select a domain first to see the DNS configuration.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 border rounded-md">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">CNAME Record (Required)</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(`smtp-relay.${selectedDomain} CNAME ${relayEndpoint}`)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Name:</span>
                        <p className="font-mono">smtp-relay</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Type:</span>
                        <p className="font-mono">CNAME</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Value:</span>
                        <p className="font-mono">{relayEndpoint}</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border rounded-md">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">MX Record (Optional - for direct routing)</span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(`10 ${smartHost}`)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Name:</span>
                        <p className="font-mono">@</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Type:</span>
                        <p className="font-mono">MX</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Value:</span>
                        <p className="font-mono">10 {smartHost}</p>
                      </div>
                    </div>
                  </div>

                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Important:</strong> DNS propagation can take up to 24 hours. 
                      Test your configuration after DNS records have propagated completely.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sendgrid" className="space-y-4">
          <SendGridSetup relayConfig={relayConfig} />
        </TabsContent>

        <TabsContent value="routing" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Smart Host Configuration</CardTitle>
                  <CardDescription>
                    Use these details to configure your email server or Exchange connector
                  </CardDescription>
                </div>
                {relayConfig && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        setLoading(true);
                        const { error } = await supabase
                          .from('smtp_relay_config')
                          .update({
                            relay_secret: crypto.getRandomValues(new Uint8Array(32))
                              .reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), ''),
                            updated_at: new Date().toISOString()
                          })
                          .eq('id', relayConfig.id);
                        
                        if (error) throw error;
                        
                        await fetchRelayConfig();
                        toast.success('Password regenerated successfully');
                      } catch (error) {
                        toast.error('Failed to regenerate password');
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading}
                  >
                    Regenerate Password
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {!selectedDomain || !relayConfig ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Please configure a routing domain first to see the smart host details.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Smart Host</Label>
                      <div className="flex items-center gap-2">
                        <Input value={smartHost} readOnly />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard(smartHost)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Port</Label>
                      <div className="flex items-center gap-2">
                        <Input value="587" readOnly />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => copyToClipboard("587")}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <Label>Authentication Credentials</Label>
                      {!isEditingPassword ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setIsEditingPassword(true);
                            setEditPassword(relayConfig.relay_secret);
                          }}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Password
                        </Button>
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={async () => {
                              try {
                                setLoading(true);
                                const { error } = await supabase
                                  .from('smtp_relay_config')
                                  .update({
                                    relay_secret: editPassword,
                                    updated_at: new Date().toISOString()
                                  })
                                  .eq('id', relayConfig.id);
                                
                                if (error) throw error;
                                
                                await fetchRelayConfig();
                                setIsEditingPassword(false);
                                toast.success('Password updated successfully');
                              } catch (error) {
                                toast.error('Failed to update password');
                              } finally {
                                setLoading(false);
                              }
                            }}
                            disabled={loading}
                          >
                            Save
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setIsEditingPassword(false);
                              setEditPassword('');
                            }}
                          >
                            <X className="h-4 w-4 mr-2" />
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className={`p-3 rounded-md ${isEditingPassword ? 'bg-secondary border-2 border-primary' : 'bg-secondary'}`}>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium w-20">Username:</span>
                          <Input value="relay" readOnly className="flex-1" />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard("relay")}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium w-20">Password:</span>
                          <Input 
                            value={isEditingPassword ? editPassword : relayConfig.relay_secret} 
                            onChange={(e) => setEditPassword(e.target.value)}
                            readOnly={!isEditingPassword} 
                            className="flex-1" 
                            type={isEditingPassword ? "text" : "password"}
                          />
                          {!isEditingPassword && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyToClipboard(relayConfig.relay_secret)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {isEditingPassword && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Note:</strong> After changing the password, update your SendGrid and email server configuration with the new relay secret.
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                    <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
                      📋 Configuration Summary
                    </h4>
                    <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                      <li>• Domain: {relayConfig.domain}</li>
                      <li>• Smart Host: {smartHost}</li>
                      <li>• Port: 587 (SMTP with STARTTLS)</li>
                      <li>• Username: relay</li>
                      <li>• Authentication: Required</li>
                      <li>• Security: TLS encryption enforced</li>
                    </ul>
                  </div>

                  <Alert>
                    <ExternalLink className="h-4 w-4" />
                    <AlertDescription>
                      Use the Exchange Admin Center manual setup to create connectors and transport rules 
                      that will route emails through this smart host configuration.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>User Assignment Management</CardTitle>
              <CardDescription>
                Assign email signatures and banners to users for automatic SMTP relay processing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Create New Assignment */}
              <div className="space-y-4 p-4 border rounded-lg">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">
                    {isEditing ? 'Edit Assignment' : 'Create New Assignment'}
                  </h3>
                  {isEditing && (
                    <Button variant="outline" size="sm" onClick={cancelEdit}>
                      <X className="h-4 w-4 mr-2" />
                      Cancel Edit
                    </Button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Select User</Label>
                    <select
                      className="w-full p-2 border rounded-md"
                      value={selectedUser}
                      onChange={(e) => setSelectedUser(e.target.value)}
                      disabled={isEditing} // Disable user selection when editing
                    >
                      <option value="">Select a user...</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.first_name} {user.last_name} ({user.email})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>Select Email Signature</Label>
                    <select
                      className="w-full p-2 border rounded-md"
                      value={selectedSignature}
                      onChange={(e) => setSelectedSignature(e.target.value)}
                    >
                      <option value="">Select a signature...</option>
                      {signatures.map((signature) => (
                        <option key={signature.id} value={signature.id}>
                          {signature.template_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label>Select Banners (Required - Maximum 4)</Label>
                    <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-1">
                      {banners.map((banner) => (
                        <div key={banner.id} className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id={`banner-${banner.id}`}
                            checked={selectedBanners.includes(banner.id)}
                            disabled={!selectedBanners.includes(banner.id) && selectedBanners.length >= 4}
                            onChange={(e) => {
                              if (e.target.checked) {
                                if (selectedBanners.length < 4) {
                                  setSelectedBanners([...selectedBanners, banner.id]);
                                }
                              } else {
                                setSelectedBanners(selectedBanners.filter(id => id !== banner.id));
                              }
                            }}
                          />
                          <label htmlFor={`banner-${banner.id}`} className="text-sm">
                            {banner.name}
                          </label>
                        </div>
                      ))}
                      <div className="text-xs text-muted-foreground mt-2">
                        Selected: {selectedBanners.length}/4 (At least 1 required)
                      </div>
                    </div>
                  </div>
                </div>

                <Button 
                  onClick={createUserAssignment}
                  disabled={!selectedUser || !selectedSignature || selectedBanners.length === 0 || loading}
                  className="w-full"
                >
                  {loading ? (isEditing ? 'Updating Assignment...' : 'Creating Assignment...') : (isEditing ? 'Update Assignment' : 'Create Assignment')}
                </Button>
              </div>

              {/* Current Assignments */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Current Assignments</h3>
                
                {assignments.length === 0 ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No user assignments found. Create assignments above to enable automatic 
                      signature and banner injection via SMTP relay.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-3">
                    {assignments.map((assignment) => (
                      <Card 
                        key={assignment.id} 
                        className={`p-4 ${isEditing && editingAssignment?.id === assignment.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <div className="font-medium">
                              {assignment.user?.first_name} {assignment.user?.last_name}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {assignment.user?.email}
                            </div>
                            {assignment.user?.department && (
                              <Badge variant="outline" className="text-xs">
                                {assignment.user.department}
                              </Badge>
                            )}
                          </div>
                          
                          <div className="text-right space-y-1">
                            <div className="text-sm">
                              <strong>Signature:</strong> {assignment.signature?.template_name || 'None'}
                            </div>
                            {assignment.banners && assignment.banners.length > 0 && (
                              <div className="text-sm">
                                <strong>Banners:</strong> {assignment.banners.map(b => b.name).join(', ')} ({assignment.banners.length}/4)
                              </div>
                            )}
                          </div>
                          
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => startEditAssignment(assignment)}
                              disabled={isEditing}
                            >
                              <Edit className="h-4 w-4" />
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => removeAssignment(assignment.id)}
                              disabled={isEditing}
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  These assignments will be automatically used by the SMTP relay function to inject 
                  signatures and banners into emails processed through your configured smart host.
                  {isEditing && " Currently editing an assignment - make changes above and save."}
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="test" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Test Email with User Assignments
              </CardTitle>
              <CardDescription>
                Send a test email to verify that signatures and banners are correctly applied
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="test-user-select">Select User (Sender)</Label>
                  <select
                    id="test-user-select"
                    className="w-full p-2 border rounded-md"
                    value={testUserId}
                    onChange={(e) => setTestUserId(e.target.value)}
                    disabled={sendingTest}
                  >
                    <option value="">Select a user with assignments...</option>
                    {assignments.map((assignment) => (
                      <option key={assignment.id} value={assignment.user_id}>
                        {assignment.user?.first_name} {assignment.user?.last_name} ({assignment.user?.email})
                      </option>
                    ))}
                  </select>
                  <p className="text-sm text-muted-foreground">
                    This user's assigned signature and banner will be applied to the test email
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="test-recipient-email">Recipient Email Address</Label>
                  <Input
                    id="test-recipient-email"
                    type="email"
                    placeholder="recipient@example.com"
                    value={testRecipientEmail}
                    onChange={(e) => setTestRecipientEmail(e.target.value)}
                    disabled={sendingTest}
                  />
                  <p className="text-sm text-muted-foreground">
                    The test email will be sent to this address
                  </p>
                </div>

                {testUserId && assignments.find(a => a.user_id === testUserId) && (
                  <div className="p-4 bg-muted rounded-md space-y-2">
                    <h4 className="font-medium">Selected User Assignment:</h4>
                    {(() => {
                      const assignment = assignments.find(a => a.user_id === testUserId);
                      return (
                        <div className="text-sm space-y-1">
                          <p><strong>User:</strong> {assignment?.user?.first_name} {assignment?.user?.last_name}</p>
                          <p><strong>Email:</strong> {assignment?.user?.email}</p>
                          <p><strong>Signature:</strong> {assignment?.signature?.template_name || 'None'}</p>
                          <p><strong>Banners:</strong> {assignment?.banners?.length || 0} assigned (1 will rotate daily)</p>
                          {assignment?.banners && assignment.banners.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              Banner names: {assignment.banners.map(b => b.name).join(', ')}
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                <Button 
                  onClick={sendTestEmail}
                  disabled={!testUserId || !testRecipientEmail || sendingTest || assignments.length === 0}
                  className="w-full"
                >
                  {sendingTest ? 'Sending Test Email...' : 'Send Test Email'}
                </Button>

                {assignments.length === 0 && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No user assignments found. Please create user assignments in the User Management tab first.
                    </AlertDescription>
                  </Alert>
                )}

                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    The test email will include the selected user's assigned signature and one of their banners (rotating daily).
                    This demonstrates how actual emails will appear when processed through the SMTP relay.
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};