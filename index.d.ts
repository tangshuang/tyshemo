interface Obj { [key: string]: any }

interface PrototypeOptions {
  name?: string;
  validate: (value: any) => boolean;
}
export declare class Prototype {
  constructor(options: PrototypeOptions);

  name?: string;
  validate: (value: any) => boolean;

  static register(proto: any, validate: (value: any) => boolean): void;
  static unregister(...args: any[]): void;
  static is(proto: any): {
    existing: () => boolean;
    typeof: (value: any) => boolean;
  };
}

export declare class Null extends Prototype {
  name: 'Null';
}

export declare class Undefined extends Prototype {
  name: 'Undefined';
}

export declare class None extends Prototype {
  name: 'None';
}

export declare class Any extends Prototype {
  name: 'Any';
}

export declare class Numeric extends Prototype {
  name: 'Numeric';

  static Number: Numeric;
  static String: Numeric;
}

export declare class Int extends Prototype {
  name: 'Int';

  static Number: Int;
  static String: Int;
}

export declare class Float extends Prototype {
  name: 'Float';

  static Number: Float;
  static String: Float;
}

export declare class Negative extends Prototype {
  name: 'Negative';

  static Number: Negative;
  static String: Negative;
}

export declare class Positive extends Prototype {
  name: 'Positive';

  static Number: Positive;
  static String: Positive;
}

export declare class Zero extends Prototype {
  name: 'Zero';

  static Number: Zero;
  static String: Zero;
}

export declare class Natural extends Prototype {
  name: 'Natural';

  static Number: Natural;
  static String: Natural;
}

export declare class Finity extends Prototype {
  name: 'Finity';
}

export declare class String8 extends Prototype {
  name: 'String8';
}

export declare class String16 extends Prototype {
  name: 'String16';
}

export declare class String32 extends Prototype {
  name: 'String32';
}

export declare class String64 extends Prototype {
  name: 'String64';
}

export declare class String128 extends Prototype {
  name: 'String128';
}

export declare class Type {
  readonly name: string;
  readonly strict: Type;
  readonly Strict: Type;

  readonly loose: Type;
  readonly Loose: Type;

  constructor(pattern: any);

  cache(value: any): Error | null;
  assert(value: any): void | never;
  test(value: any): boolean;
  track(value: any): Promise<Error | null>;
  trace(value: any): Promise<Error | null>;

  clone(): Type;

  toBeStrict(mode: boolean): this;
  toBeLoose(mode: boolean): this;

  /**
   * format error message text
   * @param options
   */
  with(options: {
    name?: string;
    strict?: boolean;
    message?: string;
    prefix?: string; // prefix of an error message
    suffix?: string;
  }): this;

  toString(): string;
}

export declare class Dict extends Type {
  constructor(pattern: Obj);
  extend(fields: Obj): Dict;
  extract(fields: { [key: string]: boolean }): Dict;
}

export declare function dict(pattern: Obj): Dict;

export declare class List extends Type {
  constructor(pattern: any[]);
}

export declare function list(pattern: any[]): List;

export declare class Tupl extends Type {
  constructor(pattern: any[]);
}

export declare function tuple(pattern: any[]): Tupl;

/**
 * @deprecated use Tupl instead
 */
export declare type Tuple = Tupl;

export declare class Enum extends Type {
  constructor(pattern: any[]);
}

export declare function enumerate(pattern: any[]): Enum;

export declare class Range extends Type {
  constructor(options: {
    min: number;
    max: number;
    minBound?: boolean;
    maxBound?: boolean;
  });
}

export declare function range(options: {
  min: number;
  max: number;
  minBound?: boolean;
  maxBound?: boolean;
}): Range;

export declare class Mapping extends Type {
  constructor(options: { key: any, value: any });
}

export declare function mapping(options: { key: any, value: any }): Mapping;

export declare class SelfRef {
  constructor(fn: (self: SelfRef) => any);
}

export declare function selfref(fn: (self: SelfRef) => any): SelfRef;

export declare class Shape extends Type {
  constructor(pattern: Obj);
}

export declare function shape(pattern: Obj): Shape;

