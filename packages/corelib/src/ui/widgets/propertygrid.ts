﻿import sQuery from "@optionaldeps/squery";
import { Culture, faIcon, getTypeShortName, isBS3, isBS5Plus, localText, tryGetText, type PropertyItem } from "@serenity-is/base";
import { Decorators, OptionsTypeAttribute } from "../../decorators";
import { Authorization, extend, getAttributes } from "../../q";
import { EditorTypeRegistry } from "../../types/editortyperegistry";
import { EditorUtils, isInputLike } from "../editors/editorutils";
import { ReflectionOptionsSetter } from "./reflectionoptionssetter";
import { Widget, WidgetProps } from "./widget";

@Decorators.registerClass('Serenity.PropertyGrid')
export class PropertyGrid<P extends PropertyGridOptions = PropertyGridOptions> extends Widget<P> {

    private editors: Widget<any>[];
    private items: PropertyItem[];
    declare public readonly idPrefix: string;

    constructor(props: WidgetProps<P>) {
        super(props);

        let div = sQuery(this.domNode);
        this.idPrefix = this.options.idPrefix = this.options.idPrefix ?? this.idPrefix;

        if (this.options.mode == null)
            this.options.mode = 1;

        div.addClass('s-PropertyGrid');
        this.editors = [];
        var items = this.options.items || [];
        this.items = [];

        var useTabs = items.some(x => !!x.tab);

        if (useTabs) {
            var itemsWithoutTab = items.filter(f => !f.tab);
            if (itemsWithoutTab.length > 0) {
                this.createItems(this.domNode, itemsWithoutTab);

                sQuery("<div class='pad'></div>").appendTo(this.domNode);
            }

            var itemsWithTab = items.filter(f => f.tab);

            var ul = sQuery("<ul class='nav nav-tabs property-tabs' role='tablist'></ul>")
                .appendTo(this.domNode);

            var tc = sQuery("<div class='tab-content property-panes'></div>")
                .appendTo(this.domNode);

            var tabIndex = 0;
            var i = 0;
            while (i < itemsWithTab.length) {
                var tab = { $: itemsWithTab[i].tab?.trim() ?? '' };
                var tabItems = [];

                var j = i;
                do {
                    tabItems.push(itemsWithTab[j]);
                } while (++j < itemsWithTab.length &&
                    (itemsWithTab[j].tab?.trim() ?? '') === tab.$);
                i = j;

                var li = sQuery(isBS3() ? '<li><a data-toggle="tab" role="tab"></a></li>' :
                    `<li class="nav-item"><a class="nav-link" data-${isBS5Plus() ? "bs-" : ""}toggle="tab" role="tab"></a></li>`)
                    .appendTo(ul);

                if (tabIndex === 0) {
                    if (isBS3())
                        li.addClass('active');
                    else
                        li.children('a').addClass('active');
                }

                var tabID = this.uniqueName + '_Tab' + tabIndex;

                li.children('a').attr('href', '#' + tabID)
                    .text(this.determineText(tab.$, function (prefix: string) {
                        return prefix + 'Tabs.' + this.tab.$;
                    }.bind({
                        tab: tab
                    })));

                var pane = sQuery("<div class='tab-pane fade' role='tabpanel'>")
                    .appendTo(tc);

                if (tabIndex === 0) {
                    pane.addClass(isBS3() ? 'in active' : 'show active');
                }

                pane.attr('id', tabID);
                this.createItems(pane[0], tabItems);
                tabIndex++;
            }
        }
        else {
            this.createItems(this.domNode, items);
        }

        this.updateInterface();
    }

    destroy() {
        if (this.editors != null) {
            for (var i = 0; i < this.editors.length; i++) {
                this.editors[i].destroy();
            }
            this.editors = null;
        }
        sQuery(this.domNode).find('a.category-link').off('click',
            this.categoryLinkClick as any).remove();

        Widget.prototype.destroy.call(this);
    }

