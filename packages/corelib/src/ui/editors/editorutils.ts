﻿import sQuery from "@optionaldeps/squery";
import { PropertyItem, isArrayLike, isInstanceOfType, localText, parseDecimal, tryGetText } from "@serenity-is/base";
import { IBooleanValue, IDoubleValue, IGetEditValue, IReadOnly, ISetEditValue, IStringValue, IValidateRequired } from "../../interfaces";
import { cast, isTrimmedEmpty, safeCast } from "../../q";
import { type Widget } from "../widgets/widget";
import { tryGetWidget } from "../widgets/widgetutils";

export function isInputLike(node: Element): node is (HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement) {
    return isInputTag(node?.nodeName);
}

export function isInputTag(tag: string) {
    return /^(?:input|select|textarea|button)$/i.test(tag);
}

export namespace EditorUtils {

    export function getDisplayText(editor: Widget<any>): string {

        var select2 = editor.element.data('select2');

        if (select2 != null) {
            var data = editor.element.select2('data');
            if (data == null)
                return '';

            return data.text ?? '';
        }

        var value = getValue(editor);
        if (value == null) {
            return '';
        }

        if (typeof value === "string")
            return value;

        if (value instanceof Boolean)
            return (!!value ? (tryGetText('Controls.FilterPanel.OperatorNames.true') ?? 'True') :
                (tryGetText('Controls.FilterPanel.OperatorNames.true') ?? 'False'));

        return value.toString();
    }

    var dummy: PropertyItem = { name: '_' };

    export function getValue(editor: Widget<any>): any {
        var target: Record<string, any> = {};
        saveValue(editor, dummy, target);
        return target['_'];
    }

    export function saveValue(editor: Widget<any>, item: PropertyItem, target: any): void {

        var getEditValue = safeCast(editor, IGetEditValue);

        if (getEditValue != null) {
            getEditValue.getEditValue(item, target);
            return;
        }

        var stringValue = safeCast(editor, IStringValue);
        if (stringValue != null) {
            target[item.name] = stringValue.get_value();
            return;
        }

        var booleanValue = safeCast(editor, IBooleanValue);
        if (booleanValue != null) {
            target[item.name] = booleanValue.get_value();
            return;
        }

        var doubleValue = safeCast(editor, IDoubleValue);
        if (doubleValue != null) {
            var value = doubleValue.get_value();
            target[item.name] = (isNaN(value) ? null : value);
            return;
        }

        if ((editor as any).getEditValue != null) {
            (editor as any).getEditValue(item, target);
            return;
        }

        if (isInputLike(editor.domNode)) {
            target[item.name] = editor.domNode.value;
            return;
        }
    }

    export function setValue(editor: Widget<any>, value: any): void {
        var source = { _: value };
        loadValue(editor, dummy, source);
    }

    export function loadValue(editor: Widget<any>, item: PropertyItem, source: any): void {

        var setEditValue = safeCast(editor, ISetEditValue);
        if (setEditValue != null) {
            setEditValue.setEditValue(source, item);
            return;
        }

        var stringValue = safeCast(editor, IStringValue);
        if (stringValue != null) {
            var value = source[item.name];
            if (value != null) {
                value = value.toString();
            }
            stringValue.set_value(cast(value, String));
            return;
        }

        var booleanValue = safeCast(editor, IBooleanValue);
        if (booleanValue != null) {
            var value1 = source[item.name];
            if (typeof (value1) === 'number') {
                booleanValue.set_value(value1 > 0);
            }
            else {
                booleanValue.set_value(!!value1);
            }
            return;
        }

        var doubleValue = safeCast(editor, IDoubleValue);
        if (doubleValue != null) {
            var d = source[item.name];
            if (!!(d == null || isInstanceOfType(d, String) && isTrimmedEmpty(cast(d, String)))) {
                doubleValue.set_value(null);
            }
            else if (isInstanceOfType(d, String)) {
                doubleValue.set_value(cast(parseDecimal(cast(d, String)), Number));
            }
            else if (isInstanceOfType(d, Boolean)) {
                doubleValue.set_value((!!d ? 1 : 0));
            }
            else {
                doubleValue.set_value(cast(d, Number));
            }
            return;
        }

        if ((editor as any).setEditValue != null) {
            (editor as any).setEditValue(source, item);
            return;
        }

        if (isInputLike(editor.domNode)) {
            var v = source[item.name];
            if (v == null) {
                editor.element.val('');
            }
            else {
                editor.element.val(v);
            }
            return;
        }
    }

