# TySheMo X

Tyshemo x is a library for advance features of tyshemo.
Following progressive programming, tyshemo core package provides `type` `schema` `model` core features, tyshemo-x provides higher level features such as parser, mocker and so on.

Read [tyshemo-x document here](https://github.com/tangshuang/tyshemo-x).


## TraceModel

What is a traced model? In some cases, you may face the situation that, in a form, you want to edit some fields in a popup-modal, however, in the modal, you can cancel the edited fileds. In this case, you have to create a temp state in the modal, so that you can drop the data when you click the cancel button. But this make the state management uncomfortable, TraceModel is to fix this situation.

```js
import { TraceModel } from 'tyshemo-x'
```

TraceModel is extened from Model, so it has all the methods of Model. However, it has some special methods to help you create traced state.

### commit(tag)

When you open the modal, you should create a state mirror by using `commit`:

```js
function onClick() {
  model.commit('edit') // don't use '$origin' as key
  modal.open()
}
```

By this, it will create a state mirror which contains the whole information about this tag.

And now, you can enjoy the validation of model in modal.

```js
function onSubmit() {
  const errors = model.validate(['key1', 'key2', 'key3']) // only validate the keys of which I have edit
  if (errors) {
    popup.show(erros)
    return
  }

  modal.close()
}
```

### reset(tag)

After a while, if you want to cancel the change, just invoke `reset` to recover state.

```js
function onCancel() {
  model.reset('edit')
  modal.close()
}
```

Isn't it easy to do like this?

### undo()

Cancel the previous change.

```js
model.name = 'tomy'
model.undo()
```

### redo()

Cancel the previous undo.

```js
model.name = 'tomy'
model.undo()

///...
model.redo()
```

Notice, `redo` should always follow `undo`, in which there is no state change. If you have changed state after you do `undo`, the history after your change will be clear, so `redo` will not work.

### clear()

Clear all records.
Notice, commits will not be cleared.

```js
model.clear()
mode.undo() // has no effect
model.reset('edit') // works
```
