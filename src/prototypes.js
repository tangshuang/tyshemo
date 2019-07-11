import Prototype from './prototype.js'
import { isNull, isUndefined, isNumeric, isNumber } from './utils.js'

export const Null = new Prototype({
  name: 'Null',
  validate: isNull,
})

export const Undefined = new Prototype({
  name: 'Undefined',
  validate: isUndefined,
})

export const Numeric = new Prototype({
  name: 'Numeric',
  validate: isNumeric,
})

export const Any = new Prototype({
  name: 'Any',
  validate: () => true,
})

export const Int = new Prototype({
  name: 'Int',
  validate: value => isNumber(value) && Number.isInteger(value),
})

export const Float = new Prototype({
  name: 'Float',
  validate: value => isNumber(value) && !Number.isInteger(value),
})

export const Negative = new Prototype({
  name: 'Negative',
  validate: value => isNumber(value) && value < 0,
})

export const Positive = new Prototype({
  name: 'Positive',
  validate: value => isNumber(value) && value > 0,
})

export const Finity = new Prototype({
  name: 'Finity',
  validate: value => isNumber(value) && Number.isFinite(value),
})

export const Zero = new Prototype({
  name: 'Zero',
  validate: value => value === 0,
})
