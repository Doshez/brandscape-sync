import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  Home, 
  FileText, 
  Image, 
  BarChart3, 
  Settings, 
  Users,
  Mail,
  UserCheck,
  Zap,
  ShieldCheck
} from "lucide-react";

type DashboardView = "home" | "signatures" | "banners" | "analytics" | "settings" | "users" | "admin-users" | "assignments" | "auto-transport-rules";

interface SidebarProps {
  activeView: DashboardView;
  setActiveView: (view: DashboardView) => void;
  profile: any;
}

const menuItems = [
  { id: "home", label: "Dashboard", icon: Home, adminOnly: false },
  { id: "signatures", label: "Email Signatures", icon: FileText, adminOnly: false },
  { id: "banners", label: "Banner Management", icon: Image, adminOnly: true },
  { id: "assignments", label: "User Assignments", icon: UserCheck, adminOnly: true },
  { id: "auto-transport-rules", label: "Deploy to Exchange", icon: Zap, adminOnly: true },
  { id: "analytics", label: "Analytics", icon: BarChart3, adminOnly: true },
  { id: "users", label: "User Management", icon: Users, adminOnly: true },
  { id: "admin-users", label: "Admin Management", icon: ShieldCheck, adminOnly: true },
  { id: "settings", label: "Company Settings", icon: Settings, adminOnly: true },
];

export const Sidebar = ({ activeView, setActiveView, profile }: SidebarProps) => {
  const isAdmin = profile?.is_admin;

  const filteredMenuItems = menuItems.filter(item => 
    !item.adminOnly || isAdmin
  );

  return (
    <div className="w-64 bg-sidebar border-r border-sidebar-border">
      <div className="p-6">
        <div className="flex items-center space-x-2">
          <Mail className="h-8 w-8 text-sidebar-primary" />
          <div>
            <h1 className="text-lg font-bold text-sidebar-foreground">Email Manager</h1>
            <p className="text-sm text-sidebar-foreground/70">Signature & Banners</p>
          </div>
        </div>
      </div>

      <nav className="px-4 space-y-2">
        {filteredMenuItems.map((item) => {
          const Icon = item.icon;
          return (
            <Button
              key={item.id}
              variant="ghost"
              className={cn(
                "w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                activeView === item.id && "bg-sidebar-accent text-sidebar-accent-foreground"
              )}
              onClick={() => setActiveView(item.id as DashboardView)}
            >
              <Icon className="mr-2 h-4 w-4" />
              {item.label}
            </Button>
          );
        })}
      </nav>

    </div>
  );
};