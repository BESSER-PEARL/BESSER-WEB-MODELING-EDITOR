import React, { Component, ComponentType } from 'react';
import { connect } from 'react-redux';
import { compose } from 'redux';
import { ClassRelationshipType } from '../../uml-class-diagram';
import { Button } from '../../../components/controls/button/button';
import { ColorButton } from '../../../components/controls/color-button/color-button';
import { Divider } from '../../../components/controls/divider/divider';
import { Dropdown } from '../../../components/controls/dropdown/dropdown';
import { ExchangeIcon } from '../../../components/controls/icon/exchange';
import { TrashIcon } from '../../../components/controls/icon/trash';
import { Textfield } from '../../../components/controls/textfield/textfield';
import { Body, Header } from '../../../components/controls/typography/typography';
import { I18nContext } from '../../../components/i18n/i18n-context';
import { localized } from '../../../components/i18n/localized';
import { ModelState } from '../../../components/store/model-state';
import { StylePane } from '../../../components/style-pane/style-pane';
import { styled } from '../../../components/theme/styles';
import { UMLElement } from '../../../services/uml-element/uml-element';
import { UMLElementRepository } from '../../../services/uml-element/uml-element-repository';
import { UMLRelationshipRepository } from '../../../services/uml-relationship/uml-relationship-repository';
import { AsyncDispatch } from '../../../utils/actions/actions';
import { UMLAssociation } from '../../common/uml-association/uml-association';
import { NNElementType } from '../index';
import { UMLClassAssociationUpdate } from '../../uml-class-diagram/uml-class-association/uml-class-association-update';
import { UMLRelationship } from '../../../services/uml-relationship/uml-relationship';

type OwnProps = {
  element: UMLAssociation;
};

type StateProps = {
  elements: ModelState['elements'];
};

type DispatchProps = {
  update: typeof UMLElementRepository.update;
  delete: typeof UMLElementRepository.delete;
  flip: typeof UMLRelationshipRepository.flip;
  getById: (id: string) => UMLElement | null;
};

type Props = OwnProps & StateProps & DispatchProps & I18nContext;

const enhance = compose<ComponentType<OwnProps>>(
  localized,
  connect<StateProps, DispatchProps, OwnProps, ModelState>(
    (state) => ({
      elements: state.elements,
    }),
    {
      update: UMLElementRepository.update,
      delete: UMLElementRepository.delete,
      flip: UMLRelationshipRepository.flip,
      getById: UMLElementRepository.getById as any as AsyncDispatch<typeof UMLElementRepository.getById>,
    }
  ),
);

