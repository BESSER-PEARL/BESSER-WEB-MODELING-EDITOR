import React, { useState } from 'react';
import styled from 'styled-components';
import { Gate } from './Gate';
import { TOOLBOX_GROUPS, GATES } from '../constants';
import { GateType } from '../types';

const PaletteWrapper = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
`;

const PaletteHeader = styled.div`
  padding: 12px;
  border-bottom: 1px solid var(--quantum-editor-border, #d5dde8);
  background-color: var(--quantum-editor-surface, #f8fafc);
  position: relative;
  z-index: 10;
`;

const PaletteContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background-color: var(--quantum-editor-border, #d5dde8);
    border-radius: 3px;

    &:hover {
      background-color: var(--quantum-editor-muted-text, #64748b);
    }
  }
`;

const GroupContainer = styled.div`
  margin-bottom: 16px;
  
  &:last-child {
    margin-bottom: 0;
  }
`;

const GroupTitle = styled.div`
  font-size: 12px;
  color: var(--quantum-editor-muted-text, #64748b);
  margin-bottom: 5px;
  text-transform: uppercase;
  font-weight: bold;
`;

const GatesGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
`;

const SelectWrapper = styled.div`
  position: relative;
  width: 100%;

  &::after {
    content: '▼';
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 10px;
    color: var(--quantum-editor-muted-text, #64748b);
    pointer-events: none;
  }
`;

const SelectInput = styled.select`
  width: 100%;
  display: flex;
  height: 40px;
  border-radius: 6px;
  border: 1px solid var(--quantum-editor-border, #d5dde8);
  background-color: var(--quantum-editor-bg, #ffffff);
  padding: 8px 12px;
  font-size: 14px;
  font-weight: 500;
  color: var(--quantum-editor-text, #0f172a);
  cursor: pointer;
  transition: all 200ms ease;
  appearance: none;
  padding-right: 32px;

  &:hover {
    border-color: var(--quantum-editor-muted-text, #64748b);
    background-color: var(--quantum-editor-surface, #f8fafc);
  }

  &:focus {
    outline: none;
    border-color: var(--quantum-editor-primary, #0284c7);
    box-shadow: 0 0 0 3px var(--quantum-editor-primary-soft, rgba(2, 132, 199, 0.16));
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
    background-color: var(--quantum-editor-muted-surface, #f1f5f9);
  }

  option {
    padding: 8px 12px;
    color: var(--quantum-editor-text, #0f172a);
    background-color: var(--quantum-editor-bg, #ffffff);

    &:hover {
      background-color: var(--quantum-editor-surface, #f8fafc);
    }

    &:checked {
      background-color: var(--quantum-editor-primary, #0284c7);
      color: #ffffff;
    }
  }
`;

interface GatePaletteProps {
    onDragStart?: (gate: GateType, e: React.MouseEvent) => void;
}

export const GatePalette: React.FC<GatePaletteProps> = ({ onDragStart }) => {
    const [selectedToolbox, setSelectedToolbox] = useState('Toolbox');
    const getGate = (type: string) => GATES.find(g => g.type === type);

    const filteredGroups = TOOLBOX_GROUPS.filter(group => group.toolbox === selectedToolbox);

    return (
        <PaletteWrapper>
            <PaletteHeader>
                {/* Toolbox Select */}
                <SelectWrapper>
                    <SelectInput
                        id="toolbox-select"
                        value={selectedToolbox}
                        onChange={(e) => setSelectedToolbox(e.target.value)}
                    >
                        <option value="Toolbox">Toolbox 1</option>
                        <option value="Toolbox2">Toolbox 2</option>
                    </SelectInput>
                </SelectWrapper>
            </PaletteHeader>

            <PaletteContent>
                {filteredGroups.map(group => (
                    <GroupContainer key={group.name}>
                        <GroupTitle>{group.name}</GroupTitle>
                        <GatesGrid>
                            {group.gates.map(gateType => {
                                const gate = getGate(gateType);
                                if (!gate) return null;
                                return (
                                    <Gate
                                        key={gate.id}
                                        gate={gate}
                                        onMouseDown={(e) => onDragStart && onDragStart(gate.type, e)}
                                    />
                                );
                            })}
                        </GatesGrid>
                    </GroupContainer>
                ))}
            </PaletteContent>
        </PaletteWrapper>
    );
};
