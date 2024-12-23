import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { v4 as uuid } from "uuid";
import { v2 as cloudinary } from "cloudinary";
import { getBase64, getSockets } from "../lib/helper.js";
import mime from 'mime-types';

// const cookieOptions = {
//   maxAge: 15 * 24 * 60 * 60 * 1000,
//   sameSite: "none",
//   httpOnly: true,
//   secure: true,
// };

const connectDB = (uri) => {
  mongoose
    .connect(uri, { dbName: "Complete-Chat-App" })
    .then((data) => console.log(`Connected to DB: ${data.connection.host}`))
    .catch((err) => {
      throw err;
    });
};

const sendToken = (res, user, code, message) => {
  const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET);

  return res.status(code).cookie("chattu-token", token, cookieOptions).json({
    success: true,
    user,
    message,
  });
};

const emitEvent = (req, event, users, data) => {
  const io = req.app.get("io");
  const usersSocket = getSockets(users);
  io.to(usersSocket).emit(event, data);
};


const getFileType = (file) => {
  const fileType = mime.extension(file.mimetype);
  return fileType || 'unknown';
};

const uploadFilesToCloudinary = async (files = []) => {

  const uploadPromises = files.map((file) => {
    const fileType = getFileType(file);
    const uniqueId = uuid(); 
    const public_id = `${uniqueId}_${file.originalname}`;

    const resourceType = file.mimetype === 'application/pdf' || file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ? 'raw'
      : 'auto';

    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        getBase64(file),
        {
          resource_type: resourceType,
          public_id: public_id,
        },
        (error, result) => {
          if (error) return reject(error);

          let fileTypeLabel;
          if (['jpg', 'jpeg', 'png', 'gif'].includes(fileType)) {
            fileTypeLabel = 'image';
          } else if (['mp4', 'mp3'].includes(fileType)) {
            fileTypeLabel = 'video';
          } else if (file.mimetype === 'application/pdf') {
            fileTypeLabel = 'pdf';
          } else if (file.mimetype === 'xlsx') {
            fileTypeLabel = 'docx';
          } else {
            fileTypeLabel = 'Unknown';
          }


          resolve({
            public_id: result.public_id,
            url: result.secure_url,
            fileType,
            fileTypeLabel
          });
        }
      );
    });
  });

  try {
    const results = await Promise.all(uploadPromises);
    return results;
  } catch (err) {
    throw new Error("Error uploading files to cloudinary", err);
  }
};

const deletFilesFromCloudinary = async (public_ids) => {
  // Delete files from cloudinary
};

export {
  connectDB,
  sendToken,
  // cookieOptions,
  emitEvent,
  deletFilesFromCloudinary,
  uploadFilesToCloudinary,
};
