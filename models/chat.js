import mongoose, { Schema, Types, model } from 'mongoose'


const schema = new Schema({
    name: {
        type: String,
        required: true,
    },
    groupChat: {
        type: Boolean,
        default: false
    },
    creator: {
        type: Types.ObjectId,
        ref: "User"
    },
    lastMessage:{
        type: Types.ObjectId,
        ref:"Message",
        default : null
    },
    members: [
        {
            type: Types.ObjectId,
            ref: "User"
        }
    ],

}, {
    timestamps: true,
});


export const Chat = mongoose.models.Chat || model("Chat", schema)