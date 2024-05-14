import express from "express";
import { isAuthenticated } from "../middlewares/auth.js";
import { 
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
    sendAttachments 
} from "../controllers/chat.js";
import { attachmentMulter } from "../middlewares/multer.js";
import { 
    addMemberValidator, 
    chatIdValidator, 
    newGroupValidator, 
    removeMemberValidator, 
    renameValidator, 
    sendAttachmentsValidator, 
    validateHandler
} from "../lib/validators.js";


const app = express.Router();



//protected routes
app.use(isAuthenticated)

app.post("/new", newGroupValidator(), validateHandler, newGroupChat);

app.get("/my/chats", getMyChats);
app.get("/my/groups", getMyGroups);

app.put("/addmembers", addMemberValidator(), validateHandler, addMembers)
app.put("/removemember",removeMemberValidator(), validateHandler, removeMember)

app.delete("/leave/:id",chatIdValidator(), validateHandler, leaveGroup)

//send attachment
app.post("/message", attachmentMulter, sendAttachmentsValidator(), validateHandler, sendAttachments);

//Get Message
app.get("/message/:id",chatIdValidator(), validateHandler, getMessages)

//Get chat details, rename, delete
app.route("/:id")
    .get(chatIdValidator(), validateHandler, getChatDetails)
    .put(renameValidator(), validateHandler, renameGroup)
    .delete(chatIdValidator(), validateHandler, deleteChat);

export default app;