import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ApollonError } from '../../services/error-management/errorManagementSlice';

type Props = {
  error: ApollonError;
  onClose: (error: ApollonError) => void;
};

export function ErrorMessage(props: Props) {
  const { headerText, bodyText } = props.error;

  return (
    <Card className="w-full border-red-300/70 bg-red-50/95 text-red-950 shadow-lg dark:border-red-900 dark:bg-red-950/70 dark:text-red-100">
      <div role="alert" className="flex items-start gap-3 p-3">
        <div className="mt-0.5 rounded-md bg-red-100 p-1 text-red-700 dark:bg-red-900/60 dark:text-red-200">
          <AlertTriangle className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-5">{headerText}</p>
          <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-red-800/90 dark:text-red-100/90">{bodyText}</p>
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-red-700 hover:bg-red-100 hover:text-red-800 dark:text-red-200 dark:hover:bg-red-900/60 dark:hover:text-red-100"
          onClick={() => props.onClose(props.error)}
          aria-label="Dismiss error"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
