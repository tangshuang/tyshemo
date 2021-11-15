import {
  getConstructorOf,
  each,
  define,
  isInheritedOf,
  isConstructor,
  isArray,
  isObject,
  isEqual,
} from 'ts-fns'

export function ofChain(target, TopConstructor) {
  const properties = {}
  const push = (target) => {
    // if it is a Constructor
    if (!isConstructor(target)) {
      target = getConstructorOf(target)
    }

    if (target === TopConstructor) {
      return
    }

    each(target, (descriptor, key) => {
      if (!Object.getOwnPropertyDescriptor(properties, key)) {
        define(properties, key, descriptor)
      }
    }, true)

    // to parent
    const Parent = getConstructorOf(target.prototype)
    if (isInheritedOf(Parent, TopConstructor)) {
      push(target.prototype)
    }
  }
  push(target)
  return properties
}

export function tryGet(get, use) {
  try {
    return get()
  }
  catch (e) {
    return use
  }
}

export function makeMsg(errors) {
  if (errors.length) {
    errors.message = errors[0].message
  }
  return errors
}

export function patchObj(source, input) {
  each(input, (value, key) => {
    const src = source[key]
    if (isArray(src) && isArray(value)) {
      src.push(...value)
    }
    else if (isObject(src) && isObject(value)) {
      patchObj(src, value)
    }
    else {
      source[key] = value
    }
  })
}

export function createAsyncRef(defaultValue, getter) {
  const ref = {
    current: defaultValue,
    deferer: null,
    getter,
    $$type: 'asyncRef',
    attach(...args) {
      if (ref.deferer) {
        return ref.deferer
      }

      ref.deferer = Promise.resolve().then(() => getter.call(this, ...args)).then((next) => {
        ref.current = next
        return next
      })
      return ref.deferer
    },
  }
  return ref
}

export function isAsyncRef(ref) {
  return isObject(ref) && ref.$$type === 'asyncRef' && isEqual(Object.keys(ref), ['$$type', 'current'])
}

export function createMemoRef(getter, compare, depend) {
  const ref = {
    $$type: 'memoRef',
    getter,
    compare,
    depend,
  }
  return ref
}

export function isMemoRef(ref) {
  return isObject(ref) && ref.$$type === 'memoRef' && !Object.keys(ref).some(item => !['getter', 'compare', 'depend'].includes(item))
}
