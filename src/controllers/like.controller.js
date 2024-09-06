import mongoose, {isValidObjectId} from "mongoose"
import {Like} from "../models/like.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import { User} from "../models/user.model.js"
import {Video} from "../models/video.model.js"
import {Comment} from "../models/comment.model.js"
import {Tweet} from "../models/tweet.model.js"


const toggleLike = asyncHandler(async (req, res) => {
    const { toggleLike, commentId, videoId, tweetId } = req.query;
  
    let reqLike;
  
    if (
      !isValidObjectId(commentId) &&
      !isValidObjectId(tweetId) &&
      !isValidObjectId(videoId)
    )
      throw new ApiError(400, "Invalid id");
  
    if (toggleLike === "true") reqLike = true;
    else if (toggleLike === "false") reqLike = false;
    else throw new ApiError(400, "Invalid query string!!!");
  
    let userLike;
  
    if (commentId) {
      const comment = await Comment.findById(commentId);
      if (!comment) throw new ApiError(400, "No comment found");
  
      userLike = await Like.find({
        comment: commentId,
        likedBy: req.user?._id,
      });
    } 
    else if (videoId) {
      const video = await Video.findById(videoId);
      if (!video) throw new ApiError(400, "No video found");
  
      userLike = await Like.find({
        video: videoId,
        likedBy: req.user?._id,
      });
    } 
    else if (tweetId) {
      const tweet = await Tweet.findById(tweetId);
      if (!tweet) throw new ApiError(400, "No tweet found");
  
      userLike = await Like.find({
        tweet: tweetId,
        likedBy: req.user?._id,
      });
    }
  
    let isLiked = false;
    let isDisLiked = false;
  
    if (userLike?.length > 0) {
      // entry is present so toggle status
      if (userLike[0].liked) {
        // like is present
        if (reqLike) {
          // toggle like so delete like
          await Like.findByIdAndDelete(userLike[0]._id);
          isLiked = false;
          isDisLiked = false;
        } 
        else {
          // toggle dis-like so make it dislike
          userLike[0].liked = false;
          let res = await userLike[0].save();
          if (!res) throw new ApiError(500, "error while updating like");
          isLiked = false;
          isDisLiked = true;
        }
      } 
      else {
        // dis-like is present
        if (reqLike) {
          // toggle like so make it like
          userLike[0].liked = true;
          let res = await userLike[0].save();
          if (!res) throw new ApiError(500, "error while updating like");
          isLiked = true;
          isDisLiked = false;
        } 
        else {
          // toggle dis-like so delete dis-like
          await Like.findByIdAndDelete(userLike[0]._id);
          isLiked = false;
          isDisLiked = false;
        }
      }
    } 
    else {
      // entry is not present so create new
      let like;
      if (commentId) {
        like = await Like.create({
          comment: commentId,
          likedBy: req.user?._id,
          liked: reqLike,
        });
      } 
      else if (videoId) {
        like = await Like.create({
          video: videoId,
          likedBy: req.user?._id,
          liked: reqLike,
        });
      } else if (tweetId) {
        like = await Like.create({
          tweet: tweetId,
          likedBy: req.user?._id,
          liked: reqLike,
        });
      }
      if (!like) throw new ApiError(500, "error while toggling like");
      isLiked = reqLike;
      isDisLiked = !reqLike;
    }
  
    let totalDisLikes, totalLikes;
  
    if (commentId) {
      totalLikes = await Like.find({ comment: commentId, liked: true });
      totalDisLikes = await Like.find({ comment: commentId, liked: false });
    } 
    else if (videoId) {
      totalLikes = await Like.find({ video: videoId, liked: true });
      totalDisLikes = await Like.find({ video: videoId, liked: false });
    } 
    else if (tweetId) {
      totalLikes = await Like.find({ tweet: tweetId, liked: true });
      totalDisLikes = await Like.find({ tweet: tweetId, liked: false });
    }
  
    return res.status(200).json(
      new ApiResponse(
        200,
        {
          isLiked,
          totalLikes: totalLikes.length,
          isDisLiked,
          totalDisLikes: totalDisLikes.length,
        },
        "Like toggled successfully"
      )
    );
});


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
    getLikedVideos,
    toggleLike
}