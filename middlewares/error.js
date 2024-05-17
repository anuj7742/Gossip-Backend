import { envMode } from "../app.js";

const errorMiddleware = (err, req, res, next) => {

    err.message ||= "Internal Server error";
    err.statusCode ||= 500;

    if (err.code === 11000) {
        const error = Object.keys(err.keyPattern).join(",")
        err.message = `${error} already taken`;
        err.statusCode = 400
    }


    if (err.name == "CastError") {
        const errorPath = err.path
        err.message = `Invalid format of ${errorPath}`;
        err.statusCode = 400
    }


    const response = {
        success: false,
        message: err.message,
    };

    if (envMode === "DEVELOPMENT") {
        response.error = err;
    }

    return res.status(err.statusCode).json(response);
}




const TryCatch = (passedFun) => async (req, res, next) => {
    try {
        await passedFun(req, res, next);
    } catch (error) {
        next(error);
    }
}

export { errorMiddleware, TryCatch } 