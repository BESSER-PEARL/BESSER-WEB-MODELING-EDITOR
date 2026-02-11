import React, { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useSearchParams } from 'react-router-dom';
import { PostHogProvider } from 'posthog-js/react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { ApollonEditor } from '@besser/wme';
import {
  POSTHOG_HOST,
  POSTHOG_KEY,
  localStorageLatestProject,
  BACKEND_URL,
  APPLICATION_SERVER_VERSION,
} from './constant';
import { ApollonEditorProvider } from './components/apollon-editor-component/apollon-editor-context';
import { ApollonEditorComponent } from './components/apollon-editor-component/ApollonEditorComponent';
import { GraphicalUIEditor } from './components/grapesjs-editor';
import { QuantumEditorComponent } from './components/quantum-editor-component/QuantumEditorComponent';
import { ErrorPanel } from './components/error-handling/error-panel';
import { UMLAgentModeling } from './components/uml-agent-widget/UMLAgentModeling';
import { CookieConsentBanner, hasUserConsented } from './components/cookie-consent/CookieConsentBanner';
import { ApplicationStore } from './components/store/application-store';
import { useProject } from './hooks/useProject';
import {
  useGenerateCode,
  DjangoConfig,
  SQLConfig,
  SQLAlchemyConfig,
  JSONSchemaConfig,
  AgentConfig,
  QiskitConfig,
} from './services/generate-code/useGenerateCode';
import { useDeployLocally } from './services/generate-code/useDeployLocally';
import { useGitHubBumlImport } from './services/import/useGitHubBumlImport';
import { WorkspaceShell, GeneratorType, GeneratorMenuMode } from './components/sidebar/WorkspaceShell';
import { ProjectHubDialog } from './components/home/ProjectHubDialog';
import { ProjectSettingsPanel } from './components/project/ProjectSettingsPanel';
import { TemplateLibraryDialog } from './components/modals/TemplateLibraryDialog';
import { ExportDialog } from './components/modals/ExportDialog';
import { GeneratorConfigDialogs } from './components/modals/generator-config/GeneratorConfigDialogs';
import { GrapesJSProjectData, isUMLModel } from './types/project';
import { validateDiagram } from './services/validation/validateDiagram';
import { ConfigDialog, getConfigDialogForGenerator } from './services/generate-code/generator-dialog-config';

const postHogOptions = {
  api_host: POSTHOG_HOST,
  autocapture: false,
  disable_session_recording: true,
  respect_dnt: true,
  opt_out_capturing_by_default: !hasUserConsented(),
  persistence: (hasUserConsented() ? 'localStorage+cookie' : 'memory') as 'localStorage+cookie' | 'memory',
  ip: false,
};

const knownRoutes = ['/', '/project-settings', '/graphical-ui-editor', '/quantum-editor'];

const toIdentifier = (value: string, fallback: string): string => {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');

  if (!normalized) {
    return fallback;
  }

  if (/^[0-9]/.test(normalized)) {
    return `p_${normalized}`;
  }

  return normalized;
};

const validateDjangoName = (name: string): boolean => {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
};

function isGuiModelEmpty(guiModel: GrapesJSProjectData | undefined): boolean {
  if (!guiModel || !guiModel.pages || guiModel.pages.length === 0) {
    return true;
  }

  return guiModel.pages.every((page: any) => {
    if (Array.isArray(page.frames)) {
      return page.frames.every((frame: any) => {
        const components = frame?.component?.components;
        return !Array.isArray(components) || components.length === 0;
      });
    }

    const components = page?.component?.components;
    return !Array.isArray(components) || components.length === 0;
  });
}

