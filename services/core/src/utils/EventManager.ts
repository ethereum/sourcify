type ArgumentTypes<F> = F extends (...args: infer A) => any ? A : never;

export type GenericListenersInterface = {
  [index: string]: ((...args: any) => any)[];
};

export class EventManager<
  ListenersInterface extends GenericListenersInterface
> {
  listeners: ListenersInterface;
  constructor(init: ListenersInterface) {
    this.listeners = init;
  }
  on<T extends keyof ListenersInterface>(
    event: T,
    listener: ListenersInterface[T]
  ) {
    const listeners = this.listeners[event];
    this.listeners[event] = listeners.concat(listener) as ListenersInterface[T];
  }
  trigger<
    T extends keyof ListenersInterface,
    K extends ListenersInterface[T][any]
  >(event: T, ...args: ArgumentTypes<K>): ReturnType<K>[] {
    if (this.listeners["*"]) {
      this.listeners["*"].map((listener: any) =>
        listener(event, ...(args as Array<any>))
      );
    }
    return this.listeners[event].map((listener: any) =>
      listener(...(args as Array<any>))
    );
  }
}
