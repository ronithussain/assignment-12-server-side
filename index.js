const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken')
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
        const postsCollection = client.db("forumsDB").collection("postItems");
        const commentsCollection = client.db("forumsDB").collection("comments");
        const usersCollection = client.db("forumsDB").collection('users');
        //-----------------------------------------------------

        //__________________jwt starts here_________________
        //api/post 1:
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.send({ token });
        })
        //middlewares
        const verifyToken = (req, res, next) => {
            // console.log('inside verify token', req.headers.authorization)
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'Unauthorized access' });
            }
            const token = req.headers.authorization.split(' ')[1];
            
                jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                    if (err) {
                        return res.status(401).send({ message: 'Unauthorized access' })
                    }
                    req.decoded = decoded;
                    next();
                });
            
        };
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email; // decoded er moddhe je email chilo setake neya holo
            const query = {email: email}; // query diye present email k neya holo
            const user = await usersCollection.findOne(query); // userCollection e email take findOne kora hocche
            const isAdmin = user?.role === 'admin'; // check kora hocche user er role admin ki na?
            if(!isAdmin) { // jodi admin na hoy tahole 403 forbidden access return kore dibe
                return res.status(403).send({ message: 'forbidden access'})
            };
            next(); // jodi hoy tahole next e jete parbe!

        }
        //__________________jwt ends here___________________

        // UsersCollection starts here_________________________

        // userCollection--------user/admin/:email---or--not
        app.get('/users/admin/:email', verifyToken, async(req, res) => { // ekhane authProvider e je email ase seta req.body theke niye decoded er sathe present email ke check kora hocche je ai email er role ta admin ki na?
            const email = req.params.email;
            if(email !== req.decoded.email){
                return res.status(403).send({message: 'unauthorized access'})
            }

            const query = {email: email};
            const user = await usersCollection.findOne(query);
            let admin = false;
            if(user){
                admin = user?.role === 'admin'
            }
            res.send({admin});
        })
        // usersCollection-------subscription--------patch
        app.patch('/users/subscription/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    subscription: 'subscription'
                }
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        });
        // usersCollection-------admin-------patch
        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'admin'
                }
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        })
        // usersCollection--------------------deleted
        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await usersCollection.deleteOne(query);
            console.log(query, result);
            res.send(result);
        })
        // usersCollection--------search and get------get
        app.get('/users',verifyToken, async (req, res) => {
            const search = req.query.search || '';
            const query = search ? { name: { $regex: search, $options: 'i' } } : {};
            const result = await usersCollection.find(query).toArray();
            res.send(result);
        })
        // usersCollection---------------------get
        // app.get('/users',verifyToken, async(req, res) => {
        //     const result = await usersCollection.find().toArray();
        //     res.send(result);
        // })
        // usersCollection---------------------post
        app.post('/users', async (req, res) => {
            const user = req.body;
            // insert email if user dosent exists:
            // you can do this many ways (1. email unique, 2. upsert, 3.simple checking)
            const query = { email: user.email };
            const existingUser = await usersCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'user already exists', insertedId: null })
            };
            const result = await usersCollection.insertOne(user);
            res.send(result);
        })
        // UsersCollection ends here_________________________


        //  Like a post ---------------------------------
        app.patch("/posts/like/:id", async (req, res) => {
            const postId = new ObjectId(req.params.id);
            const { userEmail } = req.body;

            const post = await postsCollection.findOne({ _id: postId });

            if (post.downVoters?.includes(userEmail)) {
                return res.json({ error: "Already disliked! Remove dislike first." });
            }

            const update = post.upVoters?.includes(userEmail)
                ? { $pull: { upVoters: userEmail }, $inc: { upVote: -1 } } // Remove like
                : { $addToSet: { upVoters: userEmail }, $inc: { upVote: 1 } }; // Add like

            await postsCollection.updateOne({ _id: postId }, update);
            res.json({ success: true });
        });

        //  Dislike a post----------------------------------
        app.patch("/posts/dislike/:id", async (req, res) => {
            const postId = new ObjectId(req.params.id);
            const { userEmail } = req.body;

            const post = await postsCollection.findOne({ _id: postId });

            if (post.upVoters?.includes(userEmail)) {
                return res.json({ error: "Already liked! Remove like first." });
            }

            const update = post.downVoters?.includes(userEmail)
                ? { $pull: { downVoters: userEmail }, $inc: { downVote: -1 } } // Remove dislike
                : { $addToSet: { downVoters: userEmail }, $inc: { downVote: 1 } }; // Add dislike

            await postsCollection.updateOne({ _id: postId }, update);
            res.json({ success: true });
        });
        //-----------------------------------------------------



        //postCollection-------post-details------get
        app.get("/post-details/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const post = await postsCollection.findOne(query);
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

                const result = await postsCollection.updateOne(
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
            const result = await postsCollection.countDocuments(filter);
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
                const posts = await postsCollection.find().sort(sortQuery).toArray();
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
            const postCount = await postsCollection.countDocuments({ authorEmail: email });

            if (postCount >= 5) {
                return res.status(403).send({ message: "Post limit exceeded! Upgrade to a membership." });
            }

            const result = await postsCollection.insertOne(addItems);
            res.send(result);
        })


        // postCollection--------my post----get
        app.get('/myPosts', async (req, res) => {
            const email = req.query.email;
            const query = { authorEmail: email };
            const result = await postsCollection.find(query).toArray();
            res.send(result);
        });

        // postCollection--------my post----delete
        app.delete('/myPosts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await postsCollection.deleteOne(query);
            console.log(query, result);
            res.send(result);
        })

        // postCollection--------my post----viewComments
        app.get('/comments/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await postsCollection.find(query).toArray();
            console.log(result);
            res.send(result);
        });

        // 🟢 Get user profile data
        // app.get('/profile/:email', async (req, res) => {
        //     const email = req.params.email;
        //     const user = await usersCollection.findOne({ email }); // ✅ Fix: postsCollection -> usersCollection

        //     if (!user) return res.status(404).json({ message: "User not found" });

        //     const badges = user.isMember ? ["gold"] : ["bronze"];

        //     // Fetch recent posts
        //     const recentPosts = await postsCollection
        //         .find({ email })
        //         .sort({ createdAt: -1 })
        //         .limit(3)
        //         .toArray(); // ✅ Get last 3 posts

        //     res.json({
        //         name: user.name,
        //         email: user.email,
        //         image: user.image,
        //         badges,
        //         posts: recentPosts
        //     });
        // });







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