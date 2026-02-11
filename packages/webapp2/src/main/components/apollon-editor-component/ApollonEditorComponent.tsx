import { ApollonEditor, UMLModel, diagramBridge } from '@besser/wme';
import React, { useEffect, useRef, useContext, useCallback } from 'react';
import styled from 'styled-components';

import { setCreateNewEditor, updateDiagramThunk, selectCreatenewEditor } from '../../services/diagram/diagramSlice';
import { ApollonEditorContext } from './apollon-editor-context';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { isUMLModel } from '../../types/project';
import { selectCurrentProject } from '../../services/project/projectSlice';

const ApollonContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  overflow: hidden;
  width: 100%;
  height: calc(100vh - var(--app-shell-topbar-height, 60px));
  background-color: var(--apollon-background, #ffffff);
`;

export const ApollonEditorComponent: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<ApollonEditor | null>(null);
  const setupRunRef = useRef(0);
  const dispatch = useAppDispatch();
  const { diagram: reduxDiagram } = useAppSelector((state) => state.diagram);
  const options = useAppSelector((state) => state.diagram.editorOptions);
  const createNewEditor = useAppSelector(selectCreatenewEditor);
  const currentProject = useAppSelector(selectCurrentProject);
  const { setEditor } = useContext(ApollonEditorContext);

  const destroyEditorDeferred = useCallback((editor: ApollonEditor) => {
    return new Promise<void>((resolve) => {
      // Defer destroy to avoid React unmount race warnings during render transitions.
      setTimeout(() => {
        try {
          editor.destroy();
        } catch (error) {
          console.warn('Error destroying editor:', error);
        } finally {
          resolve();
        }
      }, 0);
    });
  }, []);

  // Cleanup function
  const cleanupEditor = useCallback(async () => {
    const editor = editorRef.current;
    editorRef.current = null;
    if (!editor) return;
    await destroyEditorDeferred(editor);
  }, [destroyEditorDeferred]);

  useEffect(() => {
    if (!currentProject) {
      diagramBridge.setStateMachineDiagrams([]);
      diagramBridge.setQuantumCircuitDiagrams([]);
      return;
    }

    const stateMachineDiagram = currentProject.diagrams.StateMachineDiagram;
    const quantumCircuitDiagram = currentProject.diagrams.QuantumCircuitDiagram;

    const stateMachines =
      stateMachineDiagram?.id && stateMachineDiagram?.title
        ? [{ id: stateMachineDiagram.id, name: stateMachineDiagram.title }]
        : [];

    const quantumCircuits =
      quantumCircuitDiagram?.id && quantumCircuitDiagram?.title
        ? [{ id: quantumCircuitDiagram.id, name: quantumCircuitDiagram.title }]
        : [];

    diagramBridge.setStateMachineDiagrams(stateMachines);
    diagramBridge.setQuantumCircuitDiagrams(quantumCircuits);
  }, [currentProject]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setupRunRef.current += 1;
      void cleanupEditor();
      setEditor!(undefined);
    };
  }, [cleanupEditor, setEditor]);

  // Handle editor creation/recreation (initial load + diagram switches/templates)
  useEffect(() => {
    const setupEditor = async () => {
      if (!containerRef.current || !createNewEditor) return;

      const runId = ++setupRunRef.current;

      // Always destroy old editor before creating a new one
      await cleanupEditor();
      if (!containerRef.current || runId !== setupRunRef.current) return;

      const nextEditor = new ApollonEditor(containerRef.current, options);
      editorRef.current = nextEditor;
      await nextEditor.nextRender;
      if (runId !== setupRunRef.current || editorRef.current !== nextEditor) {
        await destroyEditorDeferred(nextEditor);
        return;
      }

      // Load diagram model if available (only UML models)
      if (reduxDiagram?.model && isUMLModel(reduxDiagram.model)) {
        nextEditor.model = reduxDiagram.model;
      }

      // Subscribe to model changes
      nextEditor.subscribeToModelChange((model: UMLModel) => {
        dispatch(updateDiagramThunk({ model }));
      });

      setEditor!(nextEditor);
      dispatch(setCreateNewEditor(false));
    };

    void setupEditor();
  }, [
    createNewEditor,
    cleanupEditor,
    destroyEditorDeferred,
    dispatch,
    options,
    reduxDiagram?.id,
    reduxDiagram?.lastUpdate,
    reduxDiagram?.model,
    setEditor,
  ]);

  return <ApollonContainer ref={containerRef} />;
};
