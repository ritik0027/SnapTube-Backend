import {Tweet} from "../models/tweet.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const createTweet = asyncHandler(async (req, res) => {
    const{ content }=req.body
    const user=await User.findById(req.user?._id)

    if(!content){
        throw new ApiError(400,"Content is required")
    }
    if(!user){
        throw new ApiError(400,"Cannot fetch user")
    }

    const tweet=await Tweet.create({
        owner: user._id,
        content:content
    })

    return(
        res
        .status(200)
        .json(new ApiResponse(200,tweet,"Tweet created successfully"))
    )
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

    const user = await User.findOne({
        refreshToken: req.cookies.refreshToken,
    })

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
    deleteTweet
}