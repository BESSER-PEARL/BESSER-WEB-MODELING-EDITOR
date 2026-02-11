import React from 'react';
import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface HelpMenuProps {
  outlineButtonClass: string;
  onOpenHelpDialog: () => void;
  onOpenAboutDialog: () => void;
}

export const HelpMenu: React.FC<HelpMenuProps> = ({ outlineButtonClass, onOpenHelpDialog, onOpenAboutDialog }) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={`gap-2 ${outlineButtonClass}`}>
          <Info className="h-4 w-4" />
          Help
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64" align="end">
        <DropdownMenuItem onClick={onOpenHelpDialog}>How does this editor work?</DropdownMenuItem>
        <DropdownMenuItem onClick={onOpenAboutDialog}>About BESSER</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
