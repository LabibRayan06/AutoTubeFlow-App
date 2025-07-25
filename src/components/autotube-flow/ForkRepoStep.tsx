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
import { Check, GitFork, KeyRound, Loader2 } from "lucide-react";
import { forkRepo } from "@/ai/flows/auth-flows";
import { useToast } from "@/hooks/use-toast";

type Props = {
  onComplete: () => void;
};

export default function ForkRepoStep({ onComplete }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleFork = async () => {
    setIsLoading(true);
    try {
      const result = await forkRepo();
      if (result.success) {
        toast({
          title: "Success!",
          description: result.message || "Repository configured successfully.",
        });
        onComplete();
      } else {
        toast({
          variant: "destructive",
          title: "Repository Fork Failed",
          description: result.message || "Could not fork the repository. Please try again.",
        });
      }
    } catch (error: any) {
       toast({
        variant: "destructive",
        title: "An Error Occurred",
        description: error.message || "Something went wrong while configuring the repository.",
      });
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const secrets = ["YT_REFRESH_TOKEN", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "SHEET_ID"];

  return (
    <Card className="shadow-lg border-border/60">
      <CardHeader>
        <CardTitle className="text-2xl">Step 4: Configure GitHub Repository</CardTitle>
        <CardDescription>
          One last step! We'll fork the repository and add the necessary secrets to get it running.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
            <p className="font-semibold mb-2 flex items-center gap-2"><GitFork className="w-4 h-4"/> Repository to Fork:</p>
            <p className="font-mono text-sm bg-muted text-muted-foreground p-2 rounded-md">LabibRayan06/AutoTubeFlow</p>
        </div>
         <div>
            <p className="font-semibold mb-2 flex items-center gap-2"><KeyRound className="w-4 h-4" /> Secrets to Add:</p>
            <div className="flex flex-wrap gap-2">
                {secrets.map(secret => (
                    <div key={secret} className="bg-muted text-muted-foreground text-sm font-mono px-2 py-1 rounded-md">{secret}</div>
                ))}
            </div>
             <p className="text-xs text-muted-foreground mt-3">Note: Secrets will be added to your forked repository to allow the GitHub Action to access your Google account and Sheet.</p>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleFork} disabled={isLoading} className="w-full sm:w-auto ml-auto">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Configuring...
            </>
          ) : (
            <>
              Fork & Add Secrets
              <Check className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
