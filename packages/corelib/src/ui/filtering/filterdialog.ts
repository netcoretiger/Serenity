﻿import { DialogTexts, localText, notifyError } from "@serenity-is/base";
import { Decorators } from "../../decorators";
import { TemplatedDialog } from "../dialogs/templateddialog";
import { FilterPanel } from "./filterpanel";
import { WidgetProps } from "../widgets/widget";

@Decorators.registerClass('Serenity.FilterDialog')
export class FilterDialog<P = {}> extends TemplatedDialog<P> {

    private filterPanel: FilterPanel;

    constructor(props: WidgetProps<P>) {
        super(props);

        this.filterPanel = new FilterPanel({ element: this.byId('FilterPanel') });
        this.filterPanel.set_showInitialLine(true);
        this.filterPanel.set_showSearchButton(false);
        this.filterPanel.set_updateStoreOnReset(false);

        this.dialogTitle = localText('Controls.FilterPanel.DialogTitle');
    }

    get_filterPanel(): FilterPanel {
        return this.filterPanel;
    }

    protected getTemplate(): string {
        return '<div id="~_FilterPanel"/>';
    }

    protected getDialogButtons() {
        return [
            {
                text: DialogTexts.OkButton,
                click: () => {
                    this.filterPanel.search();
                    if (this.filterPanel.get_hasErrors()) {
                        notifyError(localText('Controls.FilterPanel.FixErrorsMessage'), '', null);
                        return;
                    }

                    this.dialogClose();
                }
            },
            {
                text: DialogTexts.CancelButton,
                click: () => this.dialogClose()
            }
        ];
    }
}