    private createItems(container: HTMLElement, items: PropertyItem[]) {
        var categoryIndexes = {};
        var categoriesDiv = container;

        var useCategories = this.options.useCategories !== false && items.some(x => !!x.category);

        if (useCategories) {
            var linkContainer = sQuery('<div/>').addClass('category-links');
            categoryIndexes = this.createCategoryLinks(linkContainer, items);
            if (Object.keys(categoryIndexes).length > 1) {
                linkContainer.appendTo(container);
            }
            else {
                linkContainer.find('a.category-link').off('click',
                    this.categoryLinkClick as any).remove();
            }
        }

        categoriesDiv = sQuery('<div/>').addClass('categories').appendTo(container)[0];
        var fieldContainer: HTMLElement;
        if (useCategories) {
            fieldContainer = categoriesDiv;
        }
        else {
            fieldContainer = sQuery('<div/>').addClass('category').appendTo(categoriesDiv)[0];
        }
        var priorCategory = null;
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            var category = item.category;
            if (category == null) {
                category = this.options.defaultCategory ?? '';
            }

            if (useCategories && priorCategory !== category) {
                var categoryDiv = this.createCategoryDiv(categoriesDiv,
                    categoryIndexes, category,
                    ((item.collapsible !== true) ? null :
                        item.collapsed ?? false));

                if (priorCategory == null) {
                    sQuery(categoryDiv).addClass('first-category');
                }
                priorCategory = category;
                fieldContainer = categoryDiv;
            }
            var editor = this.createField(fieldContainer, item);
            this.items.push(item);
            this.editors.push(editor);
        }
    }

    private createCategoryDiv(categoriesDiv: HTMLElement,
        categoryIndexes: { [key: string]: number }, category: string, collapsed: boolean): HTMLElement {

        var categoryDiv = sQuery('<div/>').addClass('category')
            .appendTo(categoriesDiv)[0];

        var title = sQuery('<div/>').addClass('category-title')
            .append(sQuery('<a/>').addClass('category-anchor')
                .text(this.determineText(category, function (prefix) {
                    return prefix + 'Categories.' + category;
                }))
                .attr('name', this.idPrefix +
                    'Category' + categoryIndexes[category].toString()))
            .appendTo(categoryDiv);

        if (collapsed != null) {
            sQuery(categoryDiv).addClass(((collapsed === true) ?
                'collapsible collapsed' : 'collapsible'));

            var img = sQuery('<i/>').addClass(faIcon((collapsed === true) ? "plus" : "minus")).appendTo(title);

            title.click(function (e) {
                sQuery(categoryDiv).toggleClass('collapsed');
                img.toggleClass(faIcon("plus")).toggleClass(faIcon("minus"));
            });
        }

        return categoryDiv;
    }

    private categoryLinkClick = (e: Event) => {
        e.preventDefault();

        var title = sQuery('a[name=' + (e.target as HTMLElement).getAttribute('href')
            .toString().substr(1) + ']');

        if (title.closest('.category').hasClass('collapsed'))
            title.closest('.category').children('.category-title').click();

        var animate = function () {
            if (($.fn as any).fadeTo) {
                title.fadeTo(100, 0.5, function () {
                    title.fadeTo(100, 1, function () {
                    });
                });
            }
        };

        var intoView = title.closest('.category');
        if (($.fn as any).scrollintoview) {
            if (intoView.closest(':scrollable(both)').length === 0)
                animate();
            else
                (intoView as any).scrollintoview({
                    duration: 'fast',
                    direction: 'y',
                    complete: animate
                });
        }
        else if (intoView && intoView[0] && intoView[0].scrollIntoView) {
            intoView[0].scrollIntoView();
            animate();
        }
    }

    private determineText(text: string, getKey: (s: string) => string) {
        if (text != null && !text.startsWith('`')) {
            var local = tryGetText(text);
            if (local != null) {
                return local;
            }
        }

        if (text != null && text.startsWith('`')) {
            text = text.substring(1);
        }

        if (this.options.localTextPrefix) {
            var local1 = tryGetText(getKey(this.options.localTextPrefix));
            if (local1 != null) {
                return local1;
            }
        }

        return text;
    }

    private createField(container: HTMLElement, item: PropertyItem) {
        var fieldDiv = sQuery('<div/>').addClass('field')
            .addClass(item.name).data('PropertyItem', item).appendTo(container);

        if (item.cssClass) {
            fieldDiv.addClass(item.cssClass);
        }

        if (item.formCssClass) {
            fieldDiv.addClass(item.formCssClass);
            if (item.formCssClass.indexOf('line-break-') >= 0) {
                var splitted = item.formCssClass.split(String.fromCharCode(32));
                if (splitted.indexOf('line-break-xs') >= 0) {
                    sQuery("<div class='line-break' style='width: 100%' />")
                        .insertBefore(fieldDiv);
                }
                else if (splitted.indexOf('line-break-sm') >= 0) {
                    sQuery("<div class='line-break hidden-xs' style='width: 100%' />")
                        .insertBefore(fieldDiv);
                }
                else if (splitted.indexOf('line-break-md') >= 0) {
                    sQuery("<div class='line-break hidden-sm' style='width: 100%' />")
                        .insertBefore(fieldDiv);
                }
                else if (splitted.indexOf('line-break-lg') >= 0) {
                    sQuery("<div class='line-break hidden-md' style='width: 100%' />")
                        .insertBefore(fieldDiv);
                }
            }
        }
        var editorId = this.idPrefix + item.name;
        var title = this.determineText(item.title, function (prefix) {
            return prefix + item.name;
        });

        var hint = this.determineText(item.hint, function (prefix1) {
            return prefix1 + item.name + '_Hint';
        });

        var placeHolder = this.determineText(item.placeholder, function (prefix2) {
            return prefix2 + item.name + '_Placeholder';
        });

        if (hint == null) {
            hint = title ?? '';
        }

        var label = sQuery('<label/>')
            .addClass('caption')
            .attr('for', editorId)
            .attr('title', hint)
            .text(title ?? '')
            .appendTo(fieldDiv);

        if (item.labelWidth) {
            if (item.labelWidth === '0') {
                label.hide();
            }
            else {
                label.css('width', item.labelWidth);
            }
        }

        if (item.required === true) {
            sQuery('<sup>*</sup>').attr('title',
                localText('Controls.PropertyGrid.RequiredHint'))
                .prependTo(label);
        }

        var editorType = EditorTypeRegistry.get(item.editorType ?? 'String') as typeof Widget<WidgetProps<P>>;

        var editorParams = item.editorParams;
        var optionsType = null;
        var optionsAttr = getAttributes(editorType,
            OptionsTypeAttribute, true);

        if (optionsAttr != null && optionsAttr.length > 0) {
            optionsType = optionsAttr[0].optionsType;
        }
        if (optionsType != null) {
            editorParams = extend(new optionsType(), item.editorParams);
        }
        else {
            editorParams = extend(new Object(), item.editorParams);
        }

        let editor = new editorType({
            ...editorParams,
            id: editorId,
            element: el => {
                el.classList.add("editor");
                
                if (isInputLike(el))
                    el.setAttribute("name", item.name ?? "");

                if (placeHolder)
                    el.setAttribute("placeholder", placeHolder);

                fieldDiv.append(el);
            }
        }).init();

        if (getTypeShortName(editor) == "BooleanEditor" &&
            (item.editorParams == null || !!!item.editorParams['labelFor'])) {
            label.removeAttr('for');
        }

        if (getTypeShortName(editor) == "RadioButtonEditor" &&
            (item.editorParams == null || !!!item.editorParams['labelFor'])) {
            label.removeAttr('for');
        }

        if (item.maxLength != null) {
            PropertyGrid.setMaxLength(editor, item.maxLength);
        }

        if (item.editorParams != null) {
            ReflectionOptionsSetter.set(editor, item.editorParams);
        }

        sQuery('<div/>').addClass('vx').appendTo(fieldDiv);
        sQuery('<div/>').addClass('clear').appendTo(fieldDiv);

        return editor;
    }

    private getCategoryOrder(items: PropertyItem[]) {
        var order = 0;
        var result = {} as any;
        var categoryOrder = this.options.categoryOrder?.trim() || null;
        if (categoryOrder != null) {
            var split = categoryOrder.split(';');
            for (var s of split) {
                var x = s?.trim() || null;
                if (x == null) {
                    continue;
                }
                if (result[x] as any != null) {
                    continue;
                }
                result[x] = order++;
            }
        }

        for (var x1 of items) {
            var category = x1.category;
            if (category == null) {
                category = this.options.defaultCategory ?? '';
            }
            if (result[category] == null) {
                result[category] = order++;
            }
        }

        return result;
    }

    private createCategoryLinks(container: JQuery, items: PropertyItem[]) {
        var idx = 0;
        var itemIndex: Record<string, number> = {};
        var itemCategory: Record<string, string> = {};
        for (var x of items) {
            var name1 = x.name;
            var cat1 = x.category;
            if (cat1 == null) {
                cat1 = this.options.defaultCategory ?? '';
            }
            itemCategory[name1] = cat1;
            itemIndex[x.name] = idx++;
        }

        var self = this;
        var categoryOrder = this.getCategoryOrder(items);

        items.sort(function (x1, y) {
            var c = 0;
            var xcategory = itemCategory[x1.name];
            var ycategory = itemCategory[y.name];
            if (xcategory != ycategory) {
                var c1 = categoryOrder[xcategory];
                var c2 = categoryOrder[ycategory];
                if (c1 != null && c2 != null) {
                    c = c1 - c2;
                }
                else if (c1 != null) {
                    c = -1;
                }
                else if (c2 != null) {
                    c = 1;
                }
            }
            if (c === 0) {
                c = Culture.stringCompare(xcategory, ycategory);
            }
            if (c === 0) {
                c = itemIndex[x1.name] < itemIndex[y.name] ? -1 : (itemIndex[x1.name] > itemIndex[y.name] ? 1 : 0)
            }
            return c;
        });

        var categoryIndexes: Record<string, number> = {};
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            var category = { $: itemCategory[item.name] };
            if (categoryIndexes[category.$] == null) {
                var index = Object.keys(categoryIndexes).length + 1;
                categoryIndexes[category.$] = index;
                if (index > 1) {
                    sQuery('<span/>').addClass('separator').text('|').prependTo(container);
                }
                sQuery('<a/>').addClass('category-link').text(
                    this.determineText(category.$,
                        function (prefix: string) {
                            return prefix + 'Categories.' + this.category.$;
                        }.bind({ category: category })))
                    .attr('tabindex', '-1')
                    .attr('href', '#' + this.idPrefix +
                        'Category' + index.toString())
                    .click(this.categoryLinkClick as any)
                    .prependTo(container);
            }
        }

        sQuery('<div/>').addClass('clear').appendTo(container);
        return categoryIndexes;
    }

    get_editors(): Widget<any>[] {
        return this.editors;
    }

    get_items(): PropertyItem[] {
        return this.items;
    }

    get_idPrefix(): string {
        return this.idPrefix;
    }

    get_mode(): PropertyGridMode {
        return this.options.mode;
    }

    set_mode(value: PropertyGridMode) {
        if (this.options.mode !== value) {
            this.options.mode = value;
            this.updateInterface();
        }
    }

    // Obsolete
    static loadEditorValue(editor: Widget<any>,
        item: PropertyItem, source: any): void {
    }

    // Obsolete
    static saveEditorValue(editor: Widget<any>,
        item: PropertyItem, target: any): void {

        EditorUtils.saveValue(editor, item, target);
    }

    // Obsolete
    private static setReadOnly(widget: Widget<any>, isReadOnly: boolean): void {
        EditorUtils.setReadOnly(widget, isReadOnly);
    }

    // Obsolete
    private static setReadonly(elements: ArrayLike<HTMLElement>, isReadOnly: boolean): void {
        EditorUtils.setReadonly(elements, isReadOnly);
    }

    // Obsolete
    private static setRequired(widget: Widget<any>, isRequired: boolean): void {
        EditorUtils.setRequired(widget, isRequired);
    }

    private static setMaxLength(widget: Widget<any>, maxLength: number) {
        if (isInputLike(widget.domNode)) {
            if (maxLength > 0) {
                widget.domNode.setAttribute('maxlength', (maxLength ?? 0).toString());
            }
            else {
                widget.element.removeAttr('maxlength');
            }
        }
    }

    load(source: any): void {
        for (var i = 0; i < this.editors.length; i++) {
            var item = this.items[i];
            var editor = this.editors[i];
            if (!!(this.get_mode() === 1 && item.defaultValue != null) &&
                typeof (source[item.name]) === 'undefined') {
                source[item.name] = item.defaultValue;
            }

            EditorUtils.loadValue(editor, item, source);
        }
    }

    save(target?: any): any {
        if (target == null)
            target = Object.create(null);
        for (var i = 0; i < this.editors.length; i++) {
            var item = this.items[i];
            if (item.oneWay !== true && this.canModifyItem(item)) {
                var editor = this.editors[i];
                EditorUtils.saveValue(editor, item, target);
            }
        }
        return target;
    }

    public get value(): any {
        return this.save();
    }

    public set value(val: any) {
        if (val == null)
            val = Object.create(null);
        this.load(val);
    }

    private canModifyItem(item: PropertyItem) {
        if (this.get_mode() === PropertyGridMode.insert) {
            if (item.insertable === false) {
                return false;
            }

            if (item.insertPermission == null) {
                return true;
            }

            return Authorization.hasPermission(item.insertPermission);
        }
        else if (this.get_mode() === PropertyGridMode.update) {
            if (item.updatable === false) {
                return false;
            }

            if (item.updatePermission == null) {
                return true;
            }

            return Authorization.hasPermission(item.updatePermission);
        }
        return true;
    }

    updateInterface() {
        for (var i = 0; i < this.editors.length; i++) {
            var item = this.items[i];
            var editor = this.editors[i];
            var readOnly = item.readOnly === true || !this.canModifyItem(item);
            EditorUtils.setReadOnly(editor, readOnly);
            EditorUtils.setRequired(editor, !readOnly &&
                !!item.required && item.editorType !== 'Boolean');
            if (item.visible === false || item.readPermission != null ||
                item.insertPermission != null || item.updatePermission != null ||
                item.hideOnInsert === true || item.hideOnUpdate === true) {
                var hidden = (item.readPermission != null &&
                    !Authorization.hasPermission(item.readPermission)) ||
                    item.visible === false ||
                    (this.get_mode() === PropertyGridMode.insert && item.hideOnInsert === true) ||
                    (this.get_mode() === 2 && item.hideOnUpdate === true);

                var field = editor.getFieldElement();
                if (field)
                    field.classList.toggle("hidden", !!hidden);
            }
        }
    }

    enumerateItems(callback: (p1: PropertyItem, p2: Widget<any>) => void): void {
        for (var i = 0; i < this.editors.length; i++) {
            var item = this.items[i];
            var editor = this.editors[i];
            callback(item, editor);
        }
    }
}

export enum PropertyGridMode {
    insert = 1,
    update = 2
}

export interface PropertyGridOptions {
    idPrefix?: string;
    items: PropertyItem[];
    useCategories?: boolean;
    categoryOrder?: string;
    defaultCategory?: string;
    localTextPrefix?: string;
    mode?: PropertyGridMode;
}