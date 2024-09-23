import mongoose, {isValidObjectId} from "mongoose"
import {Video} from "../models/video.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { stopWords } from "../utils/helperData.js";

const publishAVideo = asyncHandler(async (req, res) => {
    const {title,description}=req.body 
    console.log(title);

    if (!title) {
        throw new ApiError(400,"title for a video is req")
    }


    const videoLocalPath = req.files?.videoFile[0].path
    if (!videoLocalPath) {
        throw new ApiError(400,"No video found")
    }
    
    const thumbnailLocalPath = req.files?.thumbnail[0].path
    if (!thumbnailLocalPath) {
        throw new ApiError(400,"No thumbnail found")
    }


    const videoFile=await uploadOnCloudinary(videoLocalPath)
    if (!videoFile) {
        throw new ApiError(400,"video not uploaded on cloudinary")
    }

    const thumbnail=await uploadOnCloudinary(thumbnailLocalPath)
    if (!thumbnail) {
        throw new ApiError(400,"thumbnail not uploaded on cloudinary")
    }

    console.log("Video and thumbnail uploaded on cloudinary");


    const user=await User.findById(req.user?._id)


    const video=await Video.create({
        videoFile:videoFile.secure_url,
        thumbnail:thumbnail.url,
        owner:user._id,
        title:title,
        description:description || "",
        duration:videoFile.duration
    })

    return (
        res
        .status(200)
        .json(new ApiResponse(200,video, "Video uploaded successfully"))
    )
});


const getAllVideos = asyncHandler(async (req, res) => {
  const { userId } = req.query;

  let filters = { isPublished: true };
  if (isValidObjectId(userId))
    filters.owner = new mongoose.Types.ObjectId(userId);

  let pipeline = [
    {
      $match: {
        ...filters,
      },
    },
  ];

  pipeline.push({
    $sort: {
      createdAt: -1,
    },
  });

  pipeline.push(
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
              fullName: 1,
              avatar: 1,
            },
          },
        ],
      },
    },
    {
      $unwind: "$owner",
    }
  );

  const allVideos = await Video.aggregate(Array.from(pipeline));

  return res
    .status(200)
    .json(new ApiResponse(200, allVideos, "all videos sent"));
});


const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid video id");
  }

  const video = await Video.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(videoId),
        isPublished: true,
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "video",
        as: "likes",
        pipeline: [
          {
            $match: {
              liked: true,
            },
          },
          {
            $group: {
              _id: "$liked",
              likeOwners: { $push: "$likedBy" },
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "video",
        as: "dislikes",
        pipeline: [
          {
            $match: {
              liked: false,
            },
          },
          {
            $group: {
              _id: "$liked",
              dislikeOwners: { $push: "$likedBy" },
            },
          },
        ],
      },
    },
    {
      $addFields: {
        likes: {
          $cond: {
            if: {
              $gt: [{ $size: "$likes" }, 0],
            },
            then: { $first: "$likes.likeOwners" },
            else: [],
          },
        },
        dislikes: {
          $cond: {
            if: {
              $gt: [{ $size: "$dislikes" }, 0],
            },
            then: { $first: "$dislikes.dislikeOwners" },
            else: [],
          },
        },
      },
    },
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
              fullName: 1,
              avatar: 1,
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
        _id: 1,
        videoFile: 1,
        title: 1,
        description: 1,
        duration: 1,
        thumbnail: 1,
        views: 1,
        owner: {
          username: 1,
          fullName: 1,
          avatar: 1,
        },
        createdAt: 1,
        updatedAt: 1,
        totalLikes: { $size: "$likes" },
        totalDisLikes: { $size: "$dislikes" },
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

  if (!video.length) throw new ApiError(404, "No video found");

  return res
    .status(200)
    .json(new ApiResponse(200, video[0], "Video sent successfully"));
});


const getUserChannelVideos = asyncHandler(async (req, res) => {
  const { username } = req.params; // Fetch username from the request params

  // Find the user by username
  const user = await User.findOne({ username });
  if (!user) {
    return res.status(404).json(new ApiResponse(404, null, "User not found"));
  }

  const allVideos = await Video.aggregate([
    {
      $match: {
        owner: new mongoose.Types.ObjectId(user._id), // Match videos by the user's _id
      },
    },
    {
      $sort: {
        createdAt: -1,
      },
    },
    // lookup for likes
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "video",
        as: "likes",
        pipeline: [
          {
            $match: {
              liked: true,
            },
          },
        ],
      },
    },
    // lookup for dislikes
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "video",
        as: "dislikes",
        pipeline: [
          {
            $match: {
              liked: false,
            },
          },
        ],
      },
    },
    // lookup for comments
    {
      $lookup: {
        from: "comments",
        localField: "_id",
        foreignField: "video",
        as: "comments",
      },
    },
    // lookup for owner information
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
              fullName: 1,
              avatar: 1,
            },
          },
        ],
      },
    },
    {
      $project: {
        title: 1,
        thumbnail: 1,
        isPublished: 1,
        duration: 1,
        description: 1,
        views: 1,
        owner: {
          username: 1,
          fullName: 1,
          avatar: 1,
        },
        createdAt: 1,
        updatedAt: 1,
        likesCount: {
          $size: "$likes",
        },
        dislikesCount: {
          $size: "$dislikes",
        },
        commentsCount: {
          $size: "$comments",
        },
      },
    },
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, allVideos, "All videos fetched successfully"));
});


