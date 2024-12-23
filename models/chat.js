import mongoose, { Schema, model, Types } from "mongoose";

const schema = new Schema(
  {
    name: {
      type: String,
      required: true,
    },
    groupChat: {
      type: Boolean,
      default: false,
    },
    avatar: {
      public_id: {
        type: String,
        required: function () {
          return this.groupChat;
        },
      },
      url: {
        type: String,
        required: function () {
          return this.groupChat;
        },
      },
    },
    creator: {
      type: Types.ObjectId,
      ref: "User",
    },
    members: [
      {
        type: Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],
  },
  {
    timestamps: true,
  }
);

export const Chat = mongoose.models.Chat || model("Chat", schema);
