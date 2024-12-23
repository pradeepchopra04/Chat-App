import mongoose, { Schema, model, Types } from "mongoose";

const schema = new Schema(
  {
    content: {
      type : String,
      index : true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    isLeft: {
      type: Boolean,
      default: false,
    },

    attachments: [
      {
        public_id: {
          type: String,
          required: true,
        },
        url: {
          type: String,
          required: true,
        },
        fileType: {
          type: String,
          required: true
        },
        fileTypeLabel: {
          type: String,
          required: true
        },
        _id: false
      },
    ],

    sender: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
    },
    chat: {
      type: Types.ObjectId,
      ref: "Chat",
      required: true,
    },
    mentioned_users: [{
      type: Types.ObjectId,
      ref: "User"
    }],
  },
  {
    timestamps: true,
  }
);

export const Message = mongoose.models.Message || model("Message", schema);
