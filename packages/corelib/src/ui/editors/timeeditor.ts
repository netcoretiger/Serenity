﻿import sQuery from "@optionaldeps/squery";
import { toId } from "@serenity-is/base";
import { Decorators } from "../../decorators";
import { IDoubleValue, IReadOnly } from "../../interfaces";
import { addOption } from "../../q";
import { EditorWidget, EditorProps } from "../widgets/widget";
import { EditorUtils } from "./editorutils";

export interface TimeEditorOptions {
    noEmptyOption?: boolean;
    startHour?: any;
    endHour?: any;
    intervalMinutes?: any;
}

@Decorators.registerEditor('Serenity.TimeEditor', [IDoubleValue, IReadOnly])
@Decorators.element("<select />")
export class TimeEditor<P extends TimeEditorOptions = TimeEditorOptions> extends EditorWidget<P> {

    private minutes: JQuery;

    constructor(props: EditorProps<P>) {
        super(props);
        
        let input = sQuery(this.domNode);
        input.addClass('editor s-TimeEditor hour');

        if (!this.options.noEmptyOption) {
            addOption(input, '', '--');
        }

        for (var h = (this.options.startHour || 0); h <= (this.options.endHour || 23); h++) {
            addOption(input, h.toString(), ((h < 10) ? ('0' + h) : h.toString()));
        }

        this.minutes = sQuery('<select/>').addClass('editor s-TimeEditor minute').insertAfter(input);
        this.minutes.change(() => sQuery(this.domNode).trigger("change"));

        for (var m = 0; m <= 59; m += (this.options.intervalMinutes || 5)) {
            addOption(this.minutes, m.toString(), ((m < 10) ? ('0' + m) : m.toString()));
        }
    }

    public get value(): number {
        var hour = toId(sQuery(this.domNode).val());
        var minute = toId(this.minutes.val());
        if (hour == null || minute == null) {
            return null;
        }
        return hour * 60 + minute;
    }

    protected get_value(): number {
        return this.value;
    }

    public set value(value: number) {
        if (!value) {
            if (this.options.noEmptyOption) {
                sQuery(this.domNode).val(this.options.startHour);
                this.minutes.val('0');
            }
            else {
                sQuery(this.domNode).val('');
                this.minutes.val('0');
            }
        }
        else {
            sQuery(this.domNode).val(Math.floor(value / 60).toString());
            this.minutes.val(value % 60);
        }
    }

    protected set_value(value: number): void {
        this.value = value;
    }

    get_readOnly(): boolean {
        return this.domNode.classList.contains('readonly');
    }

    set_readOnly(value: boolean): void {

        if (value !== this.get_readOnly()) {
            if (value) {
                sQuery(this.domNode).addClass('readonly').attr('readonly', 'readonly');
            }
            else {
                sQuery(this.domNode).removeClass('readonly').removeAttr('readonly');
            }
            EditorUtils.setReadonly(this.minutes, value);
        }
    }
}