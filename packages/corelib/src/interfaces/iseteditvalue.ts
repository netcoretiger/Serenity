﻿import { PropertyItem } from "@serenity-is/base";
import { Decorators } from "../decorators";

@Decorators.registerInterface("Serenity.ISetEditValue")
export class ISetEditValue {
}

export interface ISetEditValue {
    setEditValue(source: any, property: PropertyItem): void;
}