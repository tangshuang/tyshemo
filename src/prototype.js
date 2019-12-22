import {
  isInstanceOf,
  isNaN,
  isNumber,
  isBoolean,
  isString,
  isFunction,
  isArray,
  isObject,
  isSymbol,
  isConstructor,
  isFinite,
} from 'ts-fns/es/is.js'

export class Prototype {
  constructor({ name, validate }) {
    this.name = name
    this._validate = validate
  }
  validate(value) {
    return !!this._validate.call(this, value)
  }
  toString() {
    return this.name
  }
}

export default Prototype

const prototypes = []
Prototype.registry = (proto, validate) => {
  const item = prototypes.find(item => item.proto === proto)
  if (item) {
    item.validate = validate
  }
  else {
    prototypes.push({ proto, validate })
  }
}
Prototype.unregistry = (proto) => {
  if (arguments.length === 0) {
    prototypes.length = 0
    return
  }

  for (let i = 0, len = prototypes.length; i < len; i ++) {
    const item = prototypes[i]
    if (item.proto === proto) {
      prototypes.splice(i, 1)
      break
    }
  }
}
Prototype.find = proto => prototypes.find(item => item.proto === proto)
Prototype.is = proto => ({

  // Prototype.is(Number).existing()
  existing: () => isInstanceOf(proto, Prototype) || isNaN(proto) || isInstanceOf(proto, RegExp) || isConstructor(proto) || !!Prototype.find(proto),

  // Prototype.is(Number).typeof(10)
  typeof: (value) => {

    if (isInstanceOf(proto, Prototype)) {
      return proto.validate(value)
    }

    const item = Prototype.find(proto)
    if (item) {
      return item.validate(value)
    }

    if (isNaN(proto)) {
      return isNaN(value)
    }

    if (isInstanceOf(proto, RegExp)) {
      return isString(value) && proto.test(value)
    }

    if (isConstructor(proto)) {
      return isInstanceOf(value, proto)
    }

    return false

  },

  // Prototype.is(10).equal(10)
  equal: value => proto === value,

})

Prototype.registry(Number, isNumber)
Prototype.registry(String, isString)
Prototype.registry(Boolean, isBoolean)
Prototype.registry(Object, isObject)
Prototype.registry(Array, isArray)
Prototype.registry(Function, isFunction)
Prototype.registry(Symbol, isSymbol)
Prototype.registry(Infinity, value => !isFinite(value))
