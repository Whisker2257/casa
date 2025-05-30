// /Users/nashe/casa/backend/models/Project.js
const { Schema, model, Types } = require('mongoose');

const projectSchema = new Schema(
  {
    name:  { type: String, required: true },
    user:  { type: Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

module.exports = model('Project', projectSchema);
