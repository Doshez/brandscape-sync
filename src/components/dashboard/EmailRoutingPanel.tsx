import { useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Shield, BookOpen } from "lucide-react";
import { EmailRouting } from "./EmailRouting";
import { DomainVerification } from "./DomainVerification";
import { EmailRoutingSetup } from "./EmailRoutingSetup";
import { ExchangeConnectorGuide } from "./ExchangeConnectorGuide";

interface EmailRoutingPanelProps {
  isOpen: boolean;
  onClose: () => void;
  profile: any;
  deploymentMethod?: "transport-rules" | "email-routing" | "exchange-connector";
}

export const EmailRoutingPanel = ({ isOpen, onClose, profile, deploymentMethod = "email-routing" }: EmailRoutingPanelProps) => {
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
          {deploymentMethod === "exchange-connector" ? (
            <ExchangeConnectorGuide />
          ) : (
            <Tabs defaultValue="setup" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="setup" className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Setup Guide
                </TabsTrigger>
                <TabsTrigger value="routing" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Testing
                </TabsTrigger>
                <TabsTrigger value="verification" className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  DNS Verification
                </TabsTrigger>
              </TabsList>

              <TabsContent value="setup" className="mt-6">
                <EmailRoutingSetup />
              </TabsContent>

              <TabsContent value="routing" className="mt-6">
                <EmailRouting profile={profile} />
              </TabsContent>

              <TabsContent value="verification" className="mt-6">
                <DomainVerification profile={profile} />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
