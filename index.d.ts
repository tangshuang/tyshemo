/* eslint-disable no-dupe-class-members */
/* eslint-disable no-redeclare */
/* eslint-disable no-unused-vars */

/**
 * 用于得到某个class的构造函数，例如：
 * class Some {}
 * ConstructorOf<Some> -> Some类型的构造函数，也就是class Some本身
 * 用处：
 * class Some {
 *  static fn<T>(this: ConstructorOf<T>): void; // -> this: ConstructorOf<T> 规定了该静态方法内的this类型，由于类型推导，此处的this被推导为Some本身
 * }
 */
type ConstructorOf<T> = new (...args: any[]) => T

/**
 * 读取数组的项的类型
 */
type ItemOf<T> = T extends Array<infer P> ? P : never

// https://lifesaver.codes/answer/type-manipulations-union-to-tuple-13298
// https://note.xiexuefeng.cc/post/ts-union-to-tuple/
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends ((k: infer I) => void) ? I : never
type IsUnion<T> = [T] extends [UnionToIntersection<T>] ? false : true
type UnionToOvlds<U> = UnionToIntersection<U extends any ? (f: U) => void : never>
type PopUnion<U> = UnionToOvlds<U> extends ((a: infer A) => void) ? (A extends boolean ? boolean extends U ? boolean : A : A) : never
type GetUnionLast<Unoin> = IsUnion<Unoin> extends true ? PopUnion<Unoin> : Unoin

// https://www.tangshuang.net/8487.html
type GetUnionKeys<Unoin> = Unoin extends any
  ? {
    [key in keyof Unoin]: key
  } extends {
    [key in keyof Unoin]: infer K
  }
  ? K
  : never
  : never
type UnionToInterByKeys<Union, Keys extends string | number | symbol> = {
  [key in Keys]: GetUnionLast<
    Union extends any
    ? {
      [k in keyof Union]: k extends key ? Union[k] : never
    } extends {
      [k in keyof Union]: infer P
    }
    ? P
    : never
    : never
  >
}
type UnionToInter<Unoin> = UnionToInterByKeys<Unoin, GetUnionKeys<Unoin>>

// -------------

interface Obj { [key: string]: any }

// -------------

interface PrototypeOptions {
  name?: string
  validate: (value: any) => boolean
}
export declare class Prototype {
  constructor(options: PrototypeOptions)

  name?: string
  validate: (value: any) => boolean

  static register(proto: any, validate: (value: any) => boolean): void
  static unregister(...args: any[]): void
  static is(proto: any): {
    existing: () => boolean
    typeof: (value: any) => boolean
  }
}

export declare class Null extends Prototype {
  name: 'Null'
}

export declare class Undefined extends Prototype {
  name: 'Undefined'
}

export declare class None extends Prototype {
  name: 'None'
}

export declare class Any extends Prototype {
  name: 'Any'
}

export declare class Numeric extends Prototype {
  name: 'Numeric'

  static Number: Numeric
  static String: Numeric
}

export declare class Int extends Prototype {
  name: 'Int'

  static Number: Int
  static String: Int
}

export declare class Float extends Prototype {
  name: 'Float'

  static Number: Float
  static String: Float
}

export declare class Negative extends Prototype {
  name: 'Negative'

  static Number: Negative
  static String: Negative
}

export declare class Positive extends Prototype {
  name: 'Positive'

  static Number: Positive
  static String: Positive
}

export declare class Zero extends Prototype {
  name: 'Zero'

  static Number: Zero
  static String: Zero
}

export declare class Natural extends Prototype {
  name: 'Natural'

  static Number: Natural
  static String: Natural
}

export declare class Finity extends Prototype {
  name: 'Finity'
}

export declare class String8 extends Prototype {
  name: 'String8'
}

export declare class String16 extends Prototype {
  name: 'String16'
}

export declare class String32 extends Prototype {
  name: 'String32'
}

export declare class String64 extends Prototype {
  name: 'String64'
}

export declare class String128 extends Prototype {
  name: 'String128'
}

export declare class Type {
  readonly name: string
  readonly strict: Type
  readonly Strict: Type

  readonly loose: Type
  readonly Loose: Type

  constructor(pattern: any)

  cache(value: any): Error | null
  assert(value: any): void | never
  test(value: any): boolean
  track(value: any): Promise<Error | null>
  trace(value: any): Promise<Error | null>

  clone(): Type

  toBeStrict(mode: boolean): this
  toBeLoose(mode: boolean): this

  /**
    * format error message text
    * @param options
    */
  with(options: {
    name?: string
    strict?: boolean
    message?: string
    prefix?: string // prefix of an error message
    suffix?: string
  }): this

  toString(): string
}

export declare class Dict extends Type {
  constructor(pattern: Obj)
  extend(fields: Obj): Dict
  extract(fields: { [key: string]: boolean }): Dict
}