function AppContentInner() {
  const [editor, setEditor] = useState<ApollonEditor>();
  const [showProjectHub, setShowProjectHub] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [hasCheckedForProject, setHasCheckedForProject] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [configDialog, setConfigDialog] = useState<ConfigDialog>('none');

  const [djangoProjectName, setDjangoProjectName] = useState('');
  const [djangoAppName, setDjangoAppName] = useState('');
  const [useDocker, setUseDocker] = useState(false);
  const [sqlDialect, setSqlDialect] = useState<SQLConfig['dialect']>('sqlite');
  const [sqlAlchemyDbms, setSqlAlchemyDbms] = useState<SQLAlchemyConfig['dbms']>('sqlite');
  const [jsonSchemaMode, setJsonSchemaMode] = useState<JSONSchemaConfig['mode']>('regular');
  const [sourceLanguage, setSourceLanguage] = useState('none');
  const [selectedAgentLanguages, setSelectedAgentLanguages] = useState<string[]>([]);
  const [pendingAgentLanguage, setPendingAgentLanguage] = useState('none');
  const [qiskitBackend, setQiskitBackend] = useState<QiskitConfig['backend']>('aer_simulator');
  const [qiskitShots, setQiskitShots] = useState<number>(1024);

  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const { currentProject, loadProject } = useProject();
  const generateCode = useGenerateCode();
  const deployLocally = useDeployLocally();
  const { importFromGitHub, isLoading: isGitHubImportLoading } = useGitHubBumlImport();

  const hasTokenInUrl = !knownRoutes.includes(location.pathname);
  const isQuantumContext =
    location.pathname === '/quantum-editor' || currentProject?.currentDiagramType === 'QuantumCircuitDiagram';
  const isGuiContext =
    location.pathname === '/graphical-ui-editor' || currentProject?.currentDiagramType === 'GUINoCodeDiagram';
  const isClassContext = location.pathname === '/' && currentProject?.currentDiagramType === 'ClassDiagram';
  const isAgentContext = location.pathname === '/' && currentProject?.currentDiagramType === 'AgentDiagram';

  const generatorMenuMode: GeneratorMenuMode = isQuantumContext
    ? 'quantum'
    : isGuiContext
      ? 'gui'
      : isAgentContext
        ? 'agent'
        : isClassContext
          ? 'class'
          : 'none';

  const isLocalEnvironment =
    !BACKEND_URL || BACKEND_URL.includes('localhost') || BACKEND_URL.includes('127.0.0.1');

  const activeDiagram = currentProject ? currentProject.diagrams[currentProject.currentDiagramType] : undefined;
  const activeDiagramTitle = activeDiagram?.title || currentProject?.name || 'Diagram';

  useEffect(() => {
    const checkForLatestProject = async () => {
      if (hasCheckedForProject) {
        return;
      }

      if (hasTokenInUrl) {
        setShowProjectHub(false);
        setHasCheckedForProject(true);
        return;
      }

      const latestProjectId = localStorage.getItem(localStorageLatestProject);

      if (latestProjectId) {
        try {
          await loadProject(latestProjectId);
          setShowProjectHub(false);
        } catch {
          setShowProjectHub(true);
        }
      } else {
        setShowProjectHub(true);
      }

      setHasCheckedForProject(true);
    };

    checkForLatestProject();
  }, [loadProject, hasCheckedForProject, hasTokenInUrl]);

  useEffect(() => {
    const bumlUrl = searchParams.get('buml');

    if (bumlUrl && !isGitHubImportLoading) {
      importFromGitHub(bumlUrl).then(() => {
        searchParams.delete('buml');
        setSearchParams(searchParams, { replace: true });
      });
    }
  }, [searchParams, setSearchParams, importFromGitHub, isGitHubImportLoading]);

  useEffect(() => {
    if (!hasCheckedForProject) {
      return;
    }

    if (hasTokenInUrl) {
      setShowProjectHub(false);
      return;
    }

    setShowProjectHub(!currentProject);
  }, [currentProject, hasCheckedForProject, hasTokenInUrl]);

  useEffect(() => {
    if (!currentProject) {
      return;
    }

    const projectName = toIdentifier(currentProject.name || 'besser_project', 'besser_project');
    const appName = toIdentifier(activeDiagram?.title || 'core_app', 'core_app');
    setDjangoProjectName(projectName);
    setDjangoAppName(appName === projectName ? `${appName}_app` : appName);
  }, [currentProject?.id, currentProject?.name, activeDiagram?.title]);

  const executeGenerator = async (generatorType: GeneratorType, config?: unknown) => {
    if (!currentProject) {
      toast.error('Create or load a project before generating code.');
      return;
    }

    try {
      setIsGenerating(true);

      if (generatorType === 'web_app') {
        const guiModel = currentProject.diagrams.GUINoCodeDiagram.model as GrapesJSProjectData | undefined;
        if (isGuiModelEmpty(guiModel)) {
          toast.error('Cannot generate web application: GUI diagram is empty.');
          return;
        }

        await generateCode(null, 'web_app', activeDiagramTitle, config as any);
        return;
      }

      if (generatorType === 'qiskit') {
        if (!isQuantumContext) {
          toast.error('Open the Quantum editor before generating Qiskit code.');
          return;
        }

        await generateCode(null, 'qiskit', activeDiagramTitle, (config as QiskitConfig) ?? { backend: 'aer_simulator', shots: 1024 });
        return;
      }

      if (isQuantumContext || isGuiContext) {
        toast.error('Switch to a UML diagram to use this generator.');
        return;
      }

      if (!editor) {
        toast.error('No UML editor instance available. Open a UML diagram first.');
        return;
      }

      switch (generatorType) {
        case 'smartdata':
          await generateCode(editor, 'jsonschema', activeDiagramTitle, { mode: 'smart_data' });
          break;
        case 'django':
          await generateCode(editor, 'django', activeDiagramTitle, config as DjangoConfig);
          break;
        case 'sql':
          await generateCode(editor, 'sql', activeDiagramTitle, config as SQLConfig);
          break;
        case 'sqlalchemy':
          await generateCode(editor, 'sqlalchemy', activeDiagramTitle, config as SQLAlchemyConfig);
          break;
        case 'jsonschema':
          await generateCode(editor, 'jsonschema', activeDiagramTitle, config as JSONSchemaConfig);
          break;
        case 'agent':
          await generateCode(editor, 'agent', activeDiagramTitle, config as AgentConfig);
          break;
        default:
          await generateCode(editor, generatorType, activeDiagramTitle, config as any);
      }
    } catch (error) {
      toast.error(`Generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateRequest = async (generatorType: GeneratorType) => {
    if (!currentProject) {
      toast.error('Create or load a project before generating code.');
      return;
    }

    const requiredDialog = getConfigDialogForGenerator(generatorType);
    if (requiredDialog !== 'none') {
      setConfigDialog(requiredDialog);
      return;
    }

    await executeGenerator(generatorType);
  };

  const handleDjangoGenerate = async () => {
    if (!djangoProjectName || !djangoAppName) {
      toast.error('Project and app names are required.');
      return;
    }

    if (djangoProjectName === djangoAppName) {
      toast.error('Project and app names must be different.');
      return;
    }

    if (!validateDjangoName(djangoProjectName) || !validateDjangoName(djangoAppName)) {
      toast.error('Names must start with a letter/underscore and contain only letters, numbers, and underscores.');
      return;
    }

    await executeGenerator('django', {
      project_name: djangoProjectName,
      app_name: djangoAppName,
      containerization: useDocker,
    } as DjangoConfig);

    setConfigDialog('none');
  };

  const handleDjangoDeploy = async () => {
    if (!editor || !currentProject) {
      toast.error('Open a UML diagram before deploying.');
      return;
    }

    if (!djangoProjectName || !djangoAppName) {
      toast.error('Project and app names are required.');
      return;
    }

    if (djangoProjectName === djangoAppName) {
      toast.error('Project and app names must be different.');
      return;
    }

    if (!validateDjangoName(djangoProjectName) || !validateDjangoName(djangoAppName)) {
      toast.error('Names must start with a letter/underscore and contain only letters, numbers, and underscores.');
      return;
    }

    await deployLocally(editor, 'django', activeDiagramTitle, {
      project_name: djangoProjectName,
      app_name: djangoAppName,
      containerization: useDocker,
    } as DjangoConfig);
  };

  const handleSqlGenerate = async () => {
    await executeGenerator('sql', { dialect: sqlDialect } as SQLConfig);
    setConfigDialog('none');
  };

  const handleSqlAlchemyGenerate = async () => {
    await executeGenerator('sqlalchemy', { dbms: sqlAlchemyDbms } as SQLAlchemyConfig);
    setConfigDialog('none');
  };

  const handleJsonSchemaGenerate = async () => {
    await executeGenerator('jsonschema', { mode: jsonSchemaMode } as JSONSchemaConfig);
    setConfigDialog('none');
  };

  const handleAgentGenerate = async () => {
    const config: AgentConfig = selectedAgentLanguages.length
      ? {
          languages: {
            source: sourceLanguage,
            target: selectedAgentLanguages,
          },
        }
      : {};

    await executeGenerator('agent', config);
    setConfigDialog('none');
  };

  const handleQiskitGenerate = async () => {
    await executeGenerator('qiskit', {
      backend: qiskitBackend,
      shots: Math.max(1, qiskitShots || 1024),
    } as QiskitConfig);
    setConfigDialog('none');
  };

  const handleExport = () => {
    setShowExportDialog(true);
  };

  const handleQualityCheck = async () => {
    if (!currentProject) {
      toast.error('Create or load a project before validating.');
      return;
    }

    if (isQuantumContext || isGuiContext || currentProject.currentDiagramType === 'QuantumCircuitDiagram') {
      toast.error('coming soon');
      return;
    }

    try {
      if (activeDiagram?.model && !isUMLModel(activeDiagram.model)) {
        await validateDiagram(null, activeDiagramTitle, activeDiagram.model);
        return;
      }

      if (editor) {
        await validateDiagram(editor, activeDiagramTitle);
        return;
      }

      toast.error('No diagram available to validate');
    } catch (error) {
      toast.error(`Quality check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <ApollonEditorProvider value={{ editor, setEditor }}>
      <WorkspaceShell
        onOpenProjectHub={() => setShowProjectHub(true)}
        onOpenTemplateDialog={() => setShowTemplateDialog(true)}
        onExportProject={handleExport}
        onGenerate={handleGenerateRequest}
        onQualityCheck={handleQualityCheck}
        showQualityCheck={true}
        generatorMode={generatorMenuMode}
        isGenerating={isGenerating}
      >
        <Routes>
          <Route path="/" element={<ApollonEditorComponent />} />
          <Route path="/graphical-ui-editor" element={<GraphicalUIEditor />} />
          <Route path="/quantum-editor" element={<QuantumEditorComponent />} />
          <Route path="/project-settings" element={<ProjectSettingsPanel />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </WorkspaceShell>

      <ProjectHubDialog open={showProjectHub} onOpenChange={setShowProjectHub} />
      <TemplateLibraryDialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog} />
      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        editor={editor}
        currentDiagramTitle={activeDiagramTitle}
      />
      <GeneratorConfigDialogs
        configDialog={configDialog}
        setConfigDialog={setConfigDialog}
        isLocalEnvironment={isLocalEnvironment}
        djangoProjectName={djangoProjectName}
        djangoAppName={djangoAppName}
        useDocker={useDocker}
        sqlDialect={sqlDialect}
        sqlAlchemyDbms={sqlAlchemyDbms}
        jsonSchemaMode={jsonSchemaMode}
        sourceLanguage={sourceLanguage}
        pendingAgentLanguage={pendingAgentLanguage}
        selectedAgentLanguages={selectedAgentLanguages}
        qiskitBackend={qiskitBackend}
        qiskitShots={qiskitShots}
        onDjangoProjectNameChange={setDjangoProjectName}
        onDjangoAppNameChange={setDjangoAppName}
        onUseDockerChange={setUseDocker}
        onSqlDialectChange={setSqlDialect}
        onSqlAlchemyDbmsChange={setSqlAlchemyDbms}
        onJsonSchemaModeChange={setJsonSchemaMode}
        onSourceLanguageChange={setSourceLanguage}
        onPendingAgentLanguageChange={setPendingAgentLanguage}
        onSelectedAgentLanguagesChange={setSelectedAgentLanguages}
        onQiskitBackendChange={setQiskitBackend}
        onQiskitShotsChange={setQiskitShots}
        onDjangoGenerate={() => void handleDjangoGenerate()}
        onDjangoDeploy={() => void handleDjangoDeploy()}
        onSqlGenerate={() => void handleSqlGenerate()}
        onSqlAlchemyGenerate={() => void handleSqlAlchemyGenerate()}
        onJsonSchemaGenerate={() => void handleJsonSchemaGenerate()}
        onAgentGenerate={() => void handleAgentGenerate()}
        onQiskitGenerate={() => void handleQiskitGenerate()}
      />

      <ErrorPanel />
      <UMLAgentModeling />
      <ToastContainer />
    </ApollonEditorProvider>
  );
}

function AppContent() {
  return (
    <BrowserRouter>
      <AppContentInner />
    </BrowserRouter>
  );
}

export function RoutedApplication() {
  return (
    <PostHogProvider apiKey={POSTHOG_KEY} options={postHogOptions}>
      <ApplicationStore>
        <AppContent />
        <CookieConsentBanner />
      </ApplicationStore>
    </PostHogProvider>
  );
}
