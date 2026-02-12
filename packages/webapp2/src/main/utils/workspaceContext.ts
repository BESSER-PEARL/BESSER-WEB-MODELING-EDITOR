import type { GeneratorMenuMode } from '../components/sidebar/workspace-types';

interface WorkspaceContext {
  isQuantumContext: boolean;
  isGuiContext: boolean;
  isClassContext: boolean;
  isAgentContext: boolean;
  isDeploymentAvailable: boolean;
  generatorMenuMode: GeneratorMenuMode;
}

export const getWorkspaceContext = (pathname: string, currentDiagramType?: string): WorkspaceContext => {
  const isQuantumContext = pathname === '/quantum-editor' || currentDiagramType === 'QuantumCircuitDiagram';
  const isGuiContext = pathname === '/graphical-ui-editor' || currentDiagramType === 'GUINoCodeDiagram';
  const isClassContext = pathname === '/' && currentDiagramType === 'ClassDiagram';
  const isAgentContext = pathname === '/' && currentDiagramType === 'AgentDiagram';

  const generatorMenuMode: GeneratorMenuMode = isQuantumContext
    ? 'quantum'
    : isGuiContext
      ? 'gui'
      : isAgentContext
        ? 'agent'
        : isClassContext
          ? 'class'
          : 'none';

  return {
    isQuantumContext,
    isGuiContext,
    isClassContext,
    isAgentContext,
    isDeploymentAvailable: isGuiContext || isClassContext,
    generatorMenuMode,
  };
};
