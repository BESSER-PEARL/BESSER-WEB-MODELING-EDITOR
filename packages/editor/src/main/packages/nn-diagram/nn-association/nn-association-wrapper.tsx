import React, { FunctionComponent } from 'react';
import { connect } from 'react-redux';
import { ModelState } from '../../../components/store/model-state';
import { UMLAssociation } from '../../common/uml-association/uml-association';
import { UMLAssociationComponent } from '../../common/uml-association/uml-association-component';
import { NNAssociationComponent } from './nn-association-component';
import { NNElementType } from '../index';
import { ClassRelationshipType } from '../../uml-class-diagram';

interface OwnProps {
  element: UMLAssociation;
}

interface StateProps {
  elements: ModelState['elements'];
}

type Props = OwnProps & StateProps;

const NNAssociationWrapperComponent: FunctionComponent<Props> = ({ element, elements }) => {
  // Check if this is a ClassUnidirectional association
  if (element.type !== ClassRelationshipType.ClassUnidirectional) {
    return <UMLAssociationComponent element={element} />;
  }

  // Get source and target elements
  const source = element.source && elements[element.source.element];
  const target = element.target && elements[element.target.element];

  // Check if both are NN layers
  const isNNLayer = (type: string) => {
    return (
      type === NNElementType.Conv1DLayer ||
      type === NNElementType.Conv2DLayer ||
      type === NNElementType.Conv3DLayer
    );
  };

  // If both source and target are NN layers, use custom NN component
  if (source && target && isNNLayer(source.type) && isNNLayer(target.type)) {
    return <NNAssociationComponent element={element} />;
  }

  // Otherwise, use default association component
  return <UMLAssociationComponent element={element} />;
};

export const NNAssociationWrapper = connect<StateProps, {}, OwnProps, ModelState>(
  (state) => ({
    elements: state.elements,
  })
)(NNAssociationWrapperComponent);