    export function setReadonly(elements: HTMLElement | ArrayLike<HTMLElement>, isReadOnly: boolean) {
        elements = isArrayLike(elements) ? elements : [elements];
        for (var i = 0; i < elements.length; i++) {
            let el = elements[i];
            var type = el.getAttribute('type');
            if (el.tagName == 'SELECT' || type === 'radio' || type === 'checkbox') {
                if (isReadOnly) {
                    el.classList.add('readonly');
                    el.setAttribute('disabled', 'disabled');
                }
                else {
                    el.classList.remove('readonly');
                    el.removeAttribute('disabled');
                }
            }
            else if (isReadOnly) {
                el.classList.add('readonly');
                el.setAttribute('readonly', 'readonly');
            }
            else {
                el.classList.remove('readonly');
                el.removeAttribute('readonly');
            }
        }
    }

    export function setReadOnly(widget: Widget<any>, isReadOnly: boolean): void {

        var readOnly = safeCast(widget, IReadOnly);

        if (readOnly != null) {
            readOnly.set_readOnly(isReadOnly);
        }
        else if (isInputLike(widget.domNode)) {
            setReadonly(widget.domNode, isReadOnly);
        }
    }

    export function setRequired(widget: Widget<any>, isRequired: boolean): void {
        var req = safeCast(widget, IValidateRequired);
        if (req != null) {
            req.set_required(isRequired);
        }
        else if (isInputLike(widget.domNode)) {
            widget.domNode.classList.toggle('required', !!isRequired);
        }
        var gridField = widget.element.closest('.field');
        var hasSupItem = gridField.find('sup').get().length > 0;
        if (isRequired && !hasSupItem) {
            sQuery('<sup>*</sup>').attr('title', localText('Controls.PropertyGrid.RequiredHint'))
                .prependTo(gridField.find('.caption')[0]);
        }
        else if (!isRequired && hasSupItem) {
            sQuery(gridField.find('sup')[0]).remove();
        }
    }

    export function setContainerReadOnly(container: JQuery, readOnly: boolean) {

        if (!readOnly) {

            if (!container.hasClass('readonly-container'))
                return;

            container.removeClass('readonly-container').find(".editor.container-readonly")
                .removeClass('container-readonly').each((i, e) => {
                    var w = tryGetWidget(e) as any;
                    if (w != null)
                        EditorUtils.setReadOnly(w, false);
                    else
                        EditorUtils.setReadonly(sQuery(e), false);
                });

            return;
        }

        container.addClass('readonly-container').find(".editor")
            .not('.container-readonly')
            .each((i, e) => {
                var w = tryGetWidget(e) as any;
                if (w != null) {

                    if (w['get_readOnly']) {
                        if (w['get_readOnly']())
                            return;
                    }
                    else if (sQuery(e).is('[readonly]') || sQuery(e).is('[disabled]') || sQuery(e).is('.readonly') || sQuery(e).is('.disabled'))
                        return;

                    sQuery(e).addClass('container-readonly');
                    EditorUtils.setReadOnly(w, true);

                }
                else {
                    if (sQuery(e).is('[readonly]') || sQuery(e).is('[disabled]') || sQuery(e).is('.readonly') || sQuery(e).is('.disabled'))
                        return;

                    EditorUtils.setReadonly(sQuery(e).addClass('container-readonly'), true);
                }
            });
    }
}