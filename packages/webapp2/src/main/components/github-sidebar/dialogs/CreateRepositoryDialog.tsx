import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface CreateRepositoryDialogProps {
  open: boolean;
  isLoading: boolean;
  repoName: string;
  repoDescription: string;
  isRepoPrivate: boolean;
  fileName: string;
  folderPath: string;
  onOpenChange: (open: boolean) => void;
  onRepoNameChange: (value: string) => void;
  onRepoDescriptionChange: (value: string) => void;
  onRepoPrivateChange: (value: boolean) => void;
  onFileNameChange: (value: string) => void;
  onFolderPathChange: (value: string) => void;
  onCreate: () => void;
}

export const CreateRepositoryDialog: React.FC<CreateRepositoryDialogProps> = ({
  open,
  isLoading,
  repoName,
  repoDescription,
  isRepoPrivate,
  fileName,
  folderPath,
  onOpenChange,
  onRepoNameChange,
  onRepoDescriptionChange,
  onRepoPrivateChange,
  onFileNameChange,
  onFolderPathChange,
  onCreate,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create Repository</DialogTitle>
          <DialogDescription>Create a new GitHub repository and push the current project.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Repository Name</Label>
            <Input
              placeholder="my-project"
              value={repoName}
              onChange={(event) => onRepoNameChange(event.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Only lowercase letters, numbers, dashes, and underscores are allowed.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea
              rows={2}
              placeholder="Optional description..."
              value={repoDescription}
              onChange={(event) => onRepoDescriptionChange(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Folder Path (optional)</Label>
            <Input
              placeholder="e.g., projects/my-models"
              value={folderPath}
              onChange={(event) => onFolderPathChange(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>File Name</Label>
            <Input
              placeholder="my_project.json"
              value={fileName}
              onChange={(event) => onFileNameChange(event.target.value)}
            />
          </div>

          <div className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-xs">
            <span className="font-semibold">Full path:</span>{' '}
            <code>/{folderPath ? `${folderPath.replace(/^\/+|\/+$/g, '')}/${fileName}` : fileName}</code>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isRepoPrivate}
              onChange={(event) => onRepoPrivateChange(event.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            Private repository
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onCreate} disabled={isLoading || !repoName.trim() || !fileName.trim()}>
            {isLoading ? 'Creating...' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
