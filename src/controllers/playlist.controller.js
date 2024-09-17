import mongoose, {isValidObjectId} from "mongoose"
import {Playlist} from "../models/playlist.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import {User} from "../models/user.model.js"
import {Video} from "../models/video.model.js"


const createPlaylist = asyncHandler(async (req, res) => {
    const { name, description } = req.body;
  
    if (!name) throw new ApiError(400, "Name required");
  
    const playlist = await Playlist.create({
      name,
      description: description || "",
      owner: req.user?._id,
    });
  
    if (!playlist) throw new ApiError(500, "Error while creating Playlist");
  
    return res
      .status(200)
      .json(new ApiResponse(200, playlist, "Playlist Created Successfully"));
});


const getUserPlaylists = asyncHandler(async (req, res) => {
    const {userId} = req.params

    if(!isValidObjectId(userId)){
        throw new ApiError(400,"Invalid userId")
    }

    const user=await User.findById(req.user?._id)

    if(!user){
        throw new ApiError(400,"Could not find user")
    }

    const playlist=await Playlist.find(
        {
            owner:user._id
        }
    )
    
    return(
        res
        .status(200)
        .json(new ApiResponse(200,playlist,"Playlists fetched successfully"))
    )
});


const getPlaylistById = asyncHandler(async (req, res) => {
    const { playlistId } = req.params;
    if (!isValidObjectId(playlistId)) {
      throw new ApiError(400, "plese give valid playlist id");
    }
    const playlists = await Playlist.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(playlistId),
        },
      },
      {
        $lookup: {
          from: "videos",
          localField: "videos",
          foreignField: "_id",
          as: "videos",
          pipeline: [
            {
              $match: { isPublished: true },
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
              $addFields: {
                owner: {
                  $first: "$owner",
                },
              },
            },
          ],
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
        $addFields: {
          owner: {
            $first: "$owner",
          },
        },
      },
      {
        $project: {
          name: 1,
          description: 1,
          videos: 1,
          owner: 1,
          thumbnail: 1,
          videosCount: 1,
          createdAt: 1,
          updatedAt: 1,
          thumbnail: {
            $first: "$videos.thumbnail",
          },
          videosCount: {
            $size: "$videos",
          },
          totalViews: {
            $sum: "$videos.views",
          },
        },
      },
    ]);
  
    return res
      .status(200)
      .json(new ApiResponse(200, playlists[0], "Playlist sent successfully"));
  });

const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params
    if (!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist Id");
    }

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video Id")
    }
    
    const video=await Video.findById(videoId)

    if(!video){
        throw new ApiError(400,"Cannot find the video")
    }

    const playlist = await Playlist.findById(playlistId)

    if (playlist.videos.includes(videoId)) {
        throw new ApiError(400, "Video already exists in the playlist");
    }

    const updatedPlaylist=await Playlist.findByIdAndUpdate(
        playlistId,{
            $push:{
                videos:videoId
            }
        },
        {
            new:true
        }
    )

    return(
        res
        .status(200)
        .json(new ApiResponse(200,updatedPlaylist,"Video added to the playlist successfully"))
    )

});


const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params
    if (!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist Id");
    }

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video Id");
    }

    const video=await Video.findById(videoId)

    if(!video){
        throw new ApiError(400,"Video does not exist")
    }

    const playlist=await Playlist.findById(playlistId)
    if(!playlist){
        throw new ApiError(400,"Playlist does not exist")
    }

    console.log('Playlist found');


    if (!playlist.videos.includes(videoId)) {
        throw new ApiError(400, "Video is not in the playlist");
    }


    try {
        await Playlist.findByIdAndUpdate(
            playlistId,{
                $pull:{
                    videos:videoId
                }
            },
            {
                new:true
            }
        )


        return(
            res
            .status(200)
            .json(new ApiResponse(200,playlist,"Video removed successfully from the playlist"))
        )
    } 
    catch (error) {
        throw new ApiError("Something went wrong while removing the video from playlist")
    }

});


const deletePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    if (!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist Id");
    }
    
    const playlist = await Playlist.findByIdAndDelete(playlistId);
    
    if (!playlist) {
        throw new ApiError(500, "Something went wrong while deleting the playlist");
    }
    
   return(
    res
    .status(200)
    .json(new ApiResponse(200,playlist,"Playlist deleted successfully"))
   )

});


const updatePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    const {name, description} = req.body
    

    if(!isValidObjectId(playlistId)){
        throw new ApiError(400,"Cannot find playlist ID")
    }

    if(!name){
        throw new ApiError(400,"name is required")
    }

    if(!description){
        throw new ApiError(400,"description is required")
    }

    try {
        const playlist=await Playlist.findByIdAndUpdate(
            playlistId,
            {
                $set:{
                    name:name,
                    description:description
                }
            },{
                new:true
            }
        )
    
        if(!playlist){
            throw new ApiError(400,"Error while updating playlist")
        }
    

        return(
            res
            .status(200)
            .json(new ApiResponse(200,playlist,"Playlist name and description updated successfully "))
        )
    } 
    catch (error) {
        throw new ApiError(400,`Error while updating playlist ${error}`)
    }
});


const getVideoSavePlaylists = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
  
    if (!isValidObjectId(videoId))
      throw new ApiError(400, "Valid videoId required");
  
    const playlists = await Playlist.aggregate([
      {
        $match: {
          owner: new mongoose.Types.ObjectId(req.user?._id),
        },
      },
      {
        $project: {
          name: 1,
          isVideoPresent: {
            $cond: {
              if: { $in: [new mongoose.Types.ObjectId(videoId), "$videos"] },
              then: true,
              else: false,
            },
          },
        },
      },
    ]);
  
    return res
      .status(200)
      .json(new ApiResponse(200, playlists, "Playlists sent successfully"));
});


export {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylist,
    getVideoSavePlaylists
}