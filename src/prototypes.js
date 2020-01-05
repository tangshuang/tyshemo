import {
  isNull,
  isUndefined,
  isNumeric,
  isNumber,
  isString,
} from 'ts-fns'

import Prototype from './prototype.js'

export const Null = /*#__PURE__*/new Prototype({
  name: 'Null',
  validate: isNull,
})

export const Undefined = /*#__PURE__*/new Prototype({
  name: 'Undefined',
  validate: isUndefined,
})

export const Numeric = /*#__PURE__*/new Prototype({
  name: 'Numeric',
  validate: isNumeric,
})

export const Any = /*#__PURE__*/new Prototype({
  name: 'Any',
  validate: () => true,
})

export const Int = /*#__PURE__*/new Prototype({
  name: 'Int',
  validate: value => isNumber(value) && Number.isInteger(value),
})

export const Float = /*#__PURE__*/new Prototype({
  name: 'Float',
  validate: value => isNumber(value) && !Number.isInteger(value),
})

export const Negative = /*#__PURE__*/new Prototype({
  name: 'Negative',
  validate: value => isNumber(value) && value < 0,
})

export const Positive = /*#__PURE__*/new Prototype({
  name: 'Positive',
  validate: value => isNumber(value) && value > 0,
})

export const Finity = /*#__PURE__*/new Prototype({
  name: 'Finity',
  validate: value => isNumber(value) && Number.isFinite(value),
})

export const Zero = /*#__PURE__*/new Prototype({
  name: 'Zero',
  validate: value => value === 0,
})

export const Natural = /*#__PURE__*/new Prototype({
  name: 'Natural',
  validate: value => isNumber(value) && Number.isInteger(value) && value >= 0,
})

export const String8 = /*#__PURE__*/new Prototype({
  name: 'String8',
  validate: value => isString(value) && value.length <= 8,
})

export const String16 = /*#__PURE__*/new Prototype({
  name: 'String16',
  validate: value => isString(value) && value.length <= 16,
})

export const String32 = /*#__PURE__*/new Prototype({
  name: 'String32',
  validate: value => isString(value) && value.length <= 32,
})

export const String64 = /*#__PURE__*/new Prototype({
  name: 'String64',
  validate: value => isString(value) && value.length <= 64,
})

export const String128 = /*#__PURE__*/new Prototype({
  name: 'String128',
  validate: value => isString(value) && value.length <= 128,
})
