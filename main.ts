abstract class Component {
  constructor(public selector: string, public html: string) {}
}

class AppComponent extends Component {
  constructor() {
    super(
      "app-root",
      `<div>
    <h1>Welcome</h1>
    <p>{{time}}</p>
    <button (click)="updateTime()">Update</button>
  </div>`
    );
  }

  time = new Date().toLocaleTimeString();

  updateTime() {
    this.time = new Date().toLocaleTimeString();
    console.log(this.time);
  }
}

const appComponent = new AppComponent();
let currentBindingId = 1;

const registeredComponents = new Map<string, Component>([
  ["app-component", new AppComponent()],
]);

function getBindingProperty<Comp extends Component>(
  expression: string,
  component: Comp
): keyof Comp {
  const name = expression.substring(2, expression.length - 2);
  if (!(name in component)) {
    throw new Error(`cannot find ${name} in ${component}`);
  }

  // TODO: Why does this not work automatically
  return name as keyof Comp;
}

function notNullable<T>(fn: () => T | undefined): NonNullable<T> {
  const result = fn();
  if (result === undefined || result === null) {
    throw new Error("nullable");
  }
  return result;
}

function setPropertyBindings(component: Component, html: string) {
  const bindingPerId = new Map<
    keyof Component,
    { id: number; value: string }
  >();
  const bindings = html.match(/{{[a-z-]+}}/g) || [];
  for (const binding of bindings) {
    const name = getBindingProperty(binding, component);
    const value = component[name];
    bindingPerId.set(name, {
      id: currentBindingId,
      value,
    });
    const placeholderTag = `<span id="ng-${currentBindingId}">${value}</span>`;
    html = html.replace(binding, placeholderTag);
    currentBindingId++;
  }
  return { bindingPerId, html };
}

function createBindingsMap(
  bindingPerId: Map<keyof Component, { id: number; value: string }>
) {
  const bindingMap = new Map<
    keyof Component,
    { dom: HTMLSpanElement; currentValue: string }
  >();
  bindingPerId.forEach(({ id, value }, binding) => {
    bindingMap.set(binding, {
      dom: document.getElementById(`ng-${id}`) as HTMLSpanElement,
      currentValue: value,
    });
  });
  return bindingMap;
}

function getHandler(event: string, component: Component): keyof Component {
  const handler = notNullable(() => event.match(/"(\w+)\(\)"/))[1];
  return handler as keyof Component;
}

function setEventBindings(component: Component, html: string) {
  const bindingPerId = new Map<number, keyof Component>();
  const events = html.match(/\(click\)="\w+\(\)"/g) || [];
  for (const event of events) {
    currentBindingId++;
    const handler = getHandler(event, component);
    html = html.replace(event, `id="ng-${currentBindingId}"`);
    bindingPerId.set(currentBindingId, handler);
  }

  return { bindingPerId, html };
}

function applyEventBindings(
  bindingPerId: Map<number, keyof Component>,
  component: Component
) {
  bindingPerId.forEach((handler, id) => {
    const dom = document.getElementById(`ng-${id}`) as HTMLElement;
    const handlerFn = component[handler] as unknown as () => void;
    if (typeof handlerFn === "function") {
      dom.addEventListener("click", () => handlerFn.apply(component));
    }
  });
}

window.addEventListener("load", () => {
  const component: Component = appComponent;
  const { bindingPerId: propertyBindingPerId, html: propertyBoundHtml } =
    setPropertyBindings(component, component.html);

  const { bindingPerId: eventBindingPerId, html: finalHtml } = setEventBindings(
    component,
    propertyBoundHtml
  );

  document.body.innerHTML = finalHtml;
  applyEventBindings(eventBindingPerId, component);

  const bindingMap = createBindingsMap(propertyBindingPerId);

  console.log(bindingMap);
});
