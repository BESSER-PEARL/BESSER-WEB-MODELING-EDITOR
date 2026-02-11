import React, { ChangeEvent, useContext, useEffect, useState } from 'react';
import styled from 'styled-components';
import { ChatSquareText, Github, BoxArrowRight } from 'react-bootstrap-icons';
import { toast } from 'react-toastify';
import { Link, useLocation } from 'react-router-dom';
import { APPLICATION_SERVER_VERSION } from '../../constant';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { updateDiagramThunk } from '../../services/diagram/diagramSlice';
import { FileMenu } from './menues/file-menu';
import { GenerateCodeMenu } from './menues/generate-code-menu';
import { DeployMenu } from './menues/deploy-menu';
import { CommunityMenu } from './menues/community-menu';
import { HelpMenu } from './menues/help-menu';
import { ThemeSwitcherMenu } from './menues/theme-switcher-menu';
import { validateDiagram } from '../../services/validation/validateDiagram';
import { ApollonEditorContext } from '../apollon-editor-component/apollon-editor-context';
import { useProject } from '../../hooks/useProject';
import { isUMLModel } from '../../types/project';
import { useGitHubAuth } from '../../services/github/useGitHubAuth';
import { GitHubSidebar } from '../github-sidebar';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import '../ui/shadcn.css';

const BarContainer = styled.header`
  height: 60px;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  position: relative;
  z-index: 1030;
  background: #ffffff;
  border-bottom: 1px solid #e4e4e7;
  box-shadow: 0 1px 0 rgba(15, 23, 42, 0.04);
  color: #09090b;

  [data-theme='dark'] & {
    background: #09090b;
    border-bottom-color: #27272a;
    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.03);
    color: #fafafa;
  }
`;

const LeftSection = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
`;

const BrandLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  padding: 4px 8px;
  transition: background-color 0.2s ease;

  &:hover {
    background: rgba(9, 9, 11, 0.06);
  }

  img {
    width: 124px;
    height: 33px;
    filter: none;
  }

  [data-theme='dark'] & {
    &:hover {
      background: rgba(250, 250, 250, 0.08);
    }

    img {
      filter: brightness(0) invert(1);
    }
  }
`;

const IconButton = styled(Button)`
  color: #18181b;
  border-color: #d4d4d8;
  background: #ffffff;

  &:hover:not(:disabled) {
    background: #f4f4f5;
    border-color: #a1a1aa;
  }

  [data-theme='dark'] & {
    color: #fafafa;
    border-color: #3f3f46;
    background: #18181b;

    &:hover:not(:disabled) {
      background: #27272a;
      border-color: #52525b;
    }
  }
`;

const MenuStrip = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 2px;
  min-width: 0;
  overflow: visible;
  padding-right: 4px;

  &::-webkit-scrollbar {
    height: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(63, 63, 70, 0.45);
    border-radius: 999px;
  }

  .sh-dropdown-trigger {
    height: 32px;
    border: none;
    background: transparent;
    color: #18181b;
    font-size: 0.84rem;
    font-weight: 600;
    border-radius: 7px;
    padding: 0 9px;
  }

  .sh-dropdown-trigger:hover,
  .sh-dropdown-trigger:focus {
    background: #f4f4f5;
  }

  [data-theme='dark'] & {
    &::-webkit-scrollbar-thumb {
      background: rgba(161, 161, 170, 0.45);
    }

    .sh-dropdown-trigger {
      border: none;
      background: transparent;
      color: #fafafa;
    }

    .sh-dropdown-trigger:hover,
    .sh-dropdown-trigger:focus {
      background: #18181b;
    }
  }

  .sh-dropdown-content {
    margin-top: 4px;
  }

  @media (max-width: 1000px) {
    overflow-x: auto;
    overflow-y: visible;
    padding-bottom: 3px;
  }
`;

const MenuTextButton = styled(Button)`
  height: 32px;
  border: none;
  background: transparent;
  color: #18181b;
  border-radius: 7px;
  padding: 0 9px;
  font-size: 0.84rem;
  font-weight: 600;
  box-shadow: none;

  &:hover:not(:disabled),
  &:focus-visible {
    background: #f4f4f5;
    color: #18181b;
    border: none;
    box-shadow: none;
  }

  [data-theme='dark'] & {
    color: #fafafa;
    background: transparent;
    border: none;

    &:hover:not(:disabled),
    &:focus-visible {
      background: #18181b;
      color: #fafafa;
      border: none;
      box-shadow: none;
    }
  }
