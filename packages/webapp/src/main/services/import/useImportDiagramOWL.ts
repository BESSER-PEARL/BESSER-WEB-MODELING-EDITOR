// Import diagram from OWL using backend API
import { toast } from 'react-toastify';
import { useCallback } from 'react';
import { BACKEND_URL } from '../../constant';
import { useAppDispatch } from '../../components/store/hooks';
import { uuid } from '../../utils/uuid';
import { loadImportedDiagram } from '../diagram/diagramSlice';
import { displayError } from '../error-management/errorManagementSlice';
import { ProjectStorageRepository } from '../storage/ProjectStorageRepository';
import { toSupportedDiagramType } from '../../types/project';
import { useBumlToDiagram } from './useBumlToDiagram';

// Hook to import diagram from OWL ontology file
export const useImportDiagramFromOWL = () => {
  const dispatch = useAppDispatch();
  const convertBumlToDiagram = useBumlToDiagram();
  
  const importDiagramFromOWL = useCallback(async (file: File, modelName?: string) => {
    try {
      const formData = new FormData();
      formData.append('owl_file', file);
      
      // Add model name if provided, otherwise backend will use filename
      if (modelName && modelName.trim()) {
        formData.append('model_name', modelName.trim());
      }

      // Call backend endpoint
      const response = await fetch(`${BACKEND_URL}/get-json-model-from-owl`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Could not parse error response' }));
        const errorMsg = errorData.detail || `HTTP error! status: ${response.status}`;
        toast.error(errorMsg);
        throw new Error(errorMsg);
      }

      const data = await response.json();
      
      // Validate diagram JSON structure
      if (!data || !data.model || !data.model.type) {
        throw new Error('Invalid diagram returned from backend');
      }

      // Add to current project
      const currentProject = ProjectStorageRepository.getCurrentProject();
      if (!currentProject) {
        throw new Error('No project is currently open. Please create or open a project first.');
      }
      
      const diagramType = toSupportedDiagramType(data.model.type);
      const newId = uuid();
      const finalTitle = modelName?.trim() || data.title || file.name.replace(/\.(owl|rdf|ttl|n3|nt)$/i, '');
      
      const importedDiagram = {
        ...data,
        id: newId,
        title: finalTitle,
        lastUpdate: new Date().toISOString(),
        description: data.description || `Imported ${diagramType} diagram from OWL ontology`,
      };
      
      const updatedProject = {
        ...currentProject,
        diagrams: {
          ...currentProject.diagrams,
          [diagramType]: {
            id: newId,
            title: importedDiagram.title,
            model: importedDiagram.model,
            lastUpdate: importedDiagram.lastUpdate,
            description: importedDiagram.description,
          }
        }
      };
      
      ProjectStorageRepository.saveProject(updatedProject);
      
      // Load diagram if it's the current diagram type
      if (diagramType === currentProject.currentDiagramType) {
        dispatch(loadImportedDiagram(importedDiagram));
      }
      
      return {
        success: true,
        diagramType,
        diagramTitle: importedDiagram.title,
        message: `${diagramType} diagram imported successfully from OWL ontology and added to project "${currentProject.name}".`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred during import';
      dispatch(displayError('Import failed', `Could not import diagram from OWL ontology: ${errorMessage}`));
      throw error;
    }
  }, [dispatch, convertBumlToDiagram]);
  
  return importDiagramFromOWL;
};