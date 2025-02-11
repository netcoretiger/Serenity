﻿import sQuery from "@optionaldeps/squery";
import { Decorators } from "../../decorators";
import { IBooleanValue } from "../../interfaces";
import { EditorWidget } from "../widgets/widget";

@Decorators.registerEditor('Serenity.BooleanEditor', [IBooleanValue])
@Decorators.element('<input type="checkbox"/>')
export class BooleanEditor<P = {}> extends EditorWidget<P> {

    public get value(): boolean {
        return sQuery(this.domNode).is(":checked");
    }

    protected get_value(): boolean {
        return this.value;
    }

    public set value(value: boolean) {
        sQuery(this.domNode).prop("checked", !!value);
    }

    protected set_value(value: boolean): void {
        this.value = value;
    }
}
