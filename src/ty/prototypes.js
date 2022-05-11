import {
  isNull,
  isUndefined,
  isNumeric,
  isNumber,
  isString,
  isNone,
} from 'ts-fns'

import { Prototype } from './prototype.js'

export class Null extends Prototype {
  name = 'Null'
  validate = isNull
}

export class Undefined extends Prototype {
  name = 'Undefined'
  validate = isUndefined
}

export class None extends Prototype {
  name = 'None'
  validate = isNone
}

export class Any extends Prototype {
  name = 'Any'
  validate = () => true
}

export class Numeric extends Prototype {
  name = 'Numeric'
  validate = value => isNumber(value) || isNumeric(value)
  static Number = class extends Numeric {
    validate = isNumber
  }
  static String = class extends Numeric {
    validate = isNumeric
  }
}

export class Int extends Prototype {
  name = 'Int'
  validate = value => (isNumber(value) && Number.isInteger(value)) || (isNumeric(value) && Number.isInteger(+value))
  static Number = class extends Int {
    validate = value => isNumber(value) && Number.isInteger(value)
  }
  static String = class extends Int {
    validate = value => isNumeric(value) && Number.isInteger(+value)
  }
}

export class Float extends Prototype {
  name = 'Float'
  validate = value => (isNumber(value) && !Number.isInteger(value)) || (isNumeric(value) && !Number.isInteger(+value))
  static Number = class extends Float {
    validate = value => isNumber(value) && !Number.isInteger(value)
  }
  static String = class extends Float {
    validate = value => isNumeric(value) && !Number.isInteger(+value)
  }
}

export class Negative extends Prototype {
  name = 'Negative'
  validate = value => (isNumber(value) && value < 0) || (isNumeric(value) && +value < 0)
  static Number = class extends Negative {
    validate = value => isNumber(value) && value < 0
  }
  static String = class extends Negative {
    validate = value => isNumeric(value) && +value < 0
  }
}

export class Positive extends Prototype {
  name = 'Positive'
  validate = value => (isNumber(value) && value > 0) || (isNumeric(value) && +value > 0)
  static Number = class extends Positive {
    validate = value => isNumber(value) && value > 0
  }
  static String = class extends Positive {
    validate = value => isNumeric(value) && +value > 0
  }
}

export class Zero extends Prototype {
  name = 'Zero'
  validate = value => value === 0 || value + '' === '0'
  static Number = class extends Zero {
    validate = value => value === 0
  }
  static String = class extends Zero {
    validate = value => value + '' === '0'
  }
}

export class Natural extends Prototype {
  name = 'Natural'
  validate = value => (isNumber(value) || isNumeric(value)) && Number.isInteger(+value) && +value >= 0
  static Number = class extends Natural {
    validate = value => isNumber(value) && Number.isInteger(value) && value >= 0
  }
  static String = class extends Natural {
    validate = value => isNumeric(value) && Number.isInteger(+value) && +value >= 0
  }
}

export class Finity extends Prototype {
  name = 'Finity'
  validate = value => isNumber(value) && Number.isFinite(value)
}

export class String8 extends Prototype {
  name = 'String8'
  validate = value => isString(value) && value.length <= 8
}

export class String16 extends Prototype {
  name = 'String16'
  validate = value => isString(value) && value.length <= 16
}

export class String32 extends Prototype {
  name = 'String32'
  validate = value => isString(value) && value.length <= 32
}

export class String64 extends Prototype {
  name = 'String64'
  validate = value => isString(value) && value.length <= 64
}

export class String128 extends Prototype {
  name = 'String128'
  validate = value => isString(value) && value.length <= 128
}
