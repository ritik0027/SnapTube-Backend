import mongoose, { isValidObjectId } from "mongoose"
import { Comment } from "../models/comment.model.js"
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js"

const getVideoComments = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid VideoId");

    const options = {
        page,
        limit,
    };

    const video = await Video.findById(videoId);

    const allComments = await Comment.aggregate([
        {
            $match: {
                video: new mongoose.Types.ObjectId(videoId),
            },
        },
        // sort by date
        {
            $sort: {
                createdAt: -1,
            },
        },
        // fetch likes of Comment
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "comment",
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
                foreignField: "comment",
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
                            fullName: 1,
                            username: 1,
                            avatar: 1,
                            _id: 1,
                        },
                    },
                ],
            },
        },
        { $unwind: "$owner" },
        {
            $project: {
                content: 1,
                owner: 1,
                createdAt: 1,
                updatedAt: 1,
                isOwner: {
                    $cond: {
                        if: { $eq: [req.user?._id, "$owner._id"] },
                        then: true,
                        else: false,
                    },
                },
                likesCount: {
                    $size: "$likes",
                },
                disLikesCount: {
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
                isLikedByVideoOwner: {
                    $cond: {
                        if: {
                            $in: [video.owner, "$likes"],
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
        .json(new ApiResponse(200, allComments, "All comments Sent"));


    Comment.aggregatePaginate(allComments, options, function (err, results) {
        console.log("results", results);
        if (!err) {
            const {
                docs,
                totalDocs,
                limit,
                page,
                totalPages,
                pagingCounter,
                hasPrevPage,
                hasNextPage,
                prevPage,
                nextPage,
            } = results;

            return res.status(200).json(
                new ApiResponse(
                    200,
                    {
                        Comments: docs,
                        totalDocs,
                        limit,
                        page,
                        totalPages,
                        pagingCounter,
                        hasPrevPage,
                        hasNextPage,
                        prevPage,
                        nextPage,
                    },
                    "Comments fetched successfully"
                )
            );
        } else throw new ApiError(500, err.message);
    });
});



const addComment = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    if (!videoId) {
        throw new ApiError(400, "Invalid videoId")
    }


    const { content } = req.body
    if (!content) {
        throw new ApiError(400, "Content is required")
    }

    const user = await User.findOne({
        refreshToken: req.cookies.refreshToken,
    })
    if (!user) {
        throw new ApiError(404, "User not found")
    }
    const video = await Video.findById(videoId)

    if (!video) {
        throw new ApiError(400, "cannot find the video")
    }

    const comment = await Comment.create({
        content: content,
        owner: user._id,
        video: video._id
    })

    if (!comment) {
        throw new ApiError(500, "Error in creating the comment")
    }

    return (
        res
            .status(200)
            .json(new ApiResponse(200, comment, "Commented successfully"))
    )
});


const updateComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params
    if (!commentId) {
        throw new ApiError(400, "Cannot find comment id")
    }

    const comment = await Comment.findById(commentId)

    const user = await User.findOne({
        refreshToken: req.cookies.refreshToken,
    })

    if (!user) {
        throw new ApiError(404, "User not found")
    }

    if (comment?.owner.equals(user._id.toString())) {
        const { content } = req.body
        if (!content) {
            throw new ApiError(400, "Content is required")
        }

        comment.content = content
        await comment.save({ validateBeforeSave: false })

        return (
            res
                .status(200)
                .json(new ApiResponse(200, comment, "comment updated successfully"))
        )
    } else {
        throw new ApiError(400, "Only the owner can update the comment")
    }
});


const deleteComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params
    if (!commentId) {
        throw new ApiError(400, "comment Id cant be fetched from params")
    }

    const comment = await Comment.findById(commentId)
    if (!comment) {
        return (
            res
                .status(404)
                .json(new ApiResponse(404, {}, "Comment not found"))
        );
    }

    const user = await User.findOne({
        refreshToken: req.cookies.refreshToken,
    })
    if (!user) {
        throw new ApiError(404, "User not found")
    }


    if (comment?.owner.equals(user._id.toString())) {
        await Comment.findByIdAndDelete(commentId)
        return (
            res
                .status(200)
                .json(new ApiResponse(200, {}, "Comment deleted successfully"))
        )
    }
    else {
        throw new ApiError(401, "Only user can delete the comment")
    }
});


export {
    getVideoComments,
    addComment,
    updateComment,
    deleteComment
}