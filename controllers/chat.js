import { TryCatch } from "../middlewares/error.js";
import { ErrorHandler } from "../utils/utility.js";
import { Chat } from "../models/chat.js";
import {
  deletFilesFromCloudinary,
  emitEvent,
  uploadFilesToCloudinary,
} from "../utils/features.js";
import {
  ALERT,
  MEMBER_ADDED,
  MEMBER_ADDED_ALERT,
  MEMBER_LEFT,
  MEMBER_REMOVED,
  MEMBER_REMOVED_ALERT,
  MESSAGE_DELETED,
  MESSAGE_UPDATED,
  NEW_MESSAGE,
  NEW_MESSAGE_ALERT,
  NEW_REQUEST,
  REFETCH_CHATS,
} from "../constants/events.js";
import { getOtherMember, getSockets } from "../lib/helper.js";
import { User } from "../models/user.js";
import { Message } from "../models/message.js";
import mongoose from "mongoose";
import { io } from "../app.js";





export const oneToOneChat = TryCatch(async (req, res, next) => {

  const { receiverId } = req.query;
  const senderId = req.user.toString();

  // Ensure both sender and receiver IDs are valid ObjectIds
  if (!mongoose.Types.ObjectId.isValid(senderId) || !mongoose.Types.ObjectId.isValid(receiverId)) {
    return next(new ErrorHandler("Invalid user IDs provided", 400));
  }

  // Check if chat already exists
  const existingChat = await Chat.findOne({
    groupChat: false,
    members: { $all: [senderId, receiverId] }
  });

  if (existingChat) {
    return next(new ErrorHandler("Chat already exists", 400));
  }

  // Fetch sender and receiver data
  const [senderData, receiverData] = await Promise.all([
    User.findById(senderId),
    User.findById(receiverId)
  ]);

  if (!senderData || !receiverData) {
    return next(new ErrorHandler("One or both users do not exist", 404));
  }

  const members = [senderId, receiverId];

  const chat = await Chat.create({
    members,
    name: `${senderData?.fullName}-${receiverData?.fullName}`,
  });

  if (!chat) {
    return next(new ErrorHandler("Chat does not exist", 404));
  }

  const newChat = {
    _id: chat._id,
    groupChat: chat.groupChat,
    avatar: receiverData.avatar.url,
    name: receiverData.fullName,
    members: chat.members
  };

  const membersSockets = getSockets(members);
  io.to(membersSockets).emit(REFETCH_CHATS, newChat);

  return res.status(201).json({
    success: true,
    message: "Private Chat created Successfully",
    chat,
  });
});



const newGroupChat = TryCatch(async (req, res, next) => {
  const { name, members } = req.body;

  const membersForGroup = JSON.parse(members);

  // if (membersForGroup.length < 3) {
  //   return next(new ErrorHandler("Atleast add 2 members in a Group"));
  // }

  const allMembers = [...membersForGroup, req.user];

  const file = req.file;

  if (!file) return next(new ErrorHandler("Please Upload Avatar for Group"));

  const result = await uploadFilesToCloudinary([file]);

  const avatar = {
    public_id: result[0].public_id,
    url: result[0].url,
  };

  const group = await Chat.create({
    name,
    groupChat: true,
    avatar,
    creator: req.user,
    members: allMembers,
  });

  if (!group) {
    return next(new ErrorHandler("Group does not exist", 404));
  }

  const newChat = {
    _id: group._id,
    groupChat: group.groupChat,
    avatar: group.avatar.url,
    name: group.name,
    members: group.members
  };

  // emitEvent(req, ALERT, allMembers, `Welcome to ${name} group`);
  const membersSockets = getSockets(group.members);
  io.to(membersSockets).emit(REFETCH_CHATS, newChat);
  io.to(membersSockets).emit(ALERT, `Welcome to ${group.name} group`);
  // emitEvent(req, REFETCH_CHATS, members);

  return res.status(201).json({
    success: true,
    message: "Group Created",
    group
  });
});

const getMyChats = TryCatch(async (req, res, next) => {
  const chats = await Chat.find({ members: req.user }).populate(
    "members",
    "fullName avatar"
  );

  const transformedChats = chats.map(({ _id, name, avatar, members, groupChat }) => {
    const otherMember = getOtherMember(members, req.user);

    return {
      _id,
      groupChat,
      avatar: groupChat
        ? avatar.url
        : otherMember.avatar.url,
      name: groupChat ? name : otherMember.fullName,
      members: members.reduce((prev, curr) => {
        if (curr._id.toString() !== req.user.toString()) {
          prev.push(curr._id);
        }
        return prev;
      }, []),
    };
  });

  return res.status(200).json({
    success: true,
    chats: transformedChats,
  });
});