export declare function dict(pattern: Obj): Dict

export declare class List extends Type {
  constructor(pattern: any[])
}

export declare function list(pattern: any[]): List

export declare class Tupl extends Type {
  constructor(pattern: any[])
}

export declare function tupl(pattern: any[]): Tupl

/**
  * @deprecated use Tupl instead
  */
export declare type Tuple = Tupl
/**
  * @deprecated use tupl instead
  */
export declare type tuple = typeof tupl

export declare class Enum extends Type {
  constructor(pattern: any[])
}

export declare function enumerate(pattern: any[]): Enum

export declare class Range extends Type {
  constructor(options: {
    min: number
    max: number
    minBound?: boolean
    maxBound?: boolean
  })
}

export declare function range(options: {
  min: number
  max: number
  minBound?: boolean
  maxBound?: boolean
}): Range

export declare class Mapping extends Type {
  constructor(options: { key: any, value: any })
}

export declare function mapping(options: { key: any, value: any }): Mapping

export declare class SelfRef {
  constructor(fn: (self: SelfRef) => any)
}

export declare function selfref(fn: (self: SelfRef) => any): SelfRef

export declare class Shape extends Type {
  constructor(pattern: Obj)
}

export declare function shape(pattern: Obj): Shape

export declare class Rule {
  readonly strict: Rule
  readonly Strict: Rule

  readonly loose: Rule
  readonly Loose: Rule

  constructor(options: {
    name: string
    pattern: any
    message: string
  })

  validate(data: Obj, key: string, pattern: any): Error | null
  catch(data: Obj, key: string): Error | null
  clone(): Rule
  toBeStrict(): this
  toBeLoose(): this
  toString(): string
}

export declare function lazy(fn: () => any): Rule

type IMessage = string | ((data: Obj, key: string) => string)

export declare function match(patterns: any[]): Rule
export declare function match(pattern: any, message: IMessage): Rule

export declare function determine(fn: (value: Obj) => boolean, A: any, B: any): Rule

export declare function shouldmatch(pattern: any, message: IMessage): Rule

export declare function shouldnotmatch(pattern: any, message: IMessage): Rule

export declare function ifexist(pattern: any): Rule

export declare function ifnotmatch(pattern: any, callback: (data: Obj, key: string) => any): Rule
export declare function ifnotmatch(pattern: any, callback: any): Rule

export declare function ifmatch(pattern: any, callback: (data: Obj, key: string) => any): Rule
export declare function ifmatch(pattern: any, callback: any): Rule

export declare function shouldexist(determine: (data: Obj) => boolean, pattern: any): Rule

export declare function shouldnotexist(determine: (data: Obj) => boolean, pattern: any): Rule

export declare function instance(pattern: any): Rule

export declare function equal(pattern: any): Rule

export declare function nullable(pattern: any): Rule

export declare function nonable(pattern: any): Rule

export declare function lambda(input: Tupl | [any, any], output: any): Rule

interface IDecorate {
  (source: any): {
    with: (...types: any[]) => any
  }

  with: (...types: any[]) => ClassDecorator | MethodDecorator | PropertyDecorator
}

type ITypes = Dict | List | Enum | Tupl | Range | Mapping | SelfRef | Shape | Type

export declare class Ty {
  bind(fn: (error: Error) => void): this
  unbind(fn: (error: Error) => void): this
  silent(is: boolean): void
  throw(error: Error): never

  expect(value: any): {
    to: {
      match: (type: any) => boolean | never
      be: (type: any) => boolean | never
    },
  }

  catch(value: any): {
    by: (type: any) => Error | null
  }

  track(value: any): {
    by: (type: any) => Promise<Error | null>
  }

  trace(value: any): {
    by: (type: any) => Promise<Error | null>
  }

  is(value: any): {
    typeof: (value: any) => boolean
    of: (type: any) => boolean
  }

  decorate: IDecorate

  static expect(value: any): {
    to: {
      match: (type: any) => boolean | never
      be: (type: any) => boolean | never
    },
  }

  static catch(value: any): {
    by: (type: any) => Error | null
  }

  static track(value: any): {
    by: (type: any) => Promise<Error | null>
  }


  static trace(value: any): {
    by: (type: any) => Promise<Error | null>
  }

  static is(value: any): {
    typeof: (value: any) => boolean
    of: (type: any) => boolean
  }

  static create(value: any): ITypes

  static readonly decorate: IDecorate
}

export declare class Parser {
  constructor(types: Obj)

  init(types: Obj): void

  define(text: string, target: any): this

  parse(description: Obj): ITypes & { __comments__: Obj }

  describe(dict: Obj, options: { arrayStyle: number, ruleStyle: number }): Obj

