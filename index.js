const express = require('express');
const app = express();
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 7000;
const { ObjectId } = require("mongodb"); // objectId import kora holo

// MiddleWare
app.use(cors());
app.use(express.json());



const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.s5ifh.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        // Send a ping to confirm a successful connection


        // crud operation is starts here
        const postCollection = client.db("forumsDB").collection("postItems");
        const commentCollection = client.db("forumsDB").collection("comments")

        //-----------------------------------------------------


        //  Like a post ---------------------------------
        app.patch("/posts/like/:id", async (req, res) => {
            const postId = new ObjectId(req.params.id);
            const { userEmail } = req.body;

            const post = await postCollection.findOne({ _id: postId });

            if (post.downVoters?.includes(userEmail)) {
                return res.json({ error: "Already disliked! Remove dislike first." });
            }

            const update = post.upVoters?.includes(userEmail)
                ? { $pull: { upVoters: userEmail }, $inc: { upVote: -1 } } // Remove like
                : { $addToSet: { upVoters: userEmail }, $inc: { upVote: 1 } }; // Add like

            await postCollection.updateOne({ _id: postId }, update);
            res.json({ success: true });
        });

        //  Dislike a post----------------------------------
        app.patch("/posts/dislike/:id", async (req, res) => {
            const postId = new ObjectId(req.params.id);
            const { userEmail } = req.body;

            const post = await postCollection.findOne({ _id: postId });

            if (post.upVoters?.includes(userEmail)) {
                return res.json({ error: "Already liked! Remove like first." });
            }

            const update = post.downVoters?.includes(userEmail)
                ? { $pull: { downVoters: userEmail }, $inc: { downVote: -1 } } // Remove dislike
                : { $addToSet: { downVoters: userEmail }, $inc: { downVote: 1 } }; // Add dislike

            await postCollection.updateOne({ _id: postId }, update);
            res.json({ success: true });
        });
        //-----------------------------------------------------



        //postCollection-------post-details------get
        app.get("/post-details/:id", async (req, res) => {
            const id = req.params.id;
            const post = await postCollection.findOne({ _id: new ObjectId(id) });
            res.json(post);
        });

        // API to add comment
        app.post("/post/comment/:id", async (req, res) => {
            try {
                const id = req.params.id;
                const { userId, userName, userImage, comment } = req.body;

                if (!userId || !comment) {
                    return res.status(400).json({ message: "User ID and comment are required." });
                }

                const result = await postCollection.updateOne(
                    { _id: new ObjectId(id) },
                    {
                        $push: {
                            comments: { userId, userName, userImage, comment, date: new Date() }
                        }
                    }
                );

                if (result.modifiedCount === 1) {
                    res.status(200).json({ message: "Comment added successfully." });
                } else {
                    res.status(500).json({ message: "Failed to add comment." });
                }
            } catch (error) {
                console.error("Error adding comment:", error);
                res.status(500).json({ message: "Internal server error." });
            }
        });


        //postCollection-----post count-----get
        app.get('/postCount/:email', async (req, res) => {
            const email = req.params.email;
            const filter = { authorEmail: email };
            const result = await postCollection.countDocuments(filter);
            res.send({ count: result })
        })
        // postCollection-----get all data------get
        app.get("/posts", async (req, res) => {
            const { sortBy } = req.query;
            let sortQuery = {};

            if (sortBy === "newest") {
                sortQuery = { createdAt: -1 };
            } else if (sortBy === "popularity") {
                sortQuery = { upVote: -1 };
            }

            try {
                const posts = await postCollection.find().sort(sortQuery).toArray();
                res.json(posts);
            } catch (error) {
                res.status(500).json({ error: "Failed to fetch posts" });
            }
        });


        //postCollection----add new post----post
        app.post('/addItems', async (req, res) => {
            const addItems = {
                ...req.body,
                upVoters: [],
                downVoters: []
            };
            const email = addItems.authorEmail;
            const postCount = await postCollection.countDocuments({ authorEmail: email });

            if (postCount >= 5) {
                return res.status(403).send({ message: "Post limit exceeded! Upgrade to a membership." });
            }

            const result = await postCollection.insertOne(addItems);
            res.send(result);
        })


        // postCollection--------my post----get
        app.get('/myPosts', async (req, res) => {
            const email = req.query.email;
            const query = { authorEmail: email };
            const result = await postCollection.find(query).toArray();
            res.send(result);
        });

        // postCollection--------my post----delete
        app.delete('/myPosts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await postCollection.deleteOne(query);
            console.log(query, result);
            res.send(result);
        })










        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);





app.get('/', (req, res) => {
    res.send('Assignment 12 is starting now the server')
})

app.listen(port, () => {
    console.log(`Assignment 12 is starting now the server`);
})