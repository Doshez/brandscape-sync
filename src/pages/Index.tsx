import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, Shield, BarChart3, Globe, Users, Building2, ArrowRight, Sparkles } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

const Index = () => {
  return (
    <div className="min-h-screen gradient-subtle">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/50 transition-smooth">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 group">
              <div className="p-2 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-smooth">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                  Email Signature Manager
                </h1>
                <p className="text-xs text-muted-foreground">Modern organizational tool</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Link to="/auth">
                <Button className="rounded-full shadow-lg hover:shadow-xl transition-smooth">
                  Access Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-24 md:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="container mx-auto px-4 text-center relative">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6 animate-float">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">Modern Email Management</span>
          </div>
          
          <h2 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent leading-tight">
            Centralized Email Signature &<br />Banner Management
          </h2>
          
          <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-3xl mx-auto leading-relaxed">
            Streamline your organization's email branding with automated signature deployment, 
            clickable banner campaigns, and comprehensive analytics - all integrated with Microsoft Exchange.
          </p>
          
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link to="/auth">
              <Button size="lg" className="rounded-full shadow-3d hover:shadow-xl transition-smooth group">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-smooth" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h3 className="text-3xl md:text-4xl font-bold mb-4">Key Features</h3>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Everything you need to manage professional email signatures and banners
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card className="hover-lift border-2 transition-smooth hover:border-primary/50 bg-card/50 backdrop-blur">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Centralized Management</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  IT administrators can manage all user signatures from a single dashboard, 
                  ensuring brand consistency across the organization.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="hover-lift border-2 transition-smooth hover:border-primary/50 bg-card/50 backdrop-blur">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Smart Banners</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Add dynamic banners to email headers with click tracking, 
                  campaign management, and engagement analytics.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="hover-lift border-2 transition-smooth hover:border-primary/50 bg-card/50 backdrop-blur">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <BarChart3 className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Analytics & Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Track click-through rates, monitor campaign performance, 
                  and gain insights into email engagement patterns.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="hover-lift border-2 transition-smooth hover:border-primary/50 bg-card/50 backdrop-blur">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Exchange Integration</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Server-side integration with Microsoft Exchange ensures signatures 
                  are applied automatically without user intervention.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="hover-lift border-2 transition-smooth hover:border-primary/50 bg-card/50 backdrop-blur">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Globe className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">Domain Verification</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  DNS-based domain authentication ensures only authorized 
                  administrators can manage organizational email branding.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="hover-lift border-2 transition-smooth hover:border-primary/50 bg-card/50 backdrop-blur">
              <CardHeader>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">User Management</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Manage user accounts, departments, and permissions with 
                  role-based access control for secure administration.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-12 bg-muted/30">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-primary/10">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <span className="font-semibold">Email Signature Manager</span>
          </div>
          <p className="text-muted-foreground text-sm">
            Internal organizational tool for email signature and banner management
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
