import Ty from './ty.js'

export { Prototype } from './prototype.js'
export {
  Null,
  Undefined,
  None,
  Any,
  Numeric,
  Int,
  Float,
  Negative,
  Positive,
  Natural,
  Finity,
  Zero,
  String8,
  String16,
  String32,
  String64,
  String128,
} from './prototypes.js'

export { Type } from './type.js'
export { Dict, dict } from './dict.js'
export { List, list } from './list.js'
export { Tuple, tuple } from './tuple.js'
export { Enum, enumerate } from './enum.js'
export { Range, range } from './range.js'
export { Mapping, mapping } from './mapping.js'
export { SelfRef, selfref } from './self-ref.js'

export { Rule } from './rule.js'
export {
  asynch,
  ifexist,
  match,
  determine,
  shouldmatch,
  shouldnotmatch,
  ifnotmatch,
  ifmatch,
  shouldexist,
  shouldnotexist,
  instance,
  equal,
  nullable,
  lambda,
} from './rules.js'

export { TyError } from './ty-error.js'

export { Ty }
export default Ty
