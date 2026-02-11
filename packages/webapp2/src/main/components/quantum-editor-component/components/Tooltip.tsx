import React, { createContext, useContext, useState, ReactNode } from 'react';
import styled from 'styled-components';

interface TooltipData {
    visible: boolean;
    x: number;
    y: number;
    title: string;
    description: string;
}

interface TooltipContextType {
    showTooltip: (x: number, y: number, title: string, description: string) => void;
    hideTooltip: () => void;
}

const TooltipContext = createContext<TooltipContextType | undefined>(undefined);

const TooltipCard = styled.div`
    position: fixed;
    padding: 8px;
    border-radius: 6px;
    border: 1px solid var(--quantum-editor-border, #d5dde8);
    background-color: var(--quantum-editor-surface, #f8fafc);
    color: var(--quantum-editor-text, #0f172a);
    box-shadow: var(--quantum-editor-tooltip-shadow, 0 12px 28px rgba(2, 6, 23, 0.18));
    z-index: 1000;
    pointer-events: none;
    max-width: 300px;
`;

const TooltipTitle = styled.div`
    font-weight: 700;
    margin-bottom: 4px;
`;

const TooltipDescription = styled.div`
    font-size: 12px;
    color: var(--quantum-editor-muted-text, #64748b);
`;

export const useTooltip = () => {
    const context = useContext(TooltipContext);
    if (!context) {
        throw new Error('useTooltip must be used within a TooltipProvider');
    }
    return context;
};

export const TooltipProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [tooltip, setTooltip] = useState<TooltipData>({
        visible: false,
        x: 0,
        y: 0,
        title: '',
        description: ''
    });

    const showTooltip = (x: number, y: number, title: string, description: string) => {
        setTooltip({ visible: true, x, y, title, description });
    };

    const hideTooltip = () => {
        setTooltip(prev => ({ ...prev, visible: false }));
    };

    return (
        <TooltipContext.Provider value={{ showTooltip, hideTooltip }}>
            {children}
            {tooltip.visible && (
                <TooltipCard
                    style={{
                        left: tooltip.x + 15,
                        top: tooltip.y + 15,
                    }}
                >
                    <TooltipTitle>{tooltip.title}</TooltipTitle>
                    <TooltipDescription>{tooltip.description}</TooltipDescription>
                </TooltipCard>
            )}
        </TooltipContext.Provider>
    );
};
