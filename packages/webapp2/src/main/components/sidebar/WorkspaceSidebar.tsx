import React from 'react';
import { UMLDiagramType } from '@besser/wme';
import { ROUTE_ITEMS, UML_ITEMS, SidebarToggleIcon, navButtonClass } from './workspace-navigation';

interface WorkspaceSidebarProps {
  isDarkTheme: boolean;
  isSidebarExpanded: boolean;
  sidebarBaseClass: string;
  sidebarTitleClass: string;
  sidebarDividerClass: string;
  sidebarToggleClass: string;
  sidebarToggleTextClass: string;
  locationPath: string;
  activeUmlType: UMLDiagramType;
  onSwitchUml: (type: UMLDiagramType) => void;
  onNavigate: (path: string) => void;
  onToggleExpanded: () => void;
}

export const WorkspaceSidebar: React.FC<WorkspaceSidebarProps> = ({
  isDarkTheme,
  isSidebarExpanded,
  sidebarBaseClass,
  sidebarTitleClass,
  sidebarDividerClass,
  sidebarToggleClass,
  sidebarToggleTextClass,
  locationPath,
  activeUmlType,
  onSwitchUml,
  onNavigate,
  onToggleExpanded,
}) => {
  return (
    <aside className={`${sidebarBaseClass} ${isSidebarExpanded ? 'w-48' : 'w-[72px]'}`}>
      {isSidebarExpanded && <p className={sidebarTitleClass}>Editors</p>}
      {UML_ITEMS.map((item) => {
        const active = locationPath === '/' && activeUmlType === item.type;
        return (
          <button
            key={item.type}
            type="button"
            className={navButtonClass(active, isSidebarExpanded, isDarkTheme)}
            onClick={() => onSwitchUml(item.type)}
            title={item.label}
          >
            {item.icon}
            {isSidebarExpanded && <span>{item.label}</span>}
          </button>
        );
      })}

      <div className={sidebarDividerClass} />

      {ROUTE_ITEMS.map((item) => {
        const active = locationPath === item.path;
        return (
          <button
            key={item.path}
            type="button"
            className={navButtonClass(active, isSidebarExpanded, isDarkTheme)}
            onClick={() => onNavigate(item.path)}
            title={item.label}
          >
            {item.icon}
            {isSidebarExpanded && <span>{item.label}</span>}
          </button>
        );
      })}

      <button
        type="button"
        onClick={onToggleExpanded}
        className={`${sidebarToggleClass} ${isSidebarExpanded ? 'justify-between gap-2' : 'justify-center'}`}
        title={isSidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        <span className="inline-flex rotate-180">
          <SidebarToggleIcon size={18} />
        </span>
        {isSidebarExpanded && <span className={sidebarToggleTextClass}></span>}
      </button>
    </aside>
  );
};
