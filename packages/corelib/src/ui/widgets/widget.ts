﻿import jQuery from "@optionaldeps/jquery";
import { Config, getInstanceType, getTypeFullName, getTypeShortName, isArrayLike, toggleClass } from "@serenity-is/base";
import { Decorators } from "../../decorators";
import { jQueryPatch } from "../../patch/jquerypatch";
import { reactPatch } from "../../patch/reactpatch";
import { addValidationRule, appendChild, replaceAll } from "../../q";
import { createDefaultElement, ensureParentOrFragment, handleElementProp, isFragmentWorkaround, setElementProps } from "./widgetinternal";
import { IdPrefixType, associateWidget, deassociateWidget, getWidgetName, useIdPrefix, type EditorProps, type WidgetProps } from "./widgetutils";
export { getWidgetFrom, tryGetWidget, useIdPrefix, type EditorProps, type IdPrefixType, type WidgetProps } from "./widgetutils";

export interface CreateWidgetParams<TWidget extends Widget<P>, P> {
    type?: { new(options?: P): TWidget, prototype: TWidget };
    options?: P & WidgetProps<{}>;
    container?: HTMLElement | ArrayLike<HTMLElement>;
    element?: (e: HTMLElement) => void;
    init?: (w: TWidget) => void;
}

let initialized = Symbol();
let renderContentsCalled = Symbol();

@Decorators.registerClass('Serenity.Widget')
export class Widget<P = {}> {
    private static nextWidgetNumber = 0;
    declare protected readonly options: WidgetProps<P>;
    declare protected readonly uniqueName: string;
    declare public readonly idPrefix: string;
    declare public readonly domNode: HTMLElement;

    constructor(props: WidgetProps<P>) {
        if (isArrayLike(props)) {
            this.domNode = ensureParentOrFragment(props[0]);
            this.options = {} as any;
        }
        else {
            this.options = props ?? {} as any;
            this.domNode = handleElementProp(getInstanceType(this), this.options);
        }

        delete this.options.element;
        setElementProps(this, this.props as any);

        let widgetName = getWidgetName(getInstanceType(this));
        this.uniqueName = widgetName + (Widget.nextWidgetNumber++).toString();

        associateWidget(this);

        if (jQuery) {
            jQuery(this.domNode).on('remove.' + widgetName, e => {
                if (e.bubbles || e.cancelable) {
                    return;
                }
                this.destroy();
            }).data(widgetName, this);
        }

        this.idPrefix = this.uniqueName + '_';
        this.addCssClass();
        !getInstanceType(this).deferRenderContents && this.internalRenderContents();
    }

    public destroy(): void {
        if (this.domNode) {
            deassociateWidget(this);
            toggleClass(this.domNode, this.getCssClass(), false);
            if (jQuery) {
                let widgetName = getWidgetName(getInstanceType(this));
                jQuery(this.domNode).off('.' + widgetName).off('.' + this.uniqueName).removeData(widgetName);
            }
            delete (this as any).domNode;
        }
    }

    static createDefaultElement(): HTMLElement {
        return createDefaultElement(this);
    }

    /**
     * @deprecated
     * Prefer domNode as this one depends on jQuery
     */
    public get element(): JQuery {
        return jQuery(this.domNode);
    }

    protected addCssClass(): void {
        toggleClass(this.domNode, this.getCssClass(), true);
    }

    protected getCssClass(): string {
        var type = getInstanceType(this);
        var classList: string[] = [];
        var fullClass = replaceAll(getTypeFullName(type), '.', '-');
        classList.push(fullClass);

        for (let k of Config.rootNamespaces) {
            if (fullClass.startsWith(k + '-')) {
                classList.push(fullClass.substring(k.length + 1));
                break;
            }
        }

        classList.push(getTypeShortName(type));
        return classList
            .filter((v, i, a) => a.indexOf(v) === i)
            .map(s => 's-' + s)
            .join(" ");
    }

    public static getWidgetName(type: Function): string {
        return getWidgetName(type);
    }

    public addValidationRule(rule: (input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) => string, uniqueName?: string): void;
    public addValidationRule(uniqueName: string, rule: (input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement) => string): void;
    public addValidationRule(rule: any, uniqueName: any): void {
        addValidationRule(this.domNode, typeof rule === "function" ? rule : uniqueName,
            typeof rule === "function" ? uniqueName ?? this.uniqueName : rule);
    }

    public getFieldElement(): HTMLElement {
        return this.domNode.closest('.field');
    }

    public getGridField(): HTMLDivElement {
        return this.domNode.closest('.field');
    }

    public change(handler: (e: Event) => void) {
        this.domNode.addEventListener('change', handler);
    };

    public changeSelect2(handler: (e: Event) => void) {
        this.domNode.addEventListener("change", e => {
            if ((e.target as HTMLElement)?.dataset?.select2settingvalue)
                return;
            handler(e);
        });
    }

    protected static defaultTagName: string = "div";

    public static create<TWidget extends Widget<P>, P>(params: CreateWidgetParams<TWidget, P>) {
        let props: WidgetProps<P> = params.options ?? ({} as any);
        let node = handleElementProp(params.type as any, props);
        params.container && (isArrayLike(params.container) ? params.container[0] : params.container)?.appendChild(node);
        params.element?.(node);
        props.element = node;
        let widget = new params.type(props as any);
        widget.init();
        params.init?.(widget);
        return widget;
    }

    
    protected internalInit() {
        getInstanceType(this).deferRenderContents && this.internalRenderContents();

        if (typeof (this.options as any)?.ref === "function")
            (this.options as any)?.ref(this);
    }

    public init(): this {
        if (!(this as any)[initialized]) {
            (this as any)[initialized] = true;
            this.internalInit();
        }
        return this;
    }

    /**
     * Returns the main element for this widget or the document fragment.
     * As widgets may get their elements from props unlike regular JSX widgets, 
     * this method should not be overridden. Override renderContents() instead.
     */
    public render(): HTMLElement | DocumentFragment {
        let el = this.init().domNode;
        let parent = el?.parentNode;
        if (parent instanceof DocumentFragment &&
            parent.childNodes.length > 1 && 
            (parent as any)[isFragmentWorkaround])
            return parent;
        return el;
    }

    protected internalRenderContents() {
        if ((this as any)[renderContentsCalled])
            return;
        (this as any)[renderContentsCalled] = true;
        let contents = this.renderContents();
        if (typeof contents !== "undefined" && contents !== false && this.domNode)
            appendChild(contents, this.domNode);
    }

    protected renderContents(): any | void {
        return (this.options as any).children;
    }

    public get props(): WidgetProps<P> {
        return this.options;
    }

    protected syncOrAsyncThen<T>(syncMethod: (() => T), asyncMethod: (() => PromiseLike<T>), then: (v: T) => void) {
        if (!(this as any).useAsync?.())
            then.call(this, syncMethod.call(this));
        else
            asyncMethod.call(this).then(then.bind(this));
    }

    protected useIdPrefix(): IdPrefixType {
        return useIdPrefix(this.idPrefix);
    }
}


Object.defineProperties(Widget.prototype, { isReactComponent: { value: true } });

export class EditorWidget<P> extends Widget<EditorProps<P>> {
    constructor(props: EditorProps<P>) {
        super(props);
    }
}

jQueryPatch(jQuery);
reactPatch();
