"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Database, FileSpreadsheet, Loader2, Youtube } from "lucide-react";
import { connectGoogle } from "@/ai/flows/auth-flows";
import { useToast } from "@/hooks/use-toast";


type Props = {
  onComplete: () => void;
};

export default function ConnectGoogleStep({ onComplete }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      const result = await connectGoogle();
      if (result.success) {
        onComplete();
      } else {
        toast({
          variant: "destructive",
          title: "Google Connection Failed",
          description: "Could not connect to your Google account. Please try again.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "An Error Occurred",
        description: "Something went wrong while connecting to Google.",
      });
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-lg border-border/60">
      <CardHeader>
        <CardTitle className="text-2xl">Step 1: Connect Google Account</CardTitle>
        <CardDescription>
          Grant access to your Google services to allow AutoTubeFlow to manage your content.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="font-semibold mb-4">We will request the following permissions:</p>
        <ul className="space-y-3 text-muted-foreground">
          <li className="flex items-center gap-3">
            <Youtube className="w-5 h-5 text-red-500" />
            <span>YouTube Data API (for video uploads)</span>
          </li>
          <li className="flex items-center gap-3">
            <Database className="w-5 h-5 text-blue-500" />
            <span>Google Drive API (to create and manage files)</span>
          </li>
          <li className="flex items-center gap-3">
            <FileSpreadsheet className="w-5 h-5 text-green-500" />
            <span>Google Sheets API (to log video data)</span>
          </li>
        </ul>
      </CardContent>
      <CardFooter>
        <Button onClick={handleConnect} disabled={isLoading} className="w-full sm:w-auto ml-auto">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              Connect with Google
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
