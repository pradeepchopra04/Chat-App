import express from "express";
import { connectDB } from "./utils/features.js";
import dotenv from "dotenv";
import { errorMiddleware } from "./middlewares/error.js";
import cookieParser from "cookie-parser";
import { Server } from "socket.io";
import { createServer } from "http";
import cors from "cors";
import { v2 as cloudinary } from "cloudinary";
import {
  CHAT_JOINED,
  CHAT_LEAVED,
  NEW_MESSAGE,
  NEW_MESSAGE_ALERT,
  ONLINE_USERS,
  START_TYPING,
  STOP_TYPING,
} from "./constants/events.js";
import { getSockets } from "./lib/helper.js";
import { Message } from "./models/message.js";
import { socketAuthenticator } from "./middlewares/auth.js";

import userRoute from "./routes/user.js";
import chatRoute from "./routes/chat.js";
import { User } from "./models/user.js";

dotenv.config({
  path: "./.env",
});

const mongoURI = process.env.MONGO_URI;
const port = process.env.PORT || 3000;
const envMode = process.env.NODE_ENV.trim() || "PRODUCTION";
const userSocketIDs = new Map();
const onlineUsers = new Set();

connectDB(mongoURI);

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// CORS option for flutterflow Application.......

const customCorsOptions = {
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE"],
};

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
      origin: "*",
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  }
});

app.set("io", io);

// Using Middlewares Here
app.use(express.json({limit : "15mb"}));
app.use(express.urlencoded({ extended: true ,limit: '1mb' }));
app.use(cookieParser());
app.use(cors(customCorsOptions));

app.use("/api/v1/user", userRoute);
app.use("/api/v1/chat", chatRoute);

app.get("/", (req, res) => {
  res.send("Api is Working!");
});

// io.use(socketAuthenticator);

io.on("connection", async(socket) => {

	const userId = socket.handshake.query.userId;
  console.log("userId: ", userId);
  console.log("socketId: ", socket.id);


  const user = await User.findById(userId);

  // const user = socket.user;

  if (!user) {
    console.log("Unauthorized connection attempt");
    socket.disconnect(true);
    return;
  }
  userSocketIDs.set(user._id.toString(), socket.id);

  console.log("A user connected", user.fullName, socket.id);


  // socket.on(NEW_MESSAGE, async ({ chatId, members, message }) => {

  //   const messageForDB = {
  //     content: message,
  //     sender: user._id,
  //     chat: chatId,
  //   };
    
  //   try {
  //     const messageData = await Message.create(messageForDB);

  //     const messageForRealTime = {
  //       content: message,
  //       _id: messageData._id,
  //       sender: {
  //         _id: user._id,
  //         fullName: user.fullName,
  //         avatar: user.avatar
  //       },
  //       chat: chatId,
  //       createdAt: new Date().toISOString(),
  //     };

  //     const membersIncludingMe = [...members, user._id];

  //     // const membersSocket = getSockets(members);
  //     const membersSocket = getSockets(membersIncludingMe);

  //     io.to(membersSocket).emit(NEW_MESSAGE, {
  //       chatId,
  //       message: messageForRealTime,
  //     });
  //     io.to(membersSocket).emit(NEW_MESSAGE_ALERT, { chatId });


  //   } catch (error) {
  //     throw new Error(error);
  //   }
  // });

  socket.on("message",(msg) =>{
    console.log("Flutter Message",msg);
  });

  socket.on("testMessage",(data) =>{
    console.log("Test Message",data);
  })

  socket.on(START_TYPING, ({ members, chatId }) => {
    console.log("someone is typing in : " + chatId);
    const membersSockets = getSockets(members);
    socket.to(membersSockets).emit(START_TYPING, { chatId, user });
  });

  socket.on(STOP_TYPING, ({ members, chatId }) => {
    console.log("someone has stopped typing in : " + chatId);
    const membersSockets = getSockets(members);
    socket.to(membersSockets).emit(STOP_TYPING, { chatId, user });
  });

  socket.on(CHAT_JOINED, (userId, members) => {
    onlineUsers.add(userId?.toString());
    console.log("User is online", user);
    const membersSocket = getSockets(members);
    io.to(membersSocket).emit(ONLINE_USERS, Array.from(onlineUsers));
  });

  socket.on(CHAT_LEAVED, ({ userId, members }) => {
    onlineUsers.delete(userId?.toString());

    const membersSocket = getSockets(members);
    io.to(membersSocket).emit(ONLINE_USERS, Array.from(onlineUsers));
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected", user.fullName, socket.id);
    userSocketIDs.delete(user?._id.toString());
    onlineUsers.delete(user?._id.toString());
    socket.broadcast.emit(ONLINE_USERS, Array.from(onlineUsers));
  });
});


app.use(errorMiddleware);

server.listen(port, () => {
  console.log(`Server is running on port ${port} in ${envMode} Mode`);
});

export { envMode, userSocketIDs, io };
