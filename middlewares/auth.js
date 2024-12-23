import jwt from "jsonwebtoken";
import { ErrorHandler } from "../utils/utility.js";
import { User } from "../models/user.js";



export const isAuthenticated = async (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (authHeader) {
    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded._id);

      if (!user) return next(new ErrorHandler("User not found", 404));

      req.user = user._id;
      req.role = user.role;
      next();
    } catch (error) {
      return next(new ErrorHandler("Login First and Provide a valid token!", 401));
    }
  } else {
    return next(new ErrorHandler("Authorization token missing!", 401));
  }
}

export const socketAuthenticator = async (socket, next) => {
  const authHeader = socket.handshake.headers['authorization'];

  if (authHeader) {
    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded._id);

      if (!user) return next(new ErrorHandler("User not found", 404));

      // Attach user information to socket object
      console.log("Socket Authenticator",user.fullName);
      socket.user = user;
      next();
    } catch (error) {
      return next(new ErrorHandler("Login First and Provide a valid token!", 401));
    }
  } else {
    return next(new ErrorHandler("Authorization token missing!", 401));
  }
};