const Flex = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
`;

type State = { colorOpen: boolean };

class NNAssociationComponent extends Component<Props, State> {
  state = { colorOpen: false };

  componentDidMount() {
    this.checkAllNNAssociations();
  }

  componentDidUpdate(prevProps: Readonly<Props>) {
    // Check all associations whenever elements change
    if (prevProps.elements !== this.props.elements) {
      this.checkAllNNAssociations();
    }
  }

  private checkAllNNAssociations() {
    const { elements, update, getById } = this.props;

    // Find all ClassUnidirectional associations and check if they're between NN layers
    Object.values(elements).forEach((elem: any) => {
      if (
        UMLRelationship.isUMLRelationship(elem) &&
        elem.type === ClassRelationshipType.ClassUnidirectional
      ) {
        const source = elem.source && getById(elem.source.element);
        const target = elem.target && getById(elem.target.element);

        if (source && target && this.isNNLayer(source) && this.isNNLayer(target)) {
          // Only update if name is not already "next" to avoid infinite loops
          if (elem.name !== 'next') {
            update(elem.id, { name: 'next' });
          }
        }
      }
    });
  }

  private toggleColor = () => {
    this.setState((state) => ({
      colorOpen: !state.colorOpen,
    }));
  };

  private isNNLayer(element: UMLElement): boolean {
    return (
      element.type === NNElementType.Conv1DLayer ||
      element.type === NNElementType.Conv2DLayer ||
      element.type === NNElementType.Conv3DLayer
    );
  }

  render() {
    const { element, getById } = this.props;
    const source = element.source && getById(element.source.element);
    const target = element.target && getById(element.target.element);
    if (!source || !target) return null;

    // If both are NN layers, return an empty div (no editing panel visible, but component still mounts)
    if (this.isNNLayer(source) && this.isNNLayer(target)) {
      return <div style={{ display: 'none' }} />;
    }

    // Otherwise, use the default class association update
    return <UMLClassAssociationUpdate element={element} />;
  }

  // Old render code below is now unused but kept for reference
  renderOldPanel() {
    const { element, getById } = this.props;
    const source = element.source && getById(element.source.element);
    const target = element.target && getById(element.target.element);
    if (!source || !target) return null;

    return (
      <div>
        <section>
          <Flex>
            <Header gutter={false} style={{ flexGrow: 1 }}>
              {this.props.translate('popup.association')}
            </Header>
            <ColorButton onClick={this.toggleColor} />
            <Button color="link" onClick={() => this.props.flip(element.id)}>
              <ExchangeIcon />
            </Button>
            <Button color="link" onClick={() => this.props.delete(element.id)}>
              <TrashIcon />
            </Button>
          </Flex>
          <StylePane
            open={this.state.colorOpen}
            element={element}
            onColorChange={this.props.update}
            lineColor
            textColor
          />
          <Divider />
        </section>
        <section>
          <Flex>
            <Body style={{ marginRight: '0.5em' }}>{this.props.translate('popup.name')}</Body>
            <Textfield
              value={element.name}
              onChange={(value) => this.props.update(element.id, { name: value })}
              placeholder="next"
            />
          </Flex>
          <Divider />
        </section>
        <section>
          <Dropdown value={element.type as keyof typeof ClassRelationshipType} onChange={this.onChange}>
            <Dropdown.Item value={ClassRelationshipType.ClassUnidirectional}>
              {this.props.translate('packages.ClassDiagram.ClassUnidirectional')}
            </Dropdown.Item>
          </Dropdown>
          <Divider />
        </section>
        <section>
          <Header>{source.name}</Header>
          <Flex>
            <Body style={{ marginRight: '0.5em' }}>{this.props.translate('popup.multiplicity')}</Body>
            <Textfield
              style={{ minWidth: 0 }}
              gutter
              value={element.source.multiplicity}
              onChange={this.onUpdate('multiplicity', 'source')}
              autoFocus
              placeholder={`1..1`}
            />
          </Flex>
          <Flex>
            <Body style={{ marginRight: '0.5em' }}>{this.props.translate('popup.role')}</Body>
            <Textfield value={element.source.role} onChange={this.onUpdate('role', 'source')} />
          </Flex>
          <Divider />
        </section>
        <section>
          <Header>{target.name}</Header>
          <Flex>
            <Body style={{ marginRight: '0.5em' }}>{this.props.translate('popup.multiplicity')}</Body>
            <Textfield
              style={{ minWidth: 0 }}
              gutter
              value={element.target.multiplicity}
              onChange={this.onUpdate('multiplicity', 'target')}
              placeholder={`1..1`}
            />
          </Flex>
          <Flex>
            <Body style={{ marginRight: '0.5em' }}>{this.props.translate('popup.role')}</Body>
            <Textfield value={element.target.role} onChange={this.onUpdate('role', 'target')} />
          </Flex>
        </section>
      </div>
    );
  }

  private onChange = (type: keyof typeof ClassRelationshipType) => {
    const { element, update } = this.props;
    update(element.id, { type });
  };

  private onUpdate = (type: 'multiplicity' | 'role', end: 'source' | 'target') => (value: string) => {
    const { element, update } = this.props;
    update<UMLAssociation>(element.id, { [end]: { ...element[end], [type]: value } });
  };
}

export const NNAssociationUpdate = enhance(NNAssociationComponent);