export declare class Rule {
  readonly strict: Rule;
  readonly Strict: Rule;

  readonly loose: Rule;
  readonly Loose: Rule;

  constructor(options: {
    name: string;
    pattern: any;
    message: string;
  });

  validate(data: Obj, key: string, pattern: any): Error | null;
  catch(data: Obj, key: string): Error | null;
  clone(): Rule;
  toBeStrict(): this;
  toBeLoose(): this;
  toString(): string;
}

export declare function lazy(fn: () => any): Rule;

type IMessage = string | ((data: Obj, key: string) => string);

export declare function match(patterns: any[]): Rule;
export declare function match(pattern: any, message: IMessage): Rule;

export declare function determine(fn: (value: Obj) => boolean, A: any, B: any): Rule;

export declare function shouldmatch(pattern: any, message: IMessage): Rule;

export declare function shouldnotmatch(pattern: any, message: IMessage): Rule;

export declare function ifexist(pattern: any): Rule;

export declare function ifnotmatch(pattern: any, callback: (data: Obj, key: string) => any): Rule;
export declare function ifnotmatch(pattern: any, callback: any): Rule;

export declare function ifmatch(pattern: any, callback: (data: Obj, key: string) => any): Rule;
export declare function ifmatch(pattern: any, callback: any): Rule;

export declare function shouldexist(determine: (data: Obj) => boolean, pattern: any): Rule;

export declare function shouldnotexist(determine: (data: Obj) => boolean, pattern: any): Rule;

export declare function instance(pattern: any): Rule;

export declare function equal(pattern: any): Rule;

export declare function nullable(pattern: any): Rule;

export declare function nonable(pattern: any): Rule;

export declare function lambda(input: Tupl | [any, any], output: any): Rule;

interface IDecorate {
  (source: any): {
    with: (...types: any[]) => any;
  };

  with: (...types: any[]) => ClassDecorator | MethodDecorator | PropertyDecorator;
}

type ITypes = Dict | List | Enum | Tupl | Range | Mapping | SelfRef | Shape | Type;

export declare class Ty {
  bind(fn: (error: Error) => void): this;
  unbind(fn: (error: Error) => void): this;
  silent(is: boolean): void;
  throw(error: Error): never;

  expect(value: any): {
    to: {
      match: (type: any) => boolean | never;
      be: (type: any) => boolean | never;
    },
  };

  catch(value: any): {
    by: (type: any) => Error | null;
  };

  track(value: any): {
    by: (type: any) => Promise<Error | null>;
  };


  trace(value: any): {
    by: (type: any) => Promise<Error | null>;
  };

  is(value: any): {
    typeof: (value: any) => boolean;
    of: (type: any) => boolean;
  };

  decorate: IDecorate;

  static expect(value: any): {
    to: {
      match: (type: any) => boolean | never;
      be: (type: any) => boolean | never;
    },
  };

  static catch(value: any): {
    by: (type: any) => Error | null;
  };

  static track(value: any): {
    by: (type: any) => Promise<Error | null>;
  };


  static trace(value: any): {
    by: (type: any) => Promise<Error | null>;
  };

  static is(value: any): {
    typeof: (value: any) => boolean;
    of: (type: any) => boolean;
  };

  static create(value: any): ITypes;

  static readonly decorate: IDecorate;
}

export declare class Parser {
  constructor(types: Obj);

  init(types: Obj): void;

  define(text: string, target: any): this;

  parse(description: Obj): ITypes & { __comments__: Obj };

  describe(dict: Obj, options: { arrayStyle: number, ruleStyle: number }): Obj;

  /**
   * give a real data object, give its type shape
   * @param data
   */
  guess(data: Obj): ITypes;

  /**
   * merge two type shapes
   * @param exist
   * @param data
   */
  merge(exist: Obj, data: Obj): Obj;

  static defaultTypes: Obj;
}

type ILoader = [any, () => any] | ((target: any, path: string | any[], next: Function) => any | void);
type ILoaders = Array<ILoader>;

export declare class Mocker {
  constructor(loaders: ILoaders);

  define(loader: ILoader): this;

  mock(type: any): any;

  static defaultLoaders: ILoaders;
}

