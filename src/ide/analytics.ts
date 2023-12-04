
declare var ga;

export function gaEvent(category: string, action: string, label?: string, value?: string) {
    if (window['ga']) {
        ga('send', 'event', category, action, label, value);
    }
}

export function gaPageView(page: string) {
    if (window['ga']) {
        ga('send', 'pageview', page);
    }
}
