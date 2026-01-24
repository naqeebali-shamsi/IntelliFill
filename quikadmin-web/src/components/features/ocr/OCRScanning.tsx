import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { FileText, Sparkles } from 'lucide-react';

interface OCRScanningProps {
  className?: string;
  isScanning?: boolean;
}

export function OCRScanning({ className, isScanning = true }: OCRScanningProps) {
  return (
    <div className={cn("relative w-full aspect-[3/4] bg-background/50 border border-white/10 rounded-xl overflow-hidden group", className)}>
      {/* Document Placeholder */}
      <div className="absolute inset-0 flex flex-col items-center justify-center p-8 opacity-50">
        <div className="space-y-4 w-full opacity-30">
          <div className="h-4 w-3/4 bg-foreground/20 rounded-full" />
          <div className="h-4 w-1/2 bg-foreground/20 rounded-full" />
          <div className="h-4 w-full bg-foreground/20 rounded-full" />
          <div className="h-4 w-5/6 bg-foreground/20 rounded-full" />
          <div className="mt-8 flex gap-4">
             <div className="h-20 w-20 bg-foreground/20 rounded-lg" />
             <div className="flex-1 space-y-2">
                <div className="h-3 w-full bg-foreground/20 rounded-full" />
                <div className="h-3 w-full bg-foreground/20 rounded-full" />
             </div>
          </div>
        </div>
      </div>

      {/* Glass Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent pointer-events-none" />

      {/* Scanning Line */}
      {isScanning && (
        <motion.div
          animate={{
            top: ["0%", "100%", "0%"],
          }}
          transition={{
            duration: 5,
            ease: "easeInOut",
            repeat: Infinity,
            repeatType: "loop"
          }}
          className="absolute left-0 right-0 h-0.5 bg-primary/30 shadow-[0_0_10px_1px_rgba(99,102,241,0.3)] z-10"
        >
           <div className="absolute right-0 -top-1 p-0.5 bg-primary/70 text-[8px] text-white font-mono rounded-l shadow-sm flex items-center gap-0.5">
             <Sparkles className="h-1.5 w-1.5" /> OCR
           </div>
        </motion.div>
      )}

      {/* Icon Overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="p-4 rounded-full bg-background/80 backdrop-blur-md border border-primary/20 shadow-2xl relative">
          <FileText className="h-8 w-8 text-primary" />
          {isScanning && (
             <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-secondary/50 opacity-50"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-secondary/70"></span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
