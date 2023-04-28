// Framework Code

abstract class AbstractComponent {
  constructor(public html: string) {}
}

type ComponentClass<Component extends AbstractComponent> = new () => Component;

function bootstrapApplication<Component extends AbstractComponent>(
  appComponentClass: ComponentClass<Component>
) {
  window.addEventListener("load", () => {
    const appComponent = new appComponentClass();
    document.body.innerHTML = appComponent.html;
  });
}

// Application Code
class AppComponent extends AbstractComponent {
  constructor() {
    super(
      `<div>
    <h1>Welcome</h1>
  </div>`
    );
  }
}

bootstrapApplication(AppComponent);
