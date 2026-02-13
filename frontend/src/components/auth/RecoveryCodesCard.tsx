import React, { useState } from 'react';

import { Button } from "@/components/ui/button";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Check, Copy, ShieldCheck } from 'lucide-react';

// Props
interface RecoveryCodesCardProps {
    recoveryKey: string;
    message?: string;
    confirmRecovery?: () => void;
}

const RecoveryCodesCard: React.FC<RecoveryCodesCardProps> = ({ recoveryKey, message, confirmRecovery }) => {
    const [copied, setCopied] = useState(false);
    const [recoveryConfirmed, setRecoveryConfirmed] = useState(false);

    function handleCopyRecoveryKey() {
        if (recoveryKey) {
          navigator.clipboard.writeText(recoveryKey);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      }

    return (
        <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 p-3 bg-amber-100 rounded-full w-fit">
            <ShieldCheck className="h-8 w-8 text-amber-600" />
          </div>
          <CardTitle className="text-xl font-bold">Save Your Recovery Key</CardTitle>
          <CardDescription>
            This is the <strong>only way</strong> to recover your vault if you forget
            your password. Store it somewhere safe — it will not be shown again.
            {message && (
              <p className="text-xs text-gray-500 text-center">
                {message}
              </p>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <div className="rounded-lg bg-gray-50 border p-4 pr-12 font-mono text-sm break-all select-all">
              {recoveryKey}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2"
              onClick={handleCopyRecoveryKey}
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              id="recoveryConfirm"
              checked={recoveryConfirmed}
              onChange={(e) => setRecoveryConfirmed(e.target.checked)}
              className="mt-1"
            />
            <label htmlFor="recoveryConfirm" className="text-sm text-gray-600">
              I have saved my recovery key in a secure location. I understand that
              without it, I cannot recover my vault if I forget my password.
            </label>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            className="w-full"
            disabled={!recoveryConfirmed}
            onClick={confirmRecovery}
          >
            Continue
          </Button>
        </CardFooter>
      </Card>
    );
};

export default RecoveryCodesCard;