`;

const MobileDivider = styled.div`
  display: none;
`;

const CenterSection = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
`;

const DiagramTitleInput = styled(Input)`
  max-width: 260px;
  min-width: 150px;
  height: 36px;
  border-radius: 10px;
  border-color: #d4d4d8;
  background: #ffffff;
  color: #18181b;
  font-weight: 600;

  &::placeholder {
    color: #71717a;
  }

  &:focus {
    border-color: #18181b;
    box-shadow: 0 0 0 3px rgba(24, 24, 27, 0.12);
  }

  [data-theme='dark'] & {
    border-color: #3f3f46;
    background: #18181b;
    color: #fafafa;

    &::placeholder {
      color: #a1a1aa;
    }

    &:focus {
      border-color: #fafafa;
      box-shadow: 0 0 0 3px rgba(250, 250, 250, 0.16);
    }
  }
`;

const RightSection = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const GitHubArea = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;

  .github-user {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: #18181b;
    font-size: 0.82rem;
    font-weight: 600;
  }

  [data-theme='dark'] & .github-user {
    color: #fafafa;
  }
`;

const GitHubButton = styled(Button)`
  color: #18181b;
  border-color: #d4d4d8;
  background: #ffffff;
  height: 34px;

  &:hover:not(:disabled) {
    background: #f4f4f5;
    border-color: #a1a1aa;
  }

  [data-theme='dark'] & {
    color: #fafafa;
    border-color: #3f3f46;
    background: #18181b;

    &:hover:not(:disabled) {
      background: #27272a;
      border-color: #52525b;
    }
  }
`;

const SidebarToggleButton = styled(Button)`
  color: #18181b;
  border-color: #d4d4d8;
  background: #ffffff;

  &:hover:not(:disabled) {
    background: #f4f4f5;
    border-color: #a1a1aa;
  }

  [data-theme='dark'] & {
    color: #fafafa;
    border-color: #3f3f46;
    background: #18181b;

    &:hover:not(:disabled) {
      background: #27272a;
      border-color: #52525b;
    }
  }
`;

const ResponsiveStyle = styled.div`
  @media (max-width: 1200px) {
    ${BarContainer} {
      grid-template-columns: 1fr auto;
      grid-template-rows: auto auto;
      height: auto;
      min-height: 60px;
      gap: 8px;
      padding: 10px 12px;
    }

    ${CenterSection} {
      order: 3;
      grid-column: 1 / span 2;
      justify-content: flex-start;
      width: 100%;
    }

    ${DiagramTitleInput} {
      max-width: 100%;
      width: min(420px, 100%);
    }
  }

  @media (max-width: 860px) {
    ${LeftSection} {
      gap: 6px;
    }

    ${MenuStrip} {
      gap: 4px;
      max-width: 100%;
    }

    ${GitHubArea} .github-user {
      display: none;
    }
  }

  @media (max-width: 680px) {
    ${BarContainer} {
      grid-template-columns: 1fr;
      grid-template-rows: auto auto auto;
    }

    ${LeftSection} {
      flex-wrap: wrap;
    }

    ${RightSection} {
      justify-content: flex-end;
    }

    ${MobileDivider} {
      display: block;
      width: 100%;
      height: 1px;
      background: #e4e4e7;
    }

    [data-theme='dark'] ${MobileDivider} {
      background: #27272a;
    }
  }
