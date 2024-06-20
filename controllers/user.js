
import { User } from "../models/user.js";
import { Chat } from "../models/chat.js";
import { Request } from "../models/request.js";
import { cookieOptions, emitEvent, sendToken, uploadFilesToCloudinary } from "../utils/features.js";
import bcrypt,{compare} from "bcrypt"
import { ErrorHandler } from "../utils/utility.js";
import { TryCatch } from "../middlewares/error.js";
import { NEW_REQUEST, REFETCH_CHATS } from "../constants/events.js";
import {getOtherMember} from "../lib/helper.js"
 
//create new User
const newUser = TryCatch(async (req,res, next) => {

    const {name, username, password, bio} = req.body;
    
    const file = req.file;

    if(!file){
        return next( new ErrorHandler("Please Upload Avatar" ) )
    }

    const result = await uploadFilesToCloudinary([file], process.env.FOLDER_NAME)
    // console.log(result)
    const avatar= {
        public_id: result[0].public_id,
        url: result[0].url
    }    
    // console.log(name)

     const user = await User.create({
        name,
        bio,
        username,
        password,
        avatar,
    })

    sendToken(res, user, 201, "User Created")

    res.status(201).json({message:"User created Successfully"})
}) 


const login = TryCatch(async (req,res, next) => {
    
    const {username, password}  = req.body;
    // console.log("password", )

    const user = await User.findOne({username}).select("+password");
    // console.log("User",user)
    if(!user) return next(new ErrorHandler("Invalid Username or Password", 404))
    // console.log("User password", typeof user.password, user.password);


    const passMatch = await compare(password, user.password);

    // console.log("Password match:", passMatch);
    
    if(!passMatch) return next(new ErrorHandler("Invalid UserName or Password", 404))


    sendToken( res, user, 200, `Welcome back, ${user.name}. `)
})


const getMyProfile = TryCatch(async (req,res, next) => {

    const user = await User.findById(req.user)

        res.status(200).json({
            success:true,
            user,
        }) 
})

const logOut = TryCatch(async (req,res) => {
    
        return res.status(200).cookie("Gossip-token", "", 
        {...cookieOptions, maxAge : 0}).json({
            success:true,
            message: "Logged Out Succcessfully",
        })
})

const searchUser = TryCatch(async (req,res) => {

    const {name } = req.query ;

    // get all chats of the user
    const myChats = await Chat.find({ groupChat : false, members : req.user})
    
    // console.log(myChats)
    
    // get all the users from mychats
    const allUsersFromMyChats = myChats.flatMap((chat) => chat.members)

    // get all users which are not my friends
    const allOtherUsers = await User.find({
        _id : {$nin : allUsersFromMyChats}, 
        name: { $regex : name, $options: "i" },
    })

    const users = allOtherUsers.map(({_id, name, avatar}) => ({
        _id, name,
        avatar: avatar.url,
    }))

    return res.status(200).json({
        success:true,
        users,
    })
})


const sendFriendRequest = TryCatch(async (req,res, next) => {
    
    const {userId } = req.body;

    const requset = await Request.findOne({
        $or: [
            {sender : req.user, receiver: userId},
            {sender: userId, receiver: req.user}
        ]
    })

    if(requset) return next(new ErrorHandler("Requset already sent", 400));

    await Request.create({
        sender : req.user,
        receiver: userId,
    })


    return res.status(200).json({
        success:true,
        message: "Friend Requset Sent",
    })
})


const acceptFriendRequest = TryCatch(async (req,res, next) => {
    
    const {requestId, accept } = req.body;

    const request = await Request.findById(requestId)
        .populate("sender", "name")
        .populate("receiver", "name");

    if(!request) return next(new ErrorHandler("Request not fount", 404));

    if(request.receiver._id.toString() !== req.user.toString())
        return next(
            new ErrorHandler("You are not authorized to accept this request", 401)
        );
    
    if(!accept){
        await request.deleteOne();

        return res.status(200).json({
            success:true,
            message : 'Friend Request Rejected',
        })
    }

    const members = [request.sender._id, request.receiver._id];

    await Promise.all([
        Chat.create({
            members,
            name: `${request.sender.name}-${request.receiver.name}`
        }),
        request.deleteOne()
    ]);

    emitEvent(req, REFETCH_CHATS, members);

    return res.status(200).json({
        success:true,
        message: "Friend Request Accepted",
        senderId : request.sender._id
    })
})


const getMyNotifications = TryCatch(async (req,res, next)=> {

    const requests = await Request.find({receiver: req.user})
                        .populate("sender", "name avatar")


     const allRequests = requests.map(({_id, sender}) => ({
        _id,
        sender:{
            _id : sender._id,
            name: sender.name,
            avatar : sender.avatar.url,
        }
     }))

     return res.status(200).json({
        success :true,
        allRequests
     })
    
})

 
const getMyFriends = TryCatch(async (req,res, next)=> {

    const chatId = req.query.chatId;

    const chats = await Chat.find({
        members: req.user,
        groupChat : false,
    }).populate("members", "name avatar")

    const friends = chats.map(({members}) => {
        const otherUser = getOtherMember(members, req.user);

        return {
            _id: otherUser._id,
            name : otherUser.name,
            avatar : otherUser.avatar.url,
        }
    })

    if(chatId){
        const chat = await Chat.findById(chatId);

        const availableFriends = friends.filter(
            (friend) => !chat.members.includes(friend._id)
        );

        return res.status(200).json({
            success:true,
            friends :availableFriends
        })
    }
    else{
        return res.status(200).json({
            success:true,
            friends
        })
    } 
})


export {
    login, 
    newUser, 
    getMyProfile, 
    logOut, 
    searchUser,
    sendFriendRequest,
    acceptFriendRequest,
    getMyNotifications,
    getMyFriends
};