  /**
    * give a real data object, give its type shape
    * @param data
    */
  guess(data: Obj): ITypes

  /**
    * merge two type shapes
    * @param exist
    * @param data
    */
  merge(exist: Obj, data: Obj): Obj

  static defaultTypes: Obj
}

type ILoader = [any, () => any] | ((target: any, path: string | any[], next: Function) => any | void)
type ILoaders = Array<ILoader>

export declare class Mocker {
  constructor(loaders: ILoaders)

  define(loader: ILoader): this

  mock(type: any): any

  static defaultLoaders: ILoaders
}

interface IBindFn {
  (store: Store, on: string): IBindFn
}

interface IWatchFn {
  (e: { target: string, key: string[], value: any, next: any, prev: any, active: any, invalid: any }): void
}

export declare class Store {
  constructor(params?: Obj)

  init(params: Obj): void

  get(keyPath: string | (string | symbol)[]): any

  set(keyPath: string | (string | symbol)[], value: any, silent?: boolean): any

  del(keyPath: string | (string | symbol)[]): void

  update(data: Obj, async?: boolean, silent?: boolean): void

  define(key: string, options: (() => any) | { get: () => any }): any

  bind(key: string): IBindFn

  observe(target: Store | Model | Function, subscribe: (target: Store | Model) => (dispatch: IWatchFn) => Function | void, unsubcribe: (target: Store | Model) => (dispatch: IWatchFn) => void): Function

  watch(keyPath: string | (string | symbol)[], fn: IWatchFn, deep?: boolean, context?: Model): this

  unwatch(keyPath: string | (string | symbol)[], fn: IWatchFn): this

  dispatch(keyPath: string | (string | symbol)[], info: { value: any, next: any, prev: any, active: any, invalid: any, compute: boolean }, force?: boolean): boolean

  forceDispatch(keyPath: string | (string | symbol)[], ...args: any[]): boolean
}

interface ValidatorOptions<T extends Model = Model, I extends any = any> {
  name?: string
  determine?: boolean | ((this: T, value: I, key: string) => boolean | Promise<boolean>)
  validate: (this: T, value: I, key: string) => boolean | Promise<boolean> | Error
  message: string
  break?: boolean
  async?: boolean
}
export declare class Validator<T extends Model = Model, I extends any = any> {
  constructor(options: ValidatorOptions<T, I>)
  extend<M extends Model = T>(attrs: Obj): Validator<M, I>

  static readonly required: <T extends Model>(message: string, emptyFn?: (this: T, value: any) => boolean) => Validator
  static readonly maxLen: (message: string, len?: number) => Validator
  static readonly minLen: (message: string, len?: number) => Validator
  static readonly max: (message: string, len?: number) => Validator
  static readonly min: (message: string, len?: number) => Validator

  static readonly integer: (len: number, message: string) => Validator
  static readonly decimal: (len: number, message: string) => Validator
  static readonly email: (message: string) => Validator
  static readonly url: (message: string) => Validator
  static readonly date: (message: string) => Validator
  static readonly match: <T extends Model>(validator: RegExp | string | number | boolean | ((this: T, value: any) => boolean) | any, message: string, name?: string) => Validator
  static readonly allOf: (validators: Validator[], message: string) => Validator
  static readonly anyOf: (validators: Validator[], message: string) => Validator
}

type ModelClass = new (...args: any[]) => Model
type MetaClass<T = any, I = T, M extends Model = Model, U extends Obj = Obj> = new (options: Attrs<T, I, M, U>) => Meta<T, I, M, U>