interface IBindFn {
  (store: Store, on: string): IBindFn;
}

interface IWatchFn {
  (e: { target: string, key: string[], value: any, next: any, prev: any, active: any, invalid: any }): void;
}

export declare class Store {
  constructor(params?: Obj);

  init(params: Obj): void;

  get(keyPath: string | (string | symbol)[]): any;

  set(keyPath: string | (string | symbol)[], value: any, silent?: boolean): any;

  del(keyPath: string | (string | symbol)[]): void;

  update(data: Obj, async?: boolean, silent?: boolean): void;

  define(key: string, options: (() => any) | { get: () => any }): any;

  bind(key: string): IBindFn;

  observe(target: Store | Model | Function, subscribe: (target: Store | Model) => (dispatch: IWatchFn) => Function | void, unsubcribe: (target: Store | Model) => (dispatch: IWatchFn) => void): Function;

  watch(keyPath: string | (string | symbol)[], fn: IWatchFn, deep?: boolean, context?: Model): this;

  unwatch(keyPath: string | (string | symbol)[], fn: IWatchFn): this;

  dispatch(keyPath: string | (string | symbol)[], info: { value: any, next: any, prev: any, active: any, invalid: any, compute: boolean }, force?: boolean): boolean;

  forceDispatch(keyPath: string | (string | symbol)[], ...args: any[]): boolean;
}

interface ValidatorOptions<T extends Model = Model> {
  name?: string;
  determine?: boolean | ((this: T, value: any) => boolean);
  validate: (this: T, value: any, key: string) => boolean | Error;
  message: string;
  break?: boolean;
  async?: boolean;
}
export declare class Validator<T extends Model = Model> {
  constructor(options: ValidatorOptions<T>);

  static readonly required: <T extends Model>(message: string, emptyFn?: (this: T, value: any) => boolean) => Validator;
  static readonly maxLen: (len: number, message: string) => Validator;
  static readonly minLen: (len: number, message: string) => Validator;
  static readonly len: (len: number, message: string) => Validator;
  static readonly integer: (len: number, message: string) => Validator;
  static readonly decimal: (len: number, message: string) => Validator;
  static readonly max: (num: number, message: string) => Validator;
  static readonly min: (num: number, message: string) => Validator;
  static readonly email: (message: string) => Validator;
  static readonly url: (message: string) => Validator;
  static readonly date: (message: string) => Validator;
  static readonly match: <T extends Model>(validator: RegExp | string | number | boolean | ((this: T, value: any) => boolean) | any, message: string, name?: string) => Validator;
  static readonly allOf: (validators: Validator[], message: string) => Validator;
  static readonly anyOf: (validators: Validator[], message: string) => Validator;
}

