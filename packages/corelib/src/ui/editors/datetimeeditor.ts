﻿import sQuery from "@optionaldeps/squery";
import { Culture, Invariant, formatDate, formatISODateTimeUTC, localText, parseDate, parseISODateTime, round, stringFormat, trunc, tryGetText } from "@serenity-is/base";
import { Decorators } from "../../decorators";
import { IReadOnly, IStringValue } from "../../interfaces";
import { addOption, addValidationRule, today } from "../../q";
import { EditorWidget, EditorProps } from "../widgets/widget";
import { DateEditor } from "./dateeditor";
import { EditorUtils } from "./editorutils";

@Decorators.registerEditor('Serenity.DateTimeEditor', [IStringValue, IReadOnly])
@Decorators.element('<input type="text"/>')
export class DateTimeEditor<P extends DateTimeEditorOptions = DateTimeEditorOptions> extends EditorWidget<P> implements IStringValue, IReadOnly {

    private minValue: string;
    private maxValue: string;
    private time: JQuery;
    private lastSetValue: string;
    private lastSetValueGet: string;

    constructor(props: EditorProps<P>) {
        super(props);

        let input = sQuery(this.domNode);
        input.addClass('s-DateTimeEditor');

        if (this.options.inputOnly) {
            input.addClass('dateTimeQ');
            // just a basic input, usually read only display
        }
        // @ts-ignore
        else if (typeof flatpickr !== "undefined" && (DateEditor.useFlatpickr || !sQuery.fn.datepicker || this.options.seconds)) {
            input.addClass('dateTimeQ');
            // @ts-ignore
            flatpickr(input[0], this.getFlatpickrOptions());
        }
        else if ((sQuery.fn as any)?.datepicker) {
            input.addClass('dateQ');

            (input as any).datepicker({
                showOn: 'button',
                beforeShow: function () {
                    if (input.hasClass('readonly') as any)
                        return false as any;
                    DateEditor.uiPickerZIndexWorkaround(this.domNode);
                    return true;
                } as any,
                yearRange: (this.options.yearRange ?? '-100:+50')
            });

            input.bind('change.' + this.uniqueName, (e) => {
                this.lastSetValue = null;
                DateEditor.dateInputChange(e as any);
            });

            this.time = sQuery('<select/>').addClass('editor s-DateTimeEditor time');
            var after = input.next('.ui-datepicker-trigger');
            if (after.length > 0) {
                this.time.insertAfter(after);
            }
            else {
                after = input.prev('.ui-datepicker-trigger');
                if (after.length > 0) {
                    this.time.insertBefore(after);
                }
                else {
                    this.time.insertAfter(input);
                }
            }

            this.time.on('change', () => {
                this.lastSetValue = null;
                input.triggerHandler('change');
            });

            var timeOpt = DateTimeEditor.getTimeOptions(
                (this.options.startHour ?? 0), 0,
                (this.options.endHour ?? 23), 59,
                (this.options.intervalMinutes ?? 5));

            for (var t of timeOpt) {
                addOption(this.time, t, t);
            }

            addValidationRule(input, e1 => {
                var value = this.get_value();
                if (!value) {
                    return null;
                }

                if (this.get_minValue() && Invariant.stringCompare(value, this.get_minValue()) < 0) {
                    return stringFormat(localText('Validation.MinDate'), formatDate(this.get_minValue(), null));
                }

                if (this.get_maxValue() && Invariant.stringCompare(value, this.get_maxValue()) > 0) {
                    return stringFormat(localText('Validation.MaxDate'), formatDate(this.get_maxValue(), null));
                }

                return null;
            }, this.uniqueName);
        }
        else
            input.attr('type', 'datetime').addClass('dateTimeQ');

        input.bind('keyup.' + this.uniqueName, e => {
            if (this.get_readOnly())
                return;

            if (this.time) {
                if (e.which === 32) {
                    if (this.get_valueAsDate() !== new Date()) {
                        this.set_valueAsDate(new Date());
                        sQuery(this.domNode).trigger('change');
                    }
                }
                else {
                    var before = sQuery(this.domNode).val();
                    DateEditor.dateInputKeyup(e as any);
                    if (before != sQuery(this.domNode).val())
                        this.lastSetValue = null;
                }
            }
        });

        this.set_sqlMinMax(true);

        if (!this.options.inputOnly) {
            sQuery("<i class='inplace-button inplace-now'><b></b></div>")
                .attr('title', this.getInplaceNowText())
                .insertAfter(this.time).click(e2 => {
                    if (this.domNode.classList.contains('readonly')) {
                        return;
                    }
                    this.lastSetValue = null;
                    this.set_valueAsDate(new Date());
                    input.triggerHandler('change');
                });
        }
    }

    getFlatpickrOptions(): any {
        return {
            clickOpens: true,
            allowInput: true,
            enableTime: true,
            time_24hr: true,
            enableSeconds: !!this.options.seconds,
            minuteIncrement: this.options.intervalMinutes ?? 5,
            dateFormat: Culture.dateOrder.split('').join(Culture.dateSeparator).replace('y', 'Y') + " H:i" + (this.options.seconds ? ":S" : ""),
            onChange: () => {
                this.lastSetValue = null;
                this.domNode && sQuery(this.domNode).triggerHandler('change');
            }
        }
    }

    get_value(): string {
        var value = (sQuery(this.domNode).val() as string).trim();
        if (value != null && value.length === 0) {
            return null;
        }

        var result: string;
        if (this.time) {
            var datePart = formatDate(value, 'yyyy-MM-dd');
            var timePart = this.time.val();
            result = datePart + 'T' + timePart + ':00.000';
        }
        else
            result = formatDate(parseDate(sQuery(this.domNode).val() as string), "yyyy-MM-ddTHH:mm:ss.fff");

        if (this.options.useUtc)
            result = formatISODateTimeUTC(parseISODateTime(result));

        if (this.lastSetValue != null &&
            this.lastSetValueGet == result)
            return this.lastSetValue;

        return result;
    }