export type Attrs<T = any, I = T, M extends Model = Model, U extends Obj = Obj> = {
  /**
   * field default value, used by `reset` `formJSON` and so on
   */
  default: T
  /**
   * field is a computed field, value will be computed until be changed by `set`
   */
  compute?(this: M): T
  /**
   * calculate value when init and the dependencies change,
   * different from `compute`, it will rewrite value when inside dependencies change,
   * you can change the value manually, however, the manual value will be changed by `activate` later if dependencies change
   */
  activate?(this: M): T
  /**
   * field value type
   */
  type?: any
  /**
   * error message when set a value not match `type`
   */
  message?: string
  /**
   * force set `default` when value not match `type`
   */
  force?: boolean
  /**
   * validators used by `validate` or `validateAsync`
   */
  validators?: (Validator<M, I> | ValidatorOptions<M, I>)[]
  /**
   * create field value used by `formJSON`
   */
  create?(this: M, value: any, key: string, data: U): T
  /**
   * export field value used by `toJSON`
   */
  save?(this: M, value: T, key: string, data: U): Obj | any | void
  /**
   * save another filed data to output data of `toJSON()`
   */
  saveAs?(this: M, value: T, key: string, data: U, output: Obj): Obj | void
  /**
   * if without `create` and `save`, asset will used as field read proof
   */
  asset?: string
  /**
   * whether drop this field when `toData()`
   */
  drop?: boolean | ((this: M, value: I, key: string, data: U) => boolean)
  /**
   * transfer the field value when `toData()`
   * when `drop` is `false`, map will not work
   */
  map?(this: M, value: I, key: string, data: U): any | void
  /**
   * map another filed data to output data of `toData()`
   * `drop` has no effect to mapAs
   */
  mapAs?(this: M, value: I, key: string, data: U, output: Obj): Obj | void
  /**
   * transfer field name to `to` when `toData`
   * can use keyPath like 'some.any'
   */
  to?: string
  /**
   * transfer given value when `set`
   */
  setter?(this: M, value: I, key: string): T
  /**
   * transfer output value when `get`
   */
  getter?(this: M, value: T, key: string): I
  /**
   * format field value when use `view.text`
   */
  formatter?(this: M, value: T, key: string): string
  /**
   * whether the field is readonly, `set` will not work
   */
  readonly?: boolean | ((this: M, value: I, key: string) => boolean)
  /**
   * whether the field is useless, `drop` will be set true, validators will not work
   */
  disabled?: boolean | ((this: M, value: I, key: string) => boolean)
  /**
   * whether hide the field, without any effect on model, just a UI helper
   */
  hidden?: boolean | ((this: M, value: I, key: string) => boolean)
  /**
   * whether the field is required, should be used together with Validator.required in `vlaidators`
   */
  required?: boolean | ((this: M, value: I, key: string) => boolean)
  /**
   * determine the field is empty, used with `required`
   */
  empty?(this: M, value: I, key: string): boolean
  /**
   * whether to make the field available, if false, disabled & drop & readonly & hidden will be forcely set `true`
   */
  available?: boolean | ((this: M, value: I, key: string) => boolean)
  /**
   * provide deps
   */
  deps?(this: M, key: string): { [key: string]: Meta | MetaClass }
  /**
   * provide information about needs, it means this field should must work with this metas
   */
  needs?(this: M, key: string): Array<Meta | MetaClass | ModelClass>
  /**
   * provide information about factors, it means this field will be trigger by the given metas
   */
  factors?(): Array<Meta | MetaClass | ModelClass>
  /**
   * provide state
   */
  state?(this: M, key: string): Obj
  /**
   * invoked when Model initialized
   */
  init?(this: M, key: string): void
  /**
   * invoked when field value changed
   */
  watch?(this: M, e: { value: I } & Obj, key: string): void
  /**
   * when **other** fields changed, follow function will be triggered,
   * current field changing will NOT be triggered (use watch instead)
   */
  follow?(this: M, e: Obj, key: string, keyOfChangedField: string):
    | void
    | Array<{
      /**
       * the target to follow
       */
      key?: string
      /**
       * the target to follow
       */
      meta?: Meta
      /**
       * when target field changed, this `action` will be invoked
       */
      action: (this: M, e: { value: any } & Obj, keyOfChangedField: string) => void
    }>
  /**
   * invoked errors occur when field change
   */
  catch?(this: M, error: Error, key: string): void
} & Obj & ThisType<M>

export declare class Meta<T = any, I = T, M extends Model = Model, U extends Obj = Obj> {
  constructor(options?: Attrs<T, I, M, U>)
  extend<D extends T = T, V extends I = I, O extends M = M, B = U>(attrs: Partial<Attrs<D, V, O, B>>): Meta<D, V, O, B>
  static extend<T = any, I = T, M extends Model = Model, U extends Obj = Obj>(attrs: Attrs<T, I, M, U>): typeof Meta & MetaClass<T, I, M, U>
  static create<T = any, I = T, M extends Model = Model, U extends Obj = Obj>(attrs: Attrs<T, I, M, U>): typeof Meta & MetaClass<T, I, M, U>
}

export declare class AsyncMeta<T = any, I = T, M extends Model = Model, U extends Obj = Obj> extends Meta<T, I, M, U> {
  fetchAsyncAttrs(): Promise<Omit<Attrs<T, I, M, U>, 'default'>>
}

export declare class SceneMeta<T = any, I = T, M extends Model = Model, U extends Obj = Obj> extends Meta<T, I, M, U> {
  /**
   * define scenes mapping
   */
  defineScenes(): {
    [sceneCode: string]: Attrs<T, I, M, U> | (() => Attrs<T, I, M, U>) | (() => Promise<Omit<Attrs<T, I, M, U>, 'default'>>)
  }
  /**
   * switch self to new scene
   * @param sceneCodes
   */
  switchScene(sceneCodes: string | string[]): this
  /**
   * switch to a new meta instance with given scene
   * @param sceneCodes
   */
  Scene(sceneCodes: string | string[]): this
  /**
   * get a new SceneMeta constructor with given scene
   * @param sceneCodes
   */
  static Scene<T>(this: ConstructorOf<T>, sceneCodes: string | string[]): ConstructorOf<T> & typeof SceneMeta
}

