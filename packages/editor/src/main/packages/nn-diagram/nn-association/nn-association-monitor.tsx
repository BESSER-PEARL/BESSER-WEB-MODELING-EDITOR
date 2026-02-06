import { Component } from 'react';
import { connect } from 'react-redux';
import { ModelState } from '../../../components/store/model-state';
import { UMLElementRepository } from '../../../services/uml-element/uml-element-repository';
import { ClassRelationshipType } from '../../uml-class-diagram';
import { NNElementType } from '../index';
import { UMLRelationship } from '../../../services/uml-relationship/uml-relationship';

type StateProps = {
  elements: ModelState['elements'];
};

type DispatchProps = {
  update: typeof UMLElementRepository.update;
  getById: (id: string) => any;
};

type Props = StateProps & DispatchProps;

class NNAssociationMonitorComponent extends Component<Props> {
  componentDidMount() {
    this.checkAndUpdateAssociations();
  }

  componentDidUpdate(prevProps: Readonly<Props>) {
    // Check if elements changed
    if (prevProps.elements !== this.props.elements) {
      this.checkAndUpdateAssociations();
    }
  }

  private isNNLayer(type: string): boolean {
    return (
      type === NNElementType.Conv1DLayer ||
      type === NNElementType.Conv2DLayer ||
      type === NNElementType.Conv3DLayer
    );
  }

  private checkAndUpdateAssociations() {
    const { elements, update, getById } = this.props;

    // Find all ClassUnidirectional associations
    Object.values(elements).forEach((element: any) => {
      if (
        UMLRelationship.isUMLRelationship(element) &&
        element.type === ClassRelationshipType.ClassUnidirectional
      ) {
        const source = element.source && getById(element.source.element);
        const target = element.target && getById(element.target.element);

        // Check if both are NN layers
        if (source && target && this.isNNLayer(source.type) && this.isNNLayer(target.type)) {
          // Set name to "next" if it's not already
          if (element.name !== 'next') {
            update(element.id, { name: 'next' });
          }
        }
      }
    });
  }

  render() {
    return null; // This component doesn't render anything
  }
}

export const NNAssociationMonitor = connect<StateProps, DispatchProps, {}, ModelState>(
  (state) => ({
    elements: state.elements,
  }),
  {
    update: UMLElementRepository.update,
    getById: UMLElementRepository.getById as any,
  }
)(NNAssociationMonitorComponent);