type Attrs<T, M extends Model, U extends Obj, I = T> = {
  /**
   * field default value, used by `reset` `formJSON` and so on
   */
   default: T;
   /**
    * field is a computed field, value will be computed until be changed by `set`
    */
   compute?(this: M): T;
   /**
    * calculate value when init and the dependencies change,
    * different from `compute`, it will rewrite value when inside dependencies change,
    * you can change the value manually, however, the manual value will be changed by `activate` later if dependencies change
    */
   activate?(this: M): T;
   /**
    * field value type
    */
   type?: any;
   /**
    * error message when set a value not match `type`
    */
   message?: string;
   /**
    * force set `default` when value not match `type`
    */
   force?: boolean;
   /**
    * validators used by `validate` or `validateAsync`
    */
   validators?: (Validator | ValidatorOptions)[];
   /**
    * create field value used by `formJSON`
    */
   create?(this: M, value: any, key: string, data: U): T;
   /**
    * export field value used by `toJSON`
    */
   save?(this: M, value: T, key: string, data: U): Obj | any;
   /**
    * if without `create` and `save`, asset will used as field read proof
    */
   asset?: string;
   /**
    * whether drop this field when `toData()`
    */
   drop?(this: M, value: T, key: string, data: T): boolean;
   /**
    * transfer the field value when `toData()`
    */
   map?(this: M, value: T, key: string, data: U): any;
   /**
    * flat another data to output data of `toData()`
    */
   flat?(this: M, value: T, key: string, data: U): Obj;
   /**
    * transfer field name to `to` when `toData`
    */
   to?: string;
   /**
    * transfer given value when `set`
    */
   setter?(this: M, value: I, key: string): T;
   /**
    * transfer output value when `get`
    */
   getter?(this: M, value: T, key: string): I;
   /**
    * format field value when use `view.text`
    */
   formatter?(this: M, value: T, key: string): string;
   /**
    * whether the field is readonly, `set` will not work
    */
   readonly?: boolean | ((this: M, value: T, key: string) => boolean);
   /**
    * whether the field is useless, `drop` will be set true, validators will not work
    */
   disabled?: boolean | ((this: M, value: T, key: string) => boolean);
   /**
    * whether hide the field, without any effect on model, just a UI helper
    */
   hidden?: boolean | ((this: M, value: T, key: string) => boolean);
   /**
    * whether the field is required, should be used together with Validator.required in `vlaidators`
    */
   required?: boolean | ((this: M, value: T, key: string) => boolean);
   /**
    * determine the field is empty, used with `required`
    */
   empty?(this: M, value: T, key: string): boolean;
   /**
    * provide state
    */
   state?(): Obj;
   /**
    * provide deps
    */
   deps?(): { [key: string]: Meta | (new () => Meta) };
   /**
    * provide information about deps, it means this field should must work with this metas
    */
   needs?(): Array<Meta | (new () => Meta)>;
   /**
    * invoked when Model initialized
    */
   init?(this: M): void;
   /**
    * invoked when field value changed
    */
   watch?(this: M, e: { value: T }): void;
   /**
    * when **other** fields changed, follow function will be triggered,
    * current field changing will NOT be triggered (use watch instead)
    */
   follow?(this: M, key: string): void;
   /**
    * invoked errors occur when field change
    */
   catch?(this: M, error: Error): void;
} & Obj & ThisType<M>;

export declare class Meta<T, M extends Model, U extends Obj, I = T> extends Attrs<T, M, U, I> {
  constructor(options?: Attrs);
}

declare function createMeta<T, M extends Model, U extends Obj, I = T>(attrs: Attrs<T, M, U, I>): Meta<T, M, U, I>;
declare function createMeta<T, M extends Model, U extends Obj, I = T>(entries: ModelClass | ModelClass[], attrs?: Attrs<T, M, U, I>, hooks?: Obj & ThisType<Factory>): Meta<T, M, U, I>;
export { createMeta }

interface View<T, I = T> extends Obj {
  /**
   * field name
   */
  key: string;
  /**
   * field value, transfered by `getter`
   */
  value: I;
  /**
   * field original value, stored inside a Store
   */
  data: T;
  /**
   * field text formatted by `formatter`
   */
  text: string;
  /**
   * state refer to current field
   */
  state: Obj;
  /**
   * field absolute keyPath
   */
  absKeyPath: string[];
  /**
   * errors by validators
   */
  errors: Error[] | any[];
  /**
   * is empty? by `empty`
   */
  empty: boolean;
  /**
   * is readonly? by `readonly`
   */
  readonly: boolean;
  /**
   * is disabled? by `disabled`
   */
  disabled: boolean;
  /**
   * is hidden? by `hidden`
   */
  hidden: boolean;
  /**
   * is required? by `required`
   */
  required: boolean;
}

type ModelClass = new () => Model;

export declare class Model implements Obj {
  constructor(data?: Obj, parent?: [Model, string | string[]]);

  $views: {
    [field: string]: View;
  } & {
    $changed: boolean;
    $state: Obj,
    $errors: Error[] | any[];
  };
  $root: this | null;
  $parent: this | null;
  $keyPath: string[];
  $absKeyPath: string[];

  schema(Schema?: any): Obj;
  state(): Obj;
  attrs(): Obj;

  restore(data: Obj, keysAddToThis?: string[]): this;
  get(keyPath: string | string[]): any;
  use(keyPath: string | string[]): View;
  use<T>(keyPath: string | string[], getter?: (view: View) => T): T;
  set(keyPath: string | string[], next: any, force?: boolean): this;
  update(data: Obj): this;
  reset(key: string): this;
  patch(data: Obj): this;
  define(key: string, value: Function | any): any;
  lock(): void;
  unlock(): void;
  setParent(parent: [Model, string]): this;
  setAttr(key: string): (attr: string, value: any) => void;