export declare class StateMeta<T = any, I = T, M extends Model = Model, U extends Obj = Obj> extends Meta<T, I, M, U> {
  constructor(attrs?: Omit<Attrs<T, I, M, U>, 'default' | 'validators' | 'drop' | 'to' | 'map' | 'disabled' | 'state'> & { value: T })
}

export declare class SceneStateMeta<T = any, I = T, M extends Model = Model, U extends Obj = Obj> extends SceneMeta<T, I, M, U> {
  constructor(attrs?: Omit<Attrs<T, I, M, U>, 'default' | 'validators' | 'drop' | 'to' | 'map' | 'disabled' | 'state'> & { value: T })
}

/**
 * crete a meta by given attributes
 * T: the value type
 * I: the type of output of getter and input of setter
 * M: the attached Model
 * U: the type of whole data node
 * @param attrs
 */
declare function createMeta<T = any, I = T, M extends Model = Model, U extends Obj = Obj>(attrs: Attrs<T, I, M, U>): Meta<T, I, M, U>

// /**
//  * create a meta by given Model
//  * @param entries Model
//  * @param attrs append attributes, omit 'default'
//  * @param hooks factory hooks
//  * @example
//  * class A extends Model {}
//  * const meta = createMeta(A)
//  * class C extends Model {
//  *   static some = meta
//  *   // same as: static some = A
//  * }
//  */
// declare function createMeta<T extends ModelClass = ModelClass, M extends Model = Model, U extends Obj = Obj>(entries: T, attrs?: Omit<Attrs<InstanceType<T>, InstanceType<T>, M, U>, 'default'>, hooks?: FactoryHooks): Meta<InstanceType<T>, InstanceType<T>, M, U>

// /**
//  * create a meta by given Models
//  * T: union of ModelClass, i.e. SomeModel | AnyModel
//  * @param entries Model[]
//  * @param attrs
//  * @param hooks
//  * @example
//  * class A extends Model {}
//  * class B extends Model {}
//  * const meta = createMeta<A | B>([A, B])
//  * class C extends Model {
//  *   static some = meta
//  *   // same as: static some = [A, B]
//  * }
//  */
// declare function createMeta<T extends ModelClass[] = ModelClass[], M extends Model = Model, U extends Obj = Obj>(entries: T, attrs?: Omit<Attrs<InstanceType<ItemOf<T>>[], InstanceType<ItemOf<T>>[], M, U>, 'default'>, hooks?: FactoryHooks): Meta<InstanceType<ItemOf<T>>[], InstanceType<ItemOf<T>>[], M, U>

/**
 * create serval metas as an array
 * @param count how many metas do you want to create
 * @param create
 * @example
 * const [A, B, C] = createMetaGroup((A, B, C) => [
 *   createMeta(...),
 *   createMeta(...),
 *   createMeta(...),
 * ])
 */
declare function createMetaGroup<T extends Meta[]>(create: (...args: Meta[]) => T): T

/**
 * create an async meta, which can be overrided by asyncGetter return value
 * @param attrs
 * @param asyncGetter
 */
declare function createAsyncMeta<T = any, I = T, M extends Model = Model, U extends Obj = Obj>(attrs: Attrs<T, I, M, U>, asyncGetter: () => Promise<Partial<Attrs<T, I, M, U>>>): AsyncMeta<T, I, M, U>

/**
 * create a scene meta, which can be switch to certain scene by Model#Scene(sceneCode)
 * @param attrs
 * @param mapping
 */
declare function createSceneMeta<T = any, I = T, M extends Model = Model, U extends Obj = Obj>(attrs: Attrs<T, I, M, U>, mapping: {
  [sceneCode: string]: Partial<Attrs<T, I, M, U>> | (() => Partial<Attrs<T, I, M, U>>) | (() => Promise<Partial<Attrs<T, I, M, U>>>)
}): SceneMeta<T, I, M, U>

/**
 * create a state meta, whose disabled is force set to be true
 * @param attrs
 */
declare function createStateMeta<T = any, I = T, M extends Model = Model, U extends Obj = Obj>(attrs: Omit<Attrs<T, I, M, U>, 'default' | 'validators' | 'drop' | 'to' | 'map' | 'disabled' | 'state'> & { value: T }): Meta<T, I, M, U>

/**
 * create a state meta which is in scene mode
 * @param attrs
 * @param mapping
 */
