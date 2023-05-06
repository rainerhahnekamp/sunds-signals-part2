// Framework Code

abstract class AbstractComponent {
  constructor(public html: string) {}
}

type ComponentClass<Component extends AbstractComponent> = new () => Component;

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

function bootstrapApplication<Component extends AbstractComponent>(
  appComponentClass: ComponentClass<Component>
) {
  window.addEventListener("load", () => {
    const appComponent = new appComponentClass();

    const { html: propertyBoundHtml } = setPropertyBindings(
      appComponent,
      appComponent.html
    );
    const {html: finalHtml, bindingPerId} = setEventBindings(appComponent, propertyBoundHtml);
    document.body.innerHTML = finalHtml;
    applyEventBindings(bindingPerId, appComponent)
  });
}

// Application Code
class AppComponent extends AbstractComponent {
  constructor() {
    super(
      `<div>
    <h1>{{title}}</h1>
    <div><p>{{time}}</p><button (click)="updateTime()">Update</button></div>
  </div>`
    );
  }

  title = "Clock App";
  time = new Date().toLocaleTimeString();

  updateTime() {
    this.time = new Date().toLocaleTimeString();
    console.log(this.time);
  }
}

bootstrapApplication(AppComponent);
