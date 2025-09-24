import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Shield, BarChart3, Globe, Users, Building2 } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Mail className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">Email Signature Manager</h1>
                <p className="text-sm text-muted-foreground">Internal organizational tool</p>
              </div>
            </div>
            <Link to="/auth">
              <Button>Access Dashboard</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-4">
            Centralized Email Signature & Banner Management
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-3xl mx-auto">
            Streamline your organization's email branding with automated signature deployment, 
            clickable banner campaigns, and comprehensive analytics - all integrated with Microsoft Exchange.
          </p>
          <div className="flex justify-center space-x-4">
            <Link to="/auth">
              <Button size="lg">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 bg-muted/50">
        <div className="container mx-auto px-4">
          <h3 className="text-3xl font-bold text-center mb-12">Key Features</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Building2 className="h-6 w-6 text-primary" />
                  <span>Centralized Management</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  IT administrators can manage all user signatures from a single dashboard, 
                  ensuring brand consistency across the organization.
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Mail className="h-6 w-6 text-primary" />
                  <span>Smart Banners</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Add dynamic banners to email headers with click tracking, 
                  campaign management, and engagement analytics.
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="h-6 w-6 text-primary" />
                  <span>Analytics & Insights</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Track click-through rates, monitor campaign performance, 
                  and gain insights into email engagement patterns.
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="h-6 w-6 text-primary" />
                  <span>Exchange Integration</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Server-side integration with Microsoft Exchange ensures signatures 
                  are applied automatically without user intervention.
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Globe className="h-6 w-6 text-primary" />
                  <span>Domain Verification</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  DNS-based domain authentication ensures only authorized 
                  administrators can manage organizational email branding.
                </CardDescription>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Users className="h-6 w-6 text-primary" />
                  <span>User Management</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>
                  Manage user accounts, departments, and permissions with 
                  role-based access control for secure administration.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-muted-foreground">
            Internal organizational tool for email signature and banner management
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
