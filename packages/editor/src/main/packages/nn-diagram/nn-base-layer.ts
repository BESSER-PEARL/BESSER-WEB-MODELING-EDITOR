import { UMLClass } from '../uml-class-diagram/uml-class/uml-class';
import { ILayer } from '../../services/layouter/layer';
import { ILayoutable } from '../../services/layouter/layoutable';
import { UMLClassifierAttribute } from '../common/uml-classifier/uml-classifier-attribute';
import { UMLClassifierMethod } from '../common/uml-classifier/uml-classifier-method';
import { UMLClassifierMember } from '../common/uml-classifier/uml-classifier-member';
import { Text } from '../../utils/svg/text';

/**
 * Base class for all NN layer elements.
 * Overrides the render method to exclude optional attributes (isMandatory === false)
 * from height calculation, while keeping them in state for persistence.
 */
export abstract class NNBaseLayer extends UMLClass {
  render(layer: ILayer, children: ILayoutable[] = []): ILayoutable[] {
    const attributes = children.filter((x): x is UMLClassifierAttribute => x instanceof UMLClassifierAttribute);
    const methods = children.filter((x): x is UMLClassifierMethod => x instanceof UMLClassifierMethod);

    // Filter attributes for display: exclude optional attributes (isMandatory === false)
    // Attributes without isMandatory property or with isMandatory === true are included
    const displayAttributes = attributes.filter((attr) => {
      if ('isMandatory' in attr && (attr as any).isMandatory === false) {
        return false;
      }
      return true;
    });

    this.hasAttributes = displayAttributes.length > 0;
    this.hasMethods = methods.length > 0;
    const radix = 10;
    this.bounds.width = [this, ...displayAttributes, ...methods].reduce(
      (current, child, index) => {
        const displayText = child instanceof UMLClassifierMember
          ? (this.stereotype === 'enumeration' ? child.name : child.displayName)
          : child.name;
        return Math.max(
          current,
          Math.round(
            (Text.size(layer, displayText, index === 0 ? { fontWeight: 'bold' } : undefined).width + 20) / radix,
          ) * radix,
        );
      },
      Math.round(this.bounds.width / radix) * radix,
    );
    if (this.className) {
      const text = this.name + (this.className ? ": " + this.className : "");
      const textWidth = Text.size(layer, text).width + 40;
      this.bounds.width = Math.max(this.bounds.width, textWidth, 50);
    }

    let y = this.headerHeight;
    for (const attribute of displayAttributes) {
      attribute.bounds.x = 0.5;
      attribute.bounds.y = y + 0.5;
      attribute.bounds.width = this.bounds.width - 1;
      y += attribute.bounds.height;
    }
    this.deviderPosition = y;
    for (const method of methods) {
      method.bounds.x = 0.5;
      method.bounds.y = y + 0.5;
      method.bounds.width = this.bounds.width - 1;
      y += method.bounds.height;
    }

    this.bounds.height = y;
    return [this, ...displayAttributes, ...methods];
  }
}
