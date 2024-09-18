import {Tweet} from "../models/tweet.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {Subscription} from "../models/subscription.model.js"

const createTweet = asyncHandler(async (req, res) => {
  const { content } = req.body;

  if (!content) throw new ApiError(400, "Tweet content required");

  const tweetRes = await Tweet.create({ content: content, owner: req.user?._id });

  if (!tweetRes) throw new ApiError(500, "Error occured while creating tweet");

  let newTweet = {
    ...tweetRes._doc,
    owner: {
      fullName: req.user?.fullName,
      username: req.user?.username,
      avatar: req.user?.avatar,
    },
    totalDisLikes: 0,
    totalLikes: 0,
    isLiked: false,
    isDisLiked: false,
  };

  return res
    .status(200)
    .json(new ApiResponse(200, newTweet, "tweet created successfully"));
});


const getUserTweets = asyncHandler(async (req, res) => {
    const { userId } = req.params;
    if(!userId){
        throw new ApiError(400,"user Id cant be found from params")
    }

    const userTweets = await Tweet.find({ owner: userId });

    return(
        res
        .status(200)
        .json(new ApiResponse(200,userTweets,"Tweets fetched successfully"))
    )
});


const getAllTweets = asyncHandler(async (req, res) => {
    const allTweets = await Tweet.aggregate([
      // sort by latest
      {
        $sort: {
          createdAt: -1,
        },
      },
      // fetch likes of tweet
      {
        $lookup: {
          from: "likes",
          localField: "_id",
          foreignField: "tweet",
          as: "likes",
          pipeline: [
            {
              $match: {
                liked: true,
              },
            },
            {
              $group: {
                _id: "liked",
                owners: { $push: "$likedBy" },
              },
            },
          ],
        },
      },
      {
        $lookup: {
          from: "likes",
          localField: "_id",
          foreignField: "tweet",
          as: "dislikes",
          pipeline: [
            {
              $match: {
                liked: false,
              },
            },
            {
              $group: {
                _id: "liked",
                owners: { $push: "$likedBy" },
              },
            },
          ],
        },
      },
      // Reshape Likes and dislikes
      {
        $addFields: {
          likes: {
            $cond: {
              if: {
                $gt: [{ $size: "$likes" }, 0],
              },
              then: { $first: "$likes.owners" },
              else: [],
            },
          },
          dislikes: {
            $cond: {
              if: {
                $gt: [{ $size: "$dislikes" }, 0],
              },
              then: { $first: "$dislikes.owners" },
              else: [],
            },
          },
        },
      },
      // get owner details
      {
        $lookup: {
          from: "users",
          localField: "owner",
          foreignField: "_id",
          as: "owner",
          pipeline: [
            {
              $project: {
                username: 1,
                avatar: 1,
                fullName: 1,
              },
            },
          ],
        },
      },
      {
        $unwind: "$owner",
      },
      {
        $project: {
          content: 1,
          createdAt: 1,
          updatedAt: 1,
          owner: 1,
          isOwner: {
            $cond: {
              if: { $eq: [req.user?._id, "$owner._id"] },
              then: true,
              else: false,
            },
          },
          totalLikes: {
            $size: "$likes",
          },
          totalDisLikes: {
            $size: "$dislikes",
          },
          isLiked: {
            $cond: {
              if: {
                $in: [req.user?._id, "$likes"],
              },
              then: true,
              else: false,
            },
          },
          isDisLiked: {
            $cond: {
              if: {
                $in: [req.user?._id, "$dislikes"],
              },
              then: true,
              else: false,
            },
          },
        },
      },
    ]);
  
    return res
      .status(200)
      .json(new ApiResponse(200, allTweets, "all tweets send successfully"));
});


