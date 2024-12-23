import express from "express";
import {
  getMyProfile,
  login,
  logout,
  newUser,
  searchUserWhoAreNotInChatList,
  searchUserWhoAreInMyGroup,
  searchUser,
  searchNonMembers
} from "../controllers/user.js";
import {
  loginValidator,
  registerValidator,
  validateHandler,
} from "../lib/validators.js";
import { isAuthenticated } from "../middlewares/auth.js";
import { singleAvatar } from "../middlewares/multer.js";

const app = express.Router();

app.post("/new", singleAvatar, registerValidator(), validateHandler, newUser);
app.post("/login", loginValidator(), validateHandler, login);
app.get("/logout", logout);

// After here user must be logged in to access the routes

app.use(isAuthenticated);

app.get("/me", getMyProfile);
app.get("/search-non-chat-users", searchUserWhoAreNotInChatList);
app.get("/search-in-group", searchUserWhoAreInMyGroup);
app.get("/search-user", searchUser);
app.get("/search-non-members", searchNonMembers);


export default app;
