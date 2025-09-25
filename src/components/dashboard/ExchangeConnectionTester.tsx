import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, XCircle, AlertTriangle, Settings } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface TestResult {
  step: string;
  status: 'pending' | 'success' | 'error' | 'warning';
  message: string;
  details?: string;
}

export const ExchangeConnectionTester = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);

  const runDiagnostics = async () => {
    setIsRunning(true);
    setTestResults([]);
    
    const results: TestResult[] = [];

    // Step 1: Test Edge Function Connectivity
    results.push({ step: "Edge Function Connectivity", status: 'pending', message: "Testing..." });
    setTestResults([...results]);
    
    try {
      const supabaseUrl = "https://ddoihmeqpjjiumqndjgk.supabase.co";
      const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkb2lobWVxcGpqaXVtcW5kamdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg2OTc3MDQsImV4cCI6MjA3NDI3MzcwNH0.QsoMKHAYB8yEydI6B_lpTFAaAo52mv5yanzxt8ph-Ho";
      
      const response = await fetch(`${supabaseUrl}/functions/v1/microsoft-graph-auth`, {
        method: 'OPTIONS',
        headers: {
          'apikey': supabaseAnonKey,
        }
      });
      
      if (response.ok) {
        results[results.length - 1] = {
          step: "Edge Function Connectivity",
          status: 'success',
          message: "Edge functions are accessible"
        };
      } else {
        results[results.length - 1] = {
          step: "Edge Function Connectivity", 
          status: 'error',
          message: "Edge functions not accessible",
          details: `Status: ${response.status}`
        };
      }
    } catch (error: any) {
      results[results.length - 1] = {
        step: "Edge Function Connectivity",
        status: 'error', 
        message: "Network connectivity issue",
        details: error.message
      };
    }
    
    setTestResults([...results]);

    // Step 2: Test Microsoft Graph Auth Function
    results.push({ step: "Microsoft Auth Function", status: 'pending', message: "Testing auth function..." });
    setTestResults([...results]);
    
    try {
      const { data, error } = await supabase.functions.invoke('microsoft-graph-auth', {
        body: { test: true }
      });
      
      if (error) {
        results[results.length - 1] = {
          step: "Microsoft Auth Function",
          status: 'warning',
          message: "Function responded with expected error",
          details: "This is normal - function expects authorization code"
        };
      } else {
        results[results.length - 1] = {
          step: "Microsoft Auth Function", 
          status: 'success',
          message: "Function is responding"
        };
      }
    } catch (error: any) {
      results[results.length - 1] = {
        step: "Microsoft Auth Function",
        status: 'error',
        message: "Function call failed",
        details: error.message
      };
    }
    
    setTestResults([...results]);

    // Step 3: Test Database Permissions
    results.push({ step: "Database Permissions", status: 'pending', message: "Testing database access..." });
    setTestResults([...results]);
    
    try {
      const { error } = await supabase
        .from('exchange_connections')
        .select('id')
        .limit(1);
        
      if (error) {
        results[results.length - 1] = {
          step: "Database Permissions",
          status: 'error',
          message: "Database access denied", 
          details: error.message
        };
      } else {
        results[results.length - 1] = {
          step: "Database Permissions",
          status: 'success',
          message: "Database accessible"
        };
      }
    } catch (error: any) {
      results[results.length - 1] = {
        step: "Database Permissions",
        status: 'error',
        message: "Database connection failed",
        details: error.message
      };
    }
    
    setTestResults([...results]);

    // Step 4: Test Microsoft OAuth URL Generation
    results.push({ step: "OAuth URL Generation", status: 'pending', message: "Testing OAuth configuration..." });
    setTestResults([...results]);
    
    const clientId = localStorage.getItem('microsoft_client_id');
    if (!clientId || clientId.trim() === '') {
      results[results.length - 1] = {
        step: "OAuth URL Generation",
        status: 'error',
        message: "Microsoft Client ID not configured",
        details: "Configure Client ID in Setup tab"
      };
    } else {
      const guidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!guidRegex.test(clientId.trim())) {
        results[results.length - 1] = {
          step: "OAuth URL Generation",
          status: 'error', 
          message: "Invalid Client ID format",
          details: "Client ID must be a valid GUID"
        };
      } else {
        results[results.length - 1] = {
          step: "OAuth URL Generation",
          status: 'success',
          message: "Client ID configured correctly"
        };
      }
    }
    
    setTestResults([...results]);
    setIsRunning(false);

    // Show summary
    const errorCount = results.filter(r => r.status === 'error').length;
    const successCount = results.filter(r => r.status === 'success').length;
    
    if (errorCount === 0) {
      toast({
        title: "Diagnostics Complete", 
        description: `All ${successCount} tests passed! Exchange integration should work.`
      });
    } else {
      toast({
        title: "Issues Found",
        description: `${errorCount} issues need to be resolved before Exchange integration will work.`,
        variant: "destructive"
      });
    }
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'pending':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    }
  };

  const getStatusBadge = (status: TestResult['status']) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-500">Pass</Badge>;
      case 'error':
        return <Badge variant="destructive">Fail</Badge>;
      case 'warning':
        return <Badge variant="outline" className="border-yellow-500 text-yellow-600">Warning</Badge>;
      case 'pending':
        return <Badge variant="outline">Running...</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Connection Diagnostics
        </CardTitle>
        <CardDescription>
          Test Exchange integration setup and troubleshoot connection issues
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={runDiagnostics} 
          disabled={isRunning}
          className="w-full"
        >
          {isRunning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Run Diagnostics
        </Button>

        {testResults.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium">Test Results:</h4>
            {testResults.map((result, index) => (
              <div key={index} className="flex items-start justify-between p-3 border rounded-lg">
                <div className="flex items-start gap-3 flex-1">
                  {getStatusIcon(result.status)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">{result.step}</p>
                      {getStatusBadge(result.status)}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{result.message}</p>
                    {result.details && (
                      <p className="text-xs text-muted-foreground mt-1 font-mono bg-muted p-1 rounded">
                        {result.details}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {testResults.some(r => r.status === 'error') && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Setup Required:</strong> Please resolve the failed tests above. 
              Common fixes include configuring Microsoft Client ID/Secret in Supabase 
              Edge Functions settings and ensuring proper network connectivity.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};