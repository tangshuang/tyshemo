import {
  getConstructorOf,
  each,
  define,
  isInheritedOf,
  isConstructor,
  isArray,
  isObject,
  isEqual,
  isString,
  makeKeyChain,
  isNumeric,
  isNumber,
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
  const keys = Object.keys(ref)
  return isObject(ref) && ref.$$type === 'memoRef' && !['getter', 'compare', 'depend'].some(item => !keys.includes(item))
}


export function isKeyPathEqual(keyPath1, keyPath2) {
  if (isString(keyPath1) && isString(keyPath2)) {
    return keyPath1 === keyPath2
  }

  const key1 = isArray(keyPath1) ? [...keyPath1] : makeKeyChain(keyPath1)
  const key2 = isArray(keyPath2) ? [...keyPath2] : makeKeyChain(keyPath2)

  const len = Math.max(key1.length, key2.length)

  for (let i = 0; i < len; i ++) {
    const path1 = key1[i]
    const path2 = key2[i]

    if (path1 === path2) {
      continue
    }

    if (isNumeric(path1) && isNumber(path2) && path1 === (path2 + '')) {
      continue
    }

    if (isNumeric(path2) && isNumber(path1) && path2 === (path1 + '')) {
      continue
    }

    return false
  }

  return true
}
