import React, { FunctionComponent } from 'react';
import { UMLAssociation } from '../../common/uml-association/uml-association';
import { ThemedPathContrast, ThemedPolyline } from '../../../components/theme/themedComponents';
import { NNElementRegistry } from '../nn-element-registry';

const RhombusFilled = (id: string, color?: string) => (
  <marker
    id={id}
    viewBox="0 0 30 30"
    markerWidth="30"
    markerHeight="30"
    refX="30"
    refY="15"
    orient="auto"
    markerUnits="strokeWidth"
  >
    <ThemedPathContrast d="M0,15 L15,22 L30,15 L15,8 z" fillColor={color} />
  </marker>
);

export const NNCompositionComponent: FunctionComponent<Props> = ({ element }) => {
  const id = `marker-${element.id}`;
  const sourceIsContainer = NNElementRegistry.isNNContainer(element.source?.element);

  // Reverse the path when NNContainer is the source so the diamond (markerEnd) is at NNContainer
  const path = sourceIsContainer ? [...element.path].reverse() : element.path;

  return (
    <g>
      {RhombusFilled(id, element.strokeColor)}
      <ThemedPolyline
        points={path.map((point) => `${point.x} ${point.y}`).join(',')}
        strokeColor={element.strokeColor}
        fillColor="none"
        strokeWidth={1}
        markerEnd={`url(#${id})`}
      />
    </g>
  );
};

interface Props {
  element: UMLAssociation;
}
