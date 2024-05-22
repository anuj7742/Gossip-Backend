import express from "express"
import {connectDB} from "./utils/features.js"
import dotenv from "dotenv"
import { errorMiddleware } from "./middlewares/error.js";
import cookieParser from "cookie-parser"
import { Server } from "socket.io";
import {createServer} from "http"
import {v4 as uuid} from "uuid"
import cors from "cors"
import {v2 as cloudinary} from "cloudinary" 

import userRoute from "./routes/user.js";
import chatRoute from "./routes/chat.js";
import adminRoute from "./routes/admin.js";
import { CHAT_JOINED, CHAT_LEAVED, NEW_MESSAGE, NEW_MESSAGE_ALERT, ONLINE_USERS, START_TYPING, STOP_TYPING } from "./constants/events.js";
import { getSockets } from "./lib/helper.js";
import { Message } from "./models/message.js";
import { corsOptions } from "./constants/config.js";
import { socketAuthenticator } from "./middlewares/auth.js";
import { Chat } from "./models/chat.js";

dotenv.config({

    path:"./.env"
})

const adminSecretKey = process.env.ADMIN_SECRET_KEY || "Anuj1234512345"

const userSocketIDs = new Map()
const onlineUsers = new Set()

const app = express();
const server = createServer(app)
const io = new Server(server, {
    cors : corsOptions
})

connectDB(process.env.MONGO_URL)
const PORT  = process.env.PORT ||3000
const envMode = process.env.NODE_ENV.trim() || "PRODUCTION"

cloudinary.config({
    cloud_name : process.env.CLOUD_NAME,
    api_key : process.env.API_KEY,
    api_secret : process.env.API_SECRET
})

app.set("io",io)

//using middlewares
app.use(express.json());
app.use(cookieParser())
app.use(cors(corsOptions))

app.use('/api/v1/user', userRoute)
app.use('/api/v1/chat', chatRoute)
app.use('/api/v1/admin', adminRoute)

app.get("/" , (req,res) => {
    res.send("Server is running")
})

io.use((socket, next) => {
    
    cookieParser()(
        socket.request,
        socket.request.res,
        async (err) => await socketAuthenticator(err, socket, next)
      );
})

io.on("connection", (socket) => {

    const user = socket.user;
    // console.log("user",user)
    userSocketIDs.set(user._id.toString(), socket.id);
     
    // console.log(userSocketIDs)

    socket.on(NEW_MESSAGE, async ({chatId, members, message}) => {

        const messageForRealTime = {
            content : message,
            _id : uuid(),
            sender: {
                _id : user._id,
                name : user.name,
            },
            chat : chatId ,
            createdAt : new Date().toISOString(),
        }

        const messageForDB = {
            content: message,
            sender : user._id,
            chat : chatId
        }

        // console.log("Emitting ",messageForRealTime)

        const membersSocket = getSockets(members)
        
        io.to(membersSocket).emit(NEW_MESSAGE, {
            chatId,
            message : messageForRealTime
        })

        io.to(membersSocket).emit(NEW_MESSAGE_ALERT, {chatId})

        try{
            const createdMessage = await Message.create(messageForDB);

            // Update the chat with the new last message
            await Chat.findByIdAndUpdate(chatId, { lastMessage: createdMessage._id });

        }catch(error){
            console.log(error)
        }
    })

    socket.on(START_TYPING, ({members, chatId}) => {
        // console.log("Start typing..", chatId)
        const membersSockets = getSockets(members)
        socket.to(membersSockets).emit(START_TYPING, {chatId})
    })

    socket.on(STOP_TYPING, ({members, chatId}) => {
        // console.log("Stop typing..",chatId)
        const membersSockets = getSockets(members)
        socket.to(membersSockets).emit(STOP_TYPING, {chatId})
    })

    socket.on(CHAT_JOINED, ({ userId, members }) => {
        onlineUsers.add(userId.toString());
    
        const membersSocket = getSockets(members);
        io.to(membersSocket).emit(ONLINE_USERS, Array.from(onlineUsers));
      });
    
      socket.on(CHAT_LEAVED, ({ userId, members }) => {
        onlineUsers.delete(userId.toString());
    
        const membersSocket = getSockets(members);
        io.to(membersSocket).emit(ONLINE_USERS, Array.from(onlineUsers));
      });

    socket.on("disconnect", () => {
        // console.log("user disconnected");
        userSocketIDs.delete(user._id.toString())
        onlineUsers.delete(user._id.toString())
        socket.broadcast.emit(ONLINE_USERS, Array.from(onlineUsers));
    })
})

app.use(errorMiddleware)

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT} in ${process.env.NODE_ENV} mode`)
});

export {
    adminSecretKey, envMode, userSocketIDs
}