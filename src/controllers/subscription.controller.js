import mongoose, {isValidObjectId} from "mongoose"
import {User} from "../models/user.model.js"
import { Subscription } from "../models/subscription.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"


const toggleSubscription = asyncHandler(async (req, res) => {
    const {channelId} = req.params
    if(!isValidObjectId(channelId)){
        throw new ApiError(400,"Cannot find the channel")
    }

    const channel=await User.findById(channelId) 
    if(!channel){
        throw new ApiError(404,"Channel does not exist")
    }

    const user = await User.findOne({
        refreshToken: req.cookies.refreshToken,
    })
    
    if (!user) {
        throw new ApiError(404, "Subscriber not found")
    }


    const userSub=await Subscription.findOne({
        subscriber: user._id,
        channel: channelId,
    });

    //if user is subscribed- unsubscribe 
    if(userSub){
        const unsubscribe= await Subscription.findOneAndDelete(
            {
                subscriber: user._id,
                channel: channel._id
            }
        )

        if (!unsubscribe) {
            throw new ApiError(500, "Something went wrong while unsubscribing ");
        }

        return(
            res
            .status(200)
            .json(new ApiResponse(200,unsubscribe,"User unsubscribed"))
        )
    }

    //else subscribe the channel
    if(!userSub){
        const subscribe=await Subscription.create(
            {
                subscriber: user._id,
                channel: channel._id
            }
        )
        if (!subscribe) {
            throw new ApiError(500,"Error while subscribing the channel")
        }
        return(
            res
            .status(200)
            .json(new ApiResponse(200,subscribe,"User subscribed"))
        )
    }
});


const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const { channelId = req.user?._id } = req.params;
  
    if (!isValidObjectId(channelId)) throw new ApiError(400, "Invalid ChannelId");
  
    const subscriberList = await Subscription.aggregate([
      {
        $match: {
          channel: new mongoose.Types.ObjectId(channelId),
        },
      },
      {
        $lookup: {
          from: "subscriptions",
          localField: "channel",
          foreignField: "subscriber",
          as: "subscribedChannels",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "subscriber",
          foreignField: "_id",
          as: "subscriber",
          pipeline: [
            {
              $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribersSubscribers",
              },
            },
            {
              $project: {
                username: 1,
                avatar: 1,
                fullName: 1,
                subscribersCount: {
                  $size: "$subscribersSubscribers",
                },
              },
            },
          ],
        },
      },
      {
        $unwind: {
          path: "$subscriber",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $addFields: {
          "subscriber.isSubscribed": {
            $cond: {
              if: {
                $in: ["$subscriber._id", "$subscribedChannels.channel"],
              },
              then: true,
              else: false,
            },
          },
        },
      },
      {
        $group: {
          _id: "channel",
          subscriber: {
            $push: "$subscriber",
          },
        },
      },
    ]);
  
    const subscribers =
      subscriberList?.length > 0 ? subscriberList[0].subscriber : [];
  
    return res
      .status(200)
      .json(new ApiResponse(200, subscribers, "Subscriber Sent Successfully"));
});


const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { subscriberId } = req.params

    const subscriptions = await Subscription.find({ subscriber: subscriberId }).populate('channel');

    const subscriptionsCount=await Subscription.countDocuments({
        subscriber: subscriberId    
    })

    return(
        res
        .status(200)
        .json(new ApiResponse(200,{subscriptionsCount,subscriptions},"Subscribed channels fetched successfully"))
    )
});

export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
}