const getMyGroups = TryCatch(async (req, res, next) => {
  const chats = await Chat.find({
    members: req.user,
    groupChat: true,
    creator: req.user,
  }).populate("members", "fullName avatar");

  const groups = chats.map(({ members, _id, groupChat, name, avatar }) => ({
    _id,
    groupChat,
    name,
    avatar,
    members: members.map((member) => member._id)
  }));

  return res.status(200).json({
    success: true,
    groups,
  });
});


// To get the list of all the members in a group.........


export const getAllMembers = TryCatch(async (req, res, next) => {

  const { chatId } = req.query;
  const chat = await Chat.findById(chatId).populate("members", "fullName avatar");

  if (!chat) {
    return next(new ErrorHandler("Chat does not exist", 404));
  }

  const members = chat.members.map(({ _id, fullName, avatar }) => {
    return {
      _id,
      fullName,
      avatar,
    }
  });

  return res.status(200).json({
    success: true,
    message: "All Members found successfully!",
    members,
    creator: chat.creator,
    groupChat: chat.groupChat
  });
});

const addMembers = TryCatch(async (req, res, next) => {
  const { chatId, members } = req.body;

  const chat = await Chat.findById(chatId);

  if (!chat) return next(new ErrorHandler("Chat not found", 404));

  if (!chat.groupChat)
    return next(new ErrorHandler("This is not a group chat", 400));

  if (chat.creator.toString() !== req.user.toString())
    return next(new ErrorHandler("You are not allowed to add members", 403));

  const allNewMembersPromise = members.map((i) => User.findById(i, "fullName"));

  const allNewMembers = await Promise.all(allNewMembersPromise);

  const uniqueMembers = allNewMembers
    .filter((i) => !chat.members.includes(i._id.toString()))
    .map((i) => i._id);

  chat.members.push(...uniqueMembers);

  if (chat.members.length > 100)
    return next(new ErrorHandler("Group members limit reached", 400));

  await chat.save();

  const allUsersName = allNewMembers.map((i) => i.fullName).join(", ");

  const alertMessage = `${allUsersName} has been added in the group ${chat?.name}`
  const membersSockets = getSockets(chat.members);
  io.to(membersSockets).emit(MEMBER_ADDED);
  io.to(membersSockets).emit(MEMBER_ADDED_ALERT, alertMessage, allNewMembers);

  return res.status(200).json({
    success: true,
    message: `${allUsersName} has been added in the group`
  });
});





const removeMember = TryCatch(async (req, res, next) => {
  const { userId, chatId } = req.body;

  const [chat, userThatWillBeRemoved] = await Promise.all([
    Chat.findById(chatId),
    User.findById(userId, "fullName"),
  ]);

  if (!chat) return next(new ErrorHandler("Chat not found", 404));

  if (!chat.groupChat)
    return next(new ErrorHandler("This is not a group chat", 400));

  if (chat.creator.toString() !== req.user.toString())
    return next(new ErrorHandler("You are not allowed to add members", 403));

  if (chat.members.length <= 3)
    return next(new ErrorHandler("Group must have at least 3 members", 400));

  const allChatMembers = chat.members.map((i) => i.toString());

  chat.members = chat.members.filter(
    (member) => member.toString() !== userId.toString()
  );

  await chat.save();

  const alertMessage = `${userThatWillBeRemoved.fullName} has been removed from the group ${chat?.name}`
  const membersSockets = getSockets(allChatMembers);
  io.to(membersSockets).emit(MEMBER_REMOVED, userId);
  io.to(membersSockets).emit(MEMBER_REMOVED_ALERT, alertMessage, userId);

  return res.status(200).json({
    success: true,
    message: `${userThatWillBeRemoved.fullName} was removed from group ${chat?.name} successfully`,
  });
});





const leaveGroup = TryCatch(async (req, res, next) => {
  const { chatId } = req.query;

  const chat = await Chat.findById(chatId);

  if (!chat) return next(new ErrorHandler("Chat not found", 404));

  if (!chat.groupChat)
    return next(new ErrorHandler("This is not a group chat", 400));

  const allMembers = chat.members;
  const remainingMembers = chat.members.filter(
    (member) => member.toString() !== req.user.toString()
  );

  if (remainingMembers.length < 3)
    return next(new ErrorHandler("Group must have at least 3 members", 400));

  if (chat.creator.toString() === req.user.toString()) {
    const randomElement = Math.floor(Math.random() * remainingMembers.length);
    const newCreator = remainingMembers[randomElement];
    chat.creator = newCreator;
  }

  chat.members = remainingMembers;

  const [user] = await Promise.all([
    User.findById(req.user, "fullName avatar"),
    chat.save(),
  ]);

  const UserId = user?._id;

  const messageForDB = {
    content: `${user.fullName} has left the group`,
    sender: user._id,
    chat: chatId,
    isLeft: true
  };

  const messageData = await Message.create(messageForDB);


  const messageForRealTime = {
    content: `${user.fullName} has left the group`,
    _id: messageData._id,
    sender: {
      _id: user._id,
      fullName: user.fullName,
      avatar: user.avatar
    },
    attachments: [],
    chat: chatId,
    isLeft: true,
    createdAt: new Date().toISOString(),
  };

  const membersSockets = getSockets(allMembers);
  io.to(membersSockets).emit(MEMBER_LEFT, { chatId, UserId, messageForRealTime });


  return res.status(200).json({
    success: true,
    message: `${user.fullName} has left the group ${chat.name}`,
  });
});