`;

const SidebarIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fillRule="evenodd"
      d="M11.28 9.53L8.81 12l2.47 2.47a.75.75 0 11-1.06 1.06l-3-3a.75.75 0 010-1.06l3-3a.75.75 0 111.06 1.06z"
    />
    <path
      fillRule="evenodd"
      d="M3.75 2A1.75 1.75 0 002 3.75v16.5c0 .966.784 1.75 1.75 1.75h16.5A1.75 1.75 0 0022 20.25V3.75A1.75 1.75 0 0020.25 2H3.75zM3.5 3.75a.25.25 0 01.25-.25H15v17H3.75a.25.25 0 01-.25-.25V3.75zm13 16.75v-17h3.75a.25.25 0 01.25.25v16.5a.25.25 0 01-.25.25H16.5z"
    />
  </svg>
);

export const ApplicationBar: React.FC<{ onToggleAgentWebUi?: () => void }> = ({ onToggleAgentWebUi }) => {
  const dispatch = useAppDispatch();
  const { diagram } = useAppSelector((state) => state.diagram);
  const [diagramTitle, setDiagramTitle] = useState<string>(diagram?.title || '');
  const [isGitHubSidebarOpen, setIsGitHubSidebarOpen] = useState(false);
  const apollonEditor = useContext(ApollonEditorContext);
  const editor = apollonEditor?.editor;
  const location = useLocation();
  const { currentProject } = useProject();
  const { isAuthenticated, username, login: githubLogin, logout: githubLogout, isLoading: githubLoading } = useGitHubAuth();

  useEffect(() => {
    if (diagram?.title) {
      setDiagramTitle(diagram.title);
    }
  }, [diagram?.title]);

  const changeDiagramTitlePreview = (event: ChangeEvent<HTMLInputElement>) => {
    setDiagramTitle(event.target.value);
  };

  const changeDiagramTitleApplicationState = () => {
    if (diagram) {
      dispatch(updateDiagramThunk({ title: diagramTitle }));
    }
  };

  const handleQualityCheck = async () => {
    if (
      location.pathname === '/quantum-editor' ||
      location.pathname === '/graphical-ui-editor' ||
      currentProject?.currentDiagramType === 'QuantumCircuitDiagram'
    ) {
      toast.error('coming soon');
      return;
    }

    if (diagram?.model && !isUMLModel(diagram.model)) {
      await validateDiagram(null, diagram.title, diagram.model);
    } else if (editor) {
      await validateDiagram(editor, diagram.title);
    } else {
      toast.error('No diagram available to validate');
    }
  };

  return (
    <>
      <ResponsiveStyle>
        <BarContainer>
          <LeftSection>
            <BrandLink to="/">
              <img alt="BESSER" src="images/logo.png" />
            </BrandLink>

            <IconButton variant="outline" size="icon" onClick={onToggleAgentWebUi} title="AI Web UI">
              <ChatSquareText size={18} />
            </IconButton>

            <MenuStrip>
              <FileMenu />
              <GenerateCodeMenu />
              <DeployMenu />
              {APPLICATION_SERVER_VERSION && (
                <MenuTextButton variant="ghost" size="sm" onClick={handleQualityCheck}>
                  Quality Check
                </MenuTextButton>
              )}
              <CommunityMenu />
              <HelpMenu />
            </MenuStrip>
          </LeftSection>

          <RightSection>
            <GitHubArea>
              {isAuthenticated ? (
                <>
                  <span className="github-user">
                    <Github size={15} />
                    {username}
                  </span>
                  <GitHubButton variant="outline" size="sm" onClick={githubLogout} title="Sign out from GitHub">
                    <BoxArrowRight size={14} />
                    Sign Out
                  </GitHubButton>
                </>
              ) : (
                <GitHubButton
                  variant="outline"
                  size="sm"
                  onClick={githubLogin}
                  disabled={githubLoading}
                  title="Connect to GitHub for deployment"
                >
                  <Github size={15} />
                  {githubLoading ? 'Connecting...' : 'Connect GitHub'}
                </GitHubButton>
              )}
            </GitHubArea>

            <ThemeSwitcherMenu />

            {isAuthenticated && (
              <SidebarToggleButton
                variant="outline"
                size="icon"
                onClick={() => setIsGitHubSidebarOpen(true)}
                title="Open GitHub sync panel"
              >
                <SidebarIcon size={18} />
              </SidebarToggleButton>
            )}
          </RightSection>

          <MobileDivider />

          <CenterSection>
            <DiagramTitleInput
              type="text"
              value={diagramTitle}
              onChange={changeDiagramTitlePreview}
              onBlur={changeDiagramTitleApplicationState}
              placeholder="Diagram Title"
            />
          </CenterSection>
        </BarContainer>
      </ResponsiveStyle>

      <GitHubSidebar isOpen={isGitHubSidebarOpen} onClose={() => setIsGitHubSidebarOpen(false)} />
    </>
  );
};
