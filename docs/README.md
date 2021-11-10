# TySheMo

> A javascript runtime data type checking system and model management tool.

## What is it?

TySheMo is a js library which helps you to check data type and shape in runtime.
Based on its type system, it provides a morden reactive model management.

It provides different level of objects to describe data's type and structure, and make it easy to ensure data type in complex js business. Different from other type system, TySheMo provides an atomic programing practice to build a data type system (checker). Based on its type description system, it provides very easy validation approach and uppredictable checking rules or methods. And, the most creative highlight thing is that, TySheMo provides a type basic model which is easy to control data change, validation and formulation.

The word `tyshemo` is made up with `type` `schema` and `model`.

## Knowledge Graph

```
                               Validator             Store, Factory
                                   |                        |
                                   |                        |
                                   |                        |
Prototype ----+                    |                        |
              |                    v                        v
              +------ Type ------ Meta ------- Schema ------+--> Model
              |        |                                          |
Rule ---------+        |                                          |
                       |                                          |
                       |                                          |
                +------+------+                                   |
                |             |                                   |
                v             v                                   v
               Ty       Parser, Mocker                          Loader
```

## About this document

In this document, you will read:

- Core concepts: Prototype, Rule, Type, Meta, Schema, Store, Model
- Core APIs: Dict, List, Tuple, Ty...
- TyError: custom error message
- Parser: use json to describe data type system
- Mocker: create mock data by defined type
- Ecology: tyshemo-service, react-tyshemo

## Ready for More?

We've briefly introduced the most basic features of tyshemo core - the rest of this document will cover them and other advanced features with much finer details, so make sure to read through it all!
