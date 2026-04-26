export const egressStrategyItems = [
  { value: "direct", label: "direct" },
  { value: "proxy", label: "proxy" }
];

export function actionStrategyItems(hasProxy: boolean) {
  return egressStrategyItems.filter((item) => hasProxy || item.value !== "proxy");
}

export function routeStrategyItems(hasProxy: boolean) {
  return actionStrategyItems(hasProxy);
}
