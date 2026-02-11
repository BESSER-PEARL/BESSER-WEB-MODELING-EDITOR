import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { UMLDiagramType } from '@besser/wme';
import { toast } from 'react-toastify';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useProject } from '../../hooks/useProject';
import { toUMLDiagramType } from '../../types/project';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { updateDiagramThunk } from '../../services/diagram/diagramSlice';
import { bugReportURL } from '../../constant';
import { useGitHubAuth } from '../../services/github/useGitHubAuth';
import { GitHubSidebar } from '../github-sidebar';
import { toggleTheme } from '../../utils/theme-switcher';
import { LocalStorageRepository } from '../../services/local-storage/local-storage-repository';
import { useDeployToGitHub } from '../../services/deploy/useGitHubDeploy';
import { ProjectStorageRepository } from '../../services/storage/ProjectStorageRepository';
import { useImportDiagramToProjectWorkflow } from '../../services/import/useImportDiagram';
import { useImportDiagramPictureFromImage } from '../../services/import/useImportDiagramPicture';
import { useImportDiagramFromKG } from '../../services/import/useImportDiagramKG';
import { buildExportableProjectPayload } from '../../services/export/projectExportUtils';
import { useProjectBumlPreview } from '../../services/export/useProjectBumlPreview';
import { appVersion, besserLibraryRepositoryLink, besserLibraryVersion, besserWMERepositoryLink } from '../../application-constants';
import { normalizeProjectName } from '../../utils/projectName';
import { JsonViewerModal } from '../modals/json-viewer-modal/json-viewer-modal';
import { FeedbackDialog } from '../modals/FeedbackDialog';
import { HelpGuideDialog } from '../modals/HelpGuideDialog';
import { WorkspaceTopBar } from '../application-bar/WorkspaceTopBar';
import { WorkspaceSidebar } from './WorkspaceSidebar';
import type { GeneratorMenuMode, GeneratorType } from './workspace-types';

export type { GeneratorType, GeneratorMenuMode } from './workspace-types';
type AssistantImportMode = 'image' | 'kg' | null;

interface WorkspaceShellProps {
  children: React.ReactNode;
  onOpenProjectHub: () => void;
  onOpenTemplateDialog: () => void;
  onExportProject: () => void;
  onGenerate: (type: GeneratorType) => void;
  onQualityCheck: () => void;
  showQualityCheck?: boolean;
  generatorMode: GeneratorMenuMode;
  isGenerating?: boolean;
}

const COMMUNITY_URLS = {
  contribute: 'https://github.com/BESSER-PEARL/BESSER/blob/master/CONTRIBUTING.md',
  repository: 'https://github.com/BESSER-PEARL/BESSER',
  survey: 'https://docs.google.com/forms/d/e/1FAIpQLSdhYVFFu8xiFkoV4u6Pgjf5F7-IS_W7aTj34N5YS2L143vxoQ/viewform',
  feedback: 'https://github.com/BESSER-PEARL/BESSER/discussions',
};

const DOCS_URL = 'https://besser.readthedocs.io/en/latest/';

const getIsDarkTheme = (): boolean => {
  const preferred = LocalStorageRepository.getUserThemePreference();
  const fallback = LocalStorageRepository.getSystemThemePreference();
  return (preferred || fallback || 'light') === 'dark';
};

const sanitizeRepoName = (name: string): string => {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
};

