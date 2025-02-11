﻿import jQuery from "@optionaldeps/jquery";
import sQuery from "@optionaldeps/squery";
import { Config, ListRequest, ServiceResponse, alertDialog, blockUI, blockUndo, iframeDialog, resolveServiceUrl, resolveUrl } from "@serenity-is/base";
import { ErrorHandling } from "./errorhandling";
import { extend } from "./system-compat";

typeof jQuery !== 'undefined' && jQuery.ajaxSetup && jQuery.ajaxSetup({
    beforeSend: function (xhr, opt) {
        if (!opt || !opt.crossDomain) {
            var token = getCookie('CSRF-TOKEN');
            if (token)
                xhr.setRequestHeader('X-CSRF-TOKEN', token);
        }
    }
});

export function getCookie(name: string) {
    if ((jQuery as any).cookie)
        return (jQuery as any).cookie(name);

    name += '=';
    for (var ca = document.cookie.split(/;\s*/), i = ca.length - 1; i >= 0; i--)
        if (!ca[i].indexOf(name))
            return ca[i].replace(name, '');
}

export interface ServiceOptions<TResponse extends ServiceResponse> extends JQueryAjaxSettings {
    request?: any;
    service?: string;
    blockUI?: boolean;
    onError?(response: TResponse): void;
    onSuccess?(response: TResponse): void;
    onCleanup?(): void;
}

export function serviceCall<TResponse extends ServiceResponse>(options: ServiceOptions<TResponse>): PromiseLike<TResponse> {
    let handleError = function (response: any) {
        if (Config.notLoggedInHandler != null &&
            response &&
            response.Error &&
            response.Error.Code == 'NotLoggedIn' &&
            Config.notLoggedInHandler(options, response)) {
            return;
        }

        if (options.onError != null) {
            options.onError(response);
            return;
        }

        ErrorHandling.showServiceError(response.Error);
    };

    let url = resolveServiceUrl(options.service)

    options = extend<ServiceOptions<TResponse>>({
        dataType: 'json',
        contentType: 'application/json',
        type: 'POST',
        cache: false,
        blockUI: true,
        url: url,
        data: JSON.stringify(options.request),
        success: function (data: any, textStatus: string, request: any) {
            try {
                if (!data.Error && options.onSuccess) {
                    options.onSuccess(data);
                }
            }
            finally {
                options.blockUI && blockUndo();
                options.onCleanup && options.onCleanup();
            }
        },
        error: function (xhr: any, status: any, ev: any) {
            try {
                if (xhr.status === 403) {
                    var l: any = null;
                    try {
                        l = xhr.getResponseHeader('Location');
                    }
                    catch ($t1) {
                        l = null;
                    }
                    if (l) {
                        window.top.location.href = l;
                        return;
                    }
                }
                if ((xhr.getResponseHeader('content-type') || '')
                    .toLowerCase().indexOf('application/json') >= 0) {
                    var json = JSON.parse(xhr.responseText);
                    if (json && json.Error) {
                        handleError(json);
                        return;
                    }
                }
                var html = xhr.responseText;
                if (!html) {
                    if (!xhr.status) {
                        if (xhr.statusText != "abort")
                            alertDialog("An unknown AJAX connection error occurred! Check browser console for details.");
                    }
                    else if (xhr.status == 500)
                        alertDialog("HTTP 500: Connection refused! Check browser console for details.");
                    else
                        alertDialog("HTTP " + xhr.status + ' error! Check browser console for details.');
                }
                else
                    iframeDialog({ html: html });
            }
            finally {
                if (options.blockUI) {
                    blockUndo();
                }
                options.onCleanup && options.onCleanup();
            }
        }
    }, options);

    options.blockUI && blockUI(null);
    return sQuery.ajax(options);
}

export function serviceRequest<TResponse extends ServiceResponse>(service: string, request?: any,
    onSuccess?: (response: TResponse) => void, options?: ServiceOptions<TResponse>): PromiseLike<TResponse> {
    return serviceCall(extend<ServiceOptions<TResponse>>({
        service: service,
        request: request,
        onSuccess: onSuccess
    }, options));
}

export function setEquality(request: ListRequest, field: string, value: any) {
    if (request.EqualityFilter == null) {
        request.EqualityFilter = {};
    }
    request.EqualityFilter[field] = value;
}

export interface PostToServiceOptions {
    url?: string;
    service?: string;
    target?: string;
    request: any;
}

export interface PostToUrlOptions {
    url?: string;
    target?: string;
    params: any;
}

export function parseQueryString(s?: string): {} {
    let qs: string;
    if (s === undefined)
        qs = location.search.substring(1, location.search.length);
    else
        qs = s || '';
    let result: Record<string, string> = {};
    let parts = qs.split('&');
    for (let i = 0; i < parts.length; i++) {
        let pair = parts[i].split('=');
        let name = decodeURIComponent(pair[0]);
        result[name] = (pair.length >= 2 ? decodeURIComponent(pair[1]) : name);
    }
    return result;
}

export function postToService(options: PostToServiceOptions) {
    let form = sQuery('<form/>')
        .attr('method', 'POST')
        .attr('action', options.url ? (resolveUrl(options.url)) : resolveServiceUrl(options.service))
        .appendTo(document.body);
    if (options.target)
        form.attr('target', options.target);
    let div = sQuery('<div/>').appendTo(form);
    sQuery('<input/>').attr('type', 'hidden').attr('name', 'request')
        .val(jQuery['toJSON'](options.request))
        .appendTo(div);
    var csrfToken = getCookie('CSRF-TOKEN');
    if (csrfToken) {
        sQuery('<input/>').attr('type', 'hidden').attr('name', '__RequestVerificationToken')
            .appendTo(div).val(csrfToken);
    }
    sQuery('<input/>').attr('type', 'submit')
        .appendTo(div);
    form.submit();
    window.setTimeout(function () { form.remove(); }, 0);
}

export function postToUrl(options: PostToUrlOptions) {
    let form = sQuery('<form/>')
        .attr('method', 'POST')
        .attr('action', resolveUrl(options.url))
        .appendTo(document.body);
    if (options.target)
        form.attr('target', options.target);
    let div = sQuery('<div/>').appendTo(form);
    if (options.params != null) {
        for (let k in options.params) {
            sQuery('<input/>').attr('type', 'hidden').attr('name', k)
                .val(options.params[k])
                .appendTo(div);
        }
    }
    var csrfToken = getCookie('CSRF-TOKEN');
    if (csrfToken) {
        sQuery('<input/>').attr('type', 'hidden').attr('name', '__RequestVerificationToken')
            .appendTo(div).val(csrfToken);
    }
    sQuery('<input/>').attr('type', 'submit')
        .appendTo(div);
    form.submit();
    window.setTimeout(function () { form.remove(); }, 0);
}