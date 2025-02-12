/* eslint-disable */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
/*
 * Copyright (c) 2023, Salesforce.com, Inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */
import {
    toString,
    isArray,
    unwrap,
    isExtensible,
    preventExtensions,
    ObjectDefineProperty,
    hasOwnProperty,
    isUndefined,
    ProxyPropertyKey,
} from './shared';
import { BaseProxyHandler, ShadowTarget } from './base-handler';

const getterMap = new WeakMap<() => any, () => any>();
const setterMap = new WeakMap<(v: any) => void, (v: any) => void>();
const reverseGetterMap = new WeakMap<() => any, () => any>();
const reverseSetterMap = new WeakMap<(v: any) => void, (v: any) => void>();

export class ReactiveProxyHandler extends BaseProxyHandler {
    wrapValue(value: any): any {
        return this.membrane.getProxy(value);
    }
    wrapGetter(originalGet: () => any): () => any {
        const wrappedGetter = getterMap.get(originalGet);
        if (!isUndefined(wrappedGetter)) {
            return wrappedGetter;
        }
        const handler = this;
        const get = function (this: any): any {
            // invoking the original getter with the original target
            return handler.wrapValue(originalGet.call(unwrap(this)));
        };
        getterMap.set(originalGet, get);
        reverseGetterMap.set(get, originalGet);
        return get;
    }
    wrapSetter(originalSet: (v: any) => void): (v: any) => void {
        const wrappedSetter = setterMap.get(originalSet);
        if (!isUndefined(wrappedSetter)) {
            return wrappedSetter;
        }
        const set = function (this: any, v: any) {
            // invoking the original setter with the original target
            originalSet.call(unwrap(this), unwrap(v));
        };
        setterMap.set(originalSet, set);
        reverseSetterMap.set(set, originalSet);
        return set;
    }
    unwrapDescriptor(descriptor: PropertyDescriptor): PropertyDescriptor {
        if (hasOwnProperty.call(descriptor, 'value')) {
            // dealing with a data descriptor
            descriptor.value = unwrap(descriptor.value);
        } else {
            const { set, get } = descriptor;
            if (!isUndefined(get)) {
                descriptor.get = this.unwrapGetter(get);
            }
            if (!isUndefined(set)) {
                descriptor.set = this.unwrapSetter(set);
            }
        }
        return descriptor;
    }
    unwrapGetter(redGet: () => any): () => any {
        const reverseGetter = reverseGetterMap.get(redGet);
        if (!isUndefined(reverseGetter)) {
            return reverseGetter;
        }
        const handler = this;
        const get = function (this: any): any {
            // invoking the red getter with the proxy of this
            return unwrap(redGet.call(handler.wrapValue(this)));
        };
        getterMap.set(get, redGet);
        reverseGetterMap.set(redGet, get);
        return get;
    }
    unwrapSetter(redSet: (v: any) => void): (v: any) => void {
        const reverseSetter = reverseSetterMap.get(redSet);
        if (!isUndefined(reverseSetter)) {
            return reverseSetter;
        }
        const handler = this;
        const set = function (this: any, v: any) {
            // invoking the red setter with the proxy of this
            redSet.call(handler.wrapValue(this), handler.wrapValue(v));
        };
        setterMap.set(set, redSet);
        reverseSetterMap.set(redSet, set);
        return set;
    }
    set(shadowTarget: ShadowTarget, key: ProxyPropertyKey, value: any): boolean {
        const {
            originalTarget,
            membrane: { valueMutated },
        } = this;
        const oldValue = originalTarget[key];
        if (oldValue !== value) {
            originalTarget[key] = value;
            valueMutated(originalTarget, key);
        } else if (key === 'length' && isArray(originalTarget)) {
            // fix for issue #236: push will add the new index, and by the time length
            // is updated, the internal length is already equal to the new length value
            // therefore, the oldValue is equal to the value. This is the forking logic
            // to support this use case.
            valueMutated(originalTarget, key);
        }
        return true;
    }
    deleteProperty(shadowTarget: ShadowTarget, key: ProxyPropertyKey): boolean {
        const {
            originalTarget,
            membrane: { valueMutated },
        } = this;
        delete originalTarget[key];
        valueMutated(originalTarget, key);
        return true;
    }
    setPrototypeOf(shadowTarget: ShadowTarget, prototype: any): any {
        throw new Error(
          `Invalid setPrototypeOf invocation for reactive proxy ${toString(
            this.originalTarget,
          )}. Prototype of reactive objects cannot be changed.`,
        );
    }
    preventExtensions(shadowTarget: ShadowTarget): boolean {
        if (isExtensible(shadowTarget)) {
            const { originalTarget } = this;
            preventExtensions(originalTarget);
            // if the originalTarget is a proxy itself, it might reject
            // the preventExtension call, in which case we should not attempt to lock down
            // the shadow target.
            // If a proxy rejects extensions, then calling preventExtensions will throw an error:
            // https://codepen.io/nolanlawson-the-selector/pen/QWMOjbY
            /* istanbul ignore if */
            if (isExtensible(originalTarget)) {
                return false;
            }
            this.lockShadowTarget(shadowTarget);
        }
        return true;
    }
    defineProperty(
        shadowTarget: ShadowTarget,
        key: ProxyPropertyKey,
        descriptor: PropertyDescriptor,
    ): boolean {
        const {
            originalTarget,
            membrane: { valueMutated, tagPropertyKey },
        } = this;
        if (key === tagPropertyKey && !hasOwnProperty.call(originalTarget, key)) {
            // To avoid leaking the membrane tag property into the original target, we must
            // be sure that the original target doesn't have yet.
            // NOTE: we do not return false here because Object.freeze and equivalent operations
            // will attempt to set the descriptor to the same value, and expect no to throw. This
            // is an small compromise for the sake of not having to diff the descriptors.
            return true;
        }
        ObjectDefineProperty(originalTarget, key, this.unwrapDescriptor(descriptor));
        // intentionally testing if false since it could be undefined as well
        if (descriptor.configurable === false) {
            this.copyDescriptorIntoShadowTarget(shadowTarget, key);
        }
        valueMutated(originalTarget, key);
        return true;
    }
}
