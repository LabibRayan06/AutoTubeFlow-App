
"use client";

import { useState } from "react";
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
import { Link, Loader2, PartyPopper } from "lucide-react";
import { addUrlToSheet } from "@/ai/flows/sheet-flows";

const formSchema = z.object({
  url: z.string().url({ message: "Please enter a valid video URL." }),
});

export default function Dashboard() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      url: "",
    },
  });

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
      </CardContent>
    </Card>
  );
}
