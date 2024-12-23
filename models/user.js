import mongoose, { Schema, model } from "mongoose";
import { hash } from "bcrypt";

const schema = new Schema(
  {
    fullName: {
      type: String,
      required: true,
      index : true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowecase: true,
      trim: true,
    },
    gender: {
      type: String,
      required: true,
      enum: ["male", "female", "others"],
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    avatar: {
      public_id: {
        type: String,
        required: true,
      },
      url: {
        type: String,
        required: true,
      },
    },
    role : {
      type : String,
      enum: ["user", "admin"],
      default : "user"
    },
  },
  {
    timestamps: true,
  }
);

schema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  this.password = await hash(this.password, 10);
});

export const User = mongoose.models.User || model("User", schema);
