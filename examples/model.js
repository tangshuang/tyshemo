import { Model } from 'tyshemo'

class PersonModel extends Model {
  static name = {
    type: String,
    default: '',
  }
  static age = {
    type: Number,
    default: 0,
  }
}

class InvestorModel extends Model {
  static name = PersonModel.name
  static age = PersonModel.age

  static money = {
    type: Number,
    default: 0,
    setter: v => +v,
    getter: v => v + '',
  }
}

class ProjectModel extends Model {
  static investor = InvestorModel
  static name = {
    type: String,
    default: '',
    required: true,
  }
}

const project = new ProjectModel()
console.log(project.investor.money)