export const sendMessage = TryCatch(async (req, res, next) => {
  const { chatId, content } = req.body;

  const [chat, me] = await Promise.all([
    Chat.findById(chatId),
    User.findById(req.user, "fullName avatar"),
  ]);

  if (!chat) return next(new ErrorHandler("Chat not found", 404));


  const messageForDB = {
    content,
    attachments: [],
    sender: me._id,
    chat: chatId,
  };

  const messageForRealTime = {
    ...messageForDB,
    sender: {
      _id: me._id,
      fullName: me.fullName,
      avatar: me.avatar
    },
  };

  console.log(messageForRealTime);

  const message = await Message.create(messageForDB);

  const membersSockets = getSockets(chat.members);

  console.log(chat.members);
  console.log(membersSockets);

  io.to(membersSockets).emit(NEW_MESSAGE, {
    chatId,
    message: messageForRealTime,
  });

  return res.status(200).json({
    success: true,
    message,
  });
});



const sendAttachments = TryCatch(async (req, res, next) => {
  const { chatId,content = "" } = req.body;

  const files = req.files || [];

  // console.log(files);

  if (files.length < 1)
    return next(new ErrorHandler("Please Upload Attachments", 400));

  if (files.length > 5)
    return next(new ErrorHandler("Files Can't be more than 5", 400));

  const [chat, me] = await Promise.all([
    Chat.findById(chatId),
    User.findById(req.user, "fullName avatar"),
  ]);

  if (!chat) return next(new ErrorHandler("Chat not found", 404));

  if (files.length < 1)
    return next(new ErrorHandler("Please provide attachments", 400));

  //   Upload files here
  const attachments = await uploadFilesToCloudinary(files);

  const messageForDB = {
    content: content || "",
    attachments,
    sender: me._id,
    chat: chatId,
  };

  const messageForRealTime = {
    ...messageForDB,
    sender: {
      _id: me._id,
      fullName: me.fullName,
      avatar: me.avatar
    },
  };

  console.log(messageForRealTime);

  const message = await Message.create(messageForDB);

  emitEvent(req, NEW_MESSAGE, chat.members, {
    message: messageForRealTime,
    chatId,
  });

  emitEvent(req, NEW_MESSAGE_ALERT, chat.members, { chatId });

  return res.status(200).json({
    success: true,
    message,
  });
});





const getChatDetails = TryCatch(async (req, res, next) => {
  if (req.query.populate === "true") {
    const chat = await Chat.findById(req.query.chatId)
      .populate("members", "fullName avatar email")
      .lean();

    if (!chat) return next(new ErrorHandler("Chat not found", 404));

    chat.members = chat.members.map(({ _id, fullName, avatar, email }) => ({
      _id,
      fullName,
      avatar: avatar.url,
      email
    }));

    return res.status(200).json({
      success: true,
      chat,
    });
  } else {
    const chat = await Chat.findById(req.query.chatId);
    if (!chat) return next(new ErrorHandler("Chat not found", 404));

    return res.status(200).json({
      success: true,
      chat,
    });
  }
});

const renameGroup = TryCatch(async (req, res, next) => {
  const { chatId } = req.query;
  const { name } = req.body;

  const chat = await Chat.findById(chatId);

  if (!chat) return next(new ErrorHandler("Chat not found", 404));

  if (!chat.groupChat)
    return next(new ErrorHandler("This is not a group chat", 400));

  let groupsOldName = chat.name;

  if (chat.creator.toString() !== req.user.toString())
    return next(
      new ErrorHandler("You are not allowed to rename the group", 403)
    );

  chat.name = name;

  await chat.save();

  emitEvent(req, REFETCH_CHATS, chat.members);

  return res.status(200).json({
    success: true,
    message: `Group ${groupsOldName} renamed to ${name} successfully`,
  });
});

