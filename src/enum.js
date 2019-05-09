import Type from './type.js'
import TsmError from './error.js'
import { isArray } from './utils.js'

export class Enum extends Type {
  constructor(pattern) {
    if (!isArray(pattern)) {
      throw new TsmError('Enum pattern should be an array.')
    }

    super(pattern)
    this.name = 'Enum'
  }
  assert(value) {
    const pattern = this.pattern
    const info = { value, pattern, type: this, level: 'type', action: 'assert' }
    const patterns = pattern

    for (let i = 0, len = patterns.length; i < len; i ++) {
      let pattern = patterns[i]
      let error = this.validate(value, pattern)
      // if there is one match, break the loop
      if (!error) {
        return
      }
    }

    throw new TsmError('mistaken', info)
  }
}

export function enumerate(pattern) {
  const type = new Enum(pattern)
  return type
}

export default Enum
