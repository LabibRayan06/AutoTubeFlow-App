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
import { ArrowRight, Loader2, Table } from "lucide-react";
import { createSheet } from "@/ai/flows/sheet-flows";
import { useToast } from "@/hooks/use-toast";

type Props = {
  onComplete: () => void;
};

export default function CreateSheetStep({ onComplete }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleCreate = async () => {
    setIsLoading(true);
    try {
      const result = await createSheet({});
      if (result.success && result.sheetId) {
        localStorage.setItem("autotube-sheet-id", result.sheetId);
        onComplete();
      } else {
        toast({
          variant: "destructive",
          title: "Sheet Creation Failed",
          description: "Could not create the Google Sheet. Please try again.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "An Error Occurred",
        description: "Something went wrong while creating the sheet.",
      });
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const columns = ["Url", "Title", "Description", "DateAdded", "isProcessed", "VideoId"];

  return (
    <Card className="shadow-lg border-border/60">
      <CardHeader>
        <CardTitle className="text-2xl">Step 2: Create Google Sheet</CardTitle>
        <CardDescription>
          A new Google Sheet will be created in your Drive to track videos.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="font-semibold mb-2">The sheet will have the following columns:</p>
        <div className="flex flex-wrap gap-2">
            {columns.map(col => (
                <div key={col} className="bg-muted text-muted-foreground text-sm font-mono px-2 py-1 rounded-md">{col}</div>
            ))}
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleCreate} disabled={isLoading} className="w-full sm:w-auto ml-auto">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              Create Sheet
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}
