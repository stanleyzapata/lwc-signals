import { $signal } from "../core";

describe("signals", () => {
  test("contain the passed value by default", () => {
    const signal = $signal(0);
    expect(signal.value).toBe(0);
  });

  test("update their value when a new one is set", () => {
    const signal = $signal(0);
    signal.value = 1;
    expect(signal.value).toBe(1);
  });

  test("delay changing their value when debounced", async () => {
    const debouncedSignal = $signal(0, {
      debounce: 100
    });

    debouncedSignal.value = 1;

    expect(debouncedSignal.value).toBe(0);

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(debouncedSignal.value).toBe(1);
  });

  test("should be identified with a symbol", () => {
    const signal = $signal(0);
    expect(signal.brand).toBe(Symbol.for("lwc-signals"));
  });

  test("allow for peeking the value without triggering a reactivity", () => {
    const signal = $signal(0);
    const spy = jest.fn(() => signal.value);
    const value = signal.peek();
    expect(spy).not.toHaveBeenCalled();
    expect(value).toBe(0);
  });
});


