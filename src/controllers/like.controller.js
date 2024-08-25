import mongoose, {isValidObjectId} from "mongoose"
import {Like} from "../models/like.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import { User} from "../models/user.model.js"
import {Video} from "../models/video.model.js"
import {Comment} from "../models/comment.model.js"
import {Tweet} from "../models/tweet.model.js"

const toggleVideoLike = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    const user = await User.findOne({
        refreshToken: req.cookies.refreshToken,
    })

    if (!user) {
        throw new ApiError(404, "User not found")
    }

    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    const existingLike = await Like.findOne({ video: videoId, likedBy: user._id });

    if (existingLike) {
        await Like.findByIdAndDelete(existingLike._id);
        return (
            res
            .status(200)
            .json(new ApiResponse(200, {}, "Like removed successfully")));
    } 

    else {
        const newLike = await Like.create({ video: videoId, likedBy: user._id });
        return (
            res
            .status(200)
            .json(new ApiResponse(200, newLike, "Like added successfully")));
    }
});


const toggleCommentLike = asyncHandler(async (req, res) => {
    const { commentId } = req.params;

    const user = await User.findOne({
        refreshToken: req.cookies.refreshToken,
    })
    
    if (!user) {
        throw new ApiError(404, "User not found")
    }

    const comment = await Comment.findById(commentId);
    if (!comment) {
        throw new ApiError(404, "Comment not found");
    }

    const existingLike = await Like.findOne({ comment: commentId, likedBy: user._id });

    if (existingLike) {
        await Like.findByIdAndDelete(existingLike._id);

        return (
            res
            .status(200)
            .json(new ApiResponse(200, {}, "Like removed successfully")));
    } 
    
    else {
        const newLike = await Like.create({ comment: commentId, likedBy: user._id });

        return (
            res
            .status(200)
            .json(new ApiResponse(200, newLike, "Like added successfully")));
    }

});


const toggleTweetLike = asyncHandler(async (req, res) => {
    const {tweetId} = req.params
    const user = await User.findOne({
        refreshToken: req.cookies.refreshToken,
    })

    if (!user) {
        throw new ApiError(404, "User not found")
    }

    const tweet = await Tweet.findById(tweetId);
    if (!tweet) {
        throw new ApiError(404, "Tweet not found");
    }

    const existingLike = await Like.findOne({ tweet: tweetId, likedBy: user._id });

    if (existingLike) {
        await Like.findByIdAndDelete(existingLike._id);

        return (
            res
            .status(200)
            .json(new ApiResponse(200, {}, "Like removed successfully")));
    } 
    
    else {
        const newLike = await Like.create({ tweet: tweetId, likedBy: user._id });

        return (
            res
            .status(200)
            .json(new ApiResponse(200, newLike, "Like added successfully")));
    }
});


const getLikedVideos = asyncHandler(async (req, res) => {
    const user = await User.findOne({
        refreshToken: req.cookies.refreshToken,
    })

    if (!user) {
        throw new ApiError(404, "User not found")
    }

    const likes = await Like.find({ likedBy: user._id, video: { $exists: true } }).populate('video');

    if (!likes) {
        return res.status(200).json(new ApiResponse(200, [], "No liked videos found"));
    }

    const likedVideos = likes.map(like => like.video);

    return (
        res
        .status(200)
        .json(new ApiResponse(200, likedVideos, "Liked videos fetched successfully"))
        );
});

export {
    toggleCommentLike,
    toggleTweetLike,
    toggleVideoLike,
    getLikedVideos
}