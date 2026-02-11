import React from 'react';
import { Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface CommunityMenuProps {
  outlineButtonClass: string;
  onOpenContribute: () => void;
  onOpenRepository: () => void;
  onOpenFeedback: () => void;
  onOpenSurvey: () => void;
  onOpenBugReport: () => void;
}

export const CommunityMenu: React.FC<CommunityMenuProps> = ({
  outlineButtonClass,
  onOpenContribute,
  onOpenRepository,
  onOpenFeedback,
  onOpenSurvey,
  onOpenBugReport,
}) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={`gap-2 ${outlineButtonClass}`}>
          <Users className="h-4 w-4" />
          Community
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="end">
        <DropdownMenuItem onClick={onOpenContribute}>Contribute</DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenRepository}>GitHub Repository</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onOpenFeedback}>Send Feedback</DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenSurvey}>User Evaluation Survey</DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenBugReport}>Report a Problem</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
