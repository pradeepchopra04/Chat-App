import express from "express";
import {
  oneToOneChat,
  addMembers,
  deleteChat,
  getChatDetails,
  getMessages,
  getMyChats,
  getMyGroups,
  leaveGroup,
  newGroupChat,
  removeMember,
  renameGroup,
  sendMessage,
  sendAttachments,
  getAllMembers,
  deleteMessage,
  updateMessage,
  searchMessages
} from "../controllers/chat.js";
import {
  addMemberValidator,
  chatIdValidator,
  newGroupValidator,
  removeMemberValidator,
  renameValidator,
  sendAttachmentsValidator,
  validateHandler,
  messageIdValidator,
  messageValidator
} from "../lib/validators.js";
import { isAuthenticated } from "../middlewares/auth.js";
import { attachmentsMulter, singleAvatar } from "../middlewares/multer.js";

const app = express.Router();

// After here user must be logged in to access the routes

app.use(isAuthenticated);

app.post("/private-chat", validateHandler,oneToOneChat)
app.post("/new", singleAvatar, newGroupChat);

app.get("/my", getMyChats);

app.get("/my/groups", getMyGroups);

app.put("/addmembers", addMemberValidator(), validateHandler, addMembers);

app.put(
  "/removemember",
  removeMemberValidator(),
  validateHandler,
  removeMember
);

app.get("/get-all-members", chatIdValidator(), validateHandler, getAllMembers);

app.delete("/leave", chatIdValidator(), validateHandler, leaveGroup);

// Send Attachments
app.post(
  "/send-attachments",
  attachmentsMulter,
  sendAttachmentsValidator(),
  validateHandler,
  sendAttachments
);

app.post(
  "/send-message",
  validateHandler,
  sendMessage
);


// Get Messages
app.get("/message", chatIdValidator(), validateHandler, getMessages);

app.delete("/message",messageIdValidator(), validateHandler, deleteMessage);

app.post("/update-message", messageValidator(), validateHandler, updateMessage);

app.get("/search-message", chatIdValidator(), validateHandler, searchMessages);



// Get Chat Details, rename,delete
app
  .route("/")
  .get(chatIdValidator(), validateHandler, getChatDetails)
  .put(renameValidator(), validateHandler, renameGroup)
  .delete(chatIdValidator(), validateHandler, deleteChat);

export default app;