declare function createSceneStateMeta<T = any, I = T, M extends Model = Model, U extends Obj = Obj>(attrs: Omit<Attrs<T, I, M, U>, 'default' | 'validators' | 'drop' | 'to' | 'map' | 'disabled' | 'state'> & { value: T }, mapping: {
  [sceneCode: string]: Partial<Attrs<T, I, M, U>> | (() => Partial<Attrs<T, I, M, U>>) | (() => Promise<Partial<Attrs<T, I, M, U>>>)
}): SceneMeta<T, I, M, U>

export { createMeta, createMetaGroup, createAsyncMeta, createSceneMeta, createStateMeta, createSceneStateMeta }

/**
 * use field value type from a meta
 * @example
 * ReflectMeta<SomeMeta> extends string
 * ReflectMeta<SomeMeta, 'data'> extends object
 * ReflectMeta<SomeMeta, 'default'> extends string, from attrs
 */
export declare type ReflectMeta<A extends Meta | MetaClass, key = 'value'> =
  A extends SceneStateMeta<infer T, infer I, infer M, infer U> ?
    key extends 'value' ? I
    : key extends 'originalValue' ? T
    : key extends 'model' ? M
    : key extends 'data' ? U
    : never
  : A extends SceneMeta<infer T, infer I, infer M, infer U> ?
    key extends 'value' ? I
    : key extends 'originalValue' ? T
    : key extends 'model' ? M
    : key extends 'data' ? U
    : never
  : A extends AsyncMeta<infer T, infer I, infer M, infer U> ?
    key extends 'value' ? I
    : key extends 'originalValue' ? T
    : key extends 'model' ? M
    : key extends 'data' ? U
    : never
  : A extends Meta<infer T, infer I, infer M, infer U> ?
    key extends 'value' ? I
    : key extends 'originalValue' ? T
    : key extends 'model' ? M
    : key extends 'data' ? U
    : never
  : A extends MetaClass<infer T, infer I, infer M, infer U> ?
    key extends 'value' ? I
    : key extends 'originalValue' ? T
    : key extends 'model' ? M
    : key extends 'data' ? U
    : never
  : never

/**
 * use field view type from a meta
 * @example
 * ReflectView<SomeMeta> extends View
 */
export declare type ReflectView<M extends Meta | MetaClass> =
  M extends SceneMeta<infer T, infer I> ? View<T, I>
  : M extends SceneMeta<infer T, infer I> ? View<T, I>
  : M extends AsyncMeta<infer T, infer I> ? View<T, I>
  : M extends Meta<infer T, infer I> ? View<T, I>
  : M extends MetaClass<infer T, infer I> ? View<T, I>
  : View

type View<T = any, I = T> = {
  /**
   * field name
   */
  key: string
  /**
   * field value, transfered by `getter`
   */
  value: I
  /**
   * field original value, stored inside a Store
   */
  data: T
  /**
   * field text formatted by `formatter`
   */
  text: string
  /**
   * state refer to current field
   */
  state: Obj
  /**
   * field absolute keyPath
   */
  absKeyPath: string[]
  /**
   * errors by validators
   */
  errors: Error[] | any[]
  /**
   * is empty? by `empty`
   */
  empty: boolean
  /**
   * is readonly? by `readonly`
   */
  readonly: boolean
  /**
   * is disabled? by `disabled`
   */
  disabled: boolean
  /**
   * is hidden? by `hidden`
   */
  hidden: boolean
  /**
   * is required? by `required`
   */
  required: boolean
  /**
   * is the field value changed
   */
  changed: boolean
} & Obj

export declare class Model implements Obj {
  constructor(data?: Obj, parent?: [Model, string | string[]])

  $views: {
    [field: string]: View
  } & {
    $changed: boolean
    $state: Obj,
    $errors: Error[] | any[]
    /**
     * if it is validating, you can use this to check
     */
    $validatings: Promise<Error[] | any[]>
  }
  $schema: {
    [field: string]: Meta
  }
  $root: this | null
  $parent: this | null
  $keyPath: string[]
  $absKeyPath: string[]

  schema(Schema?: any): Obj
  state(): Obj
  attrs(): Obj

  restore(data: Obj): this
  get(keyPath: string | string[]): any
  set(keyPath: string | string[], next: any, force?: boolean): this
  update(data: Obj): this
  reset(key: string | Meta | MetaClass): this
  patch(data: Obj): this
  define(key: string, value: Function | any): any
  lock(): void
  unlock(): void
  setParent(parent: [Model, string]): this

  watch(key: string | Meta, fn: IWatchFn, deep?: boolean): this
  unwatch(key: string | Meta, fn: IWatchFn): this

  /**
   * operate model with a chunk,
   * you can patch a chunk (Factory.chunk) to a static Chunk property of a Model
   * @param chunk
   */
  Chunk<U extends any[] = any[]>(chunk?: FactoryChunk<Model, any, U>): {
    fromChunk: (...args: U) => Promise<any>,
    fromJSON: (data: Obj) => void,
    toData: () => any,
    toJSON: () => any,
  }

