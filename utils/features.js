import mongoose from "mongoose"

import jwt from 'jsonwebtoken'
import {v4 as uuid} from "uuid"
import { v2 as cloudinary } from "cloudinary"
import { getBase64, getSockets } from "../lib/helper.js"

const connectDB = (url) => {
    mongoose
        .connect(url, { dbName: "Gossip" })
        .then((data) => console.log(`Connected to DB: ${data}`))
        .catch((err) => {
            throw err;
        })

}

const cookieOptions = {
    maxAge: 15 * 24 * 60 * 60 * 1000,
    sameSite: "none",
    httpOnly: true,
    secure: true
}


const sendToken = (res, user, code, message) => {
    const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET)

    // console.log(user, token, message)
    return res.status(code)
        .cookie("Gossip-token", token, cookieOptions)
        .json({
            success: true,
            user,
            message,
        })
}

;

const emitEvent = (req, event, users, data) => {
    const io = req.app.get("io")
    const usersSockets = getSockets(users);
    io.to(usersSockets).emit(event, data);
}

const uploadFilesToCloudinary = async (files=[], folder) => {

    const uploadPromises = files.map((file) => {
        // const options = {folder};

        return new Promise((resolve, reject) => {
            cloudinary.uploader.upload(
                getBase64(file),
                {
                    resource_type : "auto",
                    public_id : uuid(),
                    folder : folder
                },
                (error, result) => {
                if(error) return reject(error);
                resolve(result)
            })
        })
    })
    
    try{
        const results = await Promise.all(uploadPromises)
 
        // console.log(results)
        const formattedResults = results.map((result)=>( {
            public_id : result.public_id,
            url : result.secure_url,
        })) 
        return formattedResults;

    }catch(err){
        throw new Error("Error uploading files to cloudinary", err)
    }
}

const deleteFilesFromCloudinary = async (public_ids) => {

}




export {
    connectDB,
    sendToken,
    cookieOptions,
    deleteFilesFromCloudinary, 
    emitEvent,
    uploadFilesToCloudinary
}