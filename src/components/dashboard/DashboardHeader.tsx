import { Button } from "@/components/ui/button";
import { LogOut, Bell, Settings } from "lucide-react";
import { User } from "@supabase/supabase-js";

interface DashboardHeaderProps {
  user: User;
  profile: any;
  onSignOut: () => void;
}

export const DashboardHeader = ({ user, profile, onSignOut }: DashboardHeaderProps) => {
  return (
    <header className="bg-background border-b border-border px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Welcome back, {profile?.first_name || "User"}
          </h2>
          <p className="text-muted-foreground">
            Manage your organization's email signatures and banners
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm">
            <Bell className="h-4 w-4" />
          </Button>
          
          <Button variant="ghost" size="sm">
            <Settings className="h-4 w-4" />
          </Button>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onSignOut}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>
    </header>
  );
};