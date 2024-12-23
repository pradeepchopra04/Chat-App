export const errorHandler = (statusCode=500, message="Internal Server Error") => {
  const error = new Error();
  error.statusCode = statusCode;
  error.message = message;
  return error;
};