  watch(key: string, fn: IWatchFn, deep?: boolean): this;
  unwatch(key: string, fn: IWatchFn): this;

  fromJSON(data: Obj, keysAddToThis?: string[]): this;
  fromJSONPatch(data: Obj, onlyKeys?: string[]): this;
  toJSON(): Obj;
  toData(): Obj;
  toParams(determine?: (value: any) => boolean): Obj;
  toFormData(determine?: (value: any) => boolean): FormData;
  validate(key?: string | string[]): Error[] | any[];
  validateAsync(key?: string | string): Promise<Error[] | any[]>;

  on(hook: string, fn: Function): this;
  off(hook: string, fn: Function): this;
  emit(hook: string, ...args: any[]): void;

  toEdit(next?: Obj): this;

  reflect<T, M extends Model, U extends Obj, I = T>(Meta: Meta<T, M, U, I>): View<T, I>;
  reflect<T>(Meta: Meta, getter: (key: string) => T): T;

  memo<T, U>(
    getter: (this: this) => T,
    compare: (this: this, prev: U) => boolean,
    depend?: (this: this, value: T) => U,
  ): any;

  onInit(): void;
  onSwitch(params: Obj): Obj;
  onParse(data: Obj): Obj;
  onRecord(data: Obj): Obj;
  onExport(data: Obj): Obj;
  onCheck(): void;
  onError(): void;
  onEnsure(): void;
  onRestore(): void;
  onRegress(): void;
  onChange(key: string): void;
  onEdit(): EditorModel;

  static extend(next: Obj): ModelClass;
  static toEdit: new () => EditorModel;
}

declare class EditorModel extends Model {
  /**
   * create a mirror
   * @param tag
   */
  commit(tag: string): void;
  /**
   * rollback to the given named mirror
   * @param tag
   */
  rollback(tag: string): void;
  /**
   * cancel the previous change
   */
  undo(): void;
  /**
   * redo the previous undo
   */
  redo(): void;
  /**
   * clear all change records
   */
  clear(): void;
  /**
   * submit changes to original model instance
   */
  submit(): void;
}

export declare function AsyncGetter(defaultValue: any, getter: Function): {
  $$type: 'asyncRef';
} & Obj;

export declare function MemoGetter<T, U>(
  getter: (this: Model) => T,
  compare: (this: Model, prev: U) => boolean,
  depend?: (this: Model, value: T) => U,
): {
  $$type: 'memoRef'
} & Obj;

export declare class Factory {
  entry(entries: ModelClass): ModelClass;
  entry(entries: ModelClass[]): ModelClass[];
  instance(model: ModelClass, ctx: ModelClass): ModelClass;
  default(fn: Function): Function;
  type(type: any): any;
  validators(validators: Validator[]): Validator[];
  create(fn: (value: any, key: string) => any | any[]): (value: any, key: string) => any | any[];
  save(fn: (value: any, key: string) => any | any[]): (value: any, key: string) => any | any[];
  map(fn: (value: any, key: string) => any | any[]): (value: any, key: string) => any | any[];
  setter(fn: (value: any, key: string) => any | any[]): (value: any, key: string) => any | any[];
  transport(child: Model, parent: Model): void;
  getMeta(): Meta;

  static useAttrs(Model: ModelClass, attrs: [string, string, Function][]): ModelClass;
  static getMeta<T = Model>(entries: ModelClass | ModelClass[], attrs?: Obj & ThisType<T>, hooks?: Obj & ThisType<Factory>): Meta;
}

export declare function meta(entry: Attrs | (new () => Meta) | ModelClass | ModelClass[], options?: Attrs, methods?: Factory): PropertyDecorator;

export declare function state(options: { value: any } | { get: () => any, set: (v: any) => void }): PropertyDecorator;

export declare function type(type: any): PropertyDecorator;

export declare function enhance(source: any): PropertyDecorator;

export declare function layoff(): PropertyDecorator;