const deleteChat = TryCatch(async (req, res, next) => {
  const { chatId } = req.query;

  const chat = await Chat.findById(chatId);

  if (!chat) return next(new ErrorHandler("Chat not found", 404));

  const members = chat.members;

  if (chat.groupChat && chat.creator.toString() !== req.user.toString())
    return next(
      new ErrorHandler("You are not allowed to delete the group", 403)
    );

  if (!chat.groupChat && !chat.members.includes(req.user.toString())) {
    return next(
      new ErrorHandler("You are not allowed to delete the chat", 403)
    );
  }

  //   Here we have to dete All Messages as well as attachments or files from cloudinary

  const messagesWithAttachments = await Message.find({
    chat: chatId,
    attachments: { $exists: true, $ne: [] },
  });

  const public_ids = [];

  messagesWithAttachments.forEach(({ attachments }) =>
    attachments.forEach(({ public_id }) => public_ids.push(public_id))
  );

  await Promise.all([
    deletFilesFromCloudinary(public_ids),
    chat.deleteOne(),
    Message.deleteMany({ chat: chatId }),
  ]);

  emitEvent(req, REFETCH_CHATS, members);

  return res.status(200).json({
    success: true,
    message: "Chat deleted successfully",
  });
});

const getMessages = TryCatch(async (req, res, next) => {
  const { chatId } = req.query;
  const { page = 1 } = req.query;
  const resultPerPage = 20;
  const skip = (page - 1) * resultPerPage;

  const chat = await Chat.findById(chatId);

  if (!chat) return next(new ErrorHandler("Chat not found", 404));

  if (!chat.members.includes(req.user.toString()))
    return next(
      new ErrorHandler("You are not allowed to access this chat", 403)
    );

  const [messages, totalMessagesCount] = await Promise.all([
    Message.find({ chat: chatId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(resultPerPage)
      .populate("sender", "fullName avatar")
      .sort({ createdAt: -1 })
      .lean(),
    Message.countDocuments({ chat: chatId }),
  ]);

  const totalPages = Math.ceil(totalMessagesCount / resultPerPage) || 0;

  return res.status(200).json({
    success: true,
    messages: messages,
    totalPages,
    // members : chat.members
  });
});



export const searchMessages = TryCatch(async (req, res, next) => {
  const { chatId, message } = req.query;

  const chat = await Chat.findById(chatId);

  if (!chat) return next(new ErrorHandler(`Chat Does not exists!`, 404));

  const searchedMessages = await Message.find({
    chat: chatId,
    content: { $regex: message, $options: "i" },
  }).populate("sender", "fullName avatar.url email");

  if (searchedMessages.length === 0) {
    return next(new ErrorHandler(`Message ${message} not found!`, 404));
  }

  const transformedResult = searchedMessages.map((message) =>{
    return {
      _id : message._id,
      content : message.content,
      isDeleted : message.isDeleted,
      isEdited : message.isEdited,
      attachments : message.attachments,
      sender : {
        _id : message.sender._id,
        fullName : message.sender.fullName,
        email : message.sender.email,
        avatar : message.sender.avatar.url,
      },
      chat : message.chat,
      mentioned_users : message.mentioned_users,
      createdAt : message.createdAt,
      updatedAt : message.updatedAt
    }
  })

  res.status(200).json({
    success: true,
    message: "Messages found successfully!",
    searchResult : transformedResult
  });
});


// For deleting a message....
export const deleteMessage = TryCatch(async (req, res, next) => {
  const { messageId } = req.query;
  let message = await Message.findById(messageId).populate("sender", "fullName avatar");

  if (!message) {
    return next(new ErrorHandler("Message not found", 404));
  }

  let chatId = message.chat;

  const chat = await Chat.findById(chatId, "members");

  const members = chat.members;

  message.content = "";
  message.isDeleted = true;

  await message.save();

  const membersSockets = getSockets(members);
  io.to(membersSockets).emit(MESSAGE_DELETED, { chatId, message });

  return res.status(200).json({
    success: true,
    message: "Message Deleted Successfully!",
  });
});


// For updating a message.............


export const updateMessage = TryCatch(async (req, res, next) => {
  const { newMessage, messageId } = req.body;
  let message = await Message.findById(messageId).populate("sender", "fullName avatar");

  if (!message) {
    return next(new ErrorHandler("Message not found", 404));
  }

  let chatId = message.chat;

  const chat = await Chat.findById(chatId, "members");

  const members = chat.members;
  message.content = newMessage;
  message.isEdited = true;

  await message.save();

  const membersSockets = getSockets(members);
  io.to(membersSockets).emit(MESSAGE_UPDATED, { chatId, message });

  return res.status(200).json({
    success: true,
    message: "Message Edited Successfully!",
  });
});

export {
  newGroupChat,
  getMyChats,
  getMyGroups,
  addMembers,
  removeMember,
  leaveGroup,
  sendAttachments,
  getChatDetails,
  renameGroup,
  deleteChat,
  getMessages,
};
