const WebInspectorBase = typeof HTMLElement === "undefined" ? class {} : HTMLElement;

export class WebInspectorElement extends WebInspectorBase {}

export function defineWebInspector() {}
