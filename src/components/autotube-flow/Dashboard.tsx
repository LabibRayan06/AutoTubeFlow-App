
"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Link, Loader2, PartyPopper, RefreshCw, CheckCircle, Hourglass, ListTodo, AlertCircle } from "lucide-react";
import { addUrlToSheet, getSheetStats } from "@/ai/flows/sheet-flows";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

const formSchema = z.object({
  url: z.string().url({ message: "Please enter a valid video URL." }),
});

type Stats = {
  total: number;
  processed: number;
  pending: number;
};

function StatCard({ icon: Icon, title, value, isLoading }: { icon: React.ElementType, title: string, value: number, isLoading: boolean }) {
  return (
    <Card className="flex-1">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-1/2" />
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
      </CardContent>
    </Card>
  )
}


export default function Dashboard() {
  const [isLoading, setIsLoading] = useState(false);
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({ total: 0, processed: 0, pending: 0 });
  const [statsError, setStatsError] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      url: "",
    },
  });
  
  const fetchStats = useCallback(async () => {
    setIsStatsLoading(true);
    setStatsError(null);
    try {
      const result = await getSheetStats();
      if (result.success && result.stats) {
        setStats(result.stats);
      } else {
        setStatsError(result.message || "Failed to load stats.");
      }
    } catch (error: any) {
      setStatsError(error.message || "An unexpected error occurred.");
    } finally {
      setIsStatsLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      const result = await addUrlToSheet(values);
      if (result.success) {
        toast({
          title: "URL Added!",
          description: result.message,
        });
        form.reset();
        fetchStats(); // Refresh stats after adding a new URL
      } else {
        toast({
          variant: "destructive",
          title: "URL Not Added",
          description: result.message,
        });
      }
    } catch (error: any) {
       toast({
        variant: "destructive",
        title: "An Error Occurred",
        description: error.message || "Something went wrong while submitting the URL.",
      });
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-lg border-border/60">
      <CardHeader className="text-center">
        <div className="flex justify-center items-center gap-2 w-max mx-auto mb-2">
            <PartyPopper className="w-8 h-8 text-accent" />
        </div>
        <CardTitle className="text-2xl">Setup Complete!</CardTitle>
        <CardDescription>
          You're all set. Enter a video URL below to add it to your processing queue.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Video URL</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Link className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="https://www.youtube.com/watch?v=..." {...field} className="pl-10"/>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={isLoading} className="w-full">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                "Submit URL"
              )}
            </Button>
          </form>
        </Form>
        <Separator className="my-6" />
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Processing Stats</h3>
                 <Button variant="outline" size="sm" onClick={fetchStats} disabled={isStatsLoading}>
                    <RefreshCw className={`h-4 w-4 ${isStatsLoading ? 'animate-spin' : ''}`} />
                </Button>
            </div>
            {statsError ? (
                <div className="text-destructive text-sm p-3 bg-destructive/10 rounded-md flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    <p>{statsError}</p>
                </div>
            ) : (
                 <div className="flex flex-col sm:flex-row gap-4">
                    <StatCard icon={ListTodo} title="Total Videos" value={stats.total} isLoading={isStatsLoading} />
                    <StatCard icon={CheckCircle} title="Processed" value={stats.processed} isLoading={isStatsLoading} />
                    <StatCard icon={Hourglass} title="Pending" value={stats.pending} isLoading={isStatsLoading} />
                </div>
            )}
        </div>
      </CardContent>
    </Card>
  );
}
