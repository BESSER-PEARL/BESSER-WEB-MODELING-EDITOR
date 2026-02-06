import { UMLAssociation, IUMLAssociation } from '../../common/uml-association/uml-association';
import { NNRelationshipType } from '../index';
import { DeepPartial } from 'redux';
import { NNElementRegistry } from '../nn-element-registry';

export class NNNext extends UMLAssociation {
  type = NNRelationshipType.NNNext;
  name: string = 'next';

  constructor(values?: DeepPartial<IUMLAssociation>) {
    super(values);
    // Always default to "next" if no name is provided
    if (!values?.name) {
      this.name = 'next';
    }

    // Prevent NNNext connections involving NNContainer or Configuration
    // Throw a plain string (no stack trace capture) to avoid memory overhead
    const sourceId = this.source?.element;
    const targetId = this.target?.element;
    if (NNElementRegistry.isNNContainer(sourceId) || NNElementRegistry.isNNContainer(targetId)) {
      throw 'NNNext cannot connect to NNContainer'; // eslint-disable-line no-throw-literal
    }
    if (NNElementRegistry.isConfiguration(sourceId) || NNElementRegistry.isConfiguration(targetId)) {
      throw 'NNNext cannot connect to Configuration'; // eslint-disable-line no-throw-literal
    }
  }

  serialize() {
    return {
      ...super.serialize(),
      name: this.name || 'next',
    };
  }
}
