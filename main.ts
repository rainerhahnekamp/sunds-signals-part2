// Framework Code

abstract class AbstractComponent {
  constructor(public html: string) {}
}

type ComponentClass<Component extends AbstractComponent> = new () => Component;

// ## Property Binding
let currentBindingId = 0;

function notNullable<T>(fn: () => T | undefined): NonNullable<T> {
  const result = fn();
  if (result === undefined || result === null) {
    throw new Error("nullable");
  }
  return result;
}

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

function bootstrapApplication<Component extends AbstractComponent>(
  appComponentClass: ComponentClass<Component>
) {
  window.addEventListener("load", () => {
    const appComponent = new appComponentClass();

    const { bindingPerId: propertyBindingPerId, html: propertyBoundHtml } =
      setPropertyBindings(appComponent, appComponent.html);
    document.body.innerHTML = propertyBoundHtml;
  });
}

// Application Code
class AppComponent extends AbstractComponent {
  constructor() {
    super(
      `<div>
    <h1>{{title}}</h1>
    <p>{{time}}</p>
  </div>`
    );
  }

  title = "Clock App";
  time = new Date().toLocaleTimeString();
}

bootstrapApplication(AppComponent);
