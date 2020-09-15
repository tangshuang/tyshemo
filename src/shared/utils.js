import {
  getConstructorOf,
  each,
  define,
  isInheritedOf,
} from 'ts-fns'

export function ofChain(instance, TopConstructor) {
  const properties = {}
  const push = (instance) => {
    const Constructor = getConstructorOf(instance)
    if (Constructor === TopConstructor) {
      return
    }
    const Parent = getConstructorOf(Constructor.prototype)
    if (isInheritedOf(Parent, TopConstructor)) {
      push(Constructor.prototype)
    }
    each(Constructor, (descriptor, key) => define(properties, key, descriptor), true)
  }
  push(instance)
  return properties
}

export function tryGet(get, use) {
  try {
    return get()
  }
  catch (e) {
    return use && use()
  }
}

export function delay(fn) {
  return Promise.resolve().then(() => fn())
}
