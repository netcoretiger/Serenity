﻿import { notifyError } from "@serenity-is/base";
import { Decorators } from "../../decorators";
import { findElementWithRelativeId } from "../../q";
import { Widget } from "../widgets/widget";
import { tryGetWidget } from "../widgets/widgetutils";

@Decorators.registerClass('Serenity.CascadedWidgetLink')
export class CascadedWidgetLink<TParent extends Widget<any>> {

    constructor(private parentType: { new(...args: any[]): TParent },
        private widget: Widget<any>,
        private parentChange: (p1: TParent) => void) {
        this.bind();
        this.widget.element.bind('remove.' + (widget as any).uniqueName + 'cwh', e => {
            this.unbind();
            this.widget = null;
            this.parentChange = null;
        });
    }

    private _parentID: string;

    bind() {

        if (!this._parentID) {
            return null;
        }

        var parent = tryGetWidget(findElementWithRelativeId(this.widget.domNode, this._parentID), this.parentType);

        if (parent != null) {
            parent.element.bind('change.' + (this.widget as any).uniqueName, () => {
                this.parentChange(parent);
            });
            return parent;
        }
        else {
            notifyError("Can't find cascaded parent element with ID: " + this._parentID + '!', '', null);
            return null;
        }
    }

    unbind() {

        if (!this._parentID) {
            return null;
        }

        var parent = tryGetWidget(findElementWithRelativeId(this.widget.domNode, this._parentID), this.parentType);

        if (parent != null) {
            parent.element.unbind('.' + (this.widget as any).uniqueName);
        }

        return parent;
    }

    get_parentID() {
        return this._parentID;
    }

    set_parentID(value: string) {

        if (this._parentID !== value) {
            this.unbind();
            this._parentID = value;
            this.bind();
        }
    }
}