    get value(): string {
        return this.get_value();
    }

    set_value(value: string) {
        if (!value) {
            sQuery(this.domNode).val('');
            this.time && this.time.val('00:00');
        }
        else if (value.toLowerCase() === 'today') {
            if (this.time) {
                sQuery(this.domNode).val(formatDate(today(), null));
                this.time.val('00:00');
            }
            else {
                sQuery(this.domNode).val(this.getDisplayFormat())
            }
        }
        else {
            var val = ((value.toLowerCase() === 'now') ? new Date() : parseISODateTime(value));
            if (this.time) {
                val = DateTimeEditor.roundToMinutes(val, (this.options.intervalMinutes ?? 5));
                sQuery(this.domNode).val(formatDate(val, null));
                this.time.val(formatDate(val, 'HH:mm'));
            }
            else
                sQuery(this.domNode).val(formatDate(val, this.getDisplayFormat()));
        }

        this.lastSetValue = null;
        if (value && value.toLowerCase() != 'today' && value.toLowerCase() != 'now') {
            this.lastSetValueGet = this.get_value();
            this.lastSetValue = value;
        }
    }

    private getInplaceNowText(): string {
        return tryGetText('Controls.DateTimeEditor.SetToNow') ?? 'set to now';
    }

    private getDisplayFormat(): string {
        return (this.options.seconds ? Culture.dateTimeFormat : Culture.dateTimeFormat.replace(':ss', ''));
    }

    set value(v: string) {
        this.set_value(v);
    }

    private get_valueAsDate(): Date {
        if (!this.get_value())
            return null;

        return parseISODateTime(this.get_value());
    }

    get valueAsDate() {
        return this.get_valueAsDate();
    }

    private set_valueAsDate(value: Date) {
        if (value == null) {
            this.set_value(null);
        }

        this.set_value(formatDate(value, 'yyyy-MM-ddTHH:mm' + (this.options.seconds ? ':ss' : '')));
    }

    set valueAsDate(value: Date) {
        this.set_valueAsDate(value);
    }

    @Decorators.option()
    get_minValue(): string {
        return this.minValue;
    }

    set_minValue(value: string) {
        this.minValue = value;
    }

    @Decorators.option()
    get_maxValue(): string {
        return this.maxValue;
    }

    set_maxValue(value: string): void {
        this.maxValue = value;
    }

    get_minDate(): Date {
        return parseISODateTime(this.get_minValue());
    }

    set_minDate(value: Date): void {
        this.set_minValue(formatDate(value, 'yyyy-MM-ddTHH:mm:ss'));
    }

    @Decorators.option()
    get_maxDate(): Date {
        return parseISODateTime(this.get_maxValue());
    }

    set_maxDate(value: Date) {
        this.set_maxValue(formatDate(value, 'yyyy-MM-ddTHH:mm:ss'));
    }

    @Decorators.option()
    get_sqlMinMax(): boolean {
        return this.get_minValue() === '1753-01-01' && this.get_maxValue() === '9999-12-31';
    }

    set_sqlMinMax(value: boolean) {
        if (value) {
            this.set_minValue('1753-01-01');
            this.set_maxValue('9999-12-31');
        }
        else {
            this.set_minValue(null);
            this.set_maxValue(null);
        }
    }

    get_readOnly(): boolean {
        return this.domNode.classList.contains('readonly');
    }

    set_readOnly(value: boolean): void {

        if (value !== this.get_readOnly()) {
            if (value) {
                sQuery(this.domNode).addClass('readonly').attr('readonly', 'readonly');
                sQuery(this.domNode).nextAll('.ui-datepicker-trigger').css('opacity', '0.1');
                sQuery(this.domNode).nextAll('.inplace-now').css('opacity', '0.1');
            }
            else {
                sQuery(this.domNode).removeClass('readonly').removeAttr('readonly');
                sQuery(this.domNode).nextAll('.ui-datepicker-trigger').css('opacity', '1');
                sQuery(this.domNode).nextAll('.inplace-now').css('opacity', '1');
            }

            this.time && EditorUtils.setReadonly(this.time, value);
        }
    }

    static roundToMinutes(date: Date, minutesStep: number) {
        date = new Date(date.getTime());
        var m = trunc(round(date.getMinutes() / minutesStep) * minutesStep);
        date.setMinutes(m);
        date.setSeconds(0);
        date.setMilliseconds(0);
        return date;
    }

    static getTimeOptions = function (fromHour: number, fromMin: number,
        toHour: number, toMin: number, stepMins: number) {
        var list = [];
        if (toHour >= 23) {
            toHour = 23;
        }
        if (toMin >= 60) {
            toMin = 59;
        }
        var hour = fromHour;
        var min = fromMin;
        while (true) {
            if (hour > toHour || hour === toHour && min > toMin) {
                break;
            }
            var t = ((hour >= 10) ? '' : '0') + hour + ':' + ((min >= 10) ? '' : '0') + min;
            list.push(t);
            min += stepMins;
            if (min >= 60) {
                min -= 60;
                hour++;
            }
        }
        return list;
    };
}

export interface DateTimeEditorOptions {
    startHour?: any;
    endHour?: any;
    intervalMinutes?: any;
    yearRange?: string;
    useUtc?: boolean;
    seconds?: boolean;
    inputOnly?: boolean;
}