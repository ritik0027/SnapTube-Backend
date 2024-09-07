import { Router } from 'express';
import {
    createTweet,
    deleteTweet,
    getUserTweets,
    updateTweet,
    getAllUserFeedTweets,
    getAllTweets
} from "../controllers/tweet.controller.js"
import {verifyJWT} from "../middlewares/auth.middleware.js"
import { checkUser } from "../middlewares/openRouteAuth.middleware.js";

const router = Router();
router.use(verifyJWT); 

router.route("/feed").get(checkUser, getAllUserFeedTweets);
router.route("/").get(checkUser, getAllTweets)
router.route("/create-tweet").post(createTweet);
router.route("/user/:userId").get(getUserTweets);
router.route("/:tweetId").patch(updateTweet);
router.route("/:tweetId").delete(deleteTweet);

export default router