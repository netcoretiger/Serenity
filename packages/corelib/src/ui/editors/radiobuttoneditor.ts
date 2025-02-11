﻿import sQuery from "@optionaldeps/squery";
import { Enum, tryGetText } from "@serenity-is/base";
import { Decorators, EnumKeyAttribute } from "../../decorators";
import { IReadOnly, IStringValue } from "../../interfaces";
import { getAttributes, getLookup } from "../../q";
import { EnumTypeRegistry } from "../../types/enumtyperegistry";
import { EditorWidget, EditorProps } from "../widgets/widget";

export interface RadioButtonEditorOptions {
    enumKey?: string;
    enumType?: any;
    lookupKey?: string;
}

@Decorators.registerEditor('Serenity.RadioButtonEditor', [IStringValue, IReadOnly])
@Decorators.element('<div/>')
export class RadioButtonEditor<P extends RadioButtonEditorOptions = RadioButtonEditorOptions> extends EditorWidget<P>
    implements IReadOnly {

    constructor(props: EditorProps<P>) {
        super(props);

        if (!this.options.enumKey &&
            this.options.enumType == null &&
            !this.options.lookupKey) {
            return;
        }

        if (this.options.lookupKey) {
            var lookup = getLookup(this.options.lookupKey);
            for (var item of lookup.items) {
                var textValue = (item as any)[lookup.textField];
                var text = (textValue == null ? '' : textValue.toString());
                var idValue = (item as any)[lookup.idField];
                var id = (idValue == null ? '' : idValue.toString());
                this.addRadio(id, text);
            }
        }
        else {
            var enumType = this.options.enumType || EnumTypeRegistry.get(this.options.enumKey);
            var enumKey = this.options.enumKey;
            if (enumKey == null && enumType != null) {
                var enumKeyAttr = getAttributes(enumType, EnumKeyAttribute, false);
                if (enumKeyAttr.length > 0) {
                    enumKey = enumKeyAttr[0].value;
                }
            }

            var values = Enum.getValues(enumType);
            for (var x of values) {
                var name = Enum.toString(enumType, x);
                this.addRadio(x.toString(), tryGetText(
                    'Enums.' + enumKey + '.' + name) ?? name);
            }
        }
    }

    protected addRadio(value: string, text: string) {
        var label = sQuery('<label/>').text(text);
        sQuery('<input type="radio"/>').attr('name', this.uniqueName)
            .attr('id', this.uniqueName + '_' + value)
            .attr('value', value).prependTo(label);
        label.appendTo(this.domNode);
    }

    get_value(): string {
        return sQuery(this.domNode).find('input:checked').first().val() as string;
    }

    get value(): string {
        return this.get_value();
    }

    set_value(value: string): void {
        if (value !== this.get_value()) {
            var inputs = sQuery(this.domNode).find('input');
            var checks = inputs.filter(':checked');
            if (checks.length > 0) {
                (checks[0] as HTMLInputElement).checked = false;
            }
            if (value) {
                checks = inputs.filter('[value=' + value + ']');
                if (checks.length > 0) {
                    (checks[0] as HTMLInputElement).checked = true;
                }
            }
        }
    }

    set value(v: string) {
        this.set_value(v);
    }

    get_readOnly(): boolean {
        return this.domNode.getAttribute("disabled") != null;
    }

    set_readOnly(value: boolean): void {
        if (this.get_readOnly() !== value) {
            if (value) {
                sQuery(this.domNode).attr('disabled', 'disabled')
                    .find('input').attr('disabled', 'disabled');
            }
            else {
                sQuery(this.domNode).removeAttr('disabled')
                    .find('input').removeAttr('disabled');
            }
        }
    }

}