import { BesserProject, ProjectDiagram, SupportedDiagramType } from '../../types/project';
import { normalizeProjectName } from '../../utils/projectName';

export type ExportableProjectPayload = Omit<BesserProject, 'diagrams'> & {
  diagrams: Record<string, ProjectDiagram>;
};

export const buildExportableProjectPayload = (
  project: BesserProject,
  selectedDiagramTypes?: SupportedDiagramType[]
): ExportableProjectPayload => {
  const projectClone = JSON.parse(JSON.stringify(project)) as ExportableProjectPayload;
  projectClone.name = normalizeProjectName(projectClone.name || 'project');

  if (!selectedDiagramTypes || selectedDiagramTypes.length === 0) {
    return projectClone;
  }

  const filteredDiagrams: Record<string, ProjectDiagram> = {};

  selectedDiagramTypes.forEach((diagramType) => {
    const diagram = projectClone.diagrams[diagramType];
    if (diagram) {
      filteredDiagrams[diagramType] = diagram;
    }
  });

  projectClone.diagrams = filteredDiagrams;

  return projectClone;
};
