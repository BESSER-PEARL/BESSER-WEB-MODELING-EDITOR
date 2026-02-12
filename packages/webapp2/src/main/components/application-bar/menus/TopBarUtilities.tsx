import React from 'react';
import { Github, Moon, PanelRightOpen, Sun } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface TopBarUtilitiesProps {
  showQualityCheck: boolean;
  outlineButtonClass: string;
  isDarkTheme: boolean;
  githubBadgeClass: string;
  isAuthenticated: boolean;
  username?: string;
  githubLoading: boolean;
  onQualityCheck: () => void;
  onToggleTheme: () => void;
  onGitHubLogin: () => void;
  onGitHubLogout: () => void;
  onOpenGitHubSidebar: () => void;
}

export const TopBarUtilities: React.FC<TopBarUtilitiesProps> = ({
  showQualityCheck,
  outlineButtonClass,
  isDarkTheme,
  githubBadgeClass,
  isAuthenticated,
  username,
  githubLoading,
  onQualityCheck,
  onToggleTheme,
  onGitHubLogin,
  onGitHubLogout,
  onOpenGitHubSidebar,
}) => {
  return (
    <>
      {showQualityCheck && (
        <Button variant="outline" className={outlineButtonClass} onClick={onQualityCheck}>
          Quality Check
        </Button>
      )}

      <Button
        variant="outline"
        className={`${outlineButtonClass} px-2.5`}
        onClick={onToggleTheme}
        title={isDarkTheme ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {isDarkTheme ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>

      {isAuthenticated ? (
        <>
          <Badge variant="secondary" className={githubBadgeClass}>
            <Github className="mr-1 h-3.5 w-3.5" />
            {username || 'GitHub'}
          </Badge>
          <Button variant="outline" className={outlineButtonClass} onClick={onGitHubLogout}>
            Sign Out
          </Button>
          <Button
            variant="outline"
            className={`${outlineButtonClass} px-2.5`}
            onClick={onOpenGitHubSidebar}
            title="Toggle GitHub sync panel"
          >
            <PanelRightOpen className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <Button variant="outline" className={`gap-2 ${outlineButtonClass}`} onClick={onGitHubLogin} disabled={githubLoading}>
          <Github className="h-4 w-4" />
          {githubLoading ? 'Connecting...' : 'Connect GitHub'}
        </Button>
      )}
    </>
  );
};
