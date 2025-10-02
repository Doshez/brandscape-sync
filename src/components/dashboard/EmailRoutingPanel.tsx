import { useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Shield } from "lucide-react";
import { EmailRouting } from "./EmailRouting";
import { DomainVerification } from "./DomainVerification";

interface EmailRoutingPanelProps {
  isOpen: boolean;
  onClose: () => void;
  profile: any;
}

export const EmailRoutingPanel = ({ isOpen, onClose, profile }: EmailRoutingPanelProps) => {
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Email Configuration</SheetTitle>
          <SheetDescription>
            Configure email routing and verify your domain settings
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          <Tabs defaultValue="routing" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="routing" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Email Routing
              </TabsTrigger>
              <TabsTrigger value="verification" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Domain Verification
              </TabsTrigger>
            </TabsList>

            <TabsContent value="routing" className="mt-6">
              <EmailRouting profile={profile} />
            </TabsContent>

            <TabsContent value="verification" className="mt-6">
              <DomainVerification profile={profile} />
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
};
