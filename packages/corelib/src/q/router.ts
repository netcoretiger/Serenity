﻿import sQuery from "@optionaldeps/squery";
import { closePanel } from "@serenity-is/base";

export interface HandleRouteEventArgs {
    handled: boolean,
    route: string,
    parts: string[],
    index: number
}

export namespace Router {
    let oldURL: string;
    let resolving: number = 0;
    let autoinc: number = 0;
    let ignoreHash: number = 0;
    let ignoreTime: number = 0;

    export let enabled: boolean = true;

    function isEqual(url1: string, url2: string) {
        return url1 == url2 || url1 == url2 + '#' || url2 == url1 + '#';
    }

    export function navigate(hash: string, tryBack?: boolean, silent?: boolean) {
        if (!enabled || resolving > 0)
            return;

        hash = hash || '';
        hash = hash.replace(/^#/, '');
        hash = (!hash ? "" : '#' + hash);
        var newURL = window.location.href.replace(/#$/, '')
            .replace(/#.*$/, '') + hash;
        if (newURL != window.location.href) {
            if (tryBack && oldURL != null && isEqual(oldURL, newURL)) {
                if (silent)
                    ignoreChange();

                var prior = window.location.href;
                oldURL = null;
                window.history.back();
                return;
            }

            if (silent)
                ignoreChange();

            oldURL = window.location.href;
            window.location.hash = hash;
        }
    }

    export function replace(hash: string, tryBack?: boolean) {
        navigate(hash, tryBack, true);
    }

    export function replaceLast(hash: string, tryBack?: boolean) {
        if (!enabled)
            return;

        var current = window.location.hash || '';
        if (current.charAt(0) == '#')
            current = current.substr(1, current.length - 1);

        var parts = current.split('/+/');

        if (parts.length > 1) {
            if (hash && hash.length) {
                parts[parts.length - 1] = hash;
                hash = parts.join("/+/");
            }
            else {
                parts.splice(parts.length - 1, 1);
                hash = parts.join("/+/");
            }
        }
        replace(hash, tryBack);
    }

    function visibleDialogs() {
        return sQuery('.ui-dialog-content:visible, .ui-dialog.panel-hidden>.ui-dialog-content, .s-Panel').toArray().sort((a, b) => {
            return (sQuery(a).data('qrouterorder') || 0) - (sQuery(b).data('qrouterorder') || 0);
        });
    }

    function dialogOpen(owner: HTMLElement | ArrayLike<HTMLElement>, element: HTMLElement | ArrayLike<HTMLElement>, hash: () => string) {
        var route = [];
        var isDialog = sQuery(owner).hasClass(".ui-dialog-content") || sQuery(owner).hasClass('.s-Panel');
        var dialog = isDialog ? owner :
            sQuery(owner).closest('.ui-dialog-content, .s-Panel');
        var value = hash();

        var idPrefix: string;
        if (sQuery(dialog).length) {
            var dialogs = visibleDialogs();
            var index = dialogs.indexOf(sQuery(dialog)[0]);

            for (var i = 0; i <= index; i++) {
                var q = sQuery(dialogs[i]).data("qroute") as string;
                if (q && q.length)
                    route.push(q);
            }

            if (!isDialog) {
                idPrefix = sQuery(dialog).attr("id");
                if (idPrefix) {
                    idPrefix += "_";
                    var id = sQuery(owner).attr("id");
                    if (id?.startsWith(idPrefix))
                        value = id.substring(idPrefix.length) + '@' + value;
                }
            }
        }
        else {
            var id = sQuery(owner).attr("id");
            if (id && (!sQuery(owner).hasClass("route-handler") ||
                sQuery('.route-handler').first().attr("id") != id))
                value = id + "@" + value;
        }

        route.push(value);
        sQuery(element).data("qroute", value);
        replace(route.join("/+/"));

        sQuery(element).bind("dialogclose.qrouter panelclose.qrouter", e => {
            sQuery(element).data("qroute", null);
            sQuery(element).off(".qrouter");
            var prhash = sQuery(element).data("qprhash");
            var tryBack = sQuery(e.target).closest('.s-MessageDialog').length > 0 || (e && e.originalEvent &&
                ((e.originalEvent.type == "keydown" && (e.originalEvent as any).keyCode == 27) ||
                sQuery(e.originalEvent.target).hasClass("ui-dialog-titlebar-close") ||
                sQuery(e.originalEvent.target).hasClass("panel-titlebar-close")));
            if (prhash != null)
                replace(prhash, tryBack);
            else
                replaceLast('', tryBack);
        });
    }

    export function dialog(owner: HTMLElement | ArrayLike<HTMLElement>, element: HTMLElement | ArrayLike<HTMLElement>, hash: () => string) {
        if (!enabled)
            return;
        
        sQuery(element).on("dialogopen.qrouter panelopen.qrouter", e => {
            dialogOpen(owner, element, hash);
        });
    }

    export function resolve(hash?: string) {
        if (!enabled)
            return;

        resolving++;
        try {
            hash = hash ?? window.location.hash ?? '';
            if (hash.charAt(0) == '#')
                hash = hash.substr(1, hash.length - 1);

            var dialogs = visibleDialogs();
            var newParts = hash.split("/+/");
            var oldParts = dialogs.map(el => sQuery(el).data('qroute') as string);

            var same = 0;
            while (same < dialogs.length &&
                same < newParts.length &&
                oldParts[same] == newParts[same]) {
                same++;
            }

            for (var i = same; i < dialogs.length; i++) {
                var d = sQuery(dialogs[i]);
                if (d.hasClass('ui-dialog-content'))
                    (d as any).dialog?.('close');
                else if (d.hasClass('s-Panel'))
                    closePanel(d);
            }

            for (var i = same; i < newParts.length; i++) {
                var route = newParts[i];
                var routeParts = route.split('@');
                var handler: JQuery;
                if (routeParts.length == 2) {
                    var dialog = i > 0 ? sQuery(dialogs[i - 1]) : sQuery([]);
                    if (dialog.length) {
                        var idPrefix = dialog.attr("id");
                        if (idPrefix) {
                            handler = sQuery('#' + idPrefix + "_" + routeParts[0]);
                            if (handler.length) {
                                route = routeParts[1];
                            }
                        }
                    }

                    if (!handler || !handler.length) {
                        handler = sQuery('#' + routeParts[0]);
                        if (handler.length) {
                            route = routeParts[1];
                        }
                    }
                }

                if (!handler || !handler.length) {
                    handler = i > 0 ? sQuery(dialogs[i - 1]) :
                        sQuery('.route-handler').first();
                }

                handler.triggerHandler("handleroute", <HandleRouteEventArgs>{
                    handled: false,
                    route: route,
                    parts: newParts,
                    index: i
                });
            }
        }
        finally {
            resolving--;
        }
    }

    function hashChange(e: any, o: string) {
        if (ignoreHash > 0) {
            if (new Date().getTime() - ignoreTime > 1000) {
                ignoreHash = 0;
            }
            else {
                ignoreHash--;
                return;
            }
        }
        resolve();
    }

    function ignoreChange() {
        ignoreHash++;
        ignoreTime = new Date().getTime();
    }

    window.addEventListener("hashchange", hashChange as any, false);

    let routerOrder = 1;

    typeof document !== "undefined" && typeof sQuery !== "undefined" &&
        sQuery.fn && sQuery(document).on("dialogopen panelopen", ".ui-dialog-content, .s-Panel", function (event, ui) {
        if (!enabled)
            return;

        var dlg = sQuery(event.target);
        dlg.data("qrouterorder", routerOrder++);

        if (dlg.data("qroute"))
            return;

        dlg.data("qprhash", window.location.hash);
        var owner = sQuery(visibleDialogs).not(dlg).last();
        if (!owner.length)
            owner = sQuery('html');

        dialogOpen(owner, dlg, () => {
            return "!" + (++autoinc).toString(36);
        });
    });
}