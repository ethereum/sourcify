type ArgumentTypes<F> = F extends (...args: infer A) => any ? A : never;

type Arrayify<T> = {
  [K in keyof T]: Array<T[K]>;
};

export type GenericEvents = {
  "*": (...args: any) => any;
  [index: string]: (...args: any) => any;
};

export class EventManager<Events extends GenericEvents> {
  listeners: Arrayify<Events>;
  constructor(init: Arrayify<Events>) {
    this.listeners = init;
  }
  on<T extends keyof Events>(event: T, listener: Arrayify<Events>[T]) {
    const listeners = this.listeners[event];
    this.listeners[event] = listeners.concat(listener) as Arrayify<Events>[T];
  }
  trigger<T extends keyof Events, K extends Arrayify<Events>[T][any]>(
    event: T,
    ...args: ArgumentTypes<K>
  ): ReturnType<K>[] {
    if (this.listeners["*"]) {
      this.listeners["*"].map((listener: any) =>
        listener(event, ...(args as Array<any>))
      );
    }
    return this.listeners[event]?.map((listener: any) =>
      listener(...(args as Array<any>))
    );
  }
}
