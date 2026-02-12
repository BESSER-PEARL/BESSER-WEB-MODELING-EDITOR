import React from 'react';
import { CloudUpload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface CommitDialogProps {
  open: boolean;
  isSaving: boolean;
  message: string;
  onOpenChange: (open: boolean) => void;
  onMessageChange: (value: string) => void;
  onCommit: () => void;
}

export const CommitDialog: React.FC<CommitDialogProps> = ({
  open,
  isSaving,
  message,
  onOpenChange,
  onMessageChange,
  onCommit,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Push to GitHub</DialogTitle>
          <DialogDescription>Write a commit message for your changes.</DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label>Commit Message</Label>
          <Textarea
            rows={2}
            placeholder="Describe your changes..."
            value={message}
            onChange={(event) => onMessageChange(event.target.value)}
            autoFocus
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onCommit} disabled={isSaving || !message.trim()} className="gap-2">
            {isSaving ? 'Pushing...' : <CloudUpload className="h-4 w-4" />}
            Push
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
