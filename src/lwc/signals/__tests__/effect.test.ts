import { $signal, $effect } from "../core";

describe("effects", () => {
  test("react to the callback immediately", () => {
    const signal = $signal(0);
    const spy = jest.fn(() => signal.value);
    $effect(spy);
    expect(spy).toHaveBeenCalled();
  });

  test("react to updates in a signal", () => {
    const signal = $signal(0);
    const spy = jest.fn(() => signal.value);
    $effect(spy);
    spy.mockReset();

    signal.value = 1;
    expect(spy).toHaveBeenCalled();
  });

  test("react to updates in multiple signals", () => {
    const a = $signal(0);
    const b = $signal(0);
    const spy = jest.fn(() => a.value + b.value);
    $effect(spy);
    spy.mockReset();

    a.value = 1;
    b.value = 1;
    expect(spy).toHaveBeenCalledTimes(2);
  });

  test("throw an error when a circular dependency is detected", () => {
    expect(() => {
      const signal = $signal(0);
      $effect(() => {
        signal.value = signal.value++;
      });
    }).toThrow();
  });
});
