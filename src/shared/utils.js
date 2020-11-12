import {
  getConstructorOf,
  each,
  define,
  isInheritedOf,
  isConstructor,
  isArray,
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