  fromJSON(data: Obj): this
  fromJSONPatch(data: Obj): this
  toJSON(): Obj
  toData(): Obj
  toParams(determine?: (value: any) => boolean): Obj
  toFormData(determine?: (value: any) => boolean): Obj
  validate(key?: string | string[]): Error[] | any[]
  validateAsync(key?: string | string[]): Promise<Error[] | any[]>

  on(hook: string, fn: Function): this
  off(hook: string, fn: Function): this
  emit(hook: string, ...args: any[]): void

  Edit(next?: Obj): this & EditorModel

  use(keyPath: string[]): View
  use<R>(keyPath: string[], getter: (view: View) => R): R
  use<K extends keyof this>(key: K): View<this[K]>
  use<K extends keyof this, R>(key: K, getter: (view: View<this[K]>) => R): R
  use(key: string): View
  use<R>(key: string, getter: (view: View) => R): R
  use<T = any, I = T>(Meta: MetaClass): View<T, I>
  use<T = any, I = T, R = any>(Meta: MetaClass, getter: (view: View<T, I>) => R): R
  use<T = any, I = T, M extends Model = Model, U extends Obj = Obj, N extends Meta = Meta<T, I, M, U>>(meta: N): ReflectView<N>
  use<T = any, I = T, M extends Model = Model, U extends Obj = Obj, R = any, N extends Meta = Meta<T, I, M, U>>(meta: N, getter: (view: ReflectView<N>) => R): R

  memo<T, U>(
    getter: (this: this) => T,
    compare: (this: this, prev: U) => boolean,
    depend?: (this: this, value: T) => U,
  ): any

  onInit(): void
  onSwitch(params: Obj): Obj
  onParse(data: Obj): Obj
  onRecord(data: Obj): Obj
  onExport(data: Obj): Obj
  onCheck(): { message: string, [key: string]: any }[]
  onError(): void
  onEnsure(): void
  onRestore(): void
  onRegress(): void
  onChange(key: string): void
  onEdit(): EditorModel

  static Edit<T>(this: ConstructorOf<T>): ConstructorOf<T & EditorModel> & typeof Model

  static Scene<T>(this: ConstructorOf<T>, sceneCodes: string | string[]): ConstructorOf<T> & typeof Model

  static mixin<T extends ModelClass[]>(...Models: T): new () => UnionToInter<InstanceType<T[number]>>
  static mixin<T extends ModelClass[]>(force: boolean, ...Models: T): new () => UnionToInter<InstanceType<T[number]>>
}

declare class EditorModel extends Model {
  /**
   * create a mirror
   * @param tag
   */
  commit(tag: string): void
  /**
   * rollback to the given named mirror
   * @param tag
   */
  rollback(tag: string): void
  /**
   * cancel the previous change
   */
  undo(): void
  /**
   * redo the previous undo
   */
  redo(): void
  /**
   * clear all change records
   */
  clear(): void
  /**
   * submit changes to original model instance
   */
  submit(): void
}

export declare function AsyncGetter<T extends any>(defaultValue: T, getter: Function): T

export declare function MemoGetter<T, U>(
  getter: (this: Model) => T,
  compare: (this: Model, prev: U) => boolean,
  depend?: (this: Model, value: T) => U,
): {
  $$type: 'memoRef'
} & Obj

interface FactoryHooks {
  /**
   * choose which Model Class to use
   */
  entry?(entries?: ModelClass[], data?: any, parent?: Model): ModelClass[]

  /**
   * determine whether the given data is an instance of given Model Class
   */
  adapt?(entries?: ModelClass[], data?: any, parent?: Model): boolean

  /**
   * how to initialize the child Model,
   * if return void, it means we do not need this item, only for sub-models list
   */
  instance?(ChoosedModel: ModelClass, data: Obj, options: any): Model | void

  /**
   * after child model generated,
   * only once
   */
  transport?(child?: Model, parent?: Model): void

  /**
   * each the parent's fields which are depended on changed,
   * use `use` before `if...else`
   */
  linkage?(child?: Model, parent?: Model): void

  /**
   * override Meta Attribute of child Model
   */
  override?(child?: Model, parent?: Model, scenes?: string[]): Array<{
    meta: Meta | MetaClass,
    attrs: Partial<Attrs>,
  }>

  default?(fn?: Function): Function
  type?(type?: any): any
  validators?(validators?: Validator[]): Validator[]
  create?(fn?: (value?: any, key?: string, data?: any) => any | any[]): (value?: any, key?: string) => any | any[]
  save?(fn?: (value?: any, key?: string, data?: any) => any | any[]): (value?: any, key?: string) => any | any[]
  map?(fn?: (value?: any, key?: string) => any | any[]): (value?: any, key?: string) => any | any[]
  setter?(fn?: (value?: any, key?: string) => any | any[]): (value?: any, key?: string) => any | any[]
}

interface FactoryChunk<M, D, U> {
  model: M
  data: D
  params: U
}

interface Factory extends FactoryHooks {}
export declare class Factory {
  constructor(options: Partial<Attrs>);
  getMeta<T = Model | Model[], M extends Model = Model>(): Meta<T, T, M>

  /**
   * create a meta by given Model
   * @param entries Model
   * @param attrs append attributes, omit 'default'
   * @param hooks factory hooks
   * @example
   * class A extends Model {}
   * const meta = Factory.createMeta(A)
   * class C extends Model {
   *   static some = meta
   *   // same as: static some = A
   * }
   */
  static createMeta<T extends ModelClass = ModelClass, M extends Model = Model, U extends Obj = Obj>(entries: T, attrs?: Omit<Attrs<InstanceType<T>, InstanceType<T>, M, U>, 'default'>, hooks?: FactoryHooks): Meta<InstanceType<T>, InstanceType<T>, M, U>

  /**
   * create a list meta by given Models
   * @example
   * class A extends Model {}
   * class B extends Model {}
   * const meta = Factory.createMeta<(A | B)[]>([A, B])
   * class C extends Model {
   *   static some = meta
   *   // same as: static some = [A, B]
   * }
   */
  static createMeta<T extends ModelClass[] = ModelClass[], M extends Model = Model, U extends Obj = Obj>(entries: T, attrs?: Omit<Attrs<InstanceType<ItemOf<T>>[], InstanceType<ItemOf<T>>[], M, U>, 'default'>, hooks?: FactoryHooks): Meta<InstanceType<ItemOf<T>>[], InstanceType<ItemOf<T>>[], M, U>

  /**
   * create a meta by given Model
   * @example
   * class A extends Model {}
   * class B extends Model {}
   * const meta = Factory.selectMeta<A | B>([A, B])
   * class C extends Model {
   *   static some = meta
   *   // same as: static some = A | B
   * }
   */
  static selectMeta<T extends ModelClass = ModelClass, M extends Model = Model, U extends Obj = Obj>(entries: T[], select: (entries?: T[], data?: any, parent?: Model) => T, attrs?: Omit<Attrs<InstanceType<T>, InstanceType<T>, M, U>, 'default'>, hooks?: FactoryHooks): Meta<InstanceType<T>, InstanceType<T>, M, U>

  /**
   * create a list meta by given Models
   * @example
   * class A extends Model {}
   * class B extends Model {}
   * const meta = Factory.selectMeta<(A | B)[]>([[A, B]])
   * class C extends Model {
   *   static some = meta
   *   // same as: static some = [A, B]
   * }
   */
  static selectMeta<T extends ModelClass[] = ModelClass[], M extends Model = Model, U extends Obj = Obj>(entries: [T], select: (entries?: T, data?: any, parent?: Model) => T, attrs?: Omit<Attrs<InstanceType<ItemOf<T>>[], InstanceType<ItemOf<T>>[], M, U>, 'default'>, hooks?: FactoryHooks): Meta<InstanceType<ItemOf<T>>[], InstanceType<ItemOf<T>>[], M, U>

  /**
   * create a chunk for model
   * @param options
   * @param options.data (...params) => Promise<data>
   * @param options.fromJSON (data) => JSON
   * @param options.toJSON (model: Model) => JSON
   * @param options.toData (model: Model) => data
   * @returns
   */
  static chunk<M extends Model = Model, D extends Obj = Obj, U extends any[] = any[]>(options: {
    data: (...args: U) => D | Promise<D>
    type?: Type
    fromJSON?: (data: D) => Obj
    toJSON?: (model: M) => Partial<D>
    toData?: (model: M) => Obj
  }): FactoryChunk<M, D, U>

  static toParams(data: Obj, determine?: (value: any) => boolean): Obj

  static toFormData(data: Obj, determine?: (value: any) => boolean): Obj
}

declare function meta<T = any, I = T, M extends Model = Model, U extends Obj = Obj>(entries: Attrs<T, I, M, U> | Meta<T, I, M, U> | MetaClass<T, I, M, U>): PropertyDecorator
declare function meta<T = any, I = T, M extends Model = Model, U extends Obj = Obj>(entries: ModelClass | ModelClass[], attrs?: Attrs<T, I, M, U>, hooks?: FactoryHooks): PropertyDecorator
export { meta }

export declare function state<T>(options: { value: T } | { get: () => T, set?: (v: T) => void } | Meta): PropertyDecorator

export declare function type(type: any): PropertyDecorator

export declare function enhance(source: any): PropertyDecorator

/**
 * @deprecated use eject instead
 */
export declare function layoff(): PropertyDecorator
export declare function eject(): PropertyDecorator