const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    if (!videoId) {
        throw new ApiError(400, "videoId cant be fetched from params")
    }

    const video = await Video.findById(videoId)
    if (!video) {
        throw new ApiError(404, "Video not found")
    }

    const user = await User.findOne({
        refreshToken: req.cookies.refreshToken,
    })

    if (!user) {
        throw new ApiError(404, "User not found")
    }

    if (!video.owner.equals(user._id.toString())) {
        throw new ApiError(403, "Only the owner can update video details")
    }


    const { title, description } = req.body
    if (!title) {
        throw new ApiError(400, "Title is required")
    }
    if (!description) {
        throw new ApiError(400, "Description is required")
    }
    video.title = title
    video.description = description

    
    const newThumbnailLocalFilePath = req.file?.path
    if (!newThumbnailLocalFilePath) {
        throw new ApiError(400, "Thumbnail is not uploaded")
    }
    const thumbnail = await uploadOnCloudinary(newThumbnailLocalFilePath)
    if (!thumbnail) {
        throw new ApiError(500, "Failed to upload thumbnail to Cloudinary")
    }
    video.thumbnail = thumbnail.url

    // Save the changes
    await video.save();


    return res
    .status(200)
    .json(new ApiResponse(200, video, "Video details updated successfully"))
});


const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    if(!videoId){
        throw new ApiError(400,"videoId cant be fetched from params")
    }
    
    const video = await Video.findById(videoId)
    const user = await User.findOne({
        refreshToken: req.cookies.refreshToken,
    })
    if (!user) {
        throw new ApiError(404, "User not found")
    }


    //only the owner can delete the video
    if (video?.owner.equals(user._id.toString())) {
        await Video.findByIdAndDelete(videoId)
        return(
            res
            .status(200)
            .json(new ApiResponse(200,{},"Video deleted successfully"))
        )
    }else{
        throw new ApiError(401,"Only user can delete the video")
    }

});


const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params
    if(!videoId){
        throw new ApiError(400,"videoId cant be fetched from params")
    }

    const video = await Video.findById(videoId);
    if (!video) {
        throw new ApiError(404, "Video not found");
    }
    video.isPublished = !video.isPublished;

    await video.save({ validateBeforeSave: false })

    return(
        res
        .status(200)
        .json(new ApiResponse(200,video.isPublished,"Video publish toggled successfully"))
    )
});


const updateView = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    if (!isValidObjectId(videoId)) throw new APIError(400, "videoId required");
  
    const video = await Video.findById(videoId);
    if (!video) throw new ApiError(400, "Video not found");
  
    video.views += 1;
    const updatedVideo = await video.save();
    if (!updatedVideo) throw new ApiError(400, "Error occurred on updating view");
  
    let watchHistory;
    if (req.user) {
      watchHistory = await User.findByIdAndUpdate(
        req.user?._id,
        {
          $push: {
            watchHistory: new mongoose.Types.ObjectId(videoId),
          },
        },
        {
          new: true,
        }
      );
    }
  
    return res
      .status(200)
      .json(
        new ApiResponse(200,
          { isSuccess: true, views: updatedVideo.views, watchHistory },
          "Video views updated successfully"
        )
      );
});


const getAllVideosByOption = asyncHandler(async (req, res) => {
    const {
      page = 1,
      limit = 10,
      search = "",
      sortBy,
      sortType = "video",
      order,
      userId,
    } = req.query;
  
    // filter video by given filters
    let filters = { isPublished: true };
    if (isValidObjectId(userId))
      filters.owner = new mongoose.Types.ObjectId(userId);
  
    let pipeline = [
      {
        $match: {
          ...filters,
        },
      },
    ];
  
    const sort = {};
  
    // if query is given filter the videos
    if (search) {
      const queryWords = search
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ")
        .split(" ");
      const filteredWords = queryWords.filter(
        (word) => !stopWords.includes(word)
      );
  
      console.log("search: ", search);
      console.log("filteredWords: ", filteredWords);
  
      pipeline.push({
        $addFields: {
          titleMatchWordCount: {
            $size: {
              $filter: {
                input: filteredWords,
                as: "word",
                cond: {
                  $in: ["$$word", { $split: [{ $toLower: "$title" }, " "] }],
                },
              },
            },
          },
        },
      });
  
      pipeline.push({
        $addFields: {
          descriptionMatchWordCount: {
            $size: {
              $filter: {
                input: filteredWords,
                as: "word",
                cond: {
                  $in: [
                    "$$word",
                    { $split: [{ $toLower: "$description" }, " "] },
                  ],
                },
              },
            },
          },
        },
      });
  
      sort.titleMatchWordCount = -1;
    }
  
    // sort the documents
    if (sortBy) {
      sort[sortBy] = parseInt(order);
    } else if (!search && !sortBy) {
      sort["createdAt"] = -1;
    }
  
    pipeline.push({
      $sort: {
        ...sort,
      },
    });
  
    // fetch owner detail
    pipeline.push(
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
                fullName: 1,
                avatar: 1,
              },
            },
          ],
        },
      },
      {
        $unwind: "$owner",
      }
    );
  
    const videoAggregate = Video.aggregate(pipeline);
  
    const options = {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    };
  
    const allVideos = await Video.aggregatePaginate(videoAggregate, options);
  
    const { docs, ...pagingInfo } = allVideos;
  
    return res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { videos: docs, pagingInfo },
          "All Query Videos Sent Successfully"
        )
      );
});


export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus,
    updateView,
    getAllVideosByOption,
    getUserChannelVideos

}
