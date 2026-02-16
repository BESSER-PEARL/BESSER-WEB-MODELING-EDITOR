import React, { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { PostHogProvider } from 'posthog-js/react';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

import { ApollonEditor } from '@besser/wme';
import {
  POSTHOG_HOST,
  POSTHOG_KEY,
  BACKEND_URL,
} from './constant';
import { ApollonEditorProvider } from './components/apollon-editor-component/apollon-editor-context';
import { ApollonEditorComponent } from './components/apollon-editor-component/ApollonEditorComponent';
import { GraphicalUIEditor } from './components/grapesjs-editor';
import { QuantumEditorComponent } from './components/quantum-editor-component/QuantumEditorComponent';
import { ErrorPanel } from './components/error-handling/error-panel';
import { UMLAgentModeling } from './components/uml-agent-widget/UMLAgentModeling';
import { CookieConsentBanner, hasUserConsented } from './components/cookie-consent/CookieConsentBanner';
import { ApplicationStore } from './store/application-store';
import { useAppDispatch } from './store/hooks';
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
import type { GenerationResult } from './services/generate-code/types';
import { useDeployLocally } from './services/generate-code/useDeployLocally';
import { WorkspaceShell, GeneratorType } from './components/sidebar/WorkspaceShell';
import { ProjectHubDialog } from './components/home/ProjectHubDialog';
import { ProjectSettingsPanel } from './components/project/ProjectSettingsPanel';
import { TemplateLibraryDialog } from './components/modals/TemplateLibraryDialog';
import { ExportDialog } from './components/modals/ExportDialog';
import { GeneratorConfigDialogs } from './components/modals/generator-config/GeneratorConfigDialogs';
import { GrapesJSProjectData, isUMLModel } from './types/project';
import { ProjectStorageRepository } from './services/storage/ProjectStorageRepository';
import { switchDiagramTypeThunk } from './services/project/projectSlice';
import { validateDiagram } from './services/validation/validateDiagram';
import { ConfigDialog, getConfigDialogForGenerator } from './services/generate-code/generator-dialog-config';
import { useProjectBootstrap } from './hooks/useProjectBootstrap';
import { getWorkspaceContext } from './utils/workspaceContext';

const postHogOptions = {
  api_host: POSTHOG_HOST,
  autocapture: false,
  disable_session_recording: true,
  respect_dnt: true,
  opt_out_capturing_by_default: !hasUserConsented(),
  persistence: (hasUserConsented() ? 'localStorage+cookie' : 'memory') as 'localStorage+cookie' | 'memory',
  ip: false,
};

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
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
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
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const { currentProject, loadProject } = useProject();
  const generateCode = useGenerateCode();
  const deployLocally = useDeployLocally();
  const loadProjectForBootstrap = useCallback(
    async (projectId: string): Promise<void> => {
      await loadProject(projectId);
    },
    [loadProject],
  );
  const { showProjectHub, setShowProjectHub } = useProjectBootstrap({
    currentProject,
    loadProject: loadProjectForBootstrap,
    pathname: location.pathname,
  });
  const { isQuantumContext, isGuiContext, generatorMenuMode } = getWorkspaceContext(
    location.pathname,
    currentProject?.currentDiagramType,
  );

  const isLocalEnvironment =
    !BACKEND_URL || BACKEND_URL.includes('localhost') || BACKEND_URL.includes('127.0.0.1');

  const activeDiagram = currentProject ? currentProject.diagrams[currentProject.currentDiagramType] : undefined;
  const activeDiagramTitle = activeDiagram?.title || currentProject?.name || 'Diagram';

  const waitForGuiEditorReady = (timeoutMs: number = 12000): Promise<boolean> => {
    if (typeof window === 'undefined') {
      return Promise.resolve(false);
    }

    if ((window as any).__WME_GUI_EDITOR_READY__) {
      return Promise.resolve(true);
    }

    return new Promise((resolve) => {
      let done = false;
      const finish = (value: boolean) => {
        if (done) return;
        done = true;
        window.removeEventListener('wme:gui-editor-ready', onReady as EventListener);
        clearTimeout(timeoutId);
        resolve(value);
      };

      const onReady = () => finish(true);
      const timeoutId = window.setTimeout(() => finish(false), timeoutMs);
      window.addEventListener('wme:gui-editor-ready', onReady as EventListener);
    });
  };

  const triggerAssistantGuiAutoGenerate = (timeoutMs: number = 25000): Promise<{ ok: boolean; error?: string }> => {
    if (typeof window === 'undefined') {
      return Promise.resolve({ ok: false, error: 'Window is not available.' });
    }

    return new Promise((resolve) => {
      let done = false;
      const finish = (result: { ok: boolean; error?: string }) => {
        if (done) return;
        done = true;
        window.removeEventListener('wme:assistant-auto-generate-gui-done', onDone as EventListener);
        clearTimeout(timeoutId);
        resolve(result);
      };

      const onDone = (event: Event) => {
        const detail = (event as CustomEvent<{ ok?: boolean; error?: string }>).detail || {};
        finish({
          ok: Boolean(detail.ok),
          error: detail.ok ? undefined : (detail.error || 'Auto-generation failed.'),
        });
      };

      const timeoutId = window.setTimeout(
        () => finish({ ok: false, error: 'Timed out while auto-generating GUI.' }),
        timeoutMs,
      );

      window.addEventListener('wme:assistant-auto-generate-gui-done', onDone as EventListener);
      window.dispatchEvent(new CustomEvent('wme:assistant-auto-generate-gui'));
    });
  };

  const ensureGuiForAssistantWebAppGeneration = async (): Promise<GenerationResult | null> => {
    if (!currentProject) {
      return { ok: false, error: 'Create or load a project before generating code.' };
    }

    try {
      await dispatch(switchDiagramTypeThunk({ diagramType: 'GUINoCodeDiagram' })).unwrap();
    } catch {
      return { ok: false, error: 'Could not switch to GUI diagram for auto-generation.' };
    }

    if (location.pathname !== '/graphical-ui-editor') {
      navigate('/graphical-ui-editor');
    }

    const ready = await waitForGuiEditorReady(12000);
    if (!ready) {
      return { ok: false, error: 'GUI editor did not become ready in time.' };
    }

    const autoGenerateResult = await triggerAssistantGuiAutoGenerate(30000);
    if (!autoGenerateResult.ok) {
      return { ok: false, error: autoGenerateResult.error || 'Could not auto-generate GUI from Class Diagram.' };
    }

    await new Promise((resolve) => setTimeout(resolve, 150));
    return null;
  };

  useEffect(() => {
    if (!currentProject) {
      return;
    }

    const projectName = toIdentifier(currentProject.name || 'besser_project', 'besser_project');
    const appName = toIdentifier(activeDiagram?.title || 'core_app', 'core_app');
    setDjangoProjectName(projectName);
    setDjangoAppName(appName === projectName ? `${appName}_app` : appName);
  }, [currentProject?.id, currentProject?.name, activeDiagram?.title]);

  const executeGenerator = async (
    generatorType: GeneratorType,
    config?: unknown,
    options?: { autoGenerateGuiIfEmpty?: boolean },
  ): Promise<GenerationResult> => {
    if (!currentProject) {
      toast.error('Create or load a project before generating code.');
      return { ok: false, error: 'Create or load a project before generating code.' };
    }

    try {
      setIsGenerating(true);

      if (generatorType === 'web_app') {
        let guiModel = currentProject.diagrams.GUINoCodeDiagram.model as GrapesJSProjectData | undefined;

        if (isGuiModelEmpty(guiModel)) {
          if (options?.autoGenerateGuiIfEmpty) {
            const autoGenerateError = await ensureGuiForAssistantWebAppGeneration();
            if (autoGenerateError) {
              toast.error(autoGenerateError.error);
              return autoGenerateError;
            }
            const refreshedProject = ProjectStorageRepository.loadProject(currentProject.id) || currentProject;
            guiModel = refreshedProject.diagrams.GUINoCodeDiagram.model as GrapesJSProjectData | undefined;
          }

          if (isGuiModelEmpty(guiModel)) {
            toast.error('Cannot generate web application: GUI diagram is empty.');
            return { ok: false, error: 'Cannot generate web application: GUI diagram is empty.' };
          }
        }

        return await generateCode(null, 'web_app', activeDiagramTitle, config as any);
      }

      if (generatorType === 'qiskit') {
        if (!isQuantumContext) {
          toast.error('Open the Quantum editor before generating Qiskit code.');
          return { ok: false, error: 'Open the Quantum editor before generating Qiskit code.' };
        }

        return await generateCode(
          null,
          'qiskit',
          activeDiagramTitle,
          (config as QiskitConfig) ?? { backend: 'aer_simulator', shots: 1024 },
        );
      }

      if (isQuantumContext || isGuiContext) {
        toast.error('Switch to a UML diagram to use this generator.');
        return { ok: false, error: 'Switch to a UML diagram to use this generator.' };
      }

      if (!editor) {
        toast.error('No UML editor instance available. Open a UML diagram first.');
        return { ok: false, error: 'No UML editor instance available. Open a UML diagram first.' };
      }

      let result: GenerationResult = { ok: false, error: 'Generation was not executed.' };
      switch (generatorType) {
        case 'smartdata':
          result = await generateCode(editor, 'jsonschema', activeDiagramTitle, { mode: 'smart_data' });
          break;
        case 'django':
          result = await generateCode(editor, 'django', activeDiagramTitle, config as DjangoConfig);
          break;
        case 'sql':
          result = await generateCode(editor, 'sql', activeDiagramTitle, config as SQLConfig);
          break;
        case 'sqlalchemy':
          result = await generateCode(editor, 'sqlalchemy', activeDiagramTitle, config as SQLAlchemyConfig);
          break;
        case 'jsonschema':
          result = await generateCode(editor, 'jsonschema', activeDiagramTitle, config as JSONSchemaConfig);
          break;
        case 'agent':
          result = await generateCode(editor, 'agent', activeDiagramTitle, config as AgentConfig);
          break;
        default:
          result = await generateCode(editor, generatorType, activeDiagramTitle, config as any);
      }
      return result;
    } catch (error) {
      const errorMessage = `Generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      toast.error(errorMessage);
      return { ok: false, error: errorMessage };
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

  const handleAssistantGenerate = async (generatorType: GeneratorType, config?: unknown): Promise<GenerationResult> => {
    return executeGenerator(generatorType, config, { autoGenerateGuiIfEmpty: generatorType === 'web_app' });
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
        onAssistantGenerate={handleAssistantGenerate}
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
      <UMLAgentModeling onAssistantGenerate={handleAssistantGenerate} />
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

