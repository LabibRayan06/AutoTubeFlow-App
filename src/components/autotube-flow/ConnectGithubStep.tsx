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
import { Github, GitFork, KeyRound, Loader2 } from "lucide-react";
import { connectGithub } from "@/ai/flows/auth-flows";
import { useToast } from "@/hooks/use-toast";

type Props = {
  onComplete: () => void;
};

export default function ConnectGithubStep({ onComplete }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleConnect = async () => {
    setIsLoading(true);
    try {
      const result = await connectGithub({});
      if (result.success) {
        onComplete();
      } else {
        toast({
          variant: "destructive",
          title: "GitHub Connection Failed",
          description: "Could not connect to your GitHub account. Please try again.",
        });
      }
    } catch (error) {
       toast({
        variant: "destructive",
        title: "An Error Occurred",
        description: "Something went wrong while connecting to GitHub.",
      });
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-lg border-border/60">
      <CardHeader>
        <CardTitle className="text-2xl">Step 3: Connect GitHub Account</CardTitle>
        <CardDescription>
          Connect your GitHub account to fork the processing bot and set it up for automation.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="font-semibold mb-4">We will request the following permissions:</p>
        <ul className="space-y-3 text-muted-foreground">
          <li className="flex items-center gap-3">
            <GitFork className="w-5 h-5 text-primary-foreground/70" />
            <span>Repository Access (to fork a repository)</span>
          </li>
          <li className="flex items-center gap-3">
            <KeyRound className="w-5 h-5 text-primary-foreground/70" />
            <span>Secrets Access (to add secrets for the GitHub Action)</span>
          </li>
        </ul>
      </CardContent>
      <CardFooter>
        <Button onClick={handleConnect} disabled={isLoading} className="w-full sm:w-auto ml-auto">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Redirecting...
            </>
          ) : (
            <>
              Connect with GitHub
              <Github className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
