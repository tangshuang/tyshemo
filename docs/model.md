# Model

## EditableModel

What is a editable model? In some cases, you may face the situation that, in a form, you want to edit some fields in a popup-modal, however, in the modal, you can cancel the edited fileds. In this case, you have to create a temp state in the modal, so that you can drop the data when you click the cancel button. But this make the state management uncomfortable, EditableModel is to fix this situation.

```js
import { EditableModel } from 'tyshemo'
```

EditableModel is extened from Model, so it has all the methods of Model. However, it has some special methods to help you create editable state.

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