const getAllUserFeedTweets = asyncHandler(async (req, res) => {
    const subscriptions = await Subscription.find({ subscriber: req.user?._id });
  
    const subscribedChannels = subscriptions.map((item) => item.channel);
  
    const allTweets = await Tweet.aggregate([
      {
        $match: {
          owner: {
            $in: subscribedChannels,
          },
        },
      },
      // sort by latest
      {
        $sort: {
          createdAt: -1,
        },
      },
      // fetch likes of tweet
      {
        $lookup: {
          from: "likes",
          localField: "_id",
          foreignField: "tweet",
          as: "likes",
          pipeline: [
            {
              $match: {
                liked: true,
              },
            },
            {
              $group: {
                _id: "liked",
                owners: { $push: "$likedBy" },
              },
            },
          ],
        },
      },
      {
        $lookup: {
          from: "likes",
          localField: "_id",
          foreignField: "tweet",
          as: "dislikes",
          pipeline: [
            {
              $match: {
                liked: false,
              },
            },
            {
              $group: {
                _id: "liked",
                owners: { $push: "$likedBy" },
              },
            },
          ],
        },
      },
      // Reshape Likes and dislikes
      {
        $addFields: {
          likes: {
            $cond: {
              if: {
                $gt: [{ $size: "$likes" }, 0],
              },
              then: { $first: "$likes.owners" },
              else: [],
            },
          },
          dislikes: {
            $cond: {
              if: {
                $gt: [{ $size: "$dislikes" }, 0],
              },
              then: { $first: "$dislikes.owners" },
              else: [],
            },
          },
        },
      },
      // get owner details
      {
        $lookup: {
          from: "users",
          localField: "owner",
          foreignField: "_id",
          as: "owner",
          pipeline: [
            {
              $project: {
                username: 1,
                avatar: 1,
                fullName: 1,
              },
            },
          ],
        },
      },
      {
        $unwind: "$owner",
      },
      {
        $project: {
          content: 1,
          createdAt: 1,
          updatedAt: 1,
          owner: 1,
          isOwner: {
            $cond: {
              if: { $eq: [req.user?._id, "$owner._id"] },
              then: true,
              else: false,
            },
          },
          totalLikes: {
            $size: "$likes",
          },
          totalDisLikes: {
            $size: "$dislikes",
          },
          isLiked: {
            $cond: {
              if: {
                $in: [req.user?._id, "$likes"],
              },
              then: true,
              else: false,
            },
          },
          isDisLiked: {
            $cond: {
              if: {
                $in: [req.user?._id, "$dislikes"],
              },
              then: true,
              else: false,
            },
          },
        },
      },
    ]);
  
    return res
      .status(200)
      .json(new ApiResponse(200, allTweets, "all tweets send successfully"));
});


const updateTweet = asyncHandler(async (req, res) => {
    const { tweetId } = req.params
    if(!tweetId){
        throw new ApiError(400,"tweet Id cant be fetched from params")
    }

    const tweet = await Tweet.findById(tweetId)
    if(!tweet){
        throw new ApiError(400,"Cant find Tweet")
    }

    const user = await User.findOne({
        refreshToken: req.cookies.refreshToken,
    })

    if (!user) {
        throw new ApiError(404, "User not found")
    }

    if (tweet?.owner.equals(user._id.toString())) {

        const {content}=req.body

        if(!content){
            throw new ApiError(400,"Please provide content to update")
        }

        tweet.content=content
        await tweet.save({validateBeforeSave:false})

        return(
            res
            .status(200)
            .json(new ApiResponse(200,tweet,"tweet updated successfully"))
        )

    }else{
        throw new ApiError(400,"Only the owner can update the tweet")
    }
});


const deleteTweet = asyncHandler(async (req, res) => {
    const {tweetId}=req.params
    if(!tweetId){
        throw new ApiError(400,"Tweet id cant be fetched for params")
    }
    const tweet= await Tweet.findById(tweetId)

    const user = await User.findOne(req.user?._id)

    if (!user) {
        throw new ApiError(404, "User not found")
    }


    if (tweet?.owner.equals(user._id.toString())) {
        await Tweet.findByIdAndDelete(tweetId)
        return(
            res
            .status(200)
            .json(new ApiResponse(200,{},"Tweet deleted successfully"))
        )

    }

    else{
        throw new ApiError(401,"Only user can delete the tweet")
    }
});

export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet,
    getAllTweets,
    getAllUserFeedTweets,
    
}