"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, Rocket } from "lucide-react";

import ConnectGoogleStep from "@/components/autotube-flow/ConnectGoogleStep";
import CreateSheetStep from "@/components/autotube-flow/CreateSheetStep";
import ConnectGithubStep from "@/components/autotube-flow/ConnectGithubStep";
import ForkRepoStep from "@/components/autotube-flow/ForkRepoStep";
import Dashboard from "@/components/autotube-flow/Dashboard";
import { cn } from "@/lib/utils";

const STEP_COUNT = 4;
const stepsConfig = [
  "Connect Google",
  "Create Sheet",
  "Connect GitHub",
  "Configure Repo",
];

export default function AutoTubeFlowPage() {
  const [step, setStep] = useState(1);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const savedStep = localStorage.getItem("autotube-step");
    if (savedStep) {
      setStep(parseInt(savedStep, 10));
    }
  }, []);

  const handleStepComplete = () => {
    if (step < STEP_COUNT + 1) {
      const nextStep = step + 1;
      setStep(nextStep);
      localStorage.setItem("autotube-step", nextStep.toString());
    }
  };
  
  const resetSetup = () => {
    setStep(1);
    localStorage.setItem("autotube-step", "1");
  }

  const renderStepComponent = () => {
    switch (step) {
      case 1:
        return <ConnectGoogleStep onComplete={handleStepComplete} />;
      case 2:
        return <CreateSheetStep onComplete={handleStepComplete} />;
      case 3:
        return <ConnectGithubStep onComplete={handleStepComplete} />;
      case 4:
        return <ForkRepoStep onComplete={handleStepComplete} />;
      default:
        return <Dashboard onReset={resetSetup} />;
    }
  };

  if (!isClient) {
    // Render a skeleton or loader during server-side rendering and initial client-side mount
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background">
        <Rocket className="w-12 h-12 text-primary animate-pulse" />
      </div>
    );
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-4 sm:p-8 md:p-12">
      <div className="w-full max-w-2xl mx-auto">
        <div className="text-center mb-8">
            <div className="flex justify-center items-center gap-3 mb-4">
              <Rocket className="w-10 h-10 text-primary" />
              <h1 className="text-4xl sm:text-5xl font-bold text-foreground">
                AutoTubeFlow
              </h1>
            </div>
          {step <= STEP_COUNT && (
            <p className="text-muted-foreground text-lg">
              Complete the steps below to automate your workflow.
            </p>
          )}
        </div>

        {step <= STEP_COUNT && (
          <div className="mb-12">
            <div className="flex items-center justify-between">
              {stepsConfig.map((label, index) => {
                const stepNumber = index + 1;
                const isCompleted = step > stepNumber;
                const isCurrent = step === stepNumber;

                return (
                  <div key={label} className="flex-1 flex items-center gap-2">
                    <div className="flex flex-col items-center">
                      <div
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300",
                          isCompleted
                            ? "bg-primary text-primary-foreground"
                            : isCurrent
                            ? "bg-primary/80 text-primary-foreground ring-4 ring-primary/20"
                            : "bg-secondary"
                        )}
                      >
                        {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : stepNumber}
                      </div>
                       <p className={cn("text-xs mt-2 text-center", isCurrent ? "text-foreground font-semibold" : "text-muted-foreground")}>{label}</p>
                    </div>

                    {stepNumber < STEP_COUNT && (
                      <div className={cn("flex-1 h-1 rounded-full transition-colors duration-500", isCompleted ? "bg-primary" : "bg-secondary")} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        <div className="transition-all duration-300">
          {renderStepComponent()}
        </div>
      </div>
    </main>
  );
}
