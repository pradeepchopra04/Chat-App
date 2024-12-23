import { compare } from "bcrypt";
import { getOtherMember } from "../lib/helper.js";
import { TryCatch } from "../middlewares/error.js";
import { Chat } from "../models/chat.js";
import { User } from "../models/user.js";
import {
  // cookieOptions,
  emitEvent,
  sendToken,
  uploadFilesToCloudinary,
} from "../utils/features.js";
import { ErrorHandler } from "../utils/utility.js";
import { generateToken } from "../utils/generateToken.js";

// Create a new user and save it to the database and save token in cookie
const newUser = TryCatch(async (req, res, next) => {
  const { fullName, email, gender, password, confirmPassword } = req.body;

  const file = req.file;

  if (!file) return next(new ErrorHandler("Please Upload Avatar"));

  if( password !== confirmPassword){
    return next(new ErrorHandler("Password and Confirm Password do not match!"));
  }

  const result = await uploadFilesToCloudinary([file]);

  const avatar = {
    public_id: result[0].public_id,
    url: result[0].url,
  };

  const user = await User.create({
    fullName,
    email,
    gender,
    password,
    avatar,
  });

  const{ password : hashedPassword, ...data } = user._doc;

  generateToken(data, res, "Registered Successfully", 201);
});

// Login user and save token in cookie
const login = TryCatch(async (req, res, next) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select("+password");

  if (!user) return next(new ErrorHandler("User with this email does not exist", 404));

  const isMatch = await compare(password, user.password);

  if (!isMatch) return next(new ErrorHandler("Invalid Email or Password", 404));

  const{ password : hashedPassword, ...data } = user._doc;

  generateToken(data, res, `Welcome back, ${user.fullName}`, 200);
});

const getMyProfile = TryCatch(async (req, res, next) => {
  const user = await User.findById(req.user);

  if (!user) return next(new ErrorHandler("User not found", 404));

  res.status(200).json({
    success: true,
    user,
  });
});

const logout = TryCatch(async (req, res) => {
  return res
    .status(200)
    .json({
      success: true,
      message: "Logged out successfully",
    });
});

const searchUserWhoAreNotInChatList = TryCatch(async (req, res) => {
  const { name = "" } = req.query;
  // console.log(name);

  // Finding All my chats
  const myChats = await Chat.find({ groupChat: false, members: req.user });

  //  extracting All Users from my chats means friends or people I have chatted with
  const allUsersFromMyChats = myChats.flatMap((chat) => chat.members);

  // Finding all users except me and my friends
  const allUsersExceptMeAndFriends = await User.find({
    _id: { $nin: allUsersFromMyChats },
    fullName: { $regex: name, $options: "i" },
  });

  // Modifying the response
  const users = allUsersExceptMeAndFriends.map(({ _id, fullName,email, avatar }) => ({
    _id,
    fullName,
    email,
    avatar: avatar.url,
  }));

  return res.status(200).json({
    success: true,
    users,
  });
});


const searchUserWhoAreInMyGroup = TryCatch(async (req, res, next) => {
  const { name = "" } = req.query;
  const {chatId} = req.query;

  // Finding All my chats
  const myGroup = await Chat.findOne({ _id : chatId , members: req.user });

  if(!myGroup){
    return next(new ErrorHandler("Group not found", 404));
  }

  const allMembersExceptMeInGroup = myGroup.members.filter((member) => member.toString() !== req.user.toString());

  // Finding all users except me and my friends
  const allUsersExceptMeAndFriends = await User.find({
    _id: { $in: allMembersExceptMeInGroup },
    fullName: { $regex: name, $options: "i" },
  });

  // Modifying the response
  const users = allUsersExceptMeAndFriends.map(({ _id, fullName, avatar }) => ({
    _id,
    fullName,
    avatar: avatar.url,
  }));

  return res.status(200).json({
    success: true,
    users,
  });
});


// For searching all users except me................
export const searchUser = TryCatch(async (req, res, next) => {
  const { name = "" } = req.query;

  // Finding All users except me.

  const allUsersExceptMe = await User.find({
    _id: { $ne: req.user },
    fullName: { $regex: name, $options: "i" },
  }).select({fullName: 1,  email:1,  avatar : 1});

  if(!allUsersExceptMe){
    return next(new ErrorHandler(`No such user with this name ${name} exists!`, 404));
  }

  const transformedUsers = allUsersExceptMe.map(user => ({
    _id : user._id,
    fullName: user.fullName,
    email: user.email,
    avatar: user.avatar.url
  }));

  return res.status(200).json({
    success: true,
    users : transformedUsers,
  });
});



// For searching non-members to add them to the group...
export const searchNonMembers = TryCatch(async (req, res, next) => {
  const { name = "", chatId } = req.query;

  // Finding All users except me.
  const chat = await Chat.findById(chatId);

  if (!chat) {
    return next(new ErrorHandler(`Chat Does Not Exists!`, 404));
  }
  const allExistingMembers = chat.members;

  const allNonMembers = await User.find({
    _id: { $nin: allExistingMembers },
    fullName: { $regex: name, $options: "i" },
  }).populate("fullName avatar.url");

  if(allNonMembers.length === 0){
    return next(new ErrorHandler(`No such user with this name ${name} exists!`, 404));
  }
  return res.status(200).json({
    success: true,
    users : allNonMembers,
  });
});



export {
  getMyProfile,
  login,
  logout,
  newUser,
  searchUserWhoAreNotInChatList,
  searchUserWhoAreInMyGroup,
};
