// Signale

interface Consumer<T> {
  onValueChange(value: T): void;
}

let activeConsumer: Consumer<unknown> | undefined;

interface Signal<T> {
  (): T;
  set(value: T): void;
}

function signal<T>(initialValue: T): Signal<T> {
  const consumers = new Set<Consumer<T>>();
  let internalValue = initialValue;
  return Object.assign(
    () => {
      if (activeConsumer) {
        consumers.add(activeConsumer);
      }
      return internalValue;
    },
    {
      set: (newValue: T) => {
        internalValue = newValue;
        for (const consumer of consumers) {
          consumer.onValueChange(internalValue);
        }
      },
    }
  );
}

class Computed<T> implements Consumer<T> {
  internalSignal: Signal<T>;
  constructor(private computedFn: () => T) {
    const prevConsumer = activeConsumer;
    activeConsumer = this;
    this.internalSignal = signal(this.computedFn());
    activeConsumer = prevConsumer;
  }

  onValueChange(value: T) {
    this.internalSignal.set(this.computedFn());
  }
}

function computed<T>(computedFn: () => T): Signal<T> {
  const computed = new Computed(computedFn);
  return computed.internalSignal;
}

function effect<T>(effectFn: () => T): void {
  const prevConsumer = activeConsumer;
  activeConsumer = {
    onValueChange(value: any) {
      effectFn();
    },
  };
  effectFn();
  activeConsumer = prevConsumer;
}

const time = signal(new Date());
const timeStr = computed(() => time().toLocaleDateString());
effect(() => {
  console.log(`current time is: ${timeStr()}`);
});
time.set(new Date(2023, 1, 1, 0, 0));

// Framework Code

abstract class AbstractComponent {
  static selector = "";
  static imports: ComponentClass<AbstractComponent>[] = [];
  constructor(public html: string) {}
}

// Rest des Framework Codes
type ComponentClass<Component extends AbstractComponent> = {
  new (): Component;
  selector: string;
  imports: ComponentClass<AbstractComponent>[];
};

// ## Property Binding
let currentBindingId = 0;

function assertKeyOf<Component extends AbstractComponent>(
  property: string | number | symbol,
  component: Component
): asserts property is keyof Component {
  if (!(property in component)) {
    throw new Error(`${String(property)} is not a property of ${component}`);
  }
}

function setPropertyBindings<Component extends AbstractComponent>(
  component: Component,
  html: string
) {
  const bindingForId = new Map<
    keyof Component,
    { id: number; value: string }
  >();
  for (const [binding, name] of html.matchAll(/{{([a-z-]+)}}/g)) {
    currentBindingId++;
    assertKeyOf(name, component);
    const value = String(component[name]);
    bindingForId.set(name, {
      id: currentBindingId,
      value,
    });
    const placeholderTag = `<span id="ng-${currentBindingId}">${value}</span>`;

    html = html.replace(binding, placeholderTag);
  }
  return { bindingPerId: bindingForId, html };
}

function setEventBindings<Component extends AbstractComponent>(
  component: Component,
  html: string
) {
  const bindingPerId = new Map<number, keyof Component>();
  for (const [binding, name] of html.matchAll(/\(click\)="(\w+)\(\)"/g) || []) {
    currentBindingId++;
    assertKeyOf(name, component);
    html = html.replace(binding, `id="ng-${currentBindingId}"`);
    bindingPerId.set(currentBindingId, name);
  }

  return { bindingPerId, html };
}

function applyEventBindings<Component extends AbstractComponent>(
  bindingPerId: Map<number, keyof Component>,
  component: Component
) {
  bindingPerId.forEach((handler, id) => {
    const dom = document.getElementById(`ng-${id}`) as Element;
    const handlerFn = component[handler] as unknown as () => void;
    if (typeof handlerFn === "function") {
      dom.addEventListener("click", () => handlerFn.apply(component));
    }
  });
}

type ComponentTree<Component extends AbstractComponent> = {
  component: Component;
  bindings: Map<keyof Component, { dom: HTMLElement; value: string }>;
  children: ComponentTree<AbstractComponent>[];
};

function getOrThrow<Type>(value: Type): NonNullable<Type> {
  if (value === null || value === undefined) {
    throw new Error("value cannot be nullable");
  }

  return value;
}

function renderComponent<Component extends AbstractComponent>(
  parentNode: Element,
  componentClass: ComponentClass<Component>
): ComponentTree<Component> {
  const component = new componentClass();
  const { bindingPerId: propertyBindingPerId, html: propertyBoundHtml } =
    setPropertyBindings(component, component.html);

  const { bindingPerId: eventBindingPerId, html: finalHtml } = setEventBindings(
    component,
    propertyBoundHtml
  );

  parentNode.innerHTML = finalHtml;
  applyEventBindings(eventBindingPerId, component);

  const bindings = new Map<
    keyof Component,
    { dom: HTMLElement; value: string }
  >();
  for (const [key, { id, value }] of propertyBindingPerId) {
    const dom = getOrThrow(document.getElementById(`ng-${id}`));
    bindings.set(key, { value, dom });
  }

  return {
    component,
    bindings,
    children: renderSubComponents(componentClass, component, parentNode),
  };
}

function renderSubComponents<Component extends AbstractComponent>(
  ParentComponentClass: ComponentClass<Component>,
  component: Component,
  dom: Element
): ComponentTree<AbstractComponent>[] {
  const compontentTrees = [];
  for (const SubComponent of ParentComponentClass.imports) {
    const selector: string = SubComponent.selector;

    const subComponents = dom.getElementsByTagName(selector);

    if (subComponents.length) {
      const [subComponent] = subComponents;
      compontentTrees.push(renderComponent(subComponent, SubComponent));
    }
  }

  return compontentTrees;
}

function detectChanges<Component extends AbstractComponent>({
  component,
  bindings,
  children,
}: ComponentTree<Component>) {
  for (const [propName, { dom, value }] of bindings.entries()) {
    if (value !== component[propName]) {
      const value = String(component[propName]);
      dom.innerText = value;
      bindings.set(propName, { dom, value });
    }
  }

  children.forEach(detectChanges);
}

let rootComponentTree: ComponentTree<any>;

function patchAddEventListener() {
  const original = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (
    ...args: Parameters<typeof original>
  ) {
    const callback = args[1];
    if (typeof callback === "function") {
      args[1] = (event: Event) => {
        callback(event);
        detectChanges(rootComponentTree);
      };
    }
    return original.apply(this, args);
  };
}

function bootstrapApplication<Component extends AbstractComponent>(
  appComponentClass: ComponentClass<Component>
) {
  patchAddEventListener();
  window.addEventListener("load", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);
    rootComponentTree = renderComponent(root, appComponentClass);

    getOrThrow(document.getElementById("btn-cd")).addEventListener(
      "click",
      () => detectChanges(rootComponentTree)
    );
  });
}

// Application Code
class ClockComponent extends AbstractComponent {
  static selector = "clock";
  time = signal(new Date());
  prettyTime = computed(() => this.time().toLocaleString());

  constructor() {
    super(
      `<div><p>{{prettyTime()}}</p><button (click)="updateTime()">Update</button></div>`
    );
  }

  updateTime() {
    this.time.set(new Date());
    console.log(this.time);
  }
}

class AppComponent extends AbstractComponent {
  static imports = [ClockComponent];
  constructor() {
    super(
      `<div>
    <h1>{{title}}</h1>
    <clock></clock>
  </div>`
    );
  }

  title = "Clock App";
}

bootstrapApplication(AppComponent);