export const WorkspaceShell: React.FC<WorkspaceShellProps> = ({
  children,
  onOpenProjectHub,
  onOpenTemplateDialog,
  onExportProject,
  onGenerate,
  onQualityCheck,
  showQualityCheck = false,
  generatorMode,
  isGenerating = false,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useAppDispatch();
  const diagram = useAppSelector((state) => state.diagram.diagram);
  const { currentProject, currentDiagramType, switchDiagramType, updateProject } = useProject();
  const {
    isAuthenticated,
    username,
    githubSession,
    login: githubLogin,
    logout: githubLogout,
    isLoading: githubLoading,
  } = useGitHubAuth();
  const { deployToGitHub, isDeploying: isDeployingToRender, deploymentResult } = useDeployToGitHub();
  const importDiagramToProject = useImportDiagramToProjectWorkflow();
  const importDiagramPictureFromImage = useImportDiagramPictureFromImage();
  const importDiagramFromKG = useImportDiagramFromKG();
  const generateProjectBumlPreview = useProjectBumlPreview();

  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [projectNameDraft, setProjectNameDraft] = useState(currentProject?.name ?? '');
  const [diagramTitleDraft, setDiagramTitleDraft] = useState(diagram?.title ?? '');
  const [isDarkTheme, setIsDarkTheme] = useState<boolean>(() => getIsDarkTheme());
  const [isGitHubSidebarOpen, setIsGitHubSidebarOpen] = useState(false);

  const [assistantImportMode, setAssistantImportMode] = useState<AssistantImportMode>(null);
  const [assistantApiKey, setAssistantApiKey] = useState('');
  const [assistantSelectedFile, setAssistantSelectedFile] = useState<File | null>(null);
  const [assistantImportError, setAssistantImportError] = useState('');
  const [isAssistantImporting, setIsAssistantImporting] = useState(false);

  const [isProjectPreviewOpen, setIsProjectPreviewOpen] = useState(false);
  const [projectPreviewJson, setProjectPreviewJson] = useState('');
  const [projectBumlPreview, setProjectBumlPreview] = useState('');
  const [projectBumlPreviewError, setProjectBumlPreviewError] = useState('');
  const [isProjectBumlPreviewLoading, setIsProjectBumlPreviewLoading] = useState(false);

  const [isDeployDialogOpen, setIsDeployDialogOpen] = useState(false);
  const [isDeployResultOpen, setIsDeployResultOpen] = useState(false);
  const [githubRepoName, setGithubRepoName] = useState('');
  const [githubRepoDescription, setGithubRepoDescription] = useState('');
  const [githubRepoPrivate, setGithubRepoPrivate] = useState(false);

  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);
  const [isAboutDialogOpen, setIsAboutDialogOpen] = useState(false);
  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);

  useEffect(() => {
    setProjectNameDraft(currentProject?.name ?? '');
  }, [currentProject?.id, currentProject?.name]);

  useEffect(() => {
    setDiagramTitleDraft(diagram?.title ?? '');
  }, [diagram?.id, diagram?.title]);

  const activeUmlType = useMemo(() => toUMLDiagramType(currentDiagramType), [currentDiagramType]);
  const isGuiContext =
    location.pathname === '/graphical-ui-editor' || currentProject?.currentDiagramType === 'GUINoCodeDiagram';
  const isClassContext = location.pathname === '/' && currentProject?.currentDiagramType === 'ClassDiagram';
  const isDeploymentAvailable = isGuiContext || isClassContext;
  const shellBackgroundClass = isDarkTheme
    ? 'bg-[radial-gradient(120%_120%_at_0%_0%,#0f172a_0%,#111827_45%,#0b1220_100%)] text-slate-100'
    : 'bg-[radial-gradient(120%_120%_at_0%_0%,#d2e7df_0%,#f8f7f2_45%,#f7fafc_100%)] text-foreground';
  const headerBackgroundClass = isDarkTheme
    ? 'border-b border-slate-700/70 bg-[linear-gradient(105deg,rgba(15,23,42,0.95)_0%,rgba(17,24,39,0.92)_45%,rgba(30,41,59,0.96)_100%)]'
    : 'border-b border-slate-300/60 bg-[linear-gradient(105deg,rgba(240,249,255,0.95)_0%,rgba(252,255,245,0.92)_45%,rgba(237,246,255,0.96)_100%)]';
  const topPanelClass = isDarkTheme
    ? 'border-slate-700/80 bg-slate-900/70'
    : 'border-slate-300/60 bg-white/70';
  const topPanelIconClass = isDarkTheme ? 'text-slate-300' : 'text-slate-600';
  const diagramBadgeClass = isDarkTheme
    ? 'hidden bg-slate-800 text-slate-200 xl:inline-flex'
    : 'hidden bg-slate-100 text-slate-600 xl:inline-flex';
  const outlineButtonClass = isDarkTheme
    ? 'border-slate-700 bg-slate-900/70 text-slate-100 hover:bg-slate-800'
    : 'border-slate-300 bg-white/75';
  const primaryGenerateClass = isDarkTheme
    ? 'gap-2 bg-sky-700 text-white hover:bg-sky-600'
    : 'gap-2 bg-slate-900 text-white hover:bg-slate-800';
  const githubBadgeClass = isDarkTheme
    ? 'hidden max-w-[160px] truncate bg-slate-800 px-2 py-1 text-slate-100 lg:inline-flex'
    : 'hidden max-w-[160px] truncate bg-slate-100 px-2 py-1 text-slate-700 lg:inline-flex';
  const sidebarBaseClass = isDarkTheme
    ? 'hidden shrink-0 border-r border-slate-700/70 bg-slate-950/65 p-2.5 backdrop-blur-sm transition-all duration-200 md:flex md:flex-col md:gap-2'
    : 'hidden shrink-0 border-r border-slate-300/60 bg-white/60 p-2.5 backdrop-blur-sm transition-all duration-200 md:flex md:flex-col md:gap-2';
  const sidebarTitleClass = isDarkTheme
    ? 'px-2 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400'
    : 'px-2 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500';
  const sidebarDividerClass = isDarkTheme ? 'my-2 border-t border-slate-700/80' : 'my-2 border-t border-slate-300/70';
  const sidebarToggleClass = isDarkTheme
    ? 'mt-auto flex items-center rounded-lg border border-slate-700/80 bg-slate-900/80 p-2 transition hover:border-slate-600 hover:bg-slate-800'
    : 'mt-auto flex items-center rounded-lg border border-slate-300/70 bg-white/80 p-2 transition hover:border-slate-400 hover:bg-white';
  const sidebarToggleTextClass = isDarkTheme ? 'text-xs font-semibold text-slate-200' : 'text-xs font-semibold text-slate-700';

  const handleSwitchUml = (type: UMLDiagramType) => {
    if (location.pathname !== '/') {
      navigate('/');
    }
    if (activeUmlType === type) {
      return;
    }
    switchDiagramType(type);
  };

  const handleProjectRename = () => {
    const normalized = normalizeProjectName(projectNameDraft);
    if (!normalized || !currentProject || normalized === currentProject.name) {
      setProjectNameDraft(currentProject?.name ?? '');
      return;
    }
    updateProject({ name: normalized });
  };

  const handleDiagramRename = () => {
    const normalized = diagramTitleDraft.trim();
    const currentTitle = diagram?.title ?? '';
    if (!normalized || normalized === currentTitle) {
      setDiagramTitleDraft(currentTitle);
      return;
    }
    dispatch(updateDiagramThunk({ title: normalized }));
  };

  const handleToggleTheme = () => {
    toggleTheme();
    setIsDarkTheme(getIsDarkTheme());
  };

  const openExternalUrl = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleImportSingleDiagram = async () => {
    if (!currentProject) {
      toast.error('Create or load a project first.');
      return;
    }

    try {
      const result = await importDiagramToProject();
      toast.success(result.message);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      if (message.toLowerCase().includes('cancel')) {
        return;
      }
      toast.error(`Import failed: ${message}`);
    }
  };

  const resetAssistantImportDialog = () => {
    setAssistantImportMode(null);
    setAssistantApiKey('');
    setAssistantSelectedFile(null);
    setAssistantImportError('');
    setIsAssistantImporting(false);
  };

  const openAssistantImportDialog = (mode: Exclude<AssistantImportMode, null>) => {
    if (!currentProject) {
      toast.error('Create or load a project first.');
      return;
    }
    setAssistantImportMode(mode);
    setAssistantApiKey('');
    setAssistantSelectedFile(null);
    setAssistantImportError('');
  };

  const handleAssistantFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file || !assistantImportMode) {
      setAssistantSelectedFile(null);
      setAssistantImportError('');
      return;
    }

    if (assistantImportMode === 'image') {
      const allowedTypes = ['image/png', 'image/jpeg'];
      if (!allowedTypes.includes(file.type)) {
        setAssistantSelectedFile(null);
        setAssistantImportError('Only PNG or JPEG files are allowed.');
        return;
      }
    } else {
      const allowedTypes = ['application/json', 'text/turtle', 'application/x-turtle'];
      const allowedExtensions = ['.json', '.ttl', '.rdf'];
      const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
      if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(extension)) {
        setAssistantSelectedFile(null);
        setAssistantImportError('Only TTL, RDF, or JSON files are allowed.');
        return;
      }
    }

    setAssistantSelectedFile(file);
    setAssistantImportError('');
  };

  const handleAssistantImport = async () => {
    if (!assistantImportMode || !assistantSelectedFile || !assistantApiKey || assistantImportError) {
      return;
    }

    setIsAssistantImporting(true);
    try {
      const result =
        assistantImportMode === 'image'
          ? await importDiagramPictureFromImage(assistantSelectedFile, assistantApiKey)
          : await importDiagramFromKG(assistantSelectedFile, assistantApiKey);
      toast.success(result.message);
      resetAssistantImportDialog();
    } catch (error) {
      toast.error(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsAssistantImporting(false);
    }
  };

  const handleOpenProjectPreview = () => {
    if (!currentProject) {
      toast.error('Create or load a project first.');
      return;
    }

    const freshProject = ProjectStorageRepository.loadProject(currentProject.id) || currentProject;
    const exportData = {
      project: buildExportableProjectPayload(freshProject),
      exportedAt: new Date().toISOString(),
      version: '2.0.0',
    };
    setProjectPreviewJson(JSON.stringify(exportData, null, 2));
    setProjectBumlPreview('');
    setProjectBumlPreviewError('');
    setIsProjectBumlPreviewLoading(false);
    setIsProjectPreviewOpen(true);
  };

  const handleCopyProjectPreview = async () => {
    try {
      await navigator.clipboard.writeText(projectPreviewJson);
      toast.success('Project JSON copied.');
    } catch {
      toast.error('Failed to copy project JSON.');
    }
  };

  const handleDownloadProjectPreview = () => {
    const blob = new Blob([projectPreviewJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const projectName = sanitizeRepoName(currentProject?.name || 'project') || 'project';
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${projectName}_preview.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const handleRequestProjectBumlPreview = async () => {
    if (!currentProject) {
      toast.error('Create or load a project first.');
      return;
    }

    const freshProject = ProjectStorageRepository.loadProject(currentProject.id) || currentProject;
    setIsProjectBumlPreviewLoading(true);
    setProjectBumlPreviewError('');

    try {
      const bumlPreview = await generateProjectBumlPreview(freshProject);
      setProjectBumlPreview(bumlPreview);
      toast.success('Project B-UML preview generated.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate B-UML preview.';
      setProjectBumlPreview('');
      setProjectBumlPreviewError(message);
      toast.error(`Failed to generate B-UML preview: ${message}`);
    } finally {
      setIsProjectBumlPreviewLoading(false);
    }
  };

  const handleCloseProjectPreview = () => {
    setIsProjectPreviewOpen(false);
    setProjectPreviewJson('');
    setProjectBumlPreview('');
    setProjectBumlPreviewError('');
    setIsProjectBumlPreviewLoading(false);
  };

  const handleCopyProjectBumlPreview = async () => {
    if (!projectBumlPreview) {
      toast.error('No B-UML preview to copy.');
      return;
    }

    try {
      await navigator.clipboard.writeText(projectBumlPreview);
      toast.success('Project B-UML copied.');
    } catch {
      toast.error('Failed to copy B-UML preview.');
    }
  };

  const handleDownloadProjectBumlPreview = () => {
    if (!projectBumlPreview) {
      toast.error('No B-UML preview to download.');
      return;
    }

    const normalizedName =
      normalizeProjectName(currentProject?.name || 'project')
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '_') || 'project';

    const blob = new Blob([projectBumlPreview], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${normalizedName}_preview.py`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const handleOpenDeployDialog = () => {
    if (!isDeploymentAvailable) {
      toast.info('Deploy is available for Class and GUI diagrams.');
      return;
    }
    if (!isAuthenticated) {
      toast.info('Connect to GitHub first.');
      return;
    }
    if (!currentProject) {
      toast.error('Create or load a project first.');
      return;
    }

    setGithubRepoName(sanitizeRepoName(currentProject.name) || 'besser-webapp');
    setGithubRepoDescription('Web application generated by BESSER');
    setGithubRepoPrivate(false);
    setIsDeployDialogOpen(true);
  };

  const handlePublishToRender = async () => {
    if (!currentProject) {
      toast.error('No project available for deployment.');
      return;
    }
    if (!githubSession) {
      toast.error('GitHub session not found. Please reconnect.');
      return;
    }
    if (!githubRepoName.trim()) {
      toast.error('Repository name is required.');
      return;
    }

    const projectForDeploy = ProjectStorageRepository.loadProject(currentProject.id) || currentProject;
    const result = await deployToGitHub(
      projectForDeploy,
      sanitizeRepoName(githubRepoName),
      githubRepoDescription.trim() || 'Web application generated by BESSER',
      githubRepoPrivate,
      githubSession
    );

    if (result?.success) {
      setIsDeployDialogOpen(false);
      setIsDeployResultOpen(true);
    }
  };

  return (
    <div className={`flex h-screen flex-col overflow-hidden ${shellBackgroundClass}`}>
      <WorkspaceTopBar
        isDarkTheme={isDarkTheme}
        headerBackgroundClass={headerBackgroundClass}
        topPanelClass={topPanelClass}
        topPanelIconClass={topPanelIconClass}
        diagramBadgeClass={diagramBadgeClass}
        outlineButtonClass={outlineButtonClass}
        primaryGenerateClass={primaryGenerateClass}
        githubBadgeClass={githubBadgeClass}
        showQualityCheck={showQualityCheck}
        generatorMode={generatorMode}
        isGenerating={isGenerating}
        projectNameDraft={projectNameDraft}
        diagramTitleDraft={diagramTitleDraft}
        currentDiagramType={currentProject?.currentDiagramType}
        locationPath={location.pathname}
        activeUmlType={activeUmlType}
        isAuthenticated={isAuthenticated}
        username={username || undefined}
        githubLoading={githubLoading}
        hasProject={Boolean(currentProject)}
        isDeploymentAvailable={isDeploymentAvailable}
        onOpenProjectHub={onOpenProjectHub}
        onOpenTemplateDialog={onOpenTemplateDialog}
        onExportProject={onExportProject}
        onImportSingleDiagram={handleImportSingleDiagram}
        onOpenAssistantImportImage={() => openAssistantImportDialog('image')}
        onOpenAssistantImportKg={() => openAssistantImportDialog('kg')}
        onOpenProjectPreview={handleOpenProjectPreview}
        onGenerate={onGenerate}
        onQualityCheck={onQualityCheck}
        onToggleTheme={handleToggleTheme}
        onGitHubLogin={githubLogin}
        onGitHubLogout={githubLogout}
        onOpenGitHubSidebar={() => setIsGitHubSidebarOpen(true)}
        onOpenDeployDialog={handleOpenDeployDialog}
        onOpenHelpDialog={() => setIsHelpDialogOpen(true)}
        onOpenAboutDialog={() => setIsAboutDialogOpen(true)}
        onOpenContribute={() => openExternalUrl(COMMUNITY_URLS.contribute)}
        onOpenRepository={() => openExternalUrl(COMMUNITY_URLS.repository)}
        onOpenFeedback={() => setIsFeedbackDialogOpen(true)}
        onOpenSurvey={() => openExternalUrl(COMMUNITY_URLS.survey)}
        onOpenBugReport={() => openExternalUrl(bugReportURL)}
        onSwitchUml={handleSwitchUml}
        onNavigate={navigate}
        onProjectNameDraftChange={setProjectNameDraft}
        onProjectRename={handleProjectRename}
        onDiagramTitleDraftChange={setDiagramTitleDraft}
        onDiagramRename={handleDiagramRename}
      />

      <div className="flex min-h-0 flex-1">
        <WorkspaceSidebar
          isDarkTheme={isDarkTheme}
          isSidebarExpanded={isSidebarExpanded}
          sidebarBaseClass={sidebarBaseClass}
          sidebarTitleClass={sidebarTitleClass}
          sidebarDividerClass={sidebarDividerClass}
          sidebarToggleClass={sidebarToggleClass}
          sidebarToggleTextClass={sidebarToggleTextClass}
          locationPath={location.pathname}
          activeUmlType={activeUmlType}
          onSwitchUml={handleSwitchUml}
          onNavigate={navigate}
          onToggleExpanded={() => setIsSidebarExpanded((previous) => !previous)}
        />

        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>

      <GitHubSidebar isOpen={isGitHubSidebarOpen} onClose={() => setIsGitHubSidebarOpen(false)} />

      <Dialog open={assistantImportMode !== null} onOpenChange={(open) => !open && resetAssistantImportDialog()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {assistantImportMode === 'image'
                ? 'Import Class Diagram from Image'
                : 'Import Class Diagram from Knowledge Graph'}
            </DialogTitle>
            <DialogDescription>
              Use an OpenAI API key to convert your file to a class diagram and add it to the current project.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="assistant-import-api-key">OpenAI API Key</Label>
              <Input
                id="assistant-import-api-key"
                type="password"
                value={assistantApiKey}
                onChange={(event) => setAssistantApiKey(event.target.value)}
                placeholder="sk-..."
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="assistant-import-file">
                {assistantImportMode === 'image'
                  ? 'Upload Diagram Image (PNG/JPEG)'
                  : 'Upload Knowledge Graph (TTL/RDF/JSON)'}
              </Label>
              <input
                id="assistant-import-file"
                type="file"
                accept={assistantImportMode === 'image' ? 'image/png, image/jpeg' : '.ttl,.rdf,.json'}
                onChange={handleAssistantFileChange}
                className="block w-full cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
              />
              {assistantImportError && <p className="text-xs text-red-600">{assistantImportError}</p>}
              {assistantSelectedFile && <p className="text-xs text-slate-600">Selected: {assistantSelectedFile.name}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetAssistantImportDialog} disabled={isAssistantImporting}>
              Cancel
            </Button>
            <Button
              onClick={handleAssistantImport}
              disabled={!assistantApiKey || !assistantSelectedFile || !!assistantImportError || isAssistantImporting}
            >
              {isAssistantImporting ? 'Importing...' : 'Import'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <JsonViewerModal
        isVisible={isProjectPreviewOpen}
        jsonData={projectPreviewJson}
        diagramType="Project (V2.0.0)"
        onClose={handleCloseProjectPreview}
        onCopy={handleCopyProjectPreview}
        onDownload={handleDownloadProjectPreview}
        enableBumlView
        bumlData={projectBumlPreview}
        bumlLabel={currentProject?.name ? `Project B-UML Preview (${currentProject.name})` : 'Project B-UML Preview'}
        isBumlLoading={isProjectBumlPreviewLoading}
        bumlError={projectBumlPreviewError}
        onRequestBuml={() => void handleRequestProjectBumlPreview()}
        onCopyBuml={handleCopyProjectBumlPreview}
        onDownloadBuml={handleDownloadProjectBumlPreview}
      />

      <FeedbackDialog open={isFeedbackDialogOpen} onOpenChange={setIsFeedbackDialogOpen} />

      <HelpGuideDialog
        open={isHelpDialogOpen}
        onOpenChange={setIsHelpDialogOpen}
        onOpenDocs={() => openExternalUrl(DOCS_URL)}
        onOpenRepository={() => openExternalUrl(besserWMERepositoryLink)}
      />

      <Dialog open={isDeployDialogOpen} onOpenChange={setIsDeployDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Publish to Render</DialogTitle>
            <DialogDescription>
              Create a GitHub repository from the current project and deploy it on Render.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="deploy-repo-name">Repository Name</Label>
              <Input
                id="deploy-repo-name"
                value={githubRepoName}
                onChange={(event) => setGithubRepoName(event.target.value)}
                placeholder="my-awesome-app"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deploy-repo-description">Description</Label>
              <Input
                id="deploy-repo-description"
                value={githubRepoDescription}
                onChange={(event) => setGithubRepoDescription(event.target.value)}
                placeholder="Web application generated by BESSER"
              />
            </div>
            <label className="flex items-center justify-between gap-3 rounded-md border border-border/70 px-3 py-2 text-sm">
              Make repository private
              <input
                type="checkbox"
                checked={githubRepoPrivate}
                onChange={(event) => setGithubRepoPrivate(event.target.checked)}
              />
            </label>
            {githubRepoPrivate && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Private repositories may require manual Render permission setup.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeployDialogOpen(false)} disabled={isDeployingToRender}>
              Cancel
            </Button>
            <Button onClick={handlePublishToRender} disabled={isDeployingToRender || !githubRepoName.trim()}>
              {isDeployingToRender ? 'Publishing...' : 'Publish to Render'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeployResultOpen} onOpenChange={setIsDeployResultOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Repository Created Successfully</DialogTitle>
            <DialogDescription>
              Continue with one-click Render deployment or inspect the generated repository.
            </DialogDescription>
          </DialogHeader>
          {deploymentResult && (
            <div className="space-y-4">
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                <p className="font-medium">
                  {deploymentResult.owner}/{deploymentResult.repo_name}
                </p>
                <p className="text-xs">{deploymentResult.files_uploaded} files uploaded.</p>
              </div>
              <Button className="w-full" onClick={() => openExternalUrl(deploymentResult.deployment_urls.render)}>
                Open Render Deployment
              </Button>
              <Button variant="outline" className="w-full" onClick={() => openExternalUrl(deploymentResult.repo_url)}>
                View GitHub Repository
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isAboutDialogOpen} onOpenChange={setIsAboutDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>About BESSER</DialogTitle>
            <DialogDescription>Runtime versions and project resources.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm text-slate-700">
            <p>
              <span className="font-semibold">Web Editor:</span> {appVersion}
            </p>
            <p>
              <span className="font-semibold">BESSER Library:</span> {besserLibraryVersion}
            </p>
            <p className="pt-1 text-xs text-slate-600">
              BESSER provides model-driven engineering tooling for UML-based design, code generation, and deployment.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => openExternalUrl(besserWMERepositoryLink)}>
              WME Repository
            </Button>
            <Button variant="outline" onClick={() => openExternalUrl(besserLibraryRepositoryLink)}>
              Library Repository
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
