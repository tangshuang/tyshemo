# Install and Usage

You can use tyshemo with npm or cdn.

## NPM

Install:

```
npm i tyshemo
```

Now you can import tyshemo into your project.

```js
const { Ty } = require('tyshemo')
```

If you want to load on demand:

```js
const { Ty } = require('tyshemo/cjs/ty')
```

If you are using webpack, try this:

```js
import { Ty } from 'tyshemo'
```

Or use source code to be benefit from tree shaking:

```js
import { Ty } from 'tyshemo/src/ty'
```

## CDN

Link to [unpkg source](https://unpkg.com/browse/tyshemo@latest/):

```html
<script src="https://unpkg.com/tyshemo/dist/tyshemo.min.js"></script>
<script>
  const { Ty } = window.tyshemo
</script>
```

Use only ty:

```html
<script src="https://unpkg.com/tyshemo/dist/ty.min.js"></script>
<script>
  const { Ty } = window.ty
</script>
```

Use only store:

```html
<script src="https://unpkg.com/tyshemo/dist/store.min.js"></script>
<script>
  const { Store } = window.store
</script>
```

## Exports

You can look into [unpkg](https://unpkg.com/browse/tyshemo@latest/) to find out that, tyshemo has 3 type of exports: cjs, dist, src.

- Files in `src` directory is source code, it is written in ES6 but with some other packages.
- Files in `cjs` directory is commonjs code which are able to use in nodejs directly.
- Files in `dist` directory is webpack bundle files which are able to run in browsers directly. There are bundle/minified js files with their .map files.
  - `ty.js` only contains tyshemo's type system (without Parser and Mocker).
  - `store.js` only contains tyshemo's store library.
  - `tyshemo.js` contains all exports.

```html
<script src="https://unpkg.com/tyshemo/dist/tyshemo.min.js"></script